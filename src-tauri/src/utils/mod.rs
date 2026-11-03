use serde::{Deserialize, Serialize};

pub mod error;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Track {
    pub id: String,
    pub title: String,
    pub artists: Vec<String>,
    pub album: String,
    pub album_art: String,
    pub duration: i64,
    pub source: String,
    pub source_id: String,
    pub url: Option<String>,
    pub added_at: i64,
    pub playlist_id: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub track_ids: Vec<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

pub use error::{Error, Result};
