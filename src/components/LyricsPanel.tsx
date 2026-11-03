import { useAppStore } from '../stores/useAppStore'
import { X, Music, Loader2, Mic, Heart, Share2, Download, Expand, Minimize } from 'lucide-react'
import { useState, useEffect } from 'react'

interface LyricLine { time: number; text: string }

export function LyricsPanel() {
  const { currentLyrics, currentTrack, position, fetchLyrics } = useAppStore()
  const [open, setOpen] = useState(false)
  const [activeLine, setActiveLine] = useState(-1)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!currentLyrics?.synced?.length) return
    const idx = currentLyrics.synced.findIndex((l: LyricLine, i: number) =>
      l.time > position && (i === 0 || currentLyrics.synced[i - 1].time <= position)
    )
    setActiveLine(idx === -1 ? currentLyrics.synced.length - 1 : idx - 1)
  }, [position, currentLyrics])

  useEffect(() => {
    if (currentTrack && open && !currentLyrics) {
      fetchLyrics(currentTrack)
    }
  }, [currentTrack, open])

  if (!currentTrack) return null

  const handleOpen = () => {
    setOpen(true)
    if (!currentLyrics) fetchLyrics(currentTrack)
  }

  const renderLyrics = () => {
    if (!currentLyrics) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-fg-muted gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
          <p>Carregando letra...</p>
        </div>
      )
    }

    if (!currentLyrics.synced?.length) {
      return (
        <pre className="whitespace-pre-wrap text-center text-fg-secondary leading-relaxed text-body">
          {currentLyrics.plain || 'Letra não disponível'}
        </pre>
      )
    }

    return (
      currentLyrics.synced.map((line: LyricLine, i: number) => (
        <p
          key={i}
          className={`text-center transition-all duration-300 py-3 px-4 rounded-xl ${
            i === activeLine
              ? 'text-brand-primary text-lg font-semibold bg-brand-primary/10 scale-[1.02]'
              : 'text-fg-secondary hover:text-fg-primary'
          }`}
          style={{ transform: i === activeLine ? 'translateX(0)' : 'none' }}
        >
          {line.text || <span className="text-fg-tertiary">♪</span>}
        </p>
      ))
    )
  }

  return (
    <>
      {/* Floating Lyrics Button */}
      <button
        onClick={handleOpen}
        className="fixed bottom-28 right-6 z-40 btn-primary shadow-xl gap-2 animate-float"
        aria-label="Ver letra"
      >
        <Music className="w-5 h-5" />
        <span className="hidden sm:inline">Letra</span>
      </button>

      {/* Lyrics Modal */}
      {open && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Letra de ${currentTrack.title}`}
        >
          <div
            className={`bg-card border border-border rounded-3xl max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden animate-scale-in ${expanded ? 'max-w-4xl max-h-[90vh]' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={currentTrack.albumArt}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0 shadow-lg"
                />
                <div className="min-w-0">
                  <p className="font-semibold text-fg-primary truncate">{currentTrack.title}</p>
                  <p className="text-sm text-fg-secondary truncate">{currentTrack.artists.join(', ')}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="btn-ghost btn-icon-sm p-2"
                  aria-label={expanded ? 'Minimizar' : 'Expandir'}
                >
                  {expanded ? <Minimize className="w-5 h-5" /> : <Expand className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="btn-ghost btn-icon-sm p-2"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Lyrics Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2" role="region" aria-label="Letra da música">
              {renderLyrics()}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between p-4 border-t border-border bg-bg-tertiary/50">
              <div className="flex items-center gap-2">
                <button className="btn-ghost btn-icon-sm p-2 text-fg-tertiary hover:text-rose-400" aria-label="Favoritar">
                  <Heart className="w-5 h-5" />
                </button>
                <button className="btn-ghost btn-icon-sm p-2 text-fg-tertiary hover:text-brand-primary" aria-label="Compartilhar">
                  <Share2 className="w-5 h-5" />
                </button>
                <button className="btn-ghost btn-icon-sm p-2 text-fg-tertiary hover:text-brand-primary" aria-label="Baixar">
                  <Download className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-fg-tertiary">
                <Mic className="w-4 h-4" />
                <span>Sincronizado</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}