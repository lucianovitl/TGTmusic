use crate::utils::{Error, Result};
use std::{path::PathBuf, process::Output, time::Duration};
use tauri::Manager;
use tauri_plugin_store::StoreExt;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VideoInfo {
    pub id: String,
    pub title: String,
    pub channel: String,
    pub channel_id: String,
    pub duration: u64,
    pub thumbnail: String,
    pub view_count: Option<u64>,
    pub age_limit: u8,
    pub is_live: bool,
    pub availability: String,
    pub source_type: SourceType,
    pub source: String, // "youtube", "soundcloud", "bandcamp", "internet_archive", "jamendo"
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum SourceType {
    Official,
    LyricVideo,
    Cover,
    Audio,
    Live,
    Other,
}

impl SourceType {
    pub fn from_title_channel(title: &str, channel: &str) -> Self {
        let title_lower = title.to_lowercase();
        let channel_lower = channel.to_lowercase();

        // Official channel patterns
        if channel_lower.contains("official")
            || channel_lower.contains("vevo")
            || channel_lower.ends_with(" - topic")
            || (channel_lower.contains("music") && channel_lower.contains("records")) {
            return SourceType::Official;
        }

        // Lyric video patterns
        if title_lower.contains("lyric")
            || title_lower.contains("letra")
            || title_lower.contains("lyrics") {
            return SourceType::LyricVideo;
        }

        // Cover patterns
        if title_lower.contains("cover")
            || title_lower.contains("acoustic")
            || title_lower.contains("piano")
            || title_lower.contains("karaoke")
            || title_lower.contains("instrumental") {
            return SourceType::Cover;
        }

        // Audio only patterns
        if title_lower.contains("audio")
            || title_lower.contains("official audio")
            || title_lower.contains("somente audio")
            || title_lower.contains("apenas audio") {
            return SourceType::Audio;
        }

        // Live patterns
        if title_lower.contains("live")
            || title_lower.contains("ao vivo")
            || title_lower.contains("concert") {
            return SourceType::Live;
        }

        SourceType::Other
    }

    pub fn label(&self) -> &'static str {
        match self {
            SourceType::Official => "Oficial",
            SourceType::LyricVideo => "Lyric Video",
            SourceType::Cover => "Cover",
            SourceType::Audio => "Áudio Oficial",
            SourceType::Live => "Ao Vivo",
            SourceType::Other => "Outro",
        }
    }

    pub fn is_playable(&self) -> bool {
        !matches!(self, SourceType::Live)
    }

    pub fn priority(&self) -> u8 {
        match self {
            SourceType::Official => 1,
            SourceType::Audio => 2,
            SourceType::LyricVideo => 3,
            SourceType::Cover => 4,
            SourceType::Other => 5,
            SourceType::Live => 6,
        }
    }
}

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub struct YtDlp;

impl YtDlp {
    /// Get cookie file path from settings (for age-restricted/region-locked content)
    pub fn get_cookie_file(app: Option<&tauri::AppHandle>) -> Option<PathBuf> {
        if let Some(app) = app {
            if let Ok(store) = app.store("settings.dat") {
                if let Some(cookie_path) = store
                    .get("ytdlp_cookies")
                    .and_then(|value| value.as_str().map(PathBuf::from))
                {
                    if cookie_path.is_file() {
                        eprintln!("[YtDlp] Using cookie file: {}", cookie_path.display());
                        return Some(cookie_path);
                    }
                }
            }
        }
        None
    }

    /// Get proxy URL from settings
    pub fn get_proxy(app: Option<&tauri::AppHandle>) -> Option<String> {
        if let Some(app) = app {
            if let Ok(store) = app.store("settings.dat") {
                if let Some(proxy) = store.get("ytdlp_proxy").and_then(|v| v.as_str().map(|s| s.to_string())) {
                    if !proxy.trim().is_empty() {
                        eprintln!("[YtDlp] Using proxy: {}", proxy);
                        return Some(proxy);
                    }
                }
            }
        }
        None
    }

    /// Get Invidious instance URL from settings
    pub fn get_invidious_instance(app: Option<&tauri::AppHandle>) -> Option<String> {
        if let Some(app) = app {
            if let Ok(store) = app.store("settings.dat") {
                if let Some(instance) = store.get("ytdlp_invidious").and_then(|v| v.as_str().map(|s| s.to_string())) {
                    if !instance.trim().is_empty() {
                        eprintln!("[YtDlp] Using Invidious instance: {}", instance);
                        return Some(instance);
                    }
                }
            }
        }
        None
    }

    /// Get random User-Agent for YouTube requests
    pub fn get_random_user_agent() -> &'static str {
        const USER_AGENTS: &[&str] = &[
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
            "Mozilla/5.0 (Linux; Android 12; TV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "com.google.android.youtube/18.45.40 (Linux; U; Android 13) gzip",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
        ];
        use std::sync::atomic::{AtomicUsize, Ordering};
        static COUNTER: AtomicUsize = AtomicUsize::new(0);
        let idx = COUNTER.fetch_add(1, Ordering::Relaxed) % USER_AGENTS.len();
        USER_AGENTS[idx]
    }

    /// Auto-update yt-dlp to latest version from GitHub releases
    pub async fn auto_update(app: &tauri::AppHandle) -> Result<bool> {
        let binary = Self::find_sidecar(Some(app));

        // Check if we're using a bundled binary (not system PATH)
        let is_bundled = binary.to_string_lossy().contains("TGTmusic")
            || binary.to_string_lossy().contains("resources")
            || binary.to_string_lossy().contains("sidecar");

        if !is_bundled {
            eprintln!("[YtDlp] Using system yt-dlp, skipping auto-update");
            return Ok(false);
        }

        eprintln!("[YtDlp] Checking for yt-dlp updates...");

        // Get latest version from GitHub API
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()?;

        let latest_url = "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest";
        let response = match client.get(latest_url)
            .header("User-Agent", "TGTmusic")
            .send()
            .await {
                Ok(r) => r,
                Err(e) => {
                    eprintln!("[YtDlp] Failed to check updates: {}", e);
                    return Ok(false);
                }
            };

        if !response.status().is_success() {
            eprintln!("[YtDlp] GitHub API error: {}", response.status());
            return Ok(false);
        }

        let json: serde_json::Value = match response.json().await {
            Ok(j) => j,
            Err(e) => {
                eprintln!("[YtDlp] Failed to parse update response: {}", e);
                return Ok(false);
            }
        };

        let latest_version = json.get("tag_name")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        // Get current version
        let current_version = match Self::verify_binary(app).await {
            Ok(v) => v,
            Err(e) => {
                eprintln!("[YtDlp] Failed to get current version: {}", e);
                return Ok(false);
            }
        };

        if latest_version.is_empty() || latest_version == current_version {
            eprintln!("[YtDlp] Already at latest version: {}", current_version);
            return Ok(false);
        }

        eprintln!("[YtDlp] Updating from {} to {}", current_version, latest_version);

        // Find the Windows asset
        let empty_vec = vec![];
        let assets = json.get("assets").and_then(|a| a.as_array()).unwrap_or(&empty_vec);
        let asset = assets.iter().find(|a| {
            a.get("name").and_then(|n| n.as_str())
                .map(|n| n.contains("yt-dlp_x86_64") || n.contains("yt-dlp.exe"))
                .unwrap_or(false)
        });

        let download_url = asset
            .and_then(|a| a.get("browser_download_url"))
            .and_then(|u| u.as_str());

        let Some(download_url) = download_url else {
            eprintln!("[YtDlp] No suitable asset found for update");
            return Ok(false);
        };

        // Download new binary
        let download_response = match client.get(download_url).send().await {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[YtDlp] Download failed: {}", e);
                return Ok(false);
            }
        };

        if !download_response.status().is_success() {
            eprintln!("[YtDlp] Download failed: {}", download_response.status());
            return Ok(false);
        }

        let bytes = match download_response.bytes().await {
            Ok(b) => b,
            Err(e) => {
                eprintln!("[YtDlp] Failed to read download: {}", e);
                return Ok(false);
            }
        };

        // Write to binary location (backup first)
        let backup_path = binary.with_extension("exe.bak");
        let _ = std::fs::copy(&binary, &backup_path);

        match std::fs::write(&binary, &bytes) {
            Ok(_) => {
                eprintln!("[YtDlp] Updated successfully to {}", latest_version);
                // Make executable on Unix
                #[cfg(not(windows))]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let mut perms = std::fs::metadata(&binary)?.permissions();
                    perms.set_mode(0o755);
                    std::fs::set_permissions(&binary, perms)?;
                }
                Ok(true)
            }
            Err(e) => {
                // Restore backup on failure
                let _ = std::fs::copy(&backup_path, &binary);
                eprintln!("[YtDlp] Update failed, restored backup: {}", e);
                Ok(false)
            }
        }
    }

    /// Force update yt-dlp regardless of version (for troubleshooting)
    pub async fn force_update(app: &tauri::AppHandle) -> Result<bool> {
        let binary = Self::find_sidecar(Some(app));

        let is_bundled = binary.to_string_lossy().contains("TGTmusic")
            || binary.to_string_lossy().contains("resources")
            || binary.to_string_lossy().contains("sidecar");

        if !is_bundled {
            return Err(Error::YtDlp("Cannot force update system yt-dlp".into()));
        }

        eprintln!("[YtDlp] Force updating yt-dlp...");

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()?;

        let latest_url = "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest";
        let response = match client.get(latest_url)
            .header("User-Agent", "TGTmusic")
            .send()
            .await {
                Ok(r) => r,
                Err(e) => return Err(Error::YtDlp(format!("Failed to check updates: {}", e))),
            };

        if !response.status().is_success() {
            return Err(Error::YtDlp(format!("GitHub API error: {}", response.status())));
        }

        let json: serde_json::Value = match response.json().await {
            Ok(j) => j,
            Err(e) => return Err(Error::YtDlp(format!("Failed to parse update response: {}", e))),
        };

        let latest_version = json.get("tag_name")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let empty_vec = vec![];
        let assets = json.get("assets").and_then(|a| a.as_array()).unwrap_or(&empty_vec);
        let asset = assets.iter().find(|a| {
            a.get("name").and_then(|n| n.as_str())
                .map(|n| n.contains("yt-dlp_x86_64") || n.contains("yt-dlp.exe"))
                .unwrap_or(false)
        });

        let download_url = asset
            .and_then(|a| a.get("browser_download_url"))
            .and_then(|u| u.as_str());

        let Some(download_url) = download_url else {
            return Err(Error::YtDlp("No suitable asset found for update".into()));
        };

        let download_response = match client.get(download_url).send().await {
            Ok(r) => r,
            Err(e) => return Err(Error::YtDlp(format!("Download failed: {}", e))),
        };

        if !download_response.status().is_success() {
            return Err(Error::YtDlp(format!("Download failed: {}", download_response.status())));
        }

        let bytes = match download_response.bytes().await {
            Ok(b) => b,
            Err(e) => return Err(Error::YtDlp(format!("Failed to read download: {}", e))),
        };

        let backup_path = binary.with_extension("exe.bak");
        let _ = std::fs::copy(&binary, &backup_path);

        match std::fs::write(&binary, &bytes) {
            Ok(_) => {
                eprintln!("[YtDlp] Force updated successfully to {}", latest_version);
                #[cfg(not(windows))]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let mut perms = std::fs::metadata(&binary)?.permissions();
                    perms.set_mode(0o755);
                    std::fs::set_permissions(&binary, perms)?;
                }
                Ok(true)
            }
            Err(e) => {
                let _ = std::fs::copy(&backup_path, &binary);
                Err(Error::YtDlp(format!("Force update failed: {}", e)))
            }
        }
    }

    /// Find yt-dlp binary with comprehensive search
    /// Returns path and logs which one was found
    pub fn find_sidecar(app: Option<&tauri::AppHandle>) -> PathBuf {
        let binary_name = if cfg!(windows) {
            "yt-dlp.exe"
        } else {
            "yt-dlp"
        };
        let mut candidates = Vec::new();

        // 1. Configured path from settings
        if let Some(app) = app {
            if let Ok(store) = app.store("settings.dat") {
                if let Some(configured_path) = store
                    .get("ytdlp_path")
                    .and_then(|value| value.as_str().map(PathBuf::from))
                {
                    candidates.push(configured_path);
                }
            }

            // 2. Tauri resource dir (bundled with app)
            if let Ok(resource_dir) = app.path().resource_dir() {
                candidates.extend([
                    resource_dir.join(binary_name),
                    resource_dir.join("yt-dlp-x86_64-pc-windows-msvc.exe"),
                    resource_dir.join("sidecar").join(binary_name),
                    resource_dir.join("binaries/yt-dlp-x86_64-pc-windows-msvc.exe"),
                ]);
            }
        }

        // 3. Executable directory (dev mode)
        if let Ok(executable) = std::env::current_exe() {
            if let Some(executable_dir) = executable.parent() {
                candidates.push(executable_dir.join(binary_name));
                candidates.push(executable_dir.join("resources").join(binary_name));
            }
        }

        // 4. Common install locations
        if let Ok(program_files) = std::env::var("PROGRAMFILES") {
            candidates.push(PathBuf::from(program_files).join("TGTmusic").join(binary_name));
        }
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            candidates.push(PathBuf::from(local_app_data).join("TGTmusic").join(binary_name));
        }

        // 5. PATH fallback (last resort)
        candidates.push(PathBuf::from(binary_name));

        // Find first existing
        let found = candidates
            .into_iter()
            .find(|candidate| candidate.is_file());

        if let Some(path) = found {
            eprintln!("[YtDlp] Using binary: {}", path.display());
            path
        } else {
            eprintln!("[YtDlp] WARNING: Binary not found in any location, using PATH fallback: {}", binary_name);
            PathBuf::from(binary_name)
        }
    }

    /// Verify yt-dlp binary works and get version
    pub async fn verify_binary(app: &tauri::AppHandle) -> Result<String> {
        let binary = Self::find_sidecar(Some(app));
        let mut command = tokio::process::Command::new(&binary);
        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);
        command.arg("--version");

        let output = tokio::time::timeout(Duration::from_secs(10), command.output())
            .await
            .map_err(|_| Error::YtDlp("yt-dlp version check timed out".into()))?
            .map_err(Error::from)?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            return Err(Error::YtDlp(format!("yt-dlp binary verification failed: {}", err)));
        }

        let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
        eprintln!("[YtDlp] Verified version: {}", version);
        Ok(version)
    }

    async fn run_command(
        mut command: tokio::process::Command,
        timeout_secs: u64,
    ) -> Result<Output> {
        command.kill_on_drop(true);
        tokio::time::timeout(Duration::from_secs(timeout_secs), command.output())
            .await
            .map_err(|_| Error::YtDlp(format!("yt-dlp timed out after {timeout_secs} seconds")))?
            .map_err(Error::from)
    }

    fn command_error(output: &Output) -> Error {
        let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if message.is_empty() {
            Error::YtDlp(format!("yt-dlp exited with status {}", output.status))
        } else {
            Error::YtDlp(message)
        }
    }

    /// Get direct stream URL for playback
    /// Tries multiple format strategies for YouTube (handles 403/format changes)
    pub async fn get_stream_url(app: &tauri::AppHandle, video_id: &str, source: &str) -> Result<String> {
        let binary = Self::find_sidecar(Some(app));
        let cookie_file = Self::get_cookie_file(Some(app));
        let proxy = Self::get_proxy(Some(app));
        let invidious = Self::get_invidious_instance(Some(app));
        let user_agent = Self::get_random_user_agent();

        // Construct the appropriate URL based on source
        // For YouTube, use Invidious instance if configured
        let video_url = match source {
            "youtube" => {
                if let Some(instance) = &invidious {
                    format!("{}/watch?v={video_id}", instance.trim_end_matches('/'))
                } else {
                    format!("https://youtube.com/watch?v={video_id}")
                }
            }
            "soundcloud" => format!("https://soundcloud.com/{video_id}"),
            "bandcamp" => format!("https://bandcamp.com/track/{video_id}"),
            "internet_archive" => format!("https://archive.org/details/{video_id}"),
            "jamendo" => format!("https://jamendo.com/track/{video_id}"),
            _ => format!("https://youtube.com/watch?v={video_id}"), // fallback to YouTube
        };

        // For YouTube, try multiple format strategies (handles format changes/403s)
        // Updated 2024: YouTube now often serves audio-only in mp4/m4a with specific codecs
        let format_strategies: Vec<&str> = if source == "youtube" {
            vec![
                "bestaudio[ext=m4a]/bestaudio[ext=mp4]/bestaudio[ext=webm]/bestaudio",  // Preferred: m4a/mp4/webm
                "bestaudio[acodec^=opus]/bestaudio[acodec^=aac]/bestaudio",               // By codec: opus/aac
                "bestaudio/best",                                                         // Any audio
                "worstaudio/worst",                                                       // Fallback: any quality
            ]
        } else {
            vec!["bestaudio[ext=m4a]/bestaudio[ext=mp4]/bestaudio[ext=webm]/bestaudio"]
        };

        let mut last_error = None;

        for (strategy_idx, format_sel) in format_strategies.into_iter().enumerate() {
            eprintln!("[YtDlp] Trying format strategy {}: {}", strategy_idx + 1, format_sel);

            // Single attempt per strategy (fail fast on 403)
            let mut command = tokio::process::Command::new(&binary);
            #[cfg(windows)]
            command.creation_flags(CREATE_NO_WINDOW);

            let mut args: Vec<String> = vec![
                "--socket-timeout".into(), "20".into(),
                "--retries".into(), "1".into(),
                "--extractor-retries".into(), "1".into(),
                "--fragment-retries".into(), "1".into(),
                "--concurrent-fragments".into(), "4".into(),
                "--no-check-certificates".into(),
                "--user-agent".into(), user_agent.into(),
                "-f".into(), format_sel.into(),
                "-g".into(), "--no-playlist".into(),
                video_url.clone(),
            ];

            // Add cookie file if available
            if let Some(cookie_path) = &cookie_file {
                args.push("--cookies".into());
                args.push(cookie_path.to_string_lossy().to_string());
                eprintln!("[YtDlp] Using cookies for authentication");
            }

            // Add proxy if configured
            if let Some(proxy_url) = &proxy {
                args.push("--proxy".into());
                args.push(proxy_url.clone());
                eprintln!("[YtDlp] Using proxy: {}", proxy_url);
            }

            // Add Invidious extractor args if using Invidious
            if invidious.is_some() && source == "youtube" {
                args.push("--extractor".into());
                args.push("generic".into()); // Use generic extractor for Invidious
            }

            let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
            command.args(&args_ref);

            let output = match Self::run_command(command, 30).await {
                Ok(o) => o,
                Err(e) => {
                    last_error = Some(e);
                    continue; // Try next strategy
                }
            };

            if output.status.success() {
                let url = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !url.is_empty() && url.starts_with("http") {
                    eprintln!("[YtDlp] Stream URL obtained with strategy {}", strategy_idx + 1);
                    return Ok(url);
                }
                last_error = Some(Error::YtDlp("yt-dlp returned empty URL".into()));
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let err_msg = Self::command_error(&output).to_string();
                last_error = Some(Error::YtDlp(err_msg.clone()));

                // Enhanced error logging for debugging
                eprintln!("[YtDlp] Strategy {} failed: {}", strategy_idx + 1, err_msg);
                if !stderr.is_empty() {
                    eprintln!("[YtDlp] stderr: {}", stderr);
                }

                // Fail fast on 403/401 - retrying won't help
                if err_msg.contains("403") || err_msg.contains("401") || err_msg.contains("Forbidden") || err_msg.contains("Unauthorized") {
                    eprintln!("[YtDlp] 403/401 detected, trying next format strategy");
                    continue;
                }
                
                // Check for common YouTube errors
                if stderr.contains("Sign in to confirm your age") || stderr.contains("age.gate") {
                    eprintln!("[YtDlp] Age-restricted content detected");
                    last_error = Some(Error::YtDlp("Esta faixa tem restrição de idade e requer login (cookies). Configure cookies em Configurações.".into()));
                    continue;
                }
                if stderr.contains("geo") || stderr.contains("country") || stderr.contains("region") {
                    eprintln!("[YtDlp] Geo-blocking detected");
                    last_error = Some(Error::YtDlp("Esta faixa não está disponível na sua região. Configure proxy em Configurações.".into()));
                    continue;
                }
                if stderr.contains("Private video") || stderr.contains("Video unavailable") || stderr.contains("removed by the user") {
                    eprintln!("[YtDlp] Video unavailable/private");
                    last_error = Some(Error::YtDlp("Esta faixa não está mais disponível (privada/excluída).".into()));
                    continue;
                }
            }
        }

        Err(last_error.unwrap_or_else(|| Error::YtDlp("Failed to get stream URL: all format strategies exhausted".into())))
    }

    /// Download audio file for offline/cached playback
    #[allow(dead_code)]
    pub async fn download_audio(video_id: &str, output_path: &str) -> Result<()> {
        let binary = Self::find_sidecar(None);
        let video_url = format!("https://youtube.com/watch?v={video_id}");
        let mut command = tokio::process::Command::new(binary);
        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);
        command.args([
            "--socket-timeout",
            "30",
            "--retries",
            "3",
            "--fragment-retries",
            "3",
            "-f",
            "bestaudio[ext=m4a]/bestaudio",
            "-x",
            "--audio-format",
            "m4a",
            "--audio-quality",
            "0",
            "-o",
            output_path,
            "--no-playlist",
            &video_url,
        ]);
        let output = Self::run_command(command, 300).await?; // 5 min for full download
        if !output.status.success() {
            return Err(Self::command_error(&output));
        }
        Ok(())
    }

    /// Search across multiple free music sources using yt-dlp generic extractors
    /// Sources: YouTube, SoundCloud, Bandcamp, Internet Archive, Jamendo, Free Music Archive
    pub async fn search(
        app: &tauri::AppHandle,
        query: &str,
        limit: usize,
    ) -> Result<Vec<VideoInfo>> {
        let binary = Self::find_sidecar(Some(app));

        // Get cookie file for authenticated requests
        let cookie_file = Self::get_cookie_file(Some(app));

        // Define multiple free music sources with their search prefixes
        let sources = vec![
            ("YouTube", format!("ytsearch{}:{}", limit.clamp(1, 20), query)),
            ("SoundCloud", format!("scsearch{}:{}", limit.clamp(1, 10), query)),
            ("Bandcamp", format!("bcsearch{}:{}", limit.clamp(1, 10), query)),
            ("Internet Archive", format!("iasearch{}:{}", limit.clamp(1, 10), query)),
            ("Jamendo", format!("jamendosearch{}:{}", limit.clamp(1, 10), query)),
        ];

        let mut all_results = Vec::new();
        let mut seen_ids = std::collections::HashSet::new();

        // Run searches in parallel for speed
        let tasks: Vec<_> = sources
            .into_iter()
            .map(|(source_name, search_query)| {
                let binary = binary.clone();
                let cookie_file = cookie_file.clone();
                tokio::spawn(async move {
                    let mut command = tokio::process::Command::new(&binary);
                    #[cfg(windows)]
                    command.creation_flags(CREATE_NO_WINDOW);

                    // Use owned strings to avoid lifetime issues
                    let mut args: Vec<String> = vec![
                        "--socket-timeout".into(), "20".into(),
                        "--retries".into(), "2".into(),
                        "--extractor-retries".into(), "2".into(),
                        "--flat-playlist".into(),
                        "--dump-json".into(),
                        "--no-playlist".into(),
                        search_query.clone(),
                    ];

                    // Add cookie file if available (mainly for YouTube)
                    if source_name == "YouTube" {
                        if let Some(cookie_path) = &cookie_file {
                            args.push("--cookies".into());
                            args.push(cookie_path.to_string_lossy().to_string());
                        }
                    }

                    // Convert to &str for command.args
                    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
                    command.args(&args_ref);

                    let output = match Self::run_command(command, 30).await {
                        Ok(o) => o,
                        Err(e) => {
                            eprintln!("[YtDlp] {} search failed: {}", source_name, e);
                            return Vec::new();
                        }
                    };

                    if !output.status.success() {
                        eprintln!("[YtDlp] {} search returned error: {}", source_name, Self::command_error(&output));
                        return Vec::new();
                    }

                    let results: Vec<VideoInfo> = String::from_utf8_lossy(&output.stdout)
                        .lines()
                        .filter_map(|line| serde_json::from_str::<serde_json::Value>(line).ok())
                        .filter_map(|v| {
                            let id = v.get("id")?.as_str()?.to_string();
                            let title = v.get("title")?.as_str()?.to_string();
                            let channel = v.get("channel")
                                .and_then(|x| x.as_str())
                                .or_else(|| v.get("uploader").and_then(|x| x.as_str()))
                                .map(|s| s.to_string())?;
                            let channel_id = v.get("channel_id")
                                .and_then(|x| x.as_str())
                                .or_else(|| v.get("uploader_id").and_then(|x| x.as_str()))
                                .map(|s| s.to_string())?;
                            let duration = v.get("duration")?.as_u64()?;
                            let thumbnail = v.get("thumbnail")
                                .and_then(|x| x.as_str())
                                .or_else(|| {
                                    v.get("thumbnails")
                                        .and_then(|arr| arr.as_array())
                                        .and_then(|arr| arr.first())
                                        .and_then(|t| t.get("url"))
                                        .and_then(|u| u.as_str())
                                })?
                                .to_string();
                            let view_count = v.get("view_count").and_then(|x| x.as_u64());
                            let age_limit = v.get("age_limit").and_then(|x| x.as_u64()).unwrap_or(0) as u8;
                            let is_live = v.get("is_live").and_then(|x| x.as_bool()).unwrap_or(false);
                            let availability = v.get("availability").and_then(|x| x.as_str()).unwrap_or("public").to_string();

                            // Filter out age-restricted and live content
                            if age_limit > 0 || is_live {
                                return None;
                            }

                            // Filter by availability
                            if availability != "public" && availability != "unlisted" {
                                return None;
                            }

                            // Map source name to source identifier
                            let source = match source_name {
                                "YouTube" => "youtube",
                                "SoundCloud" => "soundcloud",
                                "Bandcamp" => "bandcamp",
                                "Internet Archive" => "internet_archive",
                                "Jamendo" => "jamendo",
                                _ => "unknown",
                            };

                            let source_type = SourceType::from_title_channel(&title, &channel);

                            Some(VideoInfo {
                                id,
                                title,
                                channel,
                                channel_id,
                                duration,
                                thumbnail,
                                view_count,
                                age_limit,
                                is_live,
                                availability,
                                source_type,
                                source: source.to_string(),
                            })
                        })
                        .collect();

                    eprintln!("[YtDlp] {} returned {} results", source_name, results.len());
                    results
                })
            })
            .collect();

        for task in tasks {
            if let Ok(results) = task.await {
                for result in results {
                    if seen_ids.insert(result.id.clone()) {
                        all_results.push(result);
                    }
                }
            }
        }

        // Sort by source type priority (official first)
        all_results.sort_by_key(|r| r.source_type.priority());
        all_results.truncate(limit);

        if all_results.is_empty() {
            return Err(Error::YtDlp(
                "Não foi possível conectar à fonte. Verifique sua internet e tente novamente.".into()
            ));
        }

        eprintln!("[YtDlp] Total results from all sources: {}", all_results.len());
        Ok(all_results)
    }

    /// Search with parallel fallback variations for maximum results
    /// Runs fallback searches concurrently for speed
    pub async fn search_with_fallback(
        app: &tauri::AppHandle,
        query: &str,
        limit: usize,
    ) -> Result<Vec<VideoInfo>> {
        // Try original query first
        let mut results = match Self::search(app, query, limit).await {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[YtDlp] Primary search failed: {}", e);
                Vec::new()
            }
        };

        // Sort by source type priority (official first)
        results.sort_by_key(|r| r.source_type.priority());

        // If we have enough quality results, return early
        if results.len() >= limit.min(8) {
            results.truncate(limit);
            return Ok(results);
        }

        // Run fallback variations IN PARALLEL for speed
        let variations = vec![
            format!("{} lyric video", query),
            format!("{} official audio", query),
            format!("{} cover", query),
            format!("{} acoustic", query),
        ];

        let existing_ids: std::collections::HashSet<_> = results.iter().map(|r| r.id.clone()).collect();
        let needed = limit.saturating_sub(results.len());

        // Spawn parallel searches
        let tasks: Vec<_> = variations
            .into_iter()
            .map(|variation| {
                let app = app.clone();
                let needed = needed;
                let existing = existing_ids.clone();
                tokio::spawn(async move {
                    match tokio::time::timeout(
                        Duration::from_secs(30), // 30s per fallback
                        Self::search(&app, &variation, needed)
                    ).await {
                        Ok(Ok(mut more)) => {
                            // Filter duplicates
                            more.retain(|r| !existing.contains(&r.id));
                            // Sort by priority
                            more.sort_by_key(|r| r.source_type.priority());
                            more
                        }
                        Ok(Err(e)) => {
                            eprintln!("[YtDlp] Fallback '{}' failed: {}", variation, e);
                            Vec::new()
                        }
                        Err(_) => {
                            eprintln!("[YtDlp] Fallback '{}' timed out", variation);
                            Vec::new()
                        }
                    }
                })
            })
            .collect();

        // Collect all results
        for task in tasks {
            if let Ok(more) = task.await {
                results.extend(more);
                // Re-sort by priority after each batch
                results.sort_by_key(|r| r.source_type.priority());
                if results.len() >= limit {
                    break;
                }
            }
        }

        results.truncate(limit);

        if results.is_empty() {
            return Err(Error::YtDlp(
                "Não foi possível conectar à fonte. Verifique sua internet e tente novamente.".into()
            ));
        }

        eprintln!("[YtDlp] Total results after fallbacks: {}", results.len());
        Ok(results)
    }
}