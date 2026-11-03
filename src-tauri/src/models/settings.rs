use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub theme: String,
    pub download_path: String,
    pub ytdlp_path: String,
    pub volume: f32,
    pub repeat: String,
    pub shuffle: bool,
}
