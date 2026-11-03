# Graph Report - TGTmusic  (2026-11-02)

## Corpus Check
- 46 files · ~15,279 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: .css 3, .exe 1, .example 1)

## Summary
- 373 nodes · 622 edges · 32 communities (15 shown, 17 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- App.tsx
- tauri.conf.json
- AudioEngine
- Error
- database.rs
- Error
- compilerOptions
- commands/settings.rs
- YtDlp
- dependencies
- devDependencies
- library.rs
- Serialize
- package.json
- compilerOptions
- scripts
- vite
- allowBuilds
- TGTmusic — Native Music Player Windows 10+
- embed_metadata
- vite-env.d.ts
- @tauri-apps/plugin-dialog@^2.0.0
- @tauri-apps/plugin-global-shortcut@^2.0.0
- @tauri-apps/plugin-shell@^2.0.0
- zustand
- @types/react-dom@^18.2.0
- @typescript-eslint/eslint-plugin@^7.0.0
- tgtmusic

## God Nodes (most connected - your core abstractions)
1. `useAppStore` - 26 edges
2. `compilerOptions` - 18 edges
3. `AudioEngine` - 17 edges
4. `get_pool()` - 15 edges
5. `Result` - 12 edges
6. `react` - 11 edges
7. `lucide-react` - 11 edges
8. `SpotifyClient` - 11 edges
9. `App()` - 11 edges
10. `YtDlp` - 9 edges

## Surprising Connections (you probably didn't know these)
- `TrackRowProps` --references--> `Track`  [EXTRACTED]
  src/components/TrackRow.tsx → src/stores/useAppStore.ts
- `search_tracks()` --references--> `SpotifyClient`  [EXTRACTED]
  src-tauri/src/commands/search.rs → src-tauri/src/services/spotify.rs
- `SpotifyClient` --references--> `YouTubeClient`  [EXTRACTED]
  src-tauri/src/services/spotify.rs → src-tauri/src/services/youtube.rs
- `App()` --calls--> `LibraryView()`  [EXTRACTED]
  src/App.tsx → src/components/LibraryView.tsx
- `App()` --calls--> `LyricsPanel()`  [EXTRACTED]
  src/App.tsx → src/components/LyricsPanel.tsx

## Import Cycles
- 1-file cycle: `src-tauri/src/utils/error.rs -> src-tauri/src/utils/error.rs`
- 1-file cycle: `src-tauri/src/commands/player.rs -> src-tauri/src/commands/player.rs`

## Communities (32 total, 17 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.12
Nodes (33): lucide-react, react, @tauri-apps/api, App(), PlaybackUpdateEvent, LibraryView(), LyricLine, LyricsPanel() (+25 more)

### Community 1 - "tauri.conf.json"
Cohesion: 0.06
Nodes (30): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+22 more)

### Community 3 - "Error"
Cohesion: 0.11
Nodes (9): search_tracks(), SpotifyAlbum, SpotifyArtist, SpotifyClient, SpotifyImage, SpotifySearchResponse, SpotifyTrack, SpotifyTracks (+1 more)

### Community 4 - "database.rs"
Cohesion: 0.23
Nodes (16): add_to_library(), add_to_playlist(), clear_all_data(), create_playlist(), delete_playlist(), get_library_tracks(), get_playlist_tracks(), get_playlists() (+8 more)

### Community 5 - "Error"
Cohesion: 0.07
Nodes (19): fetch_lyrics(), play_track(), seek(), set_volume(), validate_seek_position(), validate_volume(), Error, Audio (+11 more)

### Community 6 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleResolution (+11 more)

### Community 7 - "commands/settings.rs"
Cohesion: 0.21
Nodes (13): clear_all_data(), get_download_path(), get_theme(), get_ytdlp_path(), import_library(), import_playlists(), open_file(), pick_folder() (+5 more)

### Community 9 - "dependencies"
Cohesion: 0.12
Nodes (16): dependencies, date-fns@^3.6.0, lucide-react@^0.400.0, react@^18.2.0, react-dom@^18.2.0, tailwind-merge@^2.3.0, @tauri-apps/api@^2.0.0, @tauri-apps/plugin-fs@^2.0.0 (+8 more)

### Community 10 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, autoprefixer@^10.4.0, eslint@^8.57.0, postcss@^8.4.0, tailwindcss@^3.4.0, @tauri-apps/cli@^2.0.0, typescript@^5.4.0, @typescript-eslint/parser@^7.0.0 (+7 more)

### Community 11 - "library.rs"
Cohesion: 0.25
Nodes (10): add_to_library(), add_to_playlist(), create_playlist(), delete_playlist(), get_library_tracks(), get_playlist_tracks(), get_playlists(), pick_local_tracks() (+2 more)

### Community 12 - "Serialize"
Cohesion: 0.14
Nodes (5): Playlist, Settings, Track, Playlist, Track

### Community 13 - "package.json"
Cohesion: 0.22
Nodes (8): clsx@^2.1.0, description, @types/react@^18.2.0, name, type, version, clsx, @types/react

### Community 14 - "compilerOptions"
Cohesion: 0.22
Nodes (8): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, strict, include

### Community 15 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, lint, preview, tauri, tauri:build, tauri:dev

### Community 16 - "vite"
Cohesion: 0.33
Nodes (4): vite@^5.2.0, @vitejs/plugin-react@^4.2.0, vite, @vitejs/plugin-react

## Knowledge Gaps
- **12 isolated node(s):** `tgtmusic`, `Io`, `Http`, `Sql`, `Json` (+7 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 135 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Result` connect `Error` to `AudioEngine`, `Error`, `database.rs`, `commands/settings.rs`, `YtDlp`, `library.rs`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **What connects `tgtmusic`, `Io`, `Http` to the rest of the system?**
  _12 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12322695035460993 - nodes in this community are weakly interconnected._
- **Why does `Error` connect `Error` to `YtDlp`, `AudioEngine`, `Error`, `Serialize`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Should `tauri.conf.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Why does `YtDlp` connect `YtDlp` to `AudioEngine`, `Error`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Should `AudioEngine` be split into smaller, more focused modules?**
  _Cohesion score 0.11384615384615385 - nodes in this community are weakly interconnected._