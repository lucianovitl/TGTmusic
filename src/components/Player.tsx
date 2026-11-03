import { useAppStore } from '../stores/useAppStore'
import { Play, Pause, SkipBack, SkipForward, Repeat, Shuffle, Volume2, VolumeX, ListMusic, Disc3, Expand, Minimize, X, Trash2, Loader2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

export function Player() {
  const {
    currentTrack,
    isPlaying,
    playbackLoading,
    position,
    duration,
    volume,
    repeat,
    shuffle,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    toggleRepeat,
    toggleShuffle,
    queue,
    queueIndex,
    setCurrentTrack,
    removeFromQueue,
    clearQueue,
  } = useAppStore()

  const [expanded, setExpanded] = useState(false)
  const [isDraggingProgress, setIsDraggingProgress] = useState(false)
  const [isDraggingVolume, setIsDraggingVolume] = useState(false)
  const progressRef = useRef<HTMLDivElement>(null)
  const volumeRef = useRef<HTMLDivElement>(null)

  const formatTime = (s: number) => {
    if (!isFinite(s) || s < 0) return '0:00'
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  }

  const progress = duration > 0 ? Math.max(0, Math.min(100, (position / duration) * 100)) : 0

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingProgress) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seek(pct * duration)
  }

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingProgress(true)
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seek(pct * duration)
  }

  const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingProgress) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seek(pct * duration)
  }

  const handleProgressMouseUp = () => {
    setIsDraggingProgress(false)
  }

  const handleVolumeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingVolume(true)
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setVolume(pct)
  }

  const handleVolumeMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingVolume) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setVolume(pct)
  }

  const handleVolumeMouseUp = () => {
    setIsDraggingVolume(false)
  }

  // Global mouse listeners for dragging
  useEffect(() => {
    if (isDraggingProgress) {
      document.addEventListener('mousemove', handleProgressMouseMove as any)
      document.addEventListener('mouseup', handleProgressMouseUp)
      document.addEventListener('mouseleave', handleProgressMouseUp)
    }
    return () => {
      document.removeEventListener('mousemove', handleProgressMouseMove as any)
      document.removeEventListener('mouseup', handleProgressMouseUp)
      document.removeEventListener('mouseleave', handleProgressMouseUp)
    }
  }, [isDraggingProgress])

  useEffect(() => {
    if (isDraggingVolume) {
      document.addEventListener('mousemove', handleVolumeMouseMove as any)
      document.addEventListener('mouseup', handleVolumeMouseUp)
      document.addEventListener('mouseleave', handleVolumeMouseUp)
    }
    return () => {
      document.removeEventListener('mousemove', handleVolumeMouseMove as any)
      document.removeEventListener('mouseup', handleVolumeMouseUp)
      document.removeEventListener('mouseleave', handleVolumeMouseUp)
    }
  }, [isDraggingVolume])

  if (!currentTrack) {
    return (
      <div
        className="game-player fixed bottom-0 left-0 right-0 z-50 flex h-[96px] items-center justify-center"
        style={{ height: 'calc(96px + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center gap-3 px-4 text-body text-fg-secondary" role="status" aria-live="polite">
          <Disc3 className="h-5 w-5 text-brand-primary animate-pulse-soft" aria-hidden="true" />
          <span>{playbackLoading ? 'Preparando o áudio…' : 'Escolha uma faixa para começar'}</span>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Compact Player */}
      <div
        className={`game-player fixed bottom-0 left-0 right-0 z-50 flex items-center gap-3 px-3 transition-all duration-300 sm:gap-4 sm:px-5 ${expanded ? 'h-[320px] pb-4' : 'h-[96px]'}`}
        style={expanded
          ? { height: 'calc(320px + env(safe-area-inset-bottom))', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }
          : { height: 'calc(96px + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}
        role="region"
        aria-label="Player de música"
      >
        {/* Album Art */}
        <div className="relative isolate flex-shrink-0 transition-all duration-300">
          <div aria-hidden="true" className={`player-record absolute -inset-2 rounded-full ${isPlaying ? 'record-spin' : ''}`} />
          <div
            className={`relative z-10 overflow-hidden shadow-lg transition-all duration-300 ${
              expanded ? 'h-[256px] w-[256px] rounded-2xl' : 'h-[64px] w-[64px] rounded-xl'
            }`}
          >
            <img
              src={currentTrack.albumArt}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            {isPlaying && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
            )}
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <Play className="h-8 w-8 text-white/80" aria-hidden="true" />
              </div>
            )}
          </div>

          {/* Expand/Collapse Button */}
          <button
            onClick={() => setExpanded(!expanded)}
            className={`absolute ${expanded ? 'top-4 right-4' : 'top-1/2 -translate-y-1/2 right-[-12px]'} btn-ghost btn-icon-sm glass-dark transition-all duration-200 hover:scale-110 active:scale-95`}
            aria-label={expanded ? 'Minimizar player' : 'Expandir player'}
            aria-expanded={expanded}
          >
            {expanded ? <Minimize className="w-5 h-5" /> : <Expand className="w-5 h-5" />}
          </button>
        </div>

        {/* Track Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5 transition-all duration-300">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-col min-w-0">
              <h3 className="text-headline text-fg-primary truncate">{currentTrack.title}</h3>
              <p className="text-body text-fg-secondary truncate max-w-[300px]">{currentTrack.artists.join(', ')}</p>
            </div>
            {!expanded && (
              <button
                onClick={() => setExpanded(true)}
                className="btn-ghost btn-icon-sm p-1.5 text-fg-tertiary hover:text-brand-primary hover:bg-brand-primary/10 hidden sm:flex transition-all duration-200 active:scale-95"
                aria-label="Abrir fila de reprodução"
              >
                <ListMusic className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="w-11 text-right text-mono text-caption text-fg-tertiary tabular-nums sm:w-14 transition-colors duration-200">{formatTime(position)}</span>
            <div
              ref={progressRef}
              className="group relative flex h-11 min-w-12 flex-1 cursor-pointer items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
              onMouseDown={handleProgressMouseDown}
              onClick={handleProgressClick}
              role="slider"
              aria-label="Progresso da música"
              aria-valuemin={0}
              aria-valuemax={Math.floor(duration)}
              aria-valuenow={Math.floor(position)}
              aria-valuetext={`${formatTime(position)} de ${formatTime(duration)}`}
              tabIndex={0}
              onKeyDown={(e) => {
                const step = duration / 100
                if (e.key === 'ArrowRight') seek(Math.min(duration, position + step * 5))
                if (e.key === 'ArrowLeft') seek(Math.max(0, position - step * 5))
                if (e.key === 'Home') seek(0)
                if (e.key === 'End') seek(duration)
              }}
            >
              <div className="relative h-1.5 w-full rounded-full bg-border-default">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-primary to-violet-500 transition-[width] duration-75 ease-out"
                  style={{ width: `${progress}%` }}
                  role="presentation"
                />
                {/* Progress thumb */}
                <div
                  className={`pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-primary shadow-lg transition-all duration-200 md:h-4 md:w-4 ${
                    isDraggingProgress || isPlaying ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
                  }`}
                  style={{ left: `${progress}%` }}
                  role="presentation"
                />
                {/* Buffered amount indicator */}
                <div
                  className="absolute top-1/2 h-full -translate-y-1/2 rounded-full bg-brand-primary/30"
                  style={{ width: `${Math.min(progress + 10, 100)}%` }}
                  role="presentation"
                  aria-hidden="true"
                />
              </div>
            </div>
            <span className="w-11 text-mono text-caption text-fg-tertiary tabular-nums sm:w-14 transition-colors duration-200">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 md:gap-4 transition-all duration-300">
          {/* Shuffle */}
          <button
            onClick={toggleShuffle}
            className={`btn-ghost btn-icon hidden p-2 transition-all duration-200 sm:flex ${
              shuffle ? 'text-brand-primary bg-brand-primary/10' : 'text-fg-tertiary hover:text-fg-primary hover:bg-sidebar-hover'
            } hover:scale-110 active:scale-95`}
            aria-label={shuffle ? 'Desativar aleatório' : 'Aleatório'}
            aria-pressed={shuffle}
          >
            <Shuffle className="w-5 h-5" aria-hidden="true" />
          </button>

          {/* Previous */}
          <button
            onClick={prevTrack}
            className="btn-ghost btn-icon p-2 text-fg-secondary hover:text-fg-primary hover:bg-sidebar-hover transition-all duration-200 hover:scale-110 active:scale-95"
            aria-label="Anterior"
          >
            <SkipBack className="w-6 h-6" aria-hidden="true" />
          </button>

          {/* Play/Pause - Main Button */}
          <button
            onClick={togglePlay}
            className={`btn-primary relative transition-all duration-200 ${
              expanded ? 'btn-icon-lg' : 'btn-icon'
            } animate-in hover:scale-105 active:scale-95`}
            aria-label={playbackLoading ? 'Preparando áudio' : isPlaying ? 'Pausar' : 'Tocar'}
            disabled={playbackLoading}
            style={{ boxShadow: isPlaying ? 'var(--shadow-glow)' : 'var(--shadow-md)' }}
          >
            {playbackLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
            ) : isPlaying ? (
              <Pause className="w-6 h-6" aria-hidden="true" />
            ) : (
              <Play className="w-6 h-6 ml-1" aria-hidden="true" />
            )}
            {isPlaying && !expanded && (
              <span className="absolute inset-0 bg-brand-primary/30 rounded-full animate-pulse-soft" aria-hidden="true" />
            )}
          </button>

          {/* Next */}
          <button
            onClick={nextTrack}
            className="btn-ghost btn-icon p-2 text-fg-secondary hover:text-fg-primary hover:bg-sidebar-hover transition-all duration-200 hover:scale-110 active:scale-95"
            aria-label="Próxima"
          >
            <SkipForward className="w-6 h-6" aria-hidden="true" />
          </button>

          {/* Repeat */}
          <button
            onClick={toggleRepeat}
            className={`btn-ghost btn-icon hidden p-2 relative transition-all duration-200 sm:flex ${
              repeat !== 'off' ? 'text-brand-primary bg-brand-primary/10' : 'text-fg-tertiary hover:text-fg-primary hover:bg-sidebar-hover'
            } hover:scale-110 active:scale-95`}
            aria-label={`Repetir: ${repeat === 'off' ? 'desligado' : repeat === 'all' ? 'todas' : 'uma'}`}
            aria-pressed={repeat !== 'off'}
          >
            <Repeat className="w-5 h-5" aria-hidden="true" />
            {repeat === 'one' && (
              <span className="absolute -top-1 -right-1 text-[10px] font-bold text-brand-primary animate-pulse-soft">1</span>
            )}
          </button>

          {/* Volume */}
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <button
              onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
              className="btn-ghost btn-icon p-2 text-fg-secondary transition-all duration-200 hover:bg-sidebar-hover hover:text-fg-primary hover:scale-110 active:scale-95"
              aria-label={volume > 0 ? 'Mutar' : 'Desmutar'}
              aria-pressed={volume === 0}
            >
              {volume === 0 ? <VolumeX className="h-5 w-5" aria-hidden="true" /> : <Volume2 className="h-5 w-5" aria-hidden="true" />}
            </button>
            <div
              ref={volumeRef}
              className="relative h-6 w-20 cursor-pointer"
              onMouseDown={handleVolumeMouseDown}
            >
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="absolute inset-0 h-1.5 w-full cursor-pointer accent-brand-primary appearance-none opacity-0"
                aria-label="Volume"
                style={{
                  background: `linear-gradient(to right, var(--brand-primary) ${volume * 100}%, var(--border-default) ${volume * 100}%)`
                }}
              />
              <div className="absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full bg-brand-primary pointer-events-none" style={{ width: `${volume * 100}%` }} />
              <div className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-brand-primary border-2 border-bg-primary shadow-lg pointer-events-none transition-all duration-200 ${isDraggingVolume ? 'scale-125' : 'scale-100'}`} style={{ left: `calc(${volume * 100}% - 8px)` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Player */}
      {expanded && (
        <div className="fixed bottom-0 left-0 right-0 top-[96px] z-40 overflow-y-auto border-t border-player-border bg-player-bg/95 p-4 pb-[340px] backdrop-blur-xl animate-slide-up sm:p-6 md:p-8">
          <div className="mx-auto max-w-4xl">
            <div className="grid items-start gap-8 md:grid-cols-3">
              {/* Left: Track Info & Lyrics */}
              <div className="md:col-span-2 space-y-6">
                <div className="flex items-start gap-6">
                  <div className="relative isolate h-32 w-32 flex-shrink-0 overflow-hidden rounded-xl shadow-2xl sm:h-48 sm:w-48">
                    <img src={currentTrack.albumArt} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>
                  <div className="flex-1 min-w-0 pt-2">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="badge badge-primary animate-in">Tocando agora</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold text-display text-fg-primary truncate mb-2 animate-in">{currentTrack.title}</h2>
                    <p className="text-xl text-fg-secondary mb-4 animate-in delay-1">{currentTrack.artists.join(', ')}</p>
                    <p className="text-fg-tertiary animate-in delay-2">{currentTrack.album}</p>
                    <div className="mt-6 animate-in delay-3">
                      <button className="btn-primary btn-icon-lg" aria-label={isPlaying ? 'Pausar' : 'Tocar'} onClick={togglePlay}>
                        {isPlaying ? <Pause className="h-7 w-7" aria-hidden="true" /> : <Play className="ml-1 h-7 w-7" aria-hidden="true" />}
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right: Queue */}
              <div className="animate-in delay-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-headline text-fg-primary">Fila de reprodução</h3>
                  {queue.length > 0 && (
                    <button onClick={clearQueue} className="btn-ghost btn-icon-sm" aria-label="Limpar fila">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
                <div className="card max-h-[calc(100vh-220px)] overflow-y-auto">
                  {queue.length === 0 ? (
                    <p className="p-6 text-center text-fg-tertiary">A fila está vazia. Adicione músicas pelos resultados da busca.</p>
                  ) : (
                    <ul className="divide-y divide-border-subtle" aria-label="Músicas na fila">
                      {queue.map((track, index) => (
                        <li key={`${track.id}-${index}`} className="flex items-center gap-2 p-2">
                          <button
                            onClick={() => setCurrentTrack(track, queue, index)}
                            className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 text-left ${queueIndex === index ? 'bg-brand-primary/10 text-brand-primary' : 'hover:bg-sidebar-hover'}`}
                            aria-current={queueIndex === index ? 'true' : undefined}
                          >
                            <img src={track.albumArt} alt="" className="h-10 w-10 flex-shrink-0 rounded-md object-cover" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{track.title}</span>
                              <span className="block truncate text-xs text-fg-tertiary">{track.artists.join(', ')}</span>
                            </span>
                            {queueIndex === index && <span className="text-xs">Tocando</span>}
                          </button>
                          {index > queueIndex && (
                            <button
                              onClick={() => removeFromQueue(index)}
                              className="btn-ghost btn-icon-sm"
                              aria-label={`Remover ${track.title} da fila`}
                            >
                              <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}