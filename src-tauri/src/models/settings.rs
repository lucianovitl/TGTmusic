use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct Settings {
    pub theme: String,
    pub download_path: String,
    pub ytdlp_path: String,
    pub volume: f32,
    pub repeat: String,
    pub shuffle: bool,
}
