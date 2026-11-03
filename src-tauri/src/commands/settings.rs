use crate::models::Track;
use crate::services::database::*;
use crate::utils::Result;
use tauri::{AppHandle, Emitter};
use tauri_plugin_store::StoreExt;

const STORE_PATH: &str = "settings.dat";

#[tauri::command]
pub async fn get_theme(app: AppHandle) -> Result<String> {
    let store = app.store(STORE_PATH)?;
    Ok(store
        .get("theme")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "dark".into()))
}

#[tauri::command]
pub async fn set_theme(app: AppHandle, theme: String) -> Result<()> {
    let store = app.store(STORE_PATH)?;
    store.set("theme", serde_json::json!(theme));
    store.save()?;
    app.emit("theme-changed", theme.clone())?;
    Ok(())
}

#[tauri::command]
pub async fn get_download_path(app: AppHandle) -> Result<String> {
    let store = app.store(STORE_PATH)?;
    Ok(store
        .get("download_path")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| {
            dirs::audio_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default()
        }))
}

#[tauri::command]
pub async fn set_download_path(app: AppHandle, path: String) -> Result<()> {
    let store = app.store(STORE_PATH)?;
    store.set("download_path", serde_json::json!(path));
    store.save()?;
    Ok(())
}

#[tauri::command]
pub async fn get_ytdlp_path(app: AppHandle) -> Result<String> {
    let store = app.store(STORE_PATH)?;
    Ok(store
        .get("ytdlp_path")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_default())
}

#[tauri::command]
pub async fn set_ytdlp_path(app: AppHandle, path: String) -> Result<()> {
    let store = app.store(STORE_PATH)?;
    store.set("ytdlp_path", serde_json::json!(path));
    store.save()?;
    Ok(())
}

#[tauri::command]
pub async fn save_file(app: AppHandle, content: String, default_name: String) -> Result<bool> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .add_filter("JSON", &["json"])
        .set_file_name(&default_name)
        .save_file(move |path| {
            let selected_path = path.map(|path| path.to_string());
            let _ = tx.send(selected_path);
        });

    let Some(path) = rx.await? else {
        return Ok(false);
    };
    tokio::fs::write(path, content).await?;
    Ok(true)
}

#[tauri::command]
pub async fn open_file(app: AppHandle) -> Result<Option<String>> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .add_filter("JSON", &["json"])
        .pick_file(move |path| {
            let selected_path = path.map(|path| path.to_string());
            let _ = tx.send(selected_path);
        });

    let Some(path) = rx.await? else {
        return Ok(None);
    };
    Ok(Some(tokio::fs::read_to_string(path).await?))
}

#[tauri::command]
pub async fn pick_folder(app: AppHandle) -> Result<Option<String>> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_folder(move |path| {
        let selected_path = path.map(|path| path.to_string());
        let _ = tx.send(selected_path);
    });
    Ok(rx.await?)
}

#[tauri::command]
pub async fn clear_all_data(app: AppHandle) -> Result<()> {
    crate::services::database::clear_all_data(&app).await
}

#[tauri::command]
pub async fn import_library(app: AppHandle, tracks: Vec<Track>) -> Result<()> {
    crate::services::database::import_library(&app, tracks).await
}

#[tauri::command]
pub async fn import_playlists(
    app: AppHandle,
    playlists: Vec<crate::models::Playlist>,
) -> Result<()> {
    crate::services::database::import_playlists(&app, playlists).await
}
