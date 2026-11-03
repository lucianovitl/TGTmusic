use crate::utils::{Error, Result};
use std::{path::PathBuf, process::Output, time::Duration};
use tauri::Manager;
use tauri_plugin_store::StoreExt;

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
    ) -> Result<Vec<serde_json::Value>> {
        let binary = Self::find_sidecar(Some(app));
        let search_query = format!("ytsearch{}:{query}", limit.clamp(1, 50));
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
            "--flat-playlist",
            "--dump-json",
            "--no-playlist",
            &search_query,
        ]);
        let output = Self::run_command(command, 60).await?;
        if !output.status.success() {
            return Err(Self::command_error(&output));
        }

        Ok(String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter_map(|line| serde_json::from_str(line).ok())
            .collect())
    }
}
