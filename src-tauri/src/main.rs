#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;
mod services;
mod utils;

#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .manage(crate::services::spotify::SpotifyClient::new())
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
            crate::services::audio_engine::ENGINE.set_app_handle(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::player::play_track,
            commands::player::pause,
            commands::player::resume,
            commands::player::stop,
            commands::player::seek,
            commands::player::set_volume,
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
            commands::search::search_tracks,
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}
