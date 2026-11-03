import { useEffect, useState } from 'react'
import { useAppStore, type Track } from '../stores/useAppStore'
import { TrackRow } from './TrackRow'
import { ChevronLeft, Disc3, ListMusic, Loader2, Play, Plus, Shuffle, Trash2 } from 'lucide-react'
import { invoke, isTauri } from '@tauri-apps/api/core'

export function PlaylistView() {
  const { playlists, loadPlaylists, addToQueue, showToast, setCurrentTrack, createPlaylist, deletePlaylist } = useAppStore()
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null)
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    void loadPlaylists()
  }, [loadPlaylists])

  const handlePlaylistClick = async (id: string) => {
    if (!isTauri()) {
      showToast('Playlists locais estão disponíveis no app desktop.', 'info')
      return
    }

    setSelectedPlaylist(id)
    setPlaylistTracks([])
    setLoadError(false)
    setLoading(true)
    try {
      const tracks = await invoke<Track[]>('get_playlist_tracks', { playlistId: id })
      setPlaylistTracks(tracks)
    } catch (error) {
      console.error('Unable to load playlist tracks', error)
      setLoadError(true)
      showToast('Não foi possível carregar as faixas deste mix.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePlaylist = () => {
    const name = prompt('Nome do novo mix:')
    if (name?.trim()) void createPlaylist(name.trim())
  }

  const handleDeletePlaylist = (id: string, name: string) => {
    if (confirm(`Excluir o mix “${name}”?`)) void deletePlaylist(id)
  }

  const handlePlayPlaylist = (shuffleTracks = false) => {
    const playableTracks = playlistTracks.filter((track) => track.source !== 'spotify')
    if (!playableTracks.length) {
      showToast('Este mix não tem faixas com áudio disponível para reprodução.', 'info')
      return
    }

    const queue = [...playableTracks]
    if (shuffleTracks) {
      for (let index = queue.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1))
        ;[queue[index], queue[randomIndex]] = [queue[randomIndex], queue[index]]
      }
    }
    void setCurrentTrack(queue[0], queue, 0)
  }

  if (!selectedPlaylist) {
    return (
      <div className="game-page mx-auto max-w-7xl space-y-6 pb-8 animate-in">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-display text-3xl font-extrabold text-fg-primary sm:text-4xl">Seus mixes</h2>
            <p className="mt-2 text-fg-secondary">
              {playlists.length} {playlists.length === 1 ? 'mix criado' : 'mixes criados'}
            </p>
          </div>
          <button type="button" onClick={handleCreatePlaylist} className="btn-primary min-h-12 gap-2 px-5">
            <Plus className="h-5 w-5" aria-hidden="true" />
            Novo mix
          </button>
        </header>

        {playlists.length === 0 ? (
          <section className="poster-grid relative isolate overflow-hidden rounded-[2rem] border border-white/10 bg-[var(--hero-bg)] p-6 text-[var(--hero-paper)] sm:p-9">
            <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-[var(--hero-lavender)] opacity-20 blur-3xl" />
            <div className="relative max-w-2xl">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--hero-paper)]/20 bg-[var(--hero-disc-dark)] text-[var(--hero-lime)]">
                <Disc3 className="h-7 w-7" aria-hidden="true" />
              </div>
              <h3 className="text-display mt-6 text-3xl font-extrabold sm:text-4xl">Dê um nome ao próximo clima.</h3>
              <p className="mt-3 max-w-xl leading-relaxed text-[var(--hero-paper)]/80">
                Crie um mix para organizar as faixas que combinam com cada momento.
              </p>
              <button type="button" onClick={handleCreatePlaylist} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--hero-lime)] px-5 font-bold text-[var(--hero-bg)] transition-colors hover:bg-[var(--hero-paper)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hero-lime)]">
                <Plus className="h-5 w-5" aria-hidden="true" />
                Criar primeiro mix
              </button>
            </div>
          </section>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" role="list" aria-label="Seus mixes">
            {playlists.map((playlist) => (
              <article key={playlist.id} className="card group overflow-hidden" role="listitem">
                <button
                  type="button"
                  onClick={() => void handlePlaylistClick(playlist.id)}
                  className="block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-brand-primary"
                  aria-label={`Abrir mix ${playlist.name}`}
                >
                  <div className="poster-grid relative flex aspect-square items-center justify-center overflow-hidden bg-[var(--hero-bg)]">
                    <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-[var(--hero-lavender)]/20 via-transparent to-[var(--hero-orange)]/25" />
                    <div aria-hidden="true" className="player-record relative flex h-3/4 w-3/4 items-center justify-center rounded-full shadow-2xl transition-transform duration-300 group-hover:rotate-6">
                      <div className="flex h-1/3 w-1/3 items-center justify-center rounded-full border-4 border-[var(--hero-bg)] bg-[var(--hero-orange)] text-[var(--hero-bg)]">
                        <Disc3 className="h-1/2 w-1/2" aria-hidden="true" />
                      </div>
                    </div>
                    <span className="absolute right-3 top-3 rounded-full border border-white/20 bg-[var(--hero-bg)]/80 px-3 py-1 text-xs font-semibold text-[var(--hero-paper)]">
                      {playlist.trackIds.length} {playlist.trackIds.length === 1 ? 'faixa' : 'faixas'}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="truncate font-semibold text-fg-primary group-hover:text-brand-primary">{playlist.name}</h3>
                    <p className="mt-1 text-sm text-fg-secondary">
                      {playlist.trackIds.length} {playlist.trackIds.length === 1 ? 'faixa no mix' : 'faixas no mix'}
                    </p>
                  </div>
                </button>
                <div className="flex justify-end border-t border-border-subtle px-2 py-1">
                  <button type="button" onClick={() => handleDeletePlaylist(playlist.id, playlist.name)} className="btn-ghost btn-icon-sm min-h-11 min-w-11 text-fg-tertiary hover:bg-red-500/10 hover:text-red-400" aria-label={`Excluir mix ${playlist.name}`}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    )
  }

  const currentPlaylist = playlists.find((playlist) => playlist.id === selectedPlaylist)
  if (!currentPlaylist) {
    return (
      <div className="game-page mx-auto max-w-5xl space-y-6">
        <button type="button" onClick={() => setSelectedPlaylist(null)} className="btn-ghost min-h-11 gap-2">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Voltar aos mixes
        </button>
        <p className="rounded-2xl border border-border-subtle bg-bg-secondary p-6 text-fg-secondary" role="status">Este mix não está mais na sua coleção.</p>
      </div>
    )
  }

  const playableTracks = playlistTracks.filter((track) => track.source !== 'spotify')

  return (
    <div className="game-page mx-auto max-w-5xl space-y-6 pb-8 animate-in">
      <button type="button" onClick={() => setSelectedPlaylist(null)} className="btn-ghost min-h-11 gap-2">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Voltar aos mixes
      </button>

      <section className="poster-grid relative isolate overflow-hidden rounded-[2rem] border border-white/10 bg-[var(--hero-bg)] p-5 text-[var(--hero-paper)] sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-[var(--hero-orange)] opacity-20 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 items-center gap-5">
            <div aria-hidden="true" className="player-record flex h-24 w-24 shrink-0 items-center justify-center rounded-full shadow-xl sm:h-32 sm:w-32">
              <div className="flex h-1/3 w-1/3 items-center justify-center rounded-full border-4 border-[var(--hero-bg)] bg-[var(--hero-lime)] text-[var(--hero-bg)]">
                <Disc3 className="h-1/2 w-1/2" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--hero-lime)]">Seu mix</p>
              <h2 className="text-display mt-1 truncate text-3xl font-extrabold sm:text-5xl">{currentPlaylist.name}</h2>
              <p className="mt-2 text-sm text-[var(--hero-paper)]/75">
                {currentPlaylist.trackIds.length} {currentPlaylist.trackIds.length === 1 ? 'faixa' : 'faixas'} · Criado em {new Date(currentPlaylist.createdAt).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => handlePlayPlaylist()} disabled={loading || playlistTracks.length === 0} className="btn-primary min-h-12 gap-2 px-5 disabled:cursor-not-allowed disabled:opacity-50">
              <Play className="h-5 w-5" aria-hidden="true" />
              Tocar mix
            </button>
            <button type="button" onClick={() => handlePlayPlaylist(true)} disabled={loading || playlistTracks.length === 0} className="btn-secondary min-h-12 gap-2 px-5 disabled:cursor-not-allowed disabled:opacity-50">
              <Shuffle className="h-5 w-5" aria-hidden="true" />
              Aleatório
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-border-subtle bg-bg-secondary" aria-label={`Faixas de ${currentPlaylist.name}`}>
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-fg-secondary" role="status" aria-live="polite">
            <Loader2 className="h-6 w-6 animate-spin text-brand-primary" aria-hidden="true" />
            Carregando faixas…
          </div>
        ) : loadError ? (
          <div className="px-5 py-12 text-center" role="alert">
            <h3 className="text-lg font-semibold text-fg-primary">As faixas não carregaram</h3>
            <p className="mt-2 text-fg-secondary">Volte aos mixes e tente abrir este mix novamente.</p>
          </div>
        ) : playlistTracks.length > 0 ? (
          <>
            <div className="hidden border-b border-border px-4 py-3 text-xs font-semibold text-fg-tertiary lg:grid lg:grid-cols-[48px_1fr_200px_100px_60px] lg:gap-4">
              <div>#</div><div>Faixa</div><div>Artista</div><div>Duração</div><div />
            </div>
            <div className="space-y-1 p-2" role="list" aria-label={`Músicas do mix ${currentPlaylist.name}`}>
              {playlistTracks.map((track, index) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={index + 1}
                  onPlay={() => {
                    const queueIndex = playableTracks.findIndex((item) => item.id === track.id)
                    if (queueIndex >= 0) void setCurrentTrack(track, playableTracks, queueIndex)
                  }}
                  onQueue={() => { addToQueue(track); showToast(`Adicionado à fila: ${track.title}`) }}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="px-5 py-16 text-center">
            <ListMusic className="mx-auto mb-4 h-12 w-12 text-fg-tertiary/50" aria-hidden="true" />
            <h3 className="text-xl font-semibold text-fg-primary">Este mix ainda está vazio</h3>
            <p className="mx-auto mt-2 max-w-md text-fg-secondary">Adicione faixas a este mix para montar sua seleção.</p>
            <button type="button" className="btn-primary mt-6 min-h-11 px-5" onClick={() => useAppStore.getState().setView('search')}>
              Buscar músicas
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
