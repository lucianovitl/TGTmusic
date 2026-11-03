import { Plus, Play, Trash2, BadgeCheck, Music, Mic, FileAudio } from 'lucide-react'
import { Track, SourceType } from '../stores/useAppStore'

interface TrackRowProps {
  track: Track
  index: number
  onPlay: () => void
  onQueue: () => void
  onRemove?: () => void
  showIndex?: boolean
}

export function TrackRow({ track, index, onPlay, onQueue, onRemove, showIndex = true }: TrackRowProps) {
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  const playable = track.source !== 'spotify'

  const renderSourceBadge = (type?: SourceType) => {
    if (!type || type === 'other') return null
    const configs: Record<Exclude<SourceType, 'other'>, { icon: React.ReactNode; label: string; color: string }> = {
      official: { icon: <BadgeCheck className="h-3 w-3" />, label: 'Oficial', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
      lyric: { icon: <Music className="h-3 w-3" />, label: 'Lyric', color: 'bg-[var(--hero-lime)]/20 text-[var(--hero-lime)] border-[var(--hero-lime)]/30' },
      cover: { icon: <Mic className="h-3 w-3" />, label: 'Cover', color: 'bg-[var(--hero-pink)]/20 text-[var(--hero-pink)] border-[var(--hero-pink)]/30' },
      audio: { icon: <FileAudio className="h-3 w-3" />, label: 'Áudio', color: 'bg-[var(--hero-lavender)]/20 text-[var(--hero-lavender)] border-[var(--hero-lavender)]/30' },
      live: { icon: <Mic className="h-3 w-3" />, label: 'Ao Vivo', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    }
    const config = configs[type]
    if (!config) return null
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.color} animate-in`} title={config.label}>
        {config.icon}
        <span>{config.label}</span>
      </span>
    )
  }

  return (
    <div role="listitem" className="group flex w-full items-center gap-2 rounded-xl px-2 py-2.5 transition-all duration-200 hover:bg-bg-hover hover:shadow-md sm:gap-4 sm:px-3 active:scale-[0.99]">
      <button
        type="button"
        onClick={playable ? onPlay : undefined}
        disabled={!playable}
        className={`flex min-w-0 flex-1 items-center gap-2 text-left selection-playing focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary sm:gap-4 ${playable ? 'cursor-pointer' : 'cursor-default'}`}
        aria-label={playable ? `Tocar ${track.title} por ${track.artists.join(', ')}` : `Áudio indisponível para ${track.title}`}
        title={playable ? undefined : 'Este resultado contém apenas metadados'}
      >
        {showIndex && (
          <span className="w-6 text-right font-mono text-sm tabular-nums text-fg-tertiary opacity-0 transition-opacity duration-200 group-hover:opacity-100 sm:w-10">
            {index}
          </span>
        )}

        <div className="relative w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg">
          <img src={track.albumArt} alt="" className="w-full h-full object-cover transition-transform duration-300" loading="lazy" />
          {playable && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-black/40 to-black/20 opacity-0 transition-all duration-200 group-hover:opacity-100">
              <Play className="h-5 w-5 text-white transform transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
            </div>
          )}
          {/* Playing indicator overlay */}
          {playable && (
            <div className="absolute inset-0 bg-brand-primary/10 opacity-0 transition-opacity duration-200" aria-hidden="true" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-fg-primary truncate group-hover:text-brand-primary transition-colors duration-200">{track.title}</p>
          <p className="text-sm text-fg-secondary truncate">{track.artists.join(', ')}</p>
        </div>

        <div className="w-48 text-center text-sm text-fg-tertiary hidden sm:block truncate max-w-[160px] flex items-center justify-center gap-2">
          {renderSourceBadge(track.sourceType)}
          <span>{track.album}</span>
        </div>
        <div className="w-10 text-center font-mono text-sm tabular-nums text-fg-tertiary sm:w-20">{formatTime(track.duration)}</div>
      </button>

      <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 lg:opacity-100">
        {playable && (
          <button
            type="button"
            onClick={onQueue}
            className="btn-ghost btn-icon-sm min-h-11 min-w-11 p-2 text-fg-tertiary hover:bg-brand-primary/10 hover:text-brand-primary hover:scale-110 active:scale-95 transition-all duration-200"
            aria-label="Adicionar à fila"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="btn-ghost btn-icon-sm min-h-11 min-w-11 p-2 text-fg-tertiary hover:bg-red-500/10 hover:text-red-400 hover:scale-110 active:scale-95 transition-all duration-200"
            aria-label="Remover da biblioteca"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
