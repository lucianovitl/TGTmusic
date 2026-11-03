export interface EqualizerBands {
  bass: number;      // 60Hz - Low frequencies
  mid: number;       // 1kHz - Mid frequencies
  treble: number;    // 10kHz - High frequencies
}

export interface EqualizerPreset {
  name: string;
  bands: EqualizerBands;
}

export const EQUALIZER_PRESETS: EqualizerPreset[] = [
  { name: 'Flat', bands: { bass: 0, mid: 0, treble: 0 } },
  { name: 'Bass Boost', bands: { bass: 6, mid: 0, treble: 0 } },
  { name: 'Treble Boost', bands: { bass: 0, mid: 0, treble: 6 } },
  { name: 'Vocal', bands: { bass: -2, mid: 4, treble: 2 } },
  { name: 'Rock', bands: { bass: 4, mid: -2, treble: 4 } },
  { name: 'Electronic', bands: { bass: 5, mid: 0, treble: 3 } },
  { name: 'Classical', bands: { bass: 0, mid: 2, treble: 3 } },
  { name: 'Pop', bands: { bass: 2, mid: 2, treble: 1 } },
];

const CLAMP_DB = (value: number) => Math.max(-12, Math.min(12, value));

export class BrowserEqualizer {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private filters: BiquadFilterNode[] = [];
  private gainNode: GainNode | null = null;
  private bands: EqualizerBands = { bass: 0, mid: 0, treble: 0 };
  private enabled = true;

  async initialize(audioElement: HTMLAudioElement): Promise<void> {
    if (this.audioContext) return;

    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.sourceNode = this.audioContext.createMediaElementSource(audioElement);
    this.gainNode = this.audioContext.createGain();

    // Create three-band equalizer filters
    // Bass: Low shelf at 60Hz
    const bassFilter = this.audioContext.createBiquadFilter();
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 60;
    bassFilter.gain.value = 0;

    // Mid: Peaking at 1kHz
    const midFilter = this.audioContext.createBiquadFilter();
    midFilter.type = 'peaking';
    midFilter.frequency.value = 1000;
    midFilter.Q.value = 1;
    midFilter.gain.value = 0;

    // Treble: High shelf at 10kHz
    const trebleFilter = this.audioContext.createBiquadFilter();
    trebleFilter.type = 'highshelf';
    trebleFilter.frequency.value = 10000;
    trebleFilter.gain.value = 0;

    this.filters = [bassFilter, midFilter, trebleFilter];

    // Connect: source -> bass -> mid -> treble -> gain -> destination
    this.sourceNode.connect(bassFilter);
    bassFilter.connect(midFilter);
    midFilter.connect(trebleFilter);
    trebleFilter.connect(this.gainNode!);
    this.gainNode.connect(this.audioContext.destination);

    this.applyBands();
  }

  private applyBands(): void {
    if (!this.enabled) return;
    const [bass, mid, treble] = this.filters;
    if (bass) bass.gain.value = CLAMP_DB(this.bands.bass);
    if (mid) mid.gain.value = CLAMP_DB(this.bands.mid);
    if (treble) treble.gain.value = CLAMP_DB(this.bands.treble);
  }

  setBands(bands: Partial<EqualizerBands>): void {
    this.bands = { ...this.bands, ...bands };
    this.applyBands();
  }

  getBands(): EqualizerBands {
    return { ...this.bands };
  }

  setPreset(preset: EqualizerPreset): void {
    this.bands = { ...preset.bands };
    this.applyBands();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      // Reset all gains to 0 when disabled
      this.filters.forEach(f => f.gain.value = 0);
    } else {
      this.applyBands();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async destroy(): Promise<void> {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    this.filters.forEach(f => f.disconnect());
    this.filters = [];
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }
    }
}

// Singleton instance
let equalizerInstance: BrowserEqualizer | null = null;

export function getBrowserEqualizer(): BrowserEqualizer {
  if (!equalizerInstance) {
    equalizerInstance = new BrowserEqualizer();
  }
  return equalizerInstance;
}

export async function destroyBrowserEqualizer(): Promise<void> {
  if (equalizerInstance) {
    await equalizerInstance.destroy();
    equalizerInstance = null;
  }
}