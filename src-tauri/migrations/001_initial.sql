CREATE TABLE IF NOT EXISTS tracks ( id TEXT PRIMARY KEY, title TEXT NOT NULL, artists TEXT NOT NULL, album TEXT NOT NULL, album_art TEXT NOT NULL, duration INTEGER NOT NULL, source TEXT NOT NULL, source_id TEXT NOT NULL, url TEXT, added_at INTEGER NOT NULL, playlist_id TEXT REFERENCES playlists(id) ON DELETE SET NULL );
CREATE TABLE IF NOT EXISTS playlists ( id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL );
CREATE TABLE IF NOT EXISTS playlist_tracks ( playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE, track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE, position INTEGER NOT NULL, PRIMARY KEY (playlist_id, track_id) );
CREATE INDEX IF NOT EXISTS idx_tracks_playlist ON tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_added_at ON tracks(added_at DESC);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_position ON playlist_tracks(playlist_id, position);