use crate::models::Track;
use crate::services::spotify::SpotifyClient;
use crate::utils::Result;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn search_tracks(
    app: AppHandle,
    query: String,
    spotify: State<'_, SpotifyClient>,
) -> Result<Vec<Track>> {
    spotify.search_tracks(&query, 20, &app).await
}
