import { useEffect } from 'react'
import { useAppStore, type Track } from './stores/useAppStore'
import { Player } from './components/Player'
import { Sidebar } from './components/Sidebar'
import { SearchView } from './components/SearchView'
import { LibraryView } from './components/LibraryView'
import { PlaylistView } from './components/PlaylistView'
import { SettingsView } from './components/SettingsView'
import { ToastContainer } from './components/ToastContainer'
import { LyricsPanel } from './components/LyricsPanel'
import { isTauri } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

interface PlaybackUpdateEvent { position: number; duration: number; playing: boolean }

function App() {
  const { view, setView, init, theme, toggleTheme, showToast, nextTrack } = useAppStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!isTauri()) return

    let disposed = false
    const unlisteners: UnlistenFn[] = []
    const subscribe = (register: () => Promise<UnlistenFn>) =>
      register().then((unlisten) => {
        if (disposed) unlisten()
        else unlisteners.push(unlisten)
      })

    void Promise.all([
      subscribe(() => listen<PlaybackUpdateEvent>('playback-update', (event) => {
        useAppStore.setState({
          position: event.payload.position,
          duration: event.payload.duration,
          isPlaying: event.payload.playing,
        })
      })),
      subscribe(() => listen('track-ended', () => { void nextTrack() })),
      subscribe(() => listen<Track | null>('track-changed', (event) => {
        useAppStore.setState({ currentTrack: event.payload })
      })),
    ]).catch((error) => {
      if (!disposed) {
        console.error('Unable to subscribe to native app events', error)
        showToast('Não foi possível conectar aos eventos do app.', 'error')
      }
    })

    void init().catch((error) => {
      console.error('Unable to initialize native app state', error)
      showToast('Não foi possível carregar os dados locais.', 'error')
    })

    return () => {
      disposed = true
      unlisteners.splice(0).forEach((unlisten) => unlisten())
    }
  }, [init, nextTrack, showToast])

  const views = {
    search: <SearchView />,
    library: <LibraryView />,
    playlists: <PlaylistView />,
    settings: <SettingsView />,
  }

  return (
    <div className="flex h-dvh w-full min-w-0 overflow-hidden bg-bg-primary">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-bg-secondary/80 backdrop-blur-sm z-10">
          <div className="flex items-center gap-4">
            <button onClick={toggleTheme} className="btn-ghost btn-icon p-2" aria-label="Alternar tema">
              {theme === 'dark' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>
            <h1 className="text-xl font-bold text-gradient-brand text-display">TGTmusic</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setView('search')} className="btn-ghost btn-icon p-2" aria-label="Buscar">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 pb-[176px] sm:p-6 sm:pb-[176px] lg:pb-[120px]">{views[view] || <SearchView />}</main>
        <Player />
        <ToastContainer />
        <LyricsPanel />
      </div>
    </div>
  )
}

export default App