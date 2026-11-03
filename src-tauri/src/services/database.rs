use crate::models::{Playlist, Track};
use crate::utils::Result;
use sqlx::{FromRow, Row, SqlitePool};
use tauri::Manager;

pub async fn init_db(app: &tauri::AppHandle) -> Result<SqlitePool> {
    let path = app.path().app_data_dir()?.join("tgtmusic.db");
    let pool = SqlitePool::connect(&format!("sqlite:{}", path.display())).await?;
    Ok(pool)
}

pub async fn get_pool(app: &tauri::AppHandle) -> Result<SqlitePool> {
    let path = app.path().app_data_dir()?.join("tgtmusic.db");
    SqlitePool::connect(&format!("sqlite:{}", path.display()))
        .await
        .map_err(Into::into)
}

#[derive(FromRow)]
struct TrackRow {
    id: String,
    title: String,
    artists: String,
    album: String,
    album_art: String,
    duration: i64,
    source: String,
    source_id: String,
    url: Option<String>,
    added_at: i64,
    playlist_id: Option<String>,
}

impl From<TrackRow> for Track {
    fn from(r: TrackRow) -> Self {
        Track {
            id: r.id,
            title: r.title,
            artists: serde_json::from_str(&r.artists).unwrap_or_default(),
            album: r.album,
            album_art: r.album_art,
            duration: r.duration,
            source: r.source,
            source_id: r.source_id,
            url: r.url,
            added_at: r.added_at,
            playlist_id: r.playlist_id,
        }
    }
}

pub async fn get_library_tracks(app: &tauri::AppHandle) -> Result<Vec<Track>> {
    let pool = get_pool(app).await?;
    let rows = sqlx::query_as::<_, TrackRow>(
        "SELECT * FROM tracks WHERE playlist_id IS NULL ORDER BY added_at DESC",
    )
    .fetch_all(&pool)
    .await?;
    Ok(rows.into_iter().map(Into::into).collect())
}

pub async fn add_to_library(app: &tauri::AppHandle, track: &Track) -> Result<()> {
    let pool = get_pool(app).await?;
    sqlx::query("INSERT OR REPLACE INTO tracks (id, title, artists, album, album_art, duration, source, source_id, url, added_at, playlist_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&track.id).bind(&track.title).bind(serde_json::to_string(&track.artists)?)
        .bind(&track.album).bind(&track.album_art).bind(track.duration)
        .bind(&track.source).bind(&track.source_id).bind(&track.url).bind(track.added_at)
        .bind(None::<String>).execute(&pool).await?;
    Ok(())
}

pub async fn remove_from_library(app: &tauri::AppHandle, track_id: &str) -> Result<()> {
    let pool = get_pool(app).await?;
    sqlx::query("DELETE FROM tracks WHERE id = ? AND playlist_id IS NULL")
        .bind(track_id)
        .execute(&pool)
        .await?;
    Ok(())
}

pub async fn get_playlists(app: &tauri::AppHandle) -> Result<Vec<Playlist>> {
    let pool = get_pool(app).await?;
    let rows = sqlx::query(
        "SELECT id, name, created_at, updated_at FROM playlists ORDER BY updated_at DESC",
    )
    .fetch_all(&pool)
    .await?;
    let mut playlists = Vec::new();
    for row in rows {
        let id: String = row.get("id");
        let tracks = sqlx::query(
            "SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position",
        )
        .bind(&id)
        .fetch_all(&pool)
        .await?;
        playlists.push(Playlist {
            id,
            name: row.get("name"),
            track_ids: tracks.iter().map(|r| r.get("track_id")).collect(),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        });
    }
    Ok(playlists)
}

pub async fn create_playlist(app: &tauri::AppHandle, name: &str) -> Result<()> {
    let pool = get_pool(app).await?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    sqlx::query("INSERT INTO playlists (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
        .bind(&id)
        .bind(name)
        .bind(now)
        .bind(now)
        .execute(&pool)
        .await?;
    Ok(())
}

pub async fn delete_playlist(app: &tauri::AppHandle, id: &str) -> Result<()> {
    let pool = get_pool(app).await?;
    sqlx::query("DELETE FROM playlists WHERE id = ?")
        .bind(id)
        .execute(&pool)
        .await?;
    sqlx::query("DELETE FROM playlist_tracks WHERE playlist_id = ?")
        .bind(id)
        .execute(&pool)
        .await?;
    Ok(())
}

pub async fn get_playlist_tracks(app: &tauri::AppHandle, playlist_id: &str) -> Result<Vec<Track>> {
    let pool = get_pool(app).await?;
    let rows = sqlx::query_as::<_, TrackRow>(
        "SELECT t.* FROM tracks t JOIN playlist_tracks pt ON t.id = pt.track_id WHERE pt.playlist_id = ? ORDER BY pt.position"
    ).bind(playlist_id).fetch_all(&pool).await?;
    Ok(rows.into_iter().map(Into::into).collect())
}

pub async fn add_to_playlist(
    app: &tauri::AppHandle,
    playlist_id: &str,
    track_id: &str,
) -> Result<()> {
    let pool = get_pool(app).await?;
    let pos = sqlx::query_scalar(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM playlist_tracks WHERE playlist_id = ?",
    )
    .bind(playlist_id)
    .fetch_one(&pool)
    .await
    .unwrap_or(0);
    sqlx::query(
        "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)",
    )
    .bind(playlist_id)
    .bind(track_id)
    .bind(pos)
    .execute(&pool)
    .await?;
    sqlx::query("UPDATE playlists SET updated_at = ? WHERE id = ?")
        .bind(chrono::Utc::now().timestamp_millis())
        .bind(playlist_id)
        .execute(&pool)
        .await?;
    Ok(())
}

pub async fn remove_from_playlist(
    app: &tauri::AppHandle,
    playlist_id: &str,
    track_id: &str,
) -> Result<()> {
    let pool = get_pool(app).await?;
    sqlx::query("DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?")
        .bind(playlist_id)
        .bind(track_id)
        .execute(&pool)
        .await?;
    sqlx::query("UPDATE playlists SET updated_at = ? WHERE id = ?")
        .bind(chrono::Utc::now().timestamp_millis())
        .bind(playlist_id)
        .execute(&pool)
        .await?;
    Ok(())
}

pub async fn import_library(app: &tauri::AppHandle, tracks: Vec<Track>) -> Result<()> {
    let pool = get_pool(app).await?;
    for track in tracks {
        add_to_library(app, &track).await?;
    }
    Ok(())
}

pub async fn import_playlists(app: &tauri::AppHandle, playlists: Vec<Playlist>) -> Result<()> {
    let pool = get_pool(app).await?;
    for pl in playlists {
        sqlx::query("INSERT OR REPLACE INTO playlists (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
            .bind(&pl.id).bind(&pl.name).bind(pl.created_at).bind(pl.updated_at).execute(&pool).await?;
        for (i, tid) in pl.track_ids.iter().enumerate() {
            sqlx::query("INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)")
                .bind(&pl.id).bind(tid).bind(i as i64).execute(&pool).await?;
        }
    }
    Ok(())
}

pub async fn clear_all_data(app: &tauri::AppHandle) -> Result<()> {
    let pool = get_pool(app).await?;
    sqlx::query("DELETE FROM playlist_tracks")
        .execute(&pool)
        .await?;
    sqlx::query("DELETE FROM playlists").execute(&pool).await?;
    sqlx::query("DELETE FROM tracks").execute(&pool).await?;
    Ok(())
}
