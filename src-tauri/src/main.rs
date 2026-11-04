#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;
mod services;
mod utils;

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
    Emitter,
};
use std::time::Duration;
use tauri_plugin_store::StoreExt;

#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .manage(crate::services::spotify::SpotifyClient::new())
        .invoke_handler(tauri::generate_handler![
            commands::search::search_tracks,
            commands::search::search_tracks_source,
            commands::settings::check_ytdlp_binary,
        ])
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations(
                    "sqlite:tgtmusic.db",
                    vec![tauri_plugin_sql::Migration {
                        version: 1,
                        description: "initial",
                        sql: include_str!("../migrations/001_initial.sql"),
                        kind: tauri_plugin_sql::MigrationKind::Up,
                    }],
                )
                .build(),
        )
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let _ = app
                .handle()
                .plugin(tauri_plugin_store::Builder::new().build());

            // Initialize audio engine cache directory
            if let Ok(store) = app.handle().store("settings.dat") {
                if let Some(download_path) = store
                    .get("download_path")
                    .and_then(|v| v.as_str().map(|s| s.to_string()))
                    .map(std::path::PathBuf::from)
                {
                    let cache_dir = download_path.join("cache");
                    crate::services::audio_engine::ENGINE.set_cache_dir(cache_dir);
                }
            }

            crate::services::audio_engine::ENGINE.set_app_handle(app.handle().clone());

            // Verify yt-dlp binary on startup
            let app_handle = app.handle().clone();
            tokio::spawn(async move {
                match crate::services::ytdlp::YtDlp::verify_binary(&app_handle).await {
                    Ok(version) => eprintln!("[Startup] yt-dlp verified: {}", version),
                    Err(e) => eprintln!("[Startup] yt-dlp verification failed: {}", e),
                }

                // Auto-update yt-dlp in background
                let app_handle2 = app_handle.clone();
                tokio::spawn(async move {
                    tokio::time::sleep(Duration::from_secs(5)).await; // Wait for app to be ready
                    match crate::services::ytdlp::YtDlp::auto_update(&app_handle2).await {
                        Ok(updated) => {
                            if updated {
                                eprintln!("[Startup] yt-dlp auto-updated successfully");
                            } else {
                                eprintln!("[Startup] yt-dlp already up to date");
                            }
                        }
                        Err(e) => eprintln!("[Startup] yt-dlp auto-update failed: {}", e),
                    }
                });
            });

            // Create system tray with media controls
            create_system_tray(app.handle())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::player::play_track,
            commands::player::pause,
            commands::player::resume,
            commands::player::stop,
            commands::player::seek,
            commands::player::set_volume,
            commands::player::global_play_pause,
            commands::player::global_next,
            commands::player::global_prev,
            commands::library::get_library_tracks,
            commands::library::add_to_library,
            commands::library::remove_from_library,
            commands::library::get_playlists,
            commands::library::create_playlist,
            commands::library::delete_playlist,
            commands::library::get_playlist_tracks,
            commands::library::add_to_playlist,
            commands::library::remove_from_playlist,
            commands::library::pick_local_tracks,
            commands::lyrics::fetch_lyrics,
            commands::settings::get_theme,
            commands::settings::set_theme,
            commands::settings::get_download_path,
            commands::settings::set_download_path,
            commands::settings::get_ytdlp_path,
            commands::settings::set_ytdlp_path,
            commands::settings::save_file,
            commands::settings::open_file,
            commands::settings::pick_folder,
            commands::settings::clear_all_data,
            commands::settings::import_library,
            commands::settings::import_playlists,
            commands::settings::set_crossfade,
            commands::settings::test_yt_dlp,
            commands::settings::test_yt_dlp_search,
            commands::settings::test_yt_dlp_raw,
            commands::settings::test_yt_dlp_search_direct,
            commands::settings::check_ytdlp_binary,
            commands::settings::update_ytdlp,
            commands::settings::force_update_ytdlp,
            commands::settings::set_ytdlp_cookies,
            commands::settings::get_ytdlp_cookies,
            commands::settings::clear_ytdlp_cookies,
            commands::settings::set_cross_source_fallback,
            commands::settings::get_cross_source_fallback,
            commands::settings::set_download_then_play,
            commands::settings::get_download_then_play,
            commands::settings::detect_browser_cookies,
            commands::settings::import_browser_cookies,
            commands::settings::set_ytdlp_proxy,
            commands::settings::get_ytdlp_proxy,
            commands::settings::clear_ytdlp_proxy,
            commands::settings::set_ytdlp_invidious,
            commands::settings::get_ytdlp_invidious,
            commands::settings::clear_ytdlp_invidious,
            commands::search::search_tracks,
            commands::search::search_tracks_source,
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}

fn create_system_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show", "Mostrar TGTmusic", true, None::<&str>)?;
    let play_pause_item = MenuItem::with_id(app, "play_pause", "▶️ Play / ⏸️ Pause", true, None::<&str>)?;
    let next_item = MenuItem::with_id(app, "next", "⏭️ Próxima", true, None::<&str>)?;
    let prev_item = MenuItem::with_id(app, "prev", "⏮️ Anterior", true, None::<&str>)?;
    let separator = MenuItem::with_id(app, "sep1", "", false, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[
        &show_item,
        &play_pause_item,
        &next_item,
        &prev_item,
        &separator,
        &quit_item,
    ])?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(move |app, event| {
            match event.id.as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "play_pause" => {
                    let _ = app.emit("tray-play-pause", ());
                }
                "next" => {
                    let _ = app.emit("tray-next", ());
                }
                "prev" => {
                    let _ = app.emit("tray-prev", ());
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}
