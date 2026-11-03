use crate::{models::Track, utils::{Error, Result}};
use reqwest::Client;
use serde_json::Value;
use std::time::Duration;

pub struct YouTubeClient {
    client: Client,
}

impl YouTubeClient {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .connect_timeout(Duration::from_secs(8))
                .timeout(Duration::from_secs(20))
                .build()
                .unwrap_or_else(|_| Client::new()),
        }
    }

    pub async fn search_tracks(&self, query: &str, limit: usize) -> Result<Vec<Track>> {
        let url = format!(
            "https://yewtu.be/api/v1/search?q={}&type=video",
            urlencoding::encode(query)
        );
        let response = self.client.get(&url).send().await?.error_for_status()?;
        let data: Value = response.json().await?;
        let items = data
            .as_array()
            .ok_or_else(|| Error::NotFound("No YouTube results".into()))?;

        Ok(items
            .iter()
            .take(limit.clamp(1, 50))
            .filter_map(|item| {
                let video_id = item["videoId"].as_str()?;
                let title = item["title"].as_str()?;
                let artist = item["author"].as_str().unwrap_or("YouTube");
                let album_art = item["videoThumbnails"]
                    .as_array()
                    .and_then(|thumbnails| {
                        thumbnails
                            .iter()
                            .rev()
                            .find_map(|thumbnail| thumbnail["url"].as_str())
                    })
                    .unwrap_or_default();

                Some(Track {
                    id: format!("youtube-{video_id}"),
                    title: title.to_string(),
                    artists: vec![artist.to_string()],
                    album: "YouTube".into(),
                    album_art: album_art.to_string(),
                    duration: item["lengthSeconds"].as_i64().unwrap_or_default(),
                    source: "youtube".into(),
                    source_id: video_id.to_string(),
                    url: Some(format!("https://youtube.com/watch?v={video_id}")),
                    added_at: chrono::Utc::now().timestamp_millis(),
                    playlist_id: None,
                })
            })
            .collect())
    }

    pub async fn search_youtube_id(&self, title: &str, artist: &str) -> Result<String> {
        let query = format!("{title} {artist}");
        let url = format!(
            "https://yewtu.be/api/v1/search?q={}&type=video",
            urlencoding::encode(&query)
        );
        let response = self.client.get(&url).send().await?.error_for_status()?;
        let data: Value = response.json().await?;
        if let Some(id) = data
            .as_array()
            .and_then(|items| items.first())
            .and_then(|item| item["videoId"].as_str())
        {
            return Ok(id.to_string());
        }
        Err(Error::NotFound("No YouTube result".into()))
    }
}
