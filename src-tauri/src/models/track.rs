use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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
    pub source_type: Option<String>,
}
