import { useState, useMemo } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { TrackRow } from './TrackRow'
import { Disc3, Filter, FolderOpen, Grid, List, Play, Plus, Search, Trash2 } from 'lucide-react'

export function LibraryView() {
  const { libraryTracks, setCurrentTrack, addToQueue, showToast, removeTrackFromLibrary, importLocalTracks, setView } = useAppStore()
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [sortBy, setSortBy] = useState<'title' | 'artists' | 'album' | 'added' | 'duration'>('added')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [filter, setFilter] = useState('')

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  const sortedTracks = useMemo(() => {
    return [...libraryTracks].sort((a, b) => {
      let aVal: string | number
      let bVal: string | number

      if (sortBy === 'artists') {
        aVal = a.artists[0] || ''
        bVal = b.artists[0] || ''
      } else if (sortBy === 'added') {
        aVal = a.addedAt
        bVal = b.addedAt
      } else if (sortBy === 'duration') {
        aVal = a.duration
        bVal = b.duration
      } else if (sortBy === 'title') {
        aVal = a.title
        bVal = b.title
      } else if (sortBy === 'album') {
        aVal = a.album
        bVal = b.album
      } else {
        aVal = ''
        bVal = ''
      }

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = (bVal as string).toLowerCase()
      }

      const dir = sortOrder === 'asc' ? 1 : -1
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal > bVal ? dir : aVal < bVal ? -dir : 0
      }
      return (aVal as number) > (bVal as number) ? dir : (aVal as number) < (bVal as number) ? -dir : 0
    })
  }, [libraryTracks, sortBy, sortOrder])

  const filteredTracks = sortedTracks.filter(track =>
    track.title.toLowerCase().includes(filter.toLowerCase()) ||
    track.artists.some(a => a.toLowerCase().includes(filter.toLowerCase())) ||
    track.album.toLowerCase().includes(filter.toLowerCase())
  )

  if (!libraryTracks.length) {
    return (
      <div className="game-page mx-auto max-w-5xl space-y-6 pb-8 animate-in">
        <section className="poster-grid relative isolate overflow-hidden rounded-[2rem] border border-white/10 bg-[var(--hero-bg)] p-6 text-[var(--hero-paper)] sm:p-9">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-[var(--hero-lavender)] opacity-20 blur-3xl" />
          <div className="relative max-w-2xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem_0.4rem_1.2rem_0.4rem] bg-[var(--hero-lime)] text-[var(--hero-bg)]">
              <Disc3 className="h-7 w-7" aria-hidden="true" />
            </div>
            <h2 className="text-display mt-6 text-4xl font-extrabold leading-tight sm:text-5xl">Sua coleção começa com uma faixa.</h2>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-[var(--hero-paper)]/80">
              Guarde músicas encontradas na busca ou importe arquivos de áudio do seu dispositivo.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-5 rounded-3xl border border-border-subtle bg-bg-secondary p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div>
            <h3 className="text-xl font-semibold text-fg-primary">Ainda não há faixas salvas</h3>
            <p className="mt-1 text-fg-secondary">Escolha uma fonte para adicionar música à sua coleção.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setView('search')} className="btn-primary min-h-11 gap-2 px-5">
              <Plus className="h-5 w-5" aria-hidden="true" />
              Buscar músicas
            </button>
            <button type="button" onClick={importLocalTracks} className="btn-secondary min-h-11 gap-2 px-5">
              <FolderOpen className="h-5 w-5" aria-hidden="true" />
              Importar áudio
            </button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="game-page mx-auto max-w-7xl space-y-6 pb-8 animate-in">
      {/* Collection Header */}
      <div className="poster-grid relative isolate flex flex-col gap-5 overflow-hidden rounded-[2rem] border border-white/10 bg-[var(--hero-bg)] p-5 text-[var(--hero-paper)] sm:flex-row sm:items-end sm:justify-between sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[var(--hero-orange)] opacity-15 blur-3xl" />
        <div className="relative flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[var(--hero-paper)]/20 bg-[var(--hero-disc-dark)] text-[var(--hero-lime)] shadow-lg">
            <Disc3 className="h-7 w-7" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-display text-3xl font-extrabold sm:text-4xl">Sua coleção</h2>
            <p className="mt-1 text-sm text-[var(--hero-paper)]/75">
              {libraryTracks.length} {libraryTracks.length === 1 ? 'faixa salva' : 'faixas salvas'}
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-tertiary" aria-hidden="true" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar sua coleção…"
              className="input pl-10 pr-4 py-2 text-sm"
              aria-label="Filtrar biblioteca"
            />
          </div>
          <button onClick={importLocalTracks} className="btn-secondary min-h-11 gap-2 px-4 whitespace-nowrap">
            <FolderOpen className="w-4 h-4" />
            Importar áudio
          </button>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="input py-2 text-sm w-auto"
              aria-label="Ordenar por"
            >
              <option value="added">Adicionado recentemente</option>
              <option value="title">Título</option>
              <option value="artists">Artista</option>
              <option value="album">Álbum</option>
              <option value="duration">Duração</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="btn-ghost btn-icon-sm p-2"
              aria-label={sortOrder === 'asc' ? 'Ordem decrescente' : 'Ordem crescente'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex bg-bg-tertiary rounded-xl p-1" role="group" aria-label="Modo de visualização">
            <button
              onClick={() => setViewMode('list')}
              className={`btn-ghost btn-icon-sm p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-brand-primary/10 text-brand-primary' : 'text-fg-tertiary hover:text-fg-primary'}`}
              aria-label="Visualização em lista"
              aria-pressed={viewMode === 'list'}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`btn-ghost btn-icon-sm p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-brand-primary/10 text-brand-primary' : 'text-fg-tertiary hover:text-fg-primary'}`}
              aria-label="Visualização em grade"
              aria-pressed={viewMode === 'grid'}
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* List View */}
      {viewMode === 'list' && (
        <div className="card overflow-hidden">
          {/* Table Header */}
          <div className="hidden lg:grid grid-cols-[48px_1fr_200px_140px_100px_60px] gap-4 px-4 py-3 text-xs text-fg-tertiary uppercase tracking-wider border-b border-border font-medium bg-bg-tertiary/50">
            <div>#</div>
            <div>Título</div>
            <div>Artista</div>
            <div>Álbum</div>
            <div>Duração</div>
            <div></div>
          </div>

          {/* Tracks */}
          <div className="space-y-1 p-2" role="list" aria-label="Músicas da biblioteca">
            {filteredTracks.map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i + 1}
                onPlay={() => setCurrentTrack(track, filteredTracks, i)}
                onQueue={() => { addToQueue(track); showToast(`Adicionado à fila: ${track.title}`) }}
                onRemove={() => removeTrackFromLibrary(track.id)}
              />
            ))}
          </div>

        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" role="list" aria-label="Músicas da biblioteca">
          {filteredTracks.map((track, i) => (
            <article key={track.id} className="card group overflow-hidden" role="listitem">
              <div className="relative aspect-square overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCurrentTrack(track, filteredTracks, i)}
                  className="group/play relative block h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-brand-primary"
                  aria-label={`Tocar ${track.title} por ${track.artists.join(', ')}`}
                >
                  <img src={track.albumArt} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover/play:scale-105" loading="lazy" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white opacity-0 transition-opacity group-hover/play:opacity-100 group-focus-visible/play:opacity-100">
                    <Play className="h-8 w-8" aria-hidden="true" />
                  </span>
                </button>
                <div className="pointer-events-none absolute left-3 top-3">
                  <span className="badge badge-primary text-xs">#{i + 1}</span>
                </div>
              </div>
              <div className="space-y-2 p-4">
                <button type="button" onClick={() => setCurrentTrack(track, filteredTracks, i)} className="min-h-11 w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary">
                  <span className="block truncate font-semibold text-fg-primary transition-colors group-hover:text-brand-primary">{track.title}</span>
                  <span className="block truncate text-sm text-fg-secondary">{track.artists.join(', ')}</span>
                  <span className="block truncate text-xs text-fg-tertiary">{track.album}</span>
                </button>
                <div className="flex items-center justify-between gap-2 border-t border-border-subtle pt-2">
                  <span className="text-mono text-xs text-fg-tertiary">{formatTime(track.duration)}</span>
                  <span className="badge badge-neutral text-xs">{track.source === 'local' ? 'Arquivo local' : track.source === 'spotify' ? 'Só metadados' : 'YouTube'}</span>
                </div>
                <div className="flex justify-end gap-1">
                  <button type="button" onClick={() => { addToQueue(track); showToast(`Adicionado à fila: ${track.title}`) }} className="btn-ghost btn-icon-sm min-h-11 min-w-11 text-fg-tertiary hover:text-brand-primary" aria-label={`Adicionar ${track.title} à fila`}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => removeTrackFromLibrary(track.id)} className="btn-ghost btn-icon-sm min-h-11 min-w-11 text-fg-tertiary hover:bg-red-500/10 hover:text-red-400" aria-label={`Remover ${track.title} da coleção`}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {filteredTracks.length === 0 && libraryTracks.length > 0 && (
        <div className="card p-12 text-center animate-in">
          <Filter className="w-12 h-12 mx-auto mb-4 text-fg-tertiary/30" />
          <h3 className="text-xl font-semibold text-fg-primary mb-2">Nenhum resultado</h3>
          <p className="text-fg-secondary">Tente ajustar seu filtro ou busca</p>
          <button onClick={() => setFilter('')} className="btn-ghost mt-4">Limpar filtro</button>
        </div>
      )}
    </div>
  )
}