export type BrowserAudioEvent =
  | { type: 'time'; position: number; duration: number }
  | { type: 'play' | 'pause' | 'ended' }

const audio = typeof Audio === 'undefined' ? null : new Audio()
const subscribers = new Set<(event: BrowserAudioEvent) => void>()

if (audio) {
  audio.preload = 'metadata'
  audio.addEventListener('timeupdate', () => emit({ type: 'time', position: audio.currentTime, duration: audio.duration }))
  audio.addEventListener('loadedmetadata', () => emit({ type: 'time', position: audio.currentTime, duration: audio.duration }))
  audio.addEventListener('play', () => emit({ type: 'play' }))
  audio.addEventListener('pause', () => emit({ type: 'pause' }))
  audio.addEventListener('ended', () => emit({ type: 'ended' }))
}

function emit(event: BrowserAudioEvent) {
  subscribers.forEach((subscriber) => subscriber(event))
}

function clampVolume(volume: number) {
  return Math.max(0, Math.min(1, volume))
}

let equalizerInitialized = false

export function subscribeToBrowserAudio(subscriber: (event: BrowserAudioEvent) => void) {
  subscribers.add(subscriber)
  return () => subscribers.delete(subscriber)
}

export async function playBrowserAudio(url: string, volume: number) {
  if (!audio) throw new Error('Browser audio is unavailable')
  if (!url) throw new Error('No playable audio URL was provided')

  audio.pause()
  audio.src = url
  audio.currentTime = 0
  audio.volume = clampVolume(volume)

  // Initialize equalizer on first play
  if (!equalizerInitialized) {
    const { getBrowserEqualizer } = await import('./audioEqualizer')
    await getBrowserEqualizer().initialize(audio)
    equalizerInitialized = true
  }

  await audio.play()
}

export function pauseBrowserAudio() {
  audio?.pause()
}

export async function resumeBrowserAudio() {
  if (!audio) throw new Error('Browser audio is unavailable')
  await audio.play()
}

export function stopBrowserAudio() {
  if (!audio) return
  audio.pause()
  audio.removeAttribute('src')
  audio.load()
  equalizerInitialized = false
}

export function seekBrowserAudio(position: number) {
  if (!audio) throw new Error('Browser audio is unavailable')
  if (!Number.isFinite(position) || position < 0) throw new Error('Invalid seek position')
  audio.currentTime = Number.isFinite(audio.duration) ? Math.min(position, audio.duration) : position
}

export function setBrowserAudioVolume(volume: number) {
  if (!audio) throw new Error('Browser audio is unavailable')
  audio.volume = clampVolume(volume)
}

export async function getBrowserEqualizer() {
  const { getBrowserEqualizer: getEQ } = await import('./audioEqualizer')
  return getEQ()
}

export async function destroyBrowserEqualizer() {
  const { destroyBrowserEqualizer: destroyEQ } = await import('./audioEqualizer')
  await destroyEQ()
  equalizerInitialized = false
}
