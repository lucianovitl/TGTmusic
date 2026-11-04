use crate::{
    models::Track,
    services::ytdlp::YtDlp,
    utils::{Error, Result},
};
use futures_util::StreamExt;
use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, Source};
use std::{
    io::BufReader,
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};
use tauri::{AppHandle, Emitter};
use tauri_plugin_store::StoreExt;
use tokio::{
    fs,
    io::AsyncWriteExt,
    sync::Mutex as TokioMutex,
};

fn get_output_stream_handle() -> Result<&'static OutputStreamHandle> {
    static HANDLE: std::sync::OnceLock<&'static OutputStreamHandle> = std::sync::OnceLock::new();
    HANDLE.get_or_init(|| {
        let (stream, handle) = OutputStream::try_default().expect("Failed to create audio output stream");
        let _ = Box::leak(Box::new(stream));
        Box::leak(Box::new(handle))
    });
    Ok(HANDLE.get().unwrap())
}

pub struct AudioEngine {
    sink: Arc<TokioMutex<Option<Sink>>>,
    next_sink: Arc<TokioMutex<Option<Sink>>>,
    current_track: Arc<TokioMutex<Option<Track>>>,
    app_handle: Mutex<Option<AppHandle>>,
    volume: Mutex<f32>,
    play_request_id: AtomicU64,
    crossfade_duration: Mutex<Duration>,
    crossfade_enabled: Mutex<bool>,
    cache_dir: Mutex<Option<PathBuf>>,
}

impl AudioEngine {
    pub fn new() -> Self {
        Self {
            sink: Arc::new(TokioMutex::new(None)),
            next_sink: Arc::new(TokioMutex::new(None)),
            current_track: Arc::new(TokioMutex::new(None)),
            app_handle: Mutex::new(None),
            volume: Mutex::new(0.8),
            play_request_id: AtomicU64::new(0),
            crossfade_duration: Mutex::new(Duration::from_secs(5)),
            crossfade_enabled: Mutex::new(true),
            cache_dir: Mutex::new(None),
        }
    }

    pub fn set_crossfade(&self, enabled: bool, duration_secs: u64) {
        *self.crossfade_enabled.lock().unwrap() = enabled;
        *self.crossfade_duration.lock().unwrap() = Duration::from_secs(duration_secs);
    }

    pub fn set_cache_dir(&self, dir: PathBuf) {
        *self.cache_dir.lock().unwrap() = Some(dir);
    }

    pub fn set_app_handle(&self, app: AppHandle) {
        *self.app_handle.lock().unwrap() = Some(app);
    }

    /// Get cross-source fallback setting
    fn get_cross_source_fallback(&self, app_handle: &AppHandle) -> bool {
        if let Ok(store) = app_handle.store("settings.dat") {
            store.get("cross_source_fallback").and_then(|v| v.as_bool()).unwrap_or(true)
        } else {
            true // default enabled
        }
    }

    /// Get download-then-play setting
    fn get_download_then_play(&self, app_handle: &AppHandle) -> bool {
        if let Ok(store) = app_handle.store("settings.dat") {
            store.get("download_then_play").and_then(|v| v.as_bool()).unwrap_or(false)
        } else {
            false // default disabled
        }
    }

    /// Get the cache directory, creating it if needed
    #[allow(dead_code)]
    async fn get_cache_dir(&self) -> Result<PathBuf> {
        if let Some(dir) = self.cache_dir.lock().unwrap().clone() {
            return Ok(dir);
        }

        // Default to app data directory
        let dir = dirs::data_dir()
            .ok_or_else(|| Error::Config("Could not determine data directory".into()))?
            .join("TGTmusic")
            .join("cache");

        fs::create_dir_all(&dir).await?;
        *self.cache_dir.lock().unwrap() = Some(dir.clone());
        Ok(dir)
    }

    /// Get cached file path for a track
    fn get_cache_path(&self, track: &Track) -> PathBuf {
        let cache_dir = self.cache_dir.lock().unwrap().clone()
            .unwrap_or_else(|| PathBuf::from("cache"));
        let ext = match track.source.as_str() {
            "youtube" => "m4a".to_string(),
            "soundcloud" => "m4a".to_string(),
            "bandcamp" => "m4a".to_string(),
            "internet_archive" => "m4a".to_string(),
            "jamendo" => "m4a".to_string(),
            "local" => {
                let path = PathBuf::from(&track.source_id);
                path.extension()
                    .and_then(|e| e.to_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| "mp3".to_string())
            }
            _ => "m4a".to_string(),
        };
        cache_dir.join(format!("{}-{}.{}", track.source, track.source_id, ext))
    }

    /// Get temp file path for streaming download
    fn get_temp_path(&self, track: &Track) -> PathBuf {
        let cache_dir = self.cache_dir.lock().unwrap().clone()
            .unwrap_or_else(|| PathBuf::from("cache"));
        cache_dir.join(format!("{}-{}.part", track.source, track.source_id))
    }

    /// Create a sink for a track with retry logic for stream URL expiration
    async fn create_sink_for_track(&self, track: &Track, app_handle: &AppHandle) -> Result<(Sink, f64, bool)> {
        let output_handle = get_output_stream_handle()?;
        let sink = Sink::try_new(output_handle)
            .map_err(|error| Error::Audio(format!("Failed to create audio sink: {}", error)))?;

        // Check cache first
        let cache_path = self.get_cache_path(track);
        let is_cached = cache_path.exists();

        let duration = if is_cached {
            // Play from cached file
            let file = fs::File::open(&cache_path).await
                .map_err(|error| Error::Audio(format!("Failed to open cached file: {}", error)))?;
            let std_file = file.into_std().await;
            let source = Decoder::new(BufReader::new(std_file))
                .map_err(|error| Error::Audio(format!("Failed to decode cached audio: {} (file: {})", error, cache_path.display())))?;
            let duration = source
                .total_duration()
                .map(|d| d.as_secs_f64())
                .unwrap_or(track.duration.max(0) as f64);
            sink.append(source);
            duration
        } else {
            // Download to temp file and play with retry
            self.download_and_play_with_retry(track, app_handle, &cache_path, &sink).await?
        };

        Ok((sink, duration, is_cached))
    }

    /// Create a sink with cross-source fallback support
    /// When playback fails on one source, tries to find and play the same track on other sources
    async fn create_sink_with_fallback(&self, track: &Track, app_handle: &AppHandle) -> Result<(Sink, f64, bool)> {
        // First try the original track
        match self.create_sink_for_track(track, app_handle).await {
            Ok(result) => return Ok(result),
            Err(e) => {
                eprintln!("[AudioEngine] Failed to play from {}: {}", track.source, e);

                // Check if cross-source fallback is enabled
                if !self.get_cross_source_fallback(app_handle) {
                    return Err(e);
                }

                // Try to find the same track on other sources
                eprintln!("[AudioEngine] Attempting cross-source fallback for: {} - {}", track.title, track.artists.join(", "));

                let query = format!("{} {}", track.title, track.artists.join(" "));
                let alternative_sources = ["soundcloud", "bandcamp", "internet_archive", "jamendo"];

                for source in alternative_sources {
                    if source == track.source {
                        continue; // Skip the source that already failed
                    }

                    eprintln!("[AudioEngine] Trying fallback source: {}", source);

                    // Search for the track on the alternative source
                    match crate::services::ytdlp::YtDlp::search(app_handle, &query, 5).await {
                        Ok(results) => {
                            // Find the best matching result
                            for result in results {
                                if result.source == source && result.source_type.is_playable() {
                                    // Create a new track with the alternative source
                                    let mut alt_track = track.clone();
                                    alt_track.source = source.to_string();
                                    alt_track.source_id = result.id.clone();
                                    alt_track.album_art = result.thumbnail.clone();
                                    alt_track.duration = result.duration as i64;
                                    alt_track.source_type = Some(result.source_type.label().to_string());

                                    eprintln!("[AudioEngine] Found fallback track on {}: {} ({})", source, result.title, result.channel);

                                    // Try to play the alternative track
                                    match self.create_sink_for_track(&alt_track, app_handle).await {
                                        Ok(result) => {
                                            eprintln!("[AudioEngine] Successfully playing from fallback source: {}", source);
                                            let _ = app_handle.emit("track-source-fallback", serde_json::json!({
                                                "original_source": track.source,
                                                "fallback_source": source,
                                                "title": alt_track.title
                                            }));
                                            return Ok(result);
                                        }
                                        Err(e) => {
                                            eprintln!("[AudioEngine] Fallback source {} also failed: {}", source, e);
                                            continue;
                                        }
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("[AudioEngine] Search on {} failed: {}", source, e);
                            continue;
                        }
                    }
                }

                // All fallback sources failed
                Err(Error::YtDlp(format!(
                    "Failed to play track from any source. Original error: {}",
                    e
                )))
            }
        }
    }

    /// Download track with streaming playback — starts playing after ~500KB buffered
    /// When download_then_play is enabled, fully downloads before starting playback
    async fn download_and_play_with_retry(
        &self,
        track: &Track,
        app_handle: &AppHandle,
        cache_path: &PathBuf,
        sink: &Sink,
    ) -> Result<f64> {
        const MAX_RETRIES: u32 = 3;
        const INITIAL_RETRY_DELAY: Duration = Duration::from_secs(2);
        const START_PLAYBACK_THRESHOLD: u64 = 500_000; // 500KB before starting playback

        // Check if download-then-play mode is enabled
        let download_then_play = self.get_download_then_play(app_handle);

        let mut last_error = None;

        for attempt in 0..MAX_RETRIES {
            // Get fresh stream URL on each attempt (handles expiration)
            let url = match YtDlp::get_stream_url(app_handle, &track.source_id, &track.source).await {
                Ok(u) => u,
                Err(e) => {
                    last_error = Some(e);
                    eprintln!("[AudioEngine] Attempt {}: Failed to get stream URL: {}", attempt + 1, last_error.as_ref().unwrap());
                    if attempt < MAX_RETRIES - 1 {
                        let delay = INITIAL_RETRY_DELAY * 2_u32.pow(attempt);
                        tokio::time::sleep(delay).await;
                        continue;
                    }
                    return Err(last_error.unwrap());
                }
            };

            // Create HTTP client with generous timeouts
            let client = reqwest::Client::builder()
                .connect_timeout(Duration::from_secs(20))
                .timeout(Duration::from_secs(300))
                .pool_idle_timeout(Duration::from_secs(30))
                .build()?;

            // Start the request
            let response = match client.get(&url).send().await {
                Ok(r) => r,
                Err(e) => {
                    last_error = Some(Error::YtDlp(format!("Stream request failed: {}", e)));
                    eprintln!("[AudioEngine] Attempt {}: Stream request error: {}", attempt + 1, last_error.as_ref().unwrap());
                    if attempt < MAX_RETRIES - 1 {
                        let delay = INITIAL_RETRY_DELAY * 2_u32.pow(attempt);
                        tokio::time::sleep(delay).await;
                        continue;
                    }
                    return Err(last_error.unwrap());
                }
            };

            // Extract headers before consuming response
            let status = response.status();
            let content_type: String = response.headers().get("content-type").map(|v| v.to_str().unwrap_or("")).unwrap_or("").to_string();
            eprintln!("[AudioEngine] Stream HTTP status: {}, content-type: {}", status, content_type);

            let response = match response.error_for_status() {
                Ok(r) => r,
                Err(e) => {
                    last_error = Some(Error::YtDlp(format!("Stream HTTP error: {}", e)));
                    eprintln!("[AudioEngine] Attempt {}: HTTP error: {} (status: {})", attempt + 1, e, status);
                    if attempt < MAX_RETRIES - 1 {
                        let delay = INITIAL_RETRY_DELAY * 2_u32.pow(attempt);
                        tokio::time::sleep(delay).await;
                        continue;
                    }
                    return Err(last_error.unwrap());
                }
            };

            // Create temp file for download
            let temp_path = self.get_temp_path(track);
            let mut temp_file = match fs::File::create(&temp_path).await {
                Ok(f) => f,
                Err(e) => {
                    last_error = Some(Error::Audio(format!("Failed to create temp file: {}", e)));
                    if attempt < MAX_RETRIES - 1 {
                        let delay = INITIAL_RETRY_DELAY * 2_u32.pow(attempt);
                        tokio::time::sleep(delay).await;
                        continue;
                    }
                    return Err(last_error.unwrap());
                }
            };

            if download_then_play {
                // Download-then-play mode: fully download first, then play
                eprintln!("[AudioEngine] Download-then-play mode: fully downloading before playback");

                let mut stream = response.bytes_stream();
                let mut _downloaded = 0u64;
                let mut download_error = false;

                while let Some(chunk_result) = stream.next().await {
                    match chunk_result {
                        Ok(chunk) => {
                            _downloaded += chunk.len() as u64;
                            if let Err(e) = temp_file.write_all(&chunk).await {
                                last_error = Some(Error::Audio(format!("Temp file write failed: {}", e)));
                                download_error = true;
                                break;
                            }
                            temp_file.flush().await?;
                        }
                        Err(e) => {
                            last_error = Some(Error::Audio(format!("Stream error: {}", e)));
                            download_error = true;
                            break;
                        }
                    }
                }

                if download_error {
                    let _ = fs::remove_file(&temp_path).await;
                    if attempt < MAX_RETRIES - 1 {
                        let delay = INITIAL_RETRY_DELAY * 2_u32.pow(attempt);
                        eprintln!("[AudioEngine] Attempt {} failed, retrying in {:?}", attempt + 1, delay);
                        tokio::time::sleep(delay).await;
                        continue;
                    }
                    return Err(last_error.unwrap());
                }

                // Download complete, now start playback
                temp_file.flush().await?;
                drop(temp_file);

                let file = match fs::File::open(&temp_path).await {
                    Ok(f) => f,
                    Err(e) => {
                        last_error = Some(Error::Audio(format!("Failed to open temp file: {}", e)));
                        if attempt < MAX_RETRIES - 1 {
                            let delay = INITIAL_RETRY_DELAY * 2_u32.pow(attempt);
                            tokio::time::sleep(delay).await;
                            continue;
                        }
                        return Err(last_error.unwrap());
                    }
                };
                let std_file = file.into_std().await;
                let source = match Decoder::new(BufReader::new(std_file)) {
                    Ok(s) => s,
                    Err(e) => {
                        let err_str = format!("Failed to decode audio: {} (content-type: {})", e, content_type);
                        last_error = Some(Error::Audio(err_str.clone()));
                        eprintln!("[AudioEngine] {}", err_str);
                        let _ = fs::remove_file(&temp_path).await;
                        if attempt < MAX_RETRIES - 1 {
                            let delay = INITIAL_RETRY_DELAY * 2_u32.pow(attempt);
                            tokio::time::sleep(delay).await;
                            continue;
                        }
                        return Err(last_error.unwrap());
                    }
                };

                let duration = source
                    .total_duration()
                    .map(|d| d.as_secs_f64())
                    .unwrap_or(track.duration.max(0) as f64);

                sink.append(source);
                sink.play();

                // Move to cache
                let cache_path_final = cache_path.clone();
                let app_handle_final = app_handle.clone();
                let track_id_final = track.source_id.clone();
                tokio::spawn(async move {
                    if let Err(e) = fs::rename(&temp_path, &cache_path_final).await {
                        eprintln!("[AudioEngine] Failed to move to cache: {}", e);
                    } else {
                        let _ = app_handle_final.emit("track-cached", track_id_final);
                    }
                });

                eprintln!("[AudioEngine] Playback started successfully on attempt {} (download-then-play)", attempt + 1);
                return Ok(duration);
            } else {
                // Streaming mode: start playback after 500KB buffered
                let mut stream = response.bytes_stream();
                let mut downloaded = 0u64;
                let mut playback_started = false;
                let mut download_error = false;

                while let Some(chunk_result) = stream.next().await {
                    match chunk_result {
                        Ok(chunk) => {
                            downloaded += chunk.len() as u64;
                            if let Err(e) = temp_file.write_all(&chunk).await {
                                last_error = Some(Error::Audio(format!("Temp file write failed: {}", e)));
                                download_error = true;
                                break;
                            }
                            temp_file.flush().await?;

                            // Start playback once we have enough buffered data
                            if !playback_started && downloaded >= START_PLAYBACK_THRESHOLD {
                                playback_started = true;
                                eprintln!("[AudioEngine] Starting playback at {} KB buffered", downloaded / 1024);

                                // Open the same file for reading (shared read access)
                                let playback_file = match fs::File::open(&temp_path).await {
                                    Ok(f) => f,
                                    Err(e) => {
                                        last_error = Some(Error::Audio(format!("Failed to open for playback: {}", e)));
                                        download_error = true;
                                        break;
                                    }
                                };
                                let std_file = playback_file.into_std().await;
                                let source = match Decoder::new(BufReader::new(std_file)) {
                                    Ok(s) => s,
                                    Err(e) => {
                                        let err_str = format!("Failed to decode audio: {} (content-type: {})", e, content_type);
                                        last_error = Some(Error::Audio(err_str.clone()));
                                        eprintln!("[AudioEngine] {}", err_str);
                                        download_error = true;
                                        break;
                                    }
                                };

                                let _duration = source
                                    .total_duration()
                                    .map(|d| d.as_secs_f64())
                                    .unwrap_or(track.duration.max(0) as f64);

                                sink.append(source);
                                sink.play(); // Ensure it starts playing
                            }
                        }
                        Err(e) => {
                            last_error = Some(Error::Audio(format!("Stream error: {}", e)));
                            download_error = true;
                            break;
                        }
                    }
                }

                if download_error {
                    let _ = fs::remove_file(&temp_path).await;
                    if attempt < MAX_RETRIES - 1 {
                        let delay = INITIAL_RETRY_DELAY * 2_u32.pow(attempt);
                        eprintln!("[AudioEngine] Attempt {} failed, retrying in {:?}", attempt + 1, delay);
                        tokio::time::sleep(delay).await;
                        continue;
                    }
                    return Err(last_error.unwrap());
                }

                // If playback never started (very short track), start it now
                if !playback_started {
                    temp_file.flush().await?;
                    drop(temp_file);

                    let file = match fs::File::open(&temp_path).await {
                        Ok(f) => f,
                        Err(e) => {
                            last_error = Some(Error::Audio(format!("Failed to open temp file: {}", e)));
                            if attempt < MAX_RETRIES - 1 {
                                let delay = INITIAL_RETRY_DELAY * 2_u32.pow(attempt);
                                tokio::time::sleep(delay).await;
                                continue;
                            }
                            return Err(last_error.unwrap());
                        }
                    };
                    let std_file = file.into_std().await;
                    let source = match Decoder::new(BufReader::new(std_file)) {
                        Ok(s) => s,
                        Err(e) => {
                            last_error = Some(Error::Audio(format!("Failed to decode audio: {}", e)));
                            let _ = fs::remove_file(&temp_path).await;
                            if attempt < MAX_RETRIES - 1 {
                                let delay = INITIAL_RETRY_DELAY * 2_u32.pow(attempt);
                                tokio::time::sleep(delay).await;
                                continue;
                            }
                            return Err(last_error.unwrap());
                        }
                    };

                    let duration = source
                        .total_duration()
                        .map(|d| d.as_secs_f64())
                        .unwrap_or(track.duration.max(0) as f64);

                    sink.append(source);
                    sink.play();

                    // Move to cache
                    let cache_path_final = cache_path.clone();
                    let app_handle_final = app_handle.clone();
                    let track_id_final = track.source_id.clone();
                    tokio::spawn(async move {
                        if let Err(e) = fs::rename(&temp_path, &cache_path_final).await {
                            eprintln!("[AudioEngine] Failed to move to cache: {}", e);
                        } else {
                            let _ = app_handle_final.emit("track-cached", track_id_final);
                        }
                    });

                    eprintln!("[AudioEngine] Playback started successfully on attempt {}", attempt + 1);
                    return Ok(duration);
                } else {
                    // Playback already started, get duration from sink
                    let duration = track.duration.max(0) as f64;

                    // Wait for download to fully complete, then move to cache
                    temp_file.flush().await?;
                    drop(temp_file);

                    let cache_path_final = cache_path.clone();
                    let app_handle_final = app_handle.clone();
                    let track_id_final = track.source_id.clone();
                    tokio::spawn(async move {
                        if let Err(e) = fs::rename(&temp_path, &cache_path_final).await {
                            eprintln!("[AudioEngine] Failed to move to cache: {}", e);
                        } else {
                            let _ = app_handle_final.emit("track-cached", track_id_final);
                        }
                    });

                    eprintln!("[AudioEngine] Playback started successfully on attempt {} (streaming)", attempt + 1);
                    return Ok(duration);
                }
            }
        }

        Err(last_error.unwrap_or_else(|| Error::Audio("Max retries exceeded".into())))
    }

    #[allow(dead_code)]
    async fn crossfade(&self, _app_handle: AppHandle, old_sink: Sink, new_sink: Sink, duration: Duration, target_volume: f32) {
        let steps = 50;
        let step_duration = duration / steps;
        let _volume_step = target_volume / steps as f32;

        for i in 0..=steps {
            tokio::time::sleep(step_duration).await;
            let progress = i as f32 / steps as f32;
            let new_vol = target_volume * progress;
            let old_vol = target_volume * (1.0 - progress);

            new_sink.set_volume(new_vol);
            old_sink.set_volume(old_vol);
        }
    }

    pub async fn play(&self, mut track: Track) -> Result<()> {
        let request_id = self
            .play_request_id
            .fetch_add(1, Ordering::Relaxed)
            .wrapping_add(1);
        let app_handle = self
            .app_handle
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| Error::Config("Audio engine is not initialized".into()))?;

        let crossfade_enabled = *self.crossfade_enabled.lock().unwrap();
        let crossfade_duration = *self.crossfade_duration.lock().unwrap();
        let target_volume = *self.volume.lock().unwrap();

        let has_current_track = self.current_track.lock().await.is_some();

        if crossfade_enabled && has_current_track {
            // Crossfade mode
            match self.create_sink_with_fallback(&track, &app_handle).await {
                Ok((new_sink, duration, _)) => {
                    new_sink.set_volume(0.0);

                    let old_sink = {
                        let mut sink_guard = self.sink.lock().await;
                        sink_guard.take()
                    };

                    if let Some(old_sink) = old_sink {
                        *self.next_sink.lock().await = Some(new_sink);
                        old_sink.set_volume(target_volume);
                        if let Some(ref new_sink) = *self.next_sink.lock().await {
                            new_sink.play();
                        }

                        let _app_handle_clone = app_handle.clone();
                        let old_sink_clone = old_sink;
                        let next_sink_clone = self.next_sink.clone();
                        let sink_clone = self.sink.clone();
                        let crossfade_duration_clone = crossfade_duration;
                        let target_volume_clone = target_volume;

                        tokio::spawn(async move {
                            let steps = 50;
                            let step_duration = crossfade_duration_clone / steps;

                            for i in 0..=steps {
                                tokio::time::sleep(step_duration).await;
                                let progress = i as f32 / steps as f32;
                                let new_vol = target_volume_clone * progress;
                                let old_vol = target_volume_clone * (1.0 - progress);

                                if let Some(ref new_sink) = *next_sink_clone.lock().await {
                                    new_sink.set_volume(new_vol);
                                }
                                old_sink_clone.set_volume(old_vol);
                            }

                            let new_sink = {
                                let mut next_sink_guard = next_sink_clone.lock().await;
                                next_sink_guard.take()
                            };

                            if let Some(new_sink) = new_sink {
                                new_sink.set_volume(target_volume_clone);
                                *sink_clone.lock().await = Some(new_sink);
                            }
                        });
                    }

                    track.duration = duration.round() as i64;
                    if self.play_request_id.load(Ordering::Relaxed) != request_id {
                        return Ok(());
                    }
                    {
                        let mut active_track = self.current_track.lock().await;
                        *active_track = Some(track.clone());
                    }
                    let _ = app_handle.emit("track-changed", Some(track.clone()));

                    self.start_monitoring(app_handle, track).await;
                    Ok(())
                }
                Err(e) => {
                    let _ = app_handle.emit("playback-error", format!("{}: {}", track.title, e));
                    Err(e)
                }
            }
        } else {
            // Simple play mode
            match self.create_sink_with_fallback(&track, &app_handle).await {
                Ok((sink, duration, _)) => {
                    sink.set_volume(target_volume);

                    track.duration = duration.round() as i64;
                    if self.play_request_id.load(Ordering::Relaxed) != request_id {
                        return Ok(());
                    }
                    {
                        let mut active_sink = self.sink.lock().await;
                        let mut active_track = self.current_track.lock().await;
                        if self.play_request_id.load(Ordering::Relaxed) != request_id {
                            return Ok(());
                        }
                        *active_sink = Some(sink);
                        *active_track = Some(track.clone());
                    }
                    let _ = app_handle.emit("track-changed", Some(track.clone()));

                    self.start_monitoring(app_handle, track).await;
                    Ok(())
                }
                Err(e) => {
                    let _ = app_handle.emit("playback-error", format!("{}: {}", track.title, e));
                    Err(e)
                }
            }
        }
    }

    async fn start_monitoring(&self, app_handle: AppHandle, track: Track) {
        let sink_clone = self.sink.clone();
        let current_track = self.current_track.clone();
        let track_id = track.id.clone();
        let app_handle_clone = app_handle.clone();
        let duration = track.duration as f64;

        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_millis(500)).await;
                let is_current = current_track
                    .lock()
                    .await
                    .as_ref()
                    .is_some_and(|current| current.id == track_id);
                if !is_current {
                    break;
                }

                let sink_guard = sink_clone.lock().await;
                if let Some(active_sink) = sink_guard.as_ref() {
                    let _ = app_handle_clone.emit(
                        "playback-update",
                        serde_json::json!({
                            "position": active_sink.get_pos().as_secs_f64(),
                            "duration": duration,
                            "playing": !active_sink.is_paused()
                        }),
                    );
                }
                let finished = sink_guard
                    .as_ref()
                    .map_or(true, |active_sink| active_sink.empty());
                drop(sink_guard);

                if finished {
                    let _ = app_handle_clone.emit("track-ended", ());
                    *current_track.lock().await = None;
                    break;
                }
            }
        });
    }

    pub async fn pause(&self) -> Result<()> {
        let sink = self.sink.lock().await;
        let sink = sink
            .as_ref()
            .ok_or_else(|| Error::Audio("No active track to pause".into()))?;
        sink.pause();
        Ok(())
    }

    pub async fn resume(&self) -> Result<()> {
        let sink = self.sink.lock().await;
        let sink = sink
            .as_ref()
            .ok_or_else(|| Error::Audio("No active track to resume".into()))?;
        sink.play();
        Ok(())
    }

    pub async fn stop(&self) -> Result<()> {
        self.play_request_id.fetch_add(1, Ordering::Relaxed);
        let mut sink = self.sink.lock().await;
        let mut next_sink = self.next_sink.lock().await;
        let mut current_track = self.current_track.lock().await;
        *sink = None;
        *next_sink = None;
        *current_track = None;
        Ok(())
    }

    pub async fn seek(&self, position: f64) -> Result<()> {
        let position = Duration::try_from_secs_f64(position)
            .map_err(|error| Error::Config(format!("invalid seek position: {error}")))?;
        let sink = self.sink.lock().await;
        let sink = sink
            .as_ref()
            .ok_or_else(|| Error::Audio("No active track to seek".into()))?;
        sink.try_seek(position)
            .map_err(|error| Error::Audio(format!("Failed to seek: {}", error)))?;
        Ok(())
    }

    pub async fn set_volume(&self, volume: f32) -> Result<()> {
        let volume = volume.clamp(0.0, 1.0);
        *self.volume.lock().unwrap() = volume;
        if let Some(sink) = self.sink.lock().await.as_ref() {
            sink.set_volume(volume);
        }
        Ok(())
    }
}

pub static ENGINE: std::sync::LazyLock<AudioEngine> = std::sync::LazyLock::new(AudioEngine::new);