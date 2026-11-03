use crate::{
    models::Track,
    services::ytdlp::YtDlp,
    utils::{Error, Result},
};
use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, Source};
use std::{
    io::{BufReader, Cursor},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
};
use tauri::{AppHandle, Emitter};

fn get_output_stream_handle() -> Result<&'static OutputStreamHandle> {
    static HANDLE: std::sync::OnceLock<&'static OutputStreamHandle> = std::sync::OnceLock::new();
    HANDLE.get_or_init(|| {
        let (stream, handle) = OutputStream::try_default().expect("Failed to create audio output stream");
        // Leak the stream so it lives for the program duration
        let _ = Box::leak(Box::new(stream));
        Box::leak(Box::new(handle))
    });
    Ok(HANDLE.get().unwrap())
}

pub struct AudioEngine {
    sink: Arc<tokio::sync::Mutex<Option<Sink>>>,
    current_track: Arc<tokio::sync::Mutex<Option<Track>>>,
    app_handle: Mutex<Option<AppHandle>>,
    volume: Mutex<f32>,
    play_request_id: AtomicU64,
}

impl AudioEngine {
    pub fn new() -> Self {
        Self {
            sink: Arc::new(tokio::sync::Mutex::new(None)),
            current_track: Arc::new(tokio::sync::Mutex::new(None)),
            app_handle: Mutex::new(None),
            volume: Mutex::new(0.8),
            play_request_id: AtomicU64::new(0),
        }
    }

    pub fn set_app_handle(&self, app: AppHandle) {
        *self.app_handle.lock().unwrap() = Some(app);
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
        let output_handle = get_output_stream_handle()?;
        let sink = Sink::try_new(output_handle).map_err(|error| Error::Audio(error.to_string()))?;
        sink.set_volume(*self.volume.lock().unwrap());

        let duration = match track.source.as_str() {
            "local" => {
                let file = std::fs::File::open(&track.source_id)?;
                let source = Decoder::new(BufReader::new(file))
                    .map_err(|error| Error::Audio(error.to_string()))?;
                let duration = source
                    .total_duration()
                    .map(|duration| duration.as_secs_f64())
                    .unwrap_or(track.duration.max(0) as f64);
                sink.append(source);
                duration
            }
            "youtube" => {
                let client = reqwest::Client::builder()
                    .connect_timeout(std::time::Duration::from_secs(15))
                    .timeout(std::time::Duration::from_secs(150))
                    .build()?;
                let mut downloaded_audio = None;
                let mut last_error = None;
                for attempt in 0..2 {
                    let result = async {
                        let url = YtDlp::get_stream_url(&app_handle, &track.source_id).await?;
                        Ok::<_, Error>(
                            client
                                .get(url)
                                .send()
                                .await?
                                .error_for_status()?
                                .bytes()
                                .await?,
                        )
                    }
                    .await;
                    match result {
                        Ok(bytes) => {
                            downloaded_audio = Some(bytes);
                            break;
                        }
                        Err(error) => {
                            last_error = Some(error);
                            if attempt == 0 {
                                tokio::time::sleep(std::time::Duration::from_millis(800)).await;
                            }
                        }
                    }
                }
                let bytes = downloaded_audio.ok_or_else(|| {
                    last_error.unwrap_or_else(|| Error::Audio("Audio download failed".into()))
                })?;
                let source = Decoder::new(Cursor::new(bytes))
                    .map_err(|error| Error::Audio(error.to_string()))?;
                let duration = source
                    .total_duration()
                    .map(|duration| duration.as_secs_f64())
                    .unwrap_or(track.duration.max(0) as f64);
                sink.append(source);
                duration
            }
            source => {
                return Err(Error::NotFound(format!(
                    "Unsupported audio source: {source}"
                )))
            }
        };

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
            sink.set_volume(*self.volume.lock().unwrap());
            *active_sink = Some(sink);
            *active_track = Some(track.clone());
        }
        let _ = app_handle.emit("track-changed", Some(track.clone()));

        let sink_clone = self.sink.clone();
        let current_track = self.current_track.clone();
        let track_id = track.id.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
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
                    let _ = app_handle.emit(
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
                    let _ = app_handle.emit("track-ended", ());
                    *current_track.lock().await = None;
                    break;
                }
            }
        });

        Ok(())
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
        let mut current_track = self.current_track.lock().await;
        *sink = None;
        *current_track = None;
        Ok(())
    }

    pub async fn seek(&self, position: f64) -> Result<()> {
        let position = std::time::Duration::try_from_secs_f64(position)
            .map_err(|error| Error::Config(format!("invalid seek position: {error}")))?;
        let sink = self.sink.lock().await;
        let sink = sink
            .as_ref()
            .ok_or_else(|| Error::Audio("No active track to seek".into()))?;
        sink.try_seek(position)
            .map_err(|error| Error::Audio(error.to_string()))?;
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