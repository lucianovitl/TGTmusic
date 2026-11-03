import { useState, useRef, useCallback } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { useAppStore } from '../stores/useAppStore'
import { TrackRow } from './TrackRow'
import { LoadingBar, LoadingDots } from './Loading'
import { Coffee, Disc3, Dumbbell, Globe2, Guitar, Headphones, Loader2, Mic2, Music, Music2, Search as SearchIcon, Sparkles, X } from 'lucide-react'

const suggestions = [
  { label: 'Top Brasil', icon: Globe2, query: 'top brasil 2026', color: 'bg-[var(--hero-paper)] text-[var(--hero-bg)]', shape: 'rounded-[1.7rem_0.65rem_1.7rem_0.65rem]' },
  { label: 'Pop internacional', icon: Headphones, query: 'pop hits 2026', color: 'bg-[var(--hero-orange)] text-[var(--hero-bg)]', shape: 'rounded-full' },
  { label: 'Rock clássico', icon: Guitar, query: 'classic rock', color: 'bg-[var(--hero-lime)] text-[var(--hero-bg)]', shape: 'rounded-[0.65rem_1.7rem_0.65rem_1.7rem]' },
  { label: 'Eletrônica', icon: Music, query: 'electronic music', color: 'bg-[var(--hero-lavender)] text-[var(--hero-bg)]', shape: 'rounded-2xl' },
  { label: 'Hip hop', icon: Mic2, query: 'hip hop 2026', color: 'bg-[var(--hero-pink)] text-[var(--hero-bg)]', shape: 'rounded-[1.7rem_0.65rem_1.7rem_0.65rem]' },
  { label: 'Indie', icon: Disc3, query: 'indie music', color: 'bg-[var(--hero-lime)] text-[var(--hero-bg)]', shape: 'rounded-full' },
  { label: 'Lo-fi', icon: Coffee, query: 'lofi beats', color: 'bg-[var(--hero-orange)] text-[var(--hero-bg)]', shape: 'rounded-[0.65rem_1.7rem_0.65rem_1.7rem]' },
  { label: 'Treino', icon: Dumbbell, query: 'workout music', color: 'bg-[var(--hero-paper)] text-[var(--hero-bg)]', shape: 'rounded-2xl' },
]

export function SearchView() {
  const { search, searchResults, searchLoading, searchError, searchErrorMessage, setCurrentTrack, addToQueue, showToast, libraryTracks, playlists, setView } = useAppStore()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const nativeApp = isTauri()

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) await search(query)
  }, [query, search])

  const handleClear = useCallback(() => {
    setQuery('')
    void search('')
    inputRef.current?.focus()
  }, [search])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleClear()
  }, [handleClear])

  return (
    <div className="game-page mx-auto max-w-6xl space-y-8 pb-8" aria-labelledby="search-heading">
      <section className="relative isolate overflow-hidden rounded-[2rem] border border-white/10 bg-[var(--hero-bg)] text-[var(--hero-paper)] shadow-2xl">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.13]"
          style={{ backgroundImage: 'radial-gradient(var(--hero-paper) 1px, transparent 1px)', backgroundSize: '18px 18px' }}
        />
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[var(--hero-orange)] opacity-20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-[var(--hero-lavender)] opacity-20 blur-3xl" />

        <div className="relative grid items-center gap-8 px-5 py-8 sm:px-8 sm:py-10 lg:min-h-[430px] lg:grid-cols-[1.2fr_0.8fr] lg:px-12">
          <div className="min-w-0">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[var(--hero-lime)] px-3 py-1.5 text-sm font-bold text-[var(--hero-bg)] shadow-lg shadow-black/20">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              A pista está aberta
            </div>
            <h2 id="search-heading" className="text-display max-w-2xl text-4xl font-extrabold leading-[0.98] tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl">
              A próxima faixa pode mudar sua fase.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--hero-paper)]/80 sm:text-lg">
              Descubra sons novos, monte seu set e deixe a próxima música encontrar você.
            </p>

            <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--hero-paper)]/60" aria-hidden="true" />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Artista, faixa ou link do YouTube"
                  className="h-14 w-full rounded-2xl border border-white/20 bg-black/20 pl-12 pr-12 text-base text-white outline-none placeholder:text-[var(--hero-paper)]/50 focus-visible:ring-2 focus-visible:ring-[var(--hero-lime)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--hero-bg)]"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Buscar músicas"
                  aria-busy={searchLoading}
                />
                {query && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hero-lime)]"
                    aria-label="Limpar busca"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={searchLoading || !query.trim()}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[var(--hero-lime)] px-6 font-bold text-[var(--hero-bg)] shadow-lg shadow-black/20 transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hero-lime)] disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-40"
              >
                {searchLoading ? <LoadingDots className="h-5" color="text-[var(--hero-bg)]" /> : <SearchIcon className="h-5 w-5" aria-hidden="true" />}
                <span>{searchLoading ? 'Buscando…' : 'Buscar som'}</span>
              </button>
            </form>

            <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-[var(--hero-paper)]/75" role="status" aria-live="polite">
              <Globe2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {nativeApp
                ? 'A busca usa a conexão deste dispositivo; disponibilidade pode variar por região.'
                : 'Prévia no navegador: busca e reprodução reais precisam do app desktop ou de um servidor online.'}
            </p>
          </div>

          <div className="relative mx-auto flex min-h-[220px] w-full max-w-sm items-center justify-center sm:min-h-[280px] lg:min-h-[340px]" aria-hidden="true">
            <div className="absolute right-1 top-4 z-10 rotate-6 rounded-full border-2 border-[var(--hero-bg)] bg-[var(--hero-pink)] px-4 py-2 text-sm font-extrabold text-[var(--hero-bg)] shadow-xl sm:right-0 sm:top-8">
              lado A · aumenta o som
            </div>
            <div
              className="relative aspect-square w-52 rounded-full border-[10px] border-[var(--hero-paper)] shadow-[0_25px_60px_rgba(0,0,0,0.45)] sm:w-64 lg:w-72"
              style={{ backgroundImage: 'repeating-radial-gradient(circle, var(--hero-disc-light) 0 1px, var(--hero-disc-dark) 2px 7px)' }}
            >
              <div className="absolute inset-[31%] flex items-center justify-center rounded-full border-[6px] border-[var(--hero-bg)] bg-[var(--hero-orange)] text-[var(--hero-bg)]">
                <Music2 className="h-10 w-10" aria-hidden="true" />
              </div>
              <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--hero-paper)]" />
            </div>
            <div className="absolute bottom-2 left-1 rotate-[-7deg] rounded-xl bg-[var(--hero-lime)] px-3 py-2 text-xs font-black tracking-wide text-[var(--hero-bg)] shadow-lg sm:bottom-5 sm:left-0">
              33⅓ RPM · mix sem regra
            </div>
            <div className="absolute bottom-7 right-2 flex h-12 w-12 rotate-12 items-center justify-center rounded-full bg-[var(--hero-lavender)] text-[var(--hero-bg)] shadow-lg sm:bottom-12 sm:right-1 sm:h-14 sm:w-14">
              <Disc3 className="h-7 w-7" />
            </div>
          </div>
        </div>
      </section>

      {!query && (
        <section className="grid gap-3 sm:grid-cols-2" aria-label="Seu espaço musical">
          <button
            type="button"
            onClick={() => setView('library')}
            className="group flex min-h-[88px] items-center gap-4 rounded-2xl border border-border-subtle bg-bg-secondary/80 px-5 py-4 text-left transition-colors hover:border-brand-primary/50 hover:bg-bg-tertiary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem_0.4rem_1rem_0.4rem] bg-[var(--hero-lime)] text-[var(--hero-bg)]">
              <Music className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-fg-primary">Sua coleção</span>
              <span className="block text-sm text-fg-secondary">{libraryTracks.length} {libraryTracks.length === 1 ? 'faixa salva' : 'faixas salvas'}</span>
            </span>
            <Disc3 className="h-5 w-5 shrink-0 text-fg-tertiary transition-transform group-hover:rotate-12" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setView('playlists')}
            className="group flex min-h-[88px] items-center gap-4 rounded-2xl border border-border-subtle bg-bg-secondary/80 px-5 py-4 text-left transition-colors hover:border-brand-primary/50 hover:bg-bg-tertiary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--hero-lavender)] text-[var(--hero-bg)]">
              <Disc3 className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-fg-primary">Seus mixes</span>
              <span className="block text-sm text-fg-secondary">{playlists.length} {playlists.length === 1 ? 'playlist criada' : 'playlists criadas'}</span>
            </span>
            <Music2 className="h-5 w-5 shrink-0 text-fg-tertiary transition-transform group-hover:-rotate-6" aria-hidden="true" />
          </button>
        </section>
      )}

      {searchLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-center w-full" aria-live="polite">
          <div className="mb-4 w-full max-w-md">
            <LoadingBar className="h-2 rounded-full" />
          </div>
          <Loader2 className="mb-4 h-10 w-10 animate-spin text-brand-primary" aria-hidden="true" />
          <p className="text-lg font-semibold text-fg-primary">Procurando faixas…</p>
          <p className="mt-1 text-sm text-fg-secondary">Em uma conexão mais lenta, pode levar alguns segundos.</p>
        </div>
      )}

      {!searchLoading && searchError && query && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 px-5 py-6" role="alert">
          <h3 className="text-xl font-semibold text-fg-primary">A busca não chegou até a fonte</h3>
          <p className="mt-2 text-fg-secondary">{searchErrorMessage || 'Verifique a conexão e tente novamente.'}</p>
          {nativeApp && (
            <button onClick={() => void search(query)} className="mt-4 min-h-11 rounded-xl border border-border-default px-4 font-semibold text-fg-primary hover:border-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary">
              Tentar novamente
            </button>
          )}
        </div>
      )}

      {!searchLoading && !searchError && searchResults.length === 0 && query && (
        <div className="py-12 text-center" role="status">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[1.7rem_0.6rem_1.7rem_0.6rem] bg-brand-primary/10 text-brand-primary">
            <Music className="h-10 w-10" aria-hidden="true" />
          </div>
          <h3 className="text-xl font-semibold text-fg-primary">Nenhuma faixa encontrada</h3>
          <p className="mt-2 text-fg-secondary">Tente buscar pelo nome do artista ou por uma parte do título.</p>
        </div>
      )}

      {!searchLoading && searchResults.length > 0 && (
        <section aria-label="Resultados da busca">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-bold text-fg-primary">O que encontramos</h3>
            <span className="badge badge-neutral">{searchResults.length} {searchResults.length === 1 ? 'resultado' : 'resultados'} · Spotify / YouTube</span>
          </div>
          <div className="hidden border-b border-border px-3 py-3 text-xs font-medium uppercase tracking-wider text-fg-tertiary lg:grid lg:grid-cols-[48px_1fr_200px_140px_100px_60px] lg:gap-4">
            <div>#</div><div>Título</div><div>Artista</div><div>Álbum</div><div>Duração</div><div />
          </div>
          <div className="space-y-1" role="list" aria-label="Faixas encontradas">
            {searchResults.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index + 1}
                onPlay={() => void setCurrentTrack(track, searchResults, index)}
                onQueue={() => {
                  addToQueue(track)
                  showToast(`Adicionado à fila: ${track.title}`)
                }}
              />
            ))}
          </div>
        </section>
      )}

      {!query && !searchLoading && searchResults.length === 0 && (
        <section aria-labelledby="mood-heading">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h3 id="mood-heading" className="text-2xl font-bold tracking-tight text-fg-primary">Escolha um clima</h3>
              <p className="mt-1 text-sm text-fg-secondary">Toque em um recorte e comece por aí.</p>
            </div>
            <span className="hidden rotate-[-3deg] rounded-lg bg-[var(--hero-orange)] px-3 py-1.5 text-xs font-black text-[var(--hero-bg)] sm:inline-block">Misture por aqui</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {suggestions.map((suggestion) => {
              const Icon = suggestion.icon
              return (
                <button
                  key={suggestion.query}
                  onClick={() => { setQuery(suggestion.query); void search(suggestion.query) }}
                  className={`group flex min-h-[92px] items-center justify-between gap-3 px-4 py-4 text-left font-bold shadow-sm transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:min-h-[104px] sm:px-5 ${suggestion.color} ${suggestion.shape}`}
                >
                  <span className="leading-tight">{suggestion.label}</span>
                  <Icon className="h-6 w-6 shrink-0 transition-transform group-hover:rotate-[-8deg]" aria-hidden="true" />
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
