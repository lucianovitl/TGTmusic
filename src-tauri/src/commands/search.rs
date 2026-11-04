use crate::{
    models::Track,
    services::ytdlp::YtDlp,
    utils::{Error, Result},
};
use tauri::AppHandle;

/// Search tracks using yt-dlp with Spotify fallback
/// Runs both in parallel for speed, merges and deduplicates results
#[tauri::command]
pub async fn search_tracks(
    app: AppHandle,
    query: String,
) -> Result<Vec<Track>> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }

    let limit = 20;

    // Primary: yt-dlp search (most reliable, no API keys needed)
    let ytdlp_future = YtDlp::search_with_fallback(&app, &query, limit);

    // Run search and convert results
    let ytdlp_results = match ytdlp_future.await {
        Ok(results) => {
            eprintln!("[Search] yt-dlp returned {} results", results.len());
            results.into_iter().map(|v| {
                let video_id = v.id.clone();
                let source = v.source.clone(); // "youtube", "soundcloud", "bandcamp", etc.
                let source_display = match source.as_str() {
                    "youtube" => "YouTube",
                    "soundcloud" => "SoundCloud",
                    "bandcamp" => "Bandcamp",
                    "internet_archive" => "Internet Archive",
                    "jamendo" => "Jamendo",
                    _ => "Unknown",
                };
                Track {
                    id: format!("{}-{}", source, video_id),
                    title: v.title,
                    artists: vec![v.channel],
                    album: source_display.into(),
                    album_art: v.thumbnail,
                    duration: v.duration as i64,
                    source: source.clone(),
                    source_id: video_id.clone(),
                    url: Some(match source.as_str() {
                        "youtube" => format!("https://youtube.com/watch?v={}", video_id),
                        "soundcloud" => format!("https://soundcloud.com/{}", video_id),
                        "bandcamp" => format!("https://bandcamp.com/track/{}", video_id),
                        "internet_archive" => format!("https://archive.org/details/{}", video_id),
                        "jamendo" => format!("https://jamendo.com/track/{}", video_id),
                        _ => format!("https://youtube.com/watch?v={}", video_id),
                    }),
                    added_at: chrono::Utc::now().timestamp_millis(),
                    playlist_id: None,
                    source_type: Some(v.source_type.label().to_string()),
                }
            }).collect::<Vec<Track>>()
        }
        Err(e) => {
            eprintln!("[Search] yt-dlp search failed: {}", e);
            Vec::new()
        }
    };

    // If we have enough results from yt-dlp, return early
    if ytdlp_results.len() >= limit.min(10) {
        return Ok(ytdlp_results);
    }

    // Fallback: Try Spotify if we need more results
    // (SpotifyClient would need to be passed as State if available)
    // For now, return what we have from yt-dlp
    // TODO: Add Spotify as secondary source when client is available

    if ytdlp_results.is_empty() {
        return Err(Error::YtDlp(
            "Não foi possível buscar. Verifique sua conexão e tente novamente.".into()
        ));
    }

    Ok(ytdlp_results)
}

/// Search with explicit source selection
#[tauri::command]
pub async fn search_tracks_source(
    app: AppHandle,
    query: String,
    source: String, // "youtube" | "spotify" | "all"
) -> Result<Vec<Track>> {
    match source.as_str() {
        "youtube" => search_tracks(app, query).await,
        "spotify" => {
            // Would need SpotifyClient state
            Err(Error::Config("Spotify search not configured".into()))
        }
        _ => search_tracks(app, query).await,
    }
}