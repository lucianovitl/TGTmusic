use crate::models::Track;
use crate::services::{audio_engine::ENGINE, ytdlp::YtDlp};
use crate::utils::{Error, Result};
use tauri::{AppHandle, Emitter};
use tauri_plugin_store::StoreExt;
use std::path::PathBuf;

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

    // Update audio engine cache directory
    let cache_dir = PathBuf::from(&path).join("cache");
    ENGINE.set_cache_dir(cache_dir);

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

#[tauri::command]
pub async fn set_crossfade(enabled: bool, duration_secs: u64) -> Result<()> {
    ENGINE.set_crossfade(enabled, duration_secs);
    Ok(())
}

#[tauri::command]
pub async fn test_yt_dlp(app: AppHandle) -> Result<String> {
    let binary = YtDlp::find_sidecar(Some(&app));
    Ok(format!("yt-dlp path: {}", binary.display()))
}

#[tauri::command]
pub async fn test_yt_dlp_search(app: AppHandle, query: String) -> Result<String> {
    match YtDlp::search_with_fallback(&app, &query, 5).await {
        Ok(results) => Ok(format!("Encontrados {} resultados", results.len())),
        Err(e) => Ok(format!("Erro: {}", e)),
    }
}

#[tauri::command]
pub async fn test_yt_dlp_raw(app: AppHandle, query: String) -> Result<String> {
    let binary = YtDlp::find_sidecar(Some(&app));
    let search_query = format!("ytsearch3:{}", query);
    let mut command = tokio::process::Command::new(&binary);
    #[cfg(windows)]
    command.creation_flags(0x08000000);
    command.args([
        "--socket-timeout", "10",
        "--retries", "1",
        "--extractor-retries", "1",
        "--flat-playlist",
        "--dump-json",
        "--no-playlist",
        &search_query,
    ]);

    let output = match tokio::time::timeout(
        std::time::Duration::from_secs(30),
        command.output()
    ).await {
        Ok(Ok(output)) => output,
        Ok(Err(e)) => return Ok(format!("Erro exec: {}", e)),
        Err(_) => return Ok("Timeout".into()),
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    Ok(format!("stdout len: {}, stderr: {}, status: {}", stdout.len(), stderr, output.status))
}

#[tauri::command]
pub async fn test_yt_dlp_search_direct(app: AppHandle, query: String) -> Result<String> {
    match YtDlp::search(&app, &query, 5).await {
        Ok(results) => Ok(format!("search OK: {} resultados", results.len())),
        Err(e) => Ok(format!("search Err: {}", e)),
    }
}

#[tauri::command]
pub async fn check_ytdlp_binary(app: AppHandle) -> Result<serde_json::Value> {
    let binary = YtDlp::find_sidecar(Some(&app));
    let exists = binary.is_file();

    let version = if exists {
        match YtDlp::verify_binary(&app).await {
            Ok(v) => Some(v),
            Err(e) => Some(format!("Erro ao verificar: {}", e)),
        }
    } else {
        None
    };

    Ok(serde_json::json!({
        "path": binary.display().to_string(),
        "exists": exists,
        "version": version,
        "in_path": std::process::Command::new("yt-dlp").arg("--version").output().is_ok()
    }))
}

#[tauri::command]
pub async fn update_ytdlp(app: AppHandle) -> Result<serde_json::Value> {
    match YtDlp::auto_update(&app).await {
        Ok(updated) => Ok(serde_json::json!({
            "success": true,
            "updated": updated,
            "message": if updated { "yt-dlp atualizado com sucesso" } else { "Já está na versão mais recente" }
        })),
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "error": e.to_string()
        }))
    }
}

#[tauri::command]
pub async fn force_update_ytdlp(app: AppHandle) -> Result<serde_json::Value> {
    match YtDlp::force_update(&app).await {
        Ok(updated) => Ok(serde_json::json!({
            "success": true,
            "updated": updated,
            "message": if updated { "yt-dlp forçado atualizar com sucesso" } else { "Nenhuma atualização necessária" }
        })),
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "error": e.to_string()
        }))
    }
}

#[tauri::command]
pub async fn set_ytdlp_cookies(app: AppHandle, path: String) -> Result<()> {
    let store = app.store("settings.dat")?;
    store.set("ytdlp_cookies", serde_json::json!(path));
    store.save()?;
    Ok(())
}

#[tauri::command]
pub async fn get_ytdlp_cookies(app: AppHandle) -> Result<Option<String>> {
    let store = app.store("settings.dat")?;
    Ok(store.get("ytdlp_cookies").and_then(|v| v.as_str().map(|s| s.to_string())))
}

#[tauri::command]
pub async fn clear_ytdlp_cookies(app: AppHandle) -> Result<()> {
    let store = app.store("settings.dat")?;
    store.delete("ytdlp_cookies");
    store.save()?;
    Ok(())
}

#[tauri::command]
pub async fn set_ytdlp_proxy(app: AppHandle, proxy: String) -> Result<()> {
    let store = app.store("settings.dat")?;
    store.set("ytdlp_proxy", serde_json::json!(proxy.trim()));
    store.save()?;
    Ok(())
}

#[tauri::command]
pub async fn get_ytdlp_proxy(app: AppHandle) -> Result<Option<String>> {
    let store = app.store("settings.dat")?;
    Ok(store.get("ytdlp_proxy").and_then(|v| v.as_str().map(|s| s.to_string())))
}

#[tauri::command]
pub async fn clear_ytdlp_proxy(app: AppHandle) -> Result<()> {
    let store = app.store("settings.dat")?;
    store.delete("ytdlp_proxy");
    store.save()?;
    Ok(())
}

#[tauri::command]
pub async fn set_ytdlp_invidious(app: AppHandle, instance: String) -> Result<()> {
    let store = app.store("settings.dat")?;
    store.set("ytdlp_invidious", serde_json::json!(instance.trim()));
    store.save()?;
    Ok(())
}

#[tauri::command]
pub async fn get_ytdlp_invidious(app: AppHandle) -> Result<Option<String>> {
    let store = app.store("settings.dat")?;
    Ok(store.get("ytdlp_invidious").and_then(|v| v.as_str().map(|s| s.to_string())))
}

#[tauri::command]
pub async fn clear_ytdlp_invidious(app: AppHandle) -> Result<()> {
    let store = app.store("settings.dat")?;
    store.delete("ytdlp_invidious");
    store.save()?;
    Ok(())
}

#[tauri::command]
pub async fn set_cross_source_fallback(app: AppHandle, enabled: bool) -> Result<()> {
    let store = app.store("settings.dat")?;
    store.set("cross_source_fallback", serde_json::json!(enabled));
    store.save()?;
    Ok(())
}

#[tauri::command]
pub async fn get_cross_source_fallback(app: AppHandle) -> Result<bool> {
    let store = app.store("settings.dat")?;
    Ok(store.get("cross_source_fallback").and_then(|v| v.as_bool()).unwrap_or(true))
}

#[tauri::command]
pub async fn set_download_then_play(app: AppHandle, enabled: bool) -> Result<()> {
    let store = app.store("settings.dat")?;
    store.set("download_then_play", serde_json::json!(enabled));
    store.save()?;
    Ok(())
}

#[tauri::command]
pub async fn get_download_then_play(app: AppHandle) -> Result<bool> {
    let store = app.store("settings.dat")?;
    Ok(store.get("download_then_play").and_then(|v| v.as_bool()).unwrap_or(false))
}

/// Detect available browser cookie databases
#[tauri::command]
pub async fn detect_browser_cookies(_app: AppHandle) -> Result<Vec<serde_json::Value>> {
    let mut browsers = Vec::new();

    // Chrome/Chromium-based browsers
    let chrome_browsers = vec![
        ("Chrome", "Google/Chrome/User Data"),
        ("Edge", "Microsoft/Edge/User Data"),
        ("Brave", "BraveSoftware/Brave-Browser/User Data"),
        ("Vivaldi", "Vivaldi/User Data"),
        ("Opera", "Opera Software/Opera Stable"),
        ("Opera GX", "Opera Software/Opera GX Stable"),
    ];

    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        for (name, path_suffix) in chrome_browsers {
            let base_path = PathBuf::from(&local_app_data).join(path_suffix);
            if base_path.exists() {
                // Check for Default profile and other profiles
                let profiles = vec!["Default", "Profile 1", "Profile 2", "Profile 3"];
                for profile in profiles {
                    let cookie_db = base_path.join(profile).join("Network").join("Cookies");
                    if cookie_db.exists() {
                        browsers.push(serde_json::json!({
                            "browser": name,
                            "profile": profile,
                            "path": cookie_db.display().to_string(),
                            "type": "chromium"
                        }));
                    }
                }
            }
        }
    }

    // Firefox
    if let Ok(app_data) = std::env::var("APPDATA") {
        let firefox_profiles = PathBuf::from(&app_data).join("Mozilla/Firefox/Profiles");
        if firefox_profiles.exists() {
            if let Ok(entries) = std::fs::read_dir(&firefox_profiles) {
                for entry in entries.flatten() {
                    let profile_dir = entry.path();
                    let cookie_db = profile_dir.join("cookies.sqlite");
                    if cookie_db.exists() {
                        let profile_name = entry.file_name().to_string_lossy().to_string();
                        browsers.push(serde_json::json!({
                            "browser": "Firefox",
                            "profile": profile_name,
                            "path": cookie_db.display().to_string(),
                            "type": "firefox"
                        }));
                    }
                }
            }
        }
    }

    Ok(browsers)
}

/// Export browser cookies to yt-dlp compatible format (Netscape)
#[tauri::command]
pub async fn import_browser_cookies(app: AppHandle, browser: String, profile: String) -> Result<String> {
    let mut cookie_db_path = None;

    // Find the cookie database
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let chrome_browsers = vec![
            ("Chrome", "Google/Chrome/User Data"),
            ("Edge", "Microsoft/Edge/User Data"),
            ("Brave", "BraveSoftware/Brave-Browser/User Data"),
            ("Vivaldi", "Vivaldi/User Data"),
            ("Opera", "Opera Software/Opera Stable"),
            ("Opera GX", "Opera Software/Opera GX Stable"),
        ];

        for (name, path_suffix) in chrome_browsers {
            if name.to_lowercase() == browser.to_lowercase() {
                let path = PathBuf::from(&local_app_data).join(path_suffix).join(&profile).join("Network").join("Cookies");
                if path.exists() {
                    cookie_db_path = Some((path, "chromium"));
                    break;
                }
            }
        }
    }

    if cookie_db_path.is_none() {
        if let Ok(app_data) = std::env::var("APPDATA") {
            if browser.to_lowercase() == "firefox" {
                let firefox_profiles = PathBuf::from(&app_data).join("Mozilla/Firefox/Profiles");
                if let Ok(entries) = std::fs::read_dir(&firefox_profiles) {
                    for entry in entries.flatten() {
                        if entry.file_name().to_string_lossy() == profile {
                            let path = entry.path().join("cookies.sqlite");
                            if path.exists() {
                                cookie_db_path = Some((path, "firefox"));
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    let Some((db_path, db_type)) = cookie_db_path else {
        return Err(Error::Config("Cookie database not found".into()));
    };

    // Copy the database to a temp location (browsers lock the original)
    let temp_dir = std::env::temp_dir().join("tgtmusic_cookies");
    std::fs::create_dir_all(&temp_dir)?;
    let temp_db = temp_dir.join(format!("cookies_{}.db", uuid::Uuid::new_v4()));
    std::fs::copy(&db_path, &temp_db)?;

    // Extract cookies using rusqlite
    let conn = rusqlite::Connection::open(&temp_db)?;
    let mut cookies_output = String::new();
    cookies_output.push_str("# Netscape HTTP Cookie File\n");
    cookies_output.push_str("# Generated by TGTmusic\n\n");

    if db_type == "chromium" {
        // Chromium cookies table: host_key, name, value, path, expires_utc, is_secure, is_httponly, same_site
        let mut stmt = conn.prepare(
            "SELECT host_key, name, value, path, expires_utc, is_secure, is_httponly
             FROM cookies
             WHERE expires_utc > 0 AND host_key LIKE '%.youtube.%'
                OR host_key LIKE '%.google.%'
                OR host_key LIKE '%.googlevideo.%'
                OR host_key LIKE '%.ytimg.%'"
        )?;

        let rows = stmt.query_map([], |row| {
            let host: String = row.get(0)?;
            let name: String = row.get(1)?;
            let value: String = row.get(2)?;
            let path: String = row.get(3)?;
            let expires_utc: i64 = row.get(4)?;
            let is_secure: i64 = row.get(5)?;
            let _is_httponly: i64 = row.get(6)?;

            // Convert Chrome's Windows FILETIME (microseconds since 1601-01-01) to Unix timestamp
            let expires_unix = (expires_utc / 1_000_000) - 11_644_473_600;

            let domain = if host.starts_with('.') { &host[1..] } else { &host };
            let include_subdomains = if host.starts_with('.') { "TRUE" } else { "FALSE" };
            let secure = if is_secure == 1 { "TRUE" } else { "FALSE" };

            cookies_output.push_str(&format!(
                "{}\t{}\t{}\t{}\t{}\t{}\t{}\n",
                domain, include_subdomains, path, secure, expires_unix, name, value
            ));

            Ok(())
        })?;

        for _ in rows {}
    } else {
        // Firefox cookies table: host, name, value, path, expiry, isSecure, isHttpOnly
        let mut stmt = conn.prepare(
            "SELECT host, name, value, path, expiry, isSecure, isHttpOnly
             FROM moz_cookies
             WHERE expiry > 0 AND (host LIKE '%.youtube.%'
                OR host LIKE '%.google.%'
                OR host LIKE '%.googlevideo.%'
                OR host LIKE '%.ytimg.%')"
        )?;

        let rows = stmt.query_map([], |row| {
            let host: String = row.get(0)?;
            let name: String = row.get(1)?;
            let value: String = row.get(2)?;
            let path: String = row.get(3)?;
            let expiry: i64 = row.get(4)?;
            let is_secure: i64 = row.get(5)?;
            let _is_httponly: i64 = row.get(6)?;

            let domain = if host.starts_with('.') { &host[1..] } else { &host };
            let include_subdomains = if host.starts_with('.') { "TRUE" } else { "FALSE" };
            let secure = if is_secure == 1 { "TRUE" } else { "FALSE" };

            cookies_output.push_str(&format!(
                "{}\t{}\t{}\t{}\t{}\t{}\t{}\n",
                domain, include_subdomains, path, secure, expiry, name, value
            ));

            Ok(())
        })?;

        for _ in rows {}
    }

    // Clean up temp file
    let _ = std::fs::remove_file(&temp_db);

    // Save to settings
    let cookies_file = std::env::temp_dir().join("tgtmusic_cookies").join("youtube_cookies.txt");
    std::fs::write(&cookies_file, &cookies_output)?;

    let store = app.store("settings.dat")?;
    store.set("ytdlp_cookies", serde_json::json!(cookies_file.display().to_string()));
    store.save()?;

    Ok(format!("Imported cookies from {} ({}) to {}", browser, profile, cookies_file.display()))
}
