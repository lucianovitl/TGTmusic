import { useState, useEffect, useCallback } from 'react'
import { SlidersHorizontal, Music, X, RotateCcw } from 'lucide-react'
import { getBrowserEqualizer, EQUALIZER_PRESETS, type EqualizerPreset } from '../services/audioEqualizer'

interface EqualizerProps {
  isOpen: boolean
  onClose: () => void
}

export function Equalizer({ isOpen, onClose }: EqualizerProps) {
  const [bands, setBands] = useState({ bass: 0, mid: 0, treble: 0 })
  const [enabled, setEnabled] = useState(true)
  const [activePreset, setActivePreset] = useState<string>('Flat')
  const [isLoading, setIsLoading] = useState(false)

  const loadEqualizer = useCallback(async () => {
    setIsLoading(true)
    try {
      const eq = await getBrowserEqualizer()
      const currentBands = eq.getBands()
      setBands(currentBands)
      setEnabled(eq.isEnabled())
      // Find matching preset
      const preset = EQUALIZER_PRESETS.find(p =>
        p.bands.bass === currentBands.bass &&
        p.bands.mid === currentBands.mid &&
        p.bands.treble === currentBands.treble
      )
      setActivePreset(preset?.name || 'Custom')
    } catch (error) {
      console.error('Failed to load equalizer:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      loadEqualizer()
    }
  }, [isOpen, loadEqualizer])

  const handleBandChange = async (band: 'bass' | 'mid' | 'treble', value: number) => {
    const clampedValue = Math.max(-12, Math.min(12, Math.round(value)))
    setBands(prev => {
      const next = { ...prev, [band]: clampedValue }
      // Check if matches a preset
      const preset = EQUALIZER_PRESETS.find(p =>
        p.bands.bass === next.bass &&
        p.bands.mid === next.mid &&
        p.bands.treble === next.treble
      )
      setActivePreset(preset?.name || 'Custom')
      return next
    })

    try {
      const eq = await getBrowserEqualizer()
      eq.setBands({ [band]: clampedValue })
    } catch (error) {
      console.error('Failed to set equalizer band:', error)
    }
  }

  const handlePresetSelect = async (preset: EqualizerPreset) => {
    setActivePreset(preset.name)
    setBands(preset.bands)
    try {
      const eq = await getBrowserEqualizer()
      eq.setPreset(preset)
    } catch (error) {
      console.error('Failed to apply preset:', error)
    }
  }

  const handleReset = async () => {
    const flatPreset = EQUALIZER_PRESETS.find(p => p.name === 'Flat')!
    await handlePresetSelect(flatPreset)
  }

  const handleToggleEnabled = async () => {
    const nextEnabled = !enabled
    setEnabled(nextEnabled)
    try {
      const eq = await getBrowserEqualizer()
      eq.setEnabled(nextEnabled)
    } catch (error) {
      console.error('Failed to toggle equalizer:', error)
      setEnabled(enabled)
    }
  }

  if (!isOpen) return null

  const bandConfig = [
    { key: 'bass' as const, label: 'Grave', icon: Music, color: 'var(--hero-orange)', freq: '60 Hz' },
    { key: 'mid' as const, label: 'Médio', icon: Music, color: 'var(--hero-lime)', freq: '1 kHz' },
    { key: 'treble' as const, label: 'Agudo', icon: Music, color: 'var(--hero-lavender)', freq: '10 kHz' },
  ] as const

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center animate-in" role="dialog" aria-modal="true" aria-label="Equalizador">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg mx-4 mb-4 sm:mx-auto sm:mb-0 bg-bg-secondary border border-border-subtle rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
              <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-headline text-fg-primary">Equalizador</h2>
              <p className="text-caption text-fg-tertiary">Ajuste grave, médio e agudo</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="btn-ghost btn-icon-sm p-2 text-fg-tertiary hover:text-fg-primary hover:bg-sidebar-hover transition-colors"
              aria-label="Redefinir para Flat"
              title="Redefinir"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              onClick={onClose}
              className="btn-ghost btn-icon-sm p-2 text-fg-tertiary hover:text-fg-primary hover:bg-sidebar-hover transition-colors"
              aria-label="Fechar equalizador"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {/* Master Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-tertiary text-fg-secondary">
                <Music className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-body font-medium text-fg-primary">Equalizador ativo</p>
                <p className="text-caption text-fg-tertiary">Ativar ou desativar processamento de áudio</p>
              </div>
            </div>
            <button
              onClick={handleToggleEnabled}
              role="switch"
              aria-checked={enabled}
              aria-label={enabled ? 'Desativar equalizador' : 'Ativar equalizador'}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                enabled ? 'bg-brand-primary' : 'bg-bg-tertiary'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
                  enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
                aria-hidden="true"
              />
            </button>
          </div>

          {/* Presets */}
          <div>
            <h3 className="text-caption text-fg-tertiary mb-3">Presets</h3>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Presets do equalizador">
              {EQUALIZER_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => handlePresetSelect(preset)}
                  role="radio"
                  aria-checked={activePreset === preset.name}
                  className={`btn-ghost px-3 py-1.5 text-sm rounded-xl transition-all ${
                    activePreset === preset.name
                      ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/30'
                      : 'text-fg-secondary hover:text-fg-primary hover:bg-sidebar-hover'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Band Sliders */}
          <div className="space-y-4" role="group" aria-label="Controles de frequência">
            {bandConfig.map(({ key, label, icon: Icon, color, freq }) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-lg"
                      style={{ backgroundColor: color, opacity: 0.15 }}
                    >
                      <Icon className="h-4 w-4" style={{ color }} aria-hidden="true" />
                    </div>
                    <span className="text-body font-medium text-fg-primary">{label}</span>
                    <span className="text-caption text-fg-tertiary">{freq}</span>
                  </div>
                  <span
                    className="text-mono text-sm font-semibold tabular-nums"
                    style={{ color, minWidth: '40px', textAlign: 'right' }}
                    aria-live="polite"
                  >
                    {bands[key] > 0 ? '+' : ''}{bands[key]} dB
                  </span>
                </div>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={bands[key]}
                  onChange={(e) => handleBandChange(key, Number(e.target.value))}
                  disabled={!enabled || isLoading}
                  className="w-full h-2 accent-brand-primary appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={`${label} ${bands[key]} decibéis`}
                  aria-valuemin={-12}
                  aria-valuemax={12}
                  aria-valuenow={bands[key]}
                  aria-valuetext={`${label} ${bands[key] > 0 ? '+' : ''}${bands[key]} decibéis`}
                />
                <div className="flex justify-between text-xs text-fg-tertiary">
                  <span>-12 dB</span>
                  <span>0 dB</span>
                  <span>+12 dB</span>
                </div>
              </div>
            ))}
          </div>

          {/* Info */}
          <div className="pt-2 border-t border-border-subtle">
            <p className="text-caption text-fg-tertiary text-center">
              Ajustes são aplicados em tempo real na reprodução atual.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}