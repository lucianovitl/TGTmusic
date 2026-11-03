# TGTmusic — Native Music Player Windows 10+

## 🚀 Quick Start

```bash
pnpm install
# Instalar yt-dlp (obrigatório)
scoop install yt-dlp
# Ou baixe em https://github.com/yt-dlp/yt-dlp/releases

pnpm tauri:dev   # Rode em desenvolvimento
pnpm tauri:build # Build para Windows 10+
# Resultado: src-tauri/target/release/bundle/x64-msvc/TGTmusic.exe + yt-dlp.exe incluso