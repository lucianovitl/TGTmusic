use crate::{
    models::Track,
    services::{youtube::YouTubeClient, ytdlp::YtDlp},
    utils::{Error, Result},
};
use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;
use std::{sync::Mutex, time::Duration};
use tauri::AppHandle;

#[derive(Deserialize)]
struct SpotifySearchResponse {
    tracks: SpotifyTracks,
}

#[derive(Deserialize)]
struct SpotifyTracks {
    items: Vec<SpotifyTrack>,
}

#[derive(Deserialize)]
struct SpotifyTrack {
    id: String,
    name: String,
    artists: Vec<SpotifyArtist>,
    album: SpotifyAlbum,
    duration_ms: u32,
}

#[derive(Deserialize)]
struct SpotifyArtist {
    name: String,
}

#[derive(Deserialize)]
struct SpotifyAlbum {
    name: String,
    images: Vec<SpotifyImage>,
}

#[derive(Deserialize)]
struct SpotifyImage {
    url: String,
}

pub struct SpotifyClient {
    client: Client,
    youtube: YouTubeClient,
    token: Mutex<Option<String>>,
    token_expires: Mutex<std::time::Instant>,
}

impl SpotifyClient {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .connect_timeout(Duration::from_secs(10))
                .timeout(Duration::from_secs(25))
                .build()
                .unwrap_or_else(|_| Client::new()),
            youtube: YouTubeClient::new(),
            token: Mutex::new(None),
            token_expires: Mutex::new(std::time::Instant::now()),
        }
    }

    async fn ensure_token(&self) -> Result<String> {
        let token = self.token.lock().unwrap().clone();
        let expires = *self.token_expires.lock().unwrap();
        if let Some(token) = token.filter(|_| std::time::Instant::now() < expires) {
            return Ok(token);
        }

        let client_id = std::env::var("SPOTIFY_CLIENT_ID").unwrap_or_default();
        let client_secret = std::env::var("SPOTIFY_CLIENT_SECRET").unwrap_or_default();
        if client_id.is_empty() || client_secret.is_empty() {
            return Err(Error::Config("Spotify credentials not set".into()));
        }

        let response = self
            .client
            .post("https://accounts.spotify.com/api/token")
            .form(&[
                ("grant_type", "client_credentials"),
                ("client_id", client_id.as_str()),
                ("client_secret", client_secret.as_str()),
            ])
            .timeout(Duration::from_secs(20))
            .send()
            .await?
            .error_for_status()?;
        let json: Value = response.json().await?;
        let token = json["access_token"]
            .as_str()
            .ok_or_else(|| Error::Config("Spotify did not return an access token".into()))?
            .to_string();
        let expires_in = json["expires_in"]
            .as_u64()
            .unwrap_or(3600)
            .saturating_sub(60)
            .max(1);

        *self.token.lock().unwrap() = Some(token.clone());
        *self.token_expires.lock().unwrap() =
            std::time::Instant::now() + std::time::Duration::from_secs(expires_in);
        Ok(token)
    }

    async fn search_youtube(
        &self,
        app: &AppHandle,
        query: &str,
        limit: usize,
    ) -> Result<Vec<Track>> {
        if let Ok(items) = YtDlp::search(app, query, limit.clamp(1, 50)).await {
            let tracks = items
                .into_iter()
                .filter_map(|item| {
                    let video_id = item["id"].as_str()?;
                    let title = item["title"].as_str()?;
                    let artist = item["channel"]
                        .as_str()
                        .or_else(|| item["uploader"].as_str())
                        .unwrap_or("YouTube");
                    let album_art = item["thumbnail"]
                        .as_str()
                        .or_else(|| {
                            item["thumbnails"]
                                .as_array()
                                .and_then(|thumbnails| thumbnails.last())
                                .and_then(|thumbnail| thumbnail["url"].as_str())
                        })
                        .unwrap_or_default();
                    let url = item["webpage_url"]
                        .as_str()
                        .map(str::to_string)
                        .unwrap_or_else(|| format!("https://youtube.com/watch?v={video_id}"));

                    Some(Track {
                        id: format!("youtube-{video_id}"),
                        title: title.to_string(),
                        artists: vec![artist.to_string()],
                        album: "YouTube".into(),
                        album_art: album_art.to_string(),
                        duration: item["duration"].as_i64().unwrap_or_default(),
                        source: "youtube".into(),
                        source_id: video_id.to_string(),
                        url: Some(url),
                        added_at: chrono::Utc::now().timestamp_millis(),
                        playlist_id: None,
                    })
                })
                .collect::<Vec<_>>();
            if !tracks.is_empty() {
                return Ok(tracks);
            }
        }

        self.youtube.search_tracks(query, limit).await
    }

    async fn fetch_spotify_tracks(&self, query: &str, limit: usize) -> Result<Vec<SpotifyTrack>> {
        let token = self.ensure_token().await?;
        let url = format!(
            "https://api.spotify.com/v1/search?q={}&type=track&limit={}",
            urlencoding::encode(query),
            limit.clamp(1, 50)
        );
        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {token}"))
            .timeout(Duration::from_secs(20))
            .send()
            .await?
            .error_for_status()?;
        let data: SpotifySearchResponse = response.json().await?;
        Ok(data.tracks.items)
    }

    pub async fn search_tracks(
        &self,
        query: &str,
        limit: usize,
        app: &AppHandle,
    ) -> Result<Vec<Track>> {
        let items = match self.fetch_spotify_tracks(query, limit).await {
            Ok(items) if !items.is_empty() => items,
            Ok(_) | Err(_) => return self.search_youtube(app, query, limit).await,
        };

        let mut tracks = Vec::with_capacity(items.len());
        let mut has_unlinked_tracks = false;
        for item in items {
            let artist = item
                .artists
                .first()
                .map(|artist| artist.name.as_str())
                .unwrap_or_default();
            let (source, source_id) = match self.youtube.search_youtube_id(&item.name, artist).await
            {
                Ok(youtube_id) => ("youtube", youtube_id),
                Err(_) => {
                    has_unlinked_tracks = true;
                    ("spotify", item.id.clone())
                }
            };
            tracks.push(Track {
                id: format!("spotify-{}", item.id),
                title: item.name,
                artists: item.artists.into_iter().map(|artist| artist.name).collect(),
                album: item.album.name,
                album_art: item
                    .album
                    .images
                    .first()
                    .map(|image| image.url.clone())
                    .unwrap_or_default(),
                duration: item.duration_ms as i64 / 1000,
                source: source.into(),
                source_id,
                url: None,
                added_at: chrono::Utc::now().timestamp_millis(),
                playlist_id: None,
            });
        }

        if has_unlinked_tracks {
            if let Ok(youtube_tracks) = self.search_youtube(app, query, limit).await {
                if !youtube_tracks.is_empty() {
                    return Ok(youtube_tracks);
                }
            }
        }

        Ok(tracks)
    }
}
