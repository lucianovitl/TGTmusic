import { Plus, Play, Trash2 } from 'lucide-react'
import { Track } from '../stores/useAppStore'

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
  const sourceLabel = track.source === 'local' ? 'Arquivo local' : track.source === 'spotify' ? 'Só metadados' : 'YouTube'

  return (
    <div role="listitem" className="group flex w-full items-center gap-2 rounded-xl px-2 py-2.5 transition-colors hover:bg-bg-hover sm:gap-4 sm:px-3">
      <button
        type="button"
        onClick={playable ? onPlay : undefined}
        disabled={!playable}
        className={`flex min-w-0 flex-1 items-center gap-2 text-left selection-playing focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary sm:gap-4 ${playable ? '' : 'cursor-default'}`}
        aria-label={playable ? `Tocar ${track.title} por ${track.artists.join(', ')}` : `Áudio indisponível para ${track.title}`}
        title={playable ? undefined : 'Este resultado contém apenas metadados do Spotify'}
      >
        {showIndex && (
          <span className="w-6 text-right font-mono text-sm tabular-nums text-fg-tertiary opacity-0 transition-opacity duration-200 group-hover:opacity-100 sm:w-10">
            {index}
          </span>
        )}

        <div className="relative w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden shadow-sm">
          <img src={track.albumArt} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
          {playable && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <Play className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-fg-primary truncate group-hover:text-brand-primary transition-colors">{track.title}</p>
          <p className="text-sm text-fg-secondary truncate">{track.artists.join(', ')}</p>
        </div>

        <div className="w-48 text-center text-sm text-fg-tertiary hidden sm:block truncate max-w-[160px]">{track.album}</div>
        <div className="w-36 text-center text-sm text-fg-tertiary hidden md:block">
          <span className="badge badge-neutral text-xs px-2 py-0.5">{sourceLabel}</span>
        </div>
        <div className="w-10 text-center font-mono text-sm tabular-nums text-fg-tertiary sm:w-20">{formatTime(track.duration)}</div>
      </button>

      <div className="flex flex-shrink-0 items-center gap-1 opacity-100 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 lg:opacity-0">
        {playable && (
          <button
            type="button"
            onClick={onQueue}
            className="btn-ghost btn-icon-sm min-h-11 min-w-11 p-2 text-fg-tertiary hover:bg-brand-primary/10 hover:text-brand-primary"
            aria-label="Adicionar à fila"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="btn-ghost btn-icon-sm min-h-11 min-w-11 p-2 text-fg-tertiary hover:bg-red-500/10 hover:text-red-400"
            aria-label="Remover da biblioteca"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
