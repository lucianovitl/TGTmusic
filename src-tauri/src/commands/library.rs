use crate::models::{Playlist, Track};
use crate::services::database;
use crate::utils::Result;
use std::path::Path;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn get_library_tracks(app: AppHandle) -> Result<Vec<Track>> {
    database::get_library_tracks(&app).await
}

#[tauri::command]
pub async fn add_to_library(app: AppHandle, track: Track) -> Result<()> {
    database::add_to_library(&app, &track).await
}

#[tauri::command]
pub async fn remove_from_library(app: AppHandle, track_id: String) -> Result<()> {
    database::remove_from_library(&app, &track_id).await
}

#[tauri::command]
pub async fn get_playlists(app: AppHandle) -> Result<Vec<Playlist>> {
    database::get_playlists(&app).await
}

#[tauri::command]
pub async fn create_playlist(app: AppHandle, name: String) -> Result<()> {
    database::create_playlist(&app, &name).await
}

#[tauri::command]
pub async fn delete_playlist(app: AppHandle, id: String) -> Result<()> {
    database::delete_playlist(&app, &id).await
}

#[tauri::command]
pub async fn get_playlist_tracks(app: AppHandle, playlist_id: String) -> Result<Vec<Track>> {
    database::get_playlist_tracks(&app, &playlist_id).await
}

#[tauri::command]
pub async fn add_to_playlist(app: AppHandle, playlist_id: String, track_id: String) -> Result<()> {
    database::add_to_playlist(&app, &playlist_id, &track_id).await
}

#[tauri::command]
pub async fn remove_from_playlist(
    app: AppHandle,
    playlist_id: String,
    track_id: String,
) -> Result<()> {
    database::remove_from_playlist(&app, &playlist_id, &track_id).await
}

#[tauri::command]
pub async fn pick_local_tracks(app: AppHandle) -> Result<Vec<Track>> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .add_filter(
            "Arquivos de áudio",
            &["mp3", "wav", "flac", "ogg", "m4a", "aac"],
        )
        .pick_files(move |files| {
            let _ = tx.send(files);
        });

    let files = rx.await.unwrap_or_default().unwrap_or_default();
    let added_at = chrono::Utc::now().timestamp_millis();
    let album_art = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%231b1b1b'/%3E%3Cpath d='M62 20v43a14 14 0 1 1-6-11V31l30-7v31a14 14 0 1 1-6-11V16z' fill='%23a78bfa'/%3E%3C/svg%3E";

    Ok(files
        .into_iter()
        .map(|file| {
            let source_id = file.to_string();
            let title = Path::new(&source_id)
                .file_stem()
                .and_then(|name| name.to_str())
                .unwrap_or("Faixa local")
                .to_string();
            Track {
                id: format!("local-{}", uuid::Uuid::new_v4()),
                title,
                artists: vec!["Arquivo local".into()],
                album: "Arquivo local".into(),
                album_art: album_art.into(),
                duration: 0,
                source: "local".into(),
                source_id,
                url: None,
                added_at,
                playlist_id: None,
            }
        })
        .collect())
}