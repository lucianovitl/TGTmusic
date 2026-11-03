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
            || channel_lower.contains("music") && channel_lower.contains("records") {
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
}

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub struct YtDlp;

impl YtDlp {
    fn find_sidecar(app: Option<&tauri::AppHandle>) -> PathBuf {
        let binary_name = if cfg!(windows) {
            "yt-dlp.exe"
        } else {
            "yt-dlp"
        };
        let mut candidates = Vec::new();

        if let Some(app) = app {
            if let Ok(store) = app.store("settings.dat") {
                if let Some(configured_path) = store
                    .get("ytdlp_path")
                    .and_then(|value| value.as_str().map(PathBuf::from))
                {
                    candidates.push(configured_path);
                }
            }

            if let Ok(resource_dir) = app.path().resource_dir() {
                candidates.extend([
                    resource_dir.join(binary_name),
                    resource_dir.join("yt-dlp-x86_64-pc-windows-msvc.exe"),
                    resource_dir.join("sidecar").join(binary_name),
                    resource_dir.join("binaries/yt-dlp-x86_64-pc-windows-msvc.exe"),
                ]);
            }
        }

        if let Ok(executable) = std::env::current_exe() {
            if let Some(executable_dir) = executable.parent() {
                candidates.push(executable_dir.join(binary_name));
            }
        }

        candidates
            .into_iter()
            .find(|candidate| candidate.is_file())
            .unwrap_or_else(|| PathBuf::from(binary_name))
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

    pub async fn get_stream_url(app: &tauri::AppHandle, video_id: &str) -> Result<String> {
        let binary = Self::find_sidecar(Some(app));
        let video_url = format!("https://youtube.com/watch?v={video_id}");
        let mut command = tokio::process::Command::new(binary);
        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);
        command.args([
            "--socket-timeout",
            "15",
            "--retries",
            "2",
            "--extractor-retries",
            "2",
            "-f",
            "bestaudio[ext=m4a]/bestaudio",
            "-g",
            "--no-playlist",
            &video_url,
        ]);
        let output = Self::run_command(command, 45).await?;
        if !output.status.success() {
            return Err(Self::command_error(&output));
        }

        let url = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if url.is_empty() {
            return Err(Error::YtDlp("yt-dlp returned an empty audio URL".into()));
        }
        Ok(url)
    }

    #[allow(dead_code)]
    pub async fn download_audio(video_id: &str, output_path: &str) -> Result<()> {
        let binary = Self::find_sidecar(None);
        let video_url = format!("https://youtube.com/watch?v={video_id}");
        let mut command = tokio::process::Command::new(binary);
        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);
        command.args([
            "--socket-timeout",
            "15",
            "--retries",
            "2",
            "--fragment-retries",
            "2",
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
        let output = Self::run_command(command, 180).await?;
        if !output.status.success() {
            return Err(Self::command_error(&output));
        }
        Ok(())
    }

    pub async fn search(
        app: &tauri::AppHandle,
        query: &str,
        limit: usize,
    ) -> Result<Vec<VideoInfo>> {
        let binary = Self::find_sidecar(Some(app));
        let search_query = format!("ytsearch{}:{query}", limit.clamp(1, 50));
        let mut command = tokio::process::Command::new(binary);
        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);
        command.args([
            "--socket-timeout",
            "10",     // Reduced from 15
            "--retries",
            "1",      // Reduced from 2
            "--extractor-retries",
            "1",      // Reduced from 2
            "--flat-playlist",
            "--dump-json",
            "--no-playlist",
            &search_query,
        ]);
        let output = Self::run_command(command, 20).await?;  // Reduced from 60s to 20s
        if !output.status.success() {
            return Err(Self::command_error(&output));
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
                let thumbnail = v.get("thumbnail")?.as_str()?.to_string();
                let view_count = v.get("view_count").and_then(|x| x.as_u64());
                let age_limit = v.get("age_limit").and_then(|x| x.as_u64()).unwrap_or(0) as u8;
                let is_live = v.get("is_live").and_then(|x| x.as_bool()).unwrap_or(false);
                let availability = v.get("availability").and_then(|x| x.as_str()).unwrap_or("public").to_string();

                // Filter out age-restricted (age_limit > 0) and live content
                if age_limit > 0 || is_live {
                    return None;
                }

                // Also filter by availability
                if availability != "public" && availability != "unlisted" {
                    return None;
                }

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
                })
            })
            .collect();

        Ok(results)
    }

    /// Search with fallback query variations for age-restricted content
    /// Runs fallback searches in PARALLEL for speed
    pub async fn search_with_fallback(
        app: &tauri::AppHandle,
        query: &str,
        limit: usize,
    ) -> Result<Vec<VideoInfo>> {
        // Try original query first with shorter timeout
        let mut results = match Self::search(app, query, limit).await {
            Ok(r) => r,
            Err(e) => {
                // If original search fails (network error), log and continue to fallbacks
                eprintln!("Primary search failed: {}", e);
                Vec::new()
            }
        };

        // If not enough results, try variations IN PARALLEL
        if results.len() < limit.min(5) {
            // Only 3 most effective variations (reduced from 6)
            let variations = vec![
                format!("{} lyric video", query),
                format!("{} official audio", query),
                format!("{} cover", query),
            ];

            // Run all fallback searches in parallel with timeout
            // Collect existing IDs to avoid duplicates
            let existing_ids: std::collections::HashSet<_> = results.iter().map(|r| r.id.clone()).collect();

            let tasks: Vec<_> = variations
                .into_iter()
                .map(|variation| {
                    let app = app.clone();
                    let needed = limit;
                    let existing = existing_ids.clone();
                    tokio::spawn(async move {
                        // Short timeout for fallback searches
                        match tokio::time::timeout(
                            std::time::Duration::from_secs(20),
                            Self::search(&app, &variation, needed)
                        ).await {
                            Ok(Ok(mut more)) => {
                                // Filter duplicates
                                more.retain(|r| !existing.contains(&r.id));
                                more
                            }
                            Ok(Err(e)) => {
                                eprintln!("Fallback search '{}' failed: {}", variation, e);
                                Vec::new()
                            }
                            Err(_) => {
                                eprintln!("Fallback search '{}' timed out", variation);
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
                    if results.len() >= limit {
                        break;
                    }
                }
            }
        }

        // If still no results, return network error
        if results.is_empty() {
            return Err(Error::YtDlp("Não foi possível conectar à fonte. Verifique sua internet e tente novamente.".into()));
        }

        Ok(results)
    }
}
