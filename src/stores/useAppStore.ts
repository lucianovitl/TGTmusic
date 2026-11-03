import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { invoke, isTauri } from '@tauri-apps/api/core'
import {
  pauseBrowserAudio,
  playBrowserAudio,
  resumeBrowserAudio,
  seekBrowserAudio,
  setBrowserAudioVolume,
  stopBrowserAudio,
  subscribeToBrowserAudio,
} from '../services/browserAudio'

export type SourceType = 'official' | 'lyric' | 'cover' | 'audio' | 'live' | 'other';

export interface Track {
  id: string; title: string; artists: string[]; album: string; albumArt: string;
  duration: number; source: 'youtube' | 'local' | 'spotify'; sourceId: string; url?: string;
  addedAt: number; playlistId?: string; sourceType?: SourceType
}
export interface Playlist { id: string; name: string; trackIds: string[]; createdAt: number; updatedAt: number }

let playbackRequestId = 0
let searchRequestId = 0

function getFailureMessage(error: unknown, action: 'search' | 'playback') {
  const message = (typeof error === 'string' ? error : error instanceof Error ? error.message : String(error)).toLowerCase()

  // Network/timeout errors
  if (/timed out|timeout|dns|connect|network|connection|socket/.test(message)) {
    return action === 'search'
      ? 'A busca expirou ou a conexão não respondeu. Verifique a internet e tente novamente.'
      : 'A conexão demorou demais para carregar o áudio. Tente outra vez ou escolha outra faixa.'
  }

  // yt-dlp not found
  if (/program not found|no such file|cannot find the file|yt-dlp\.exe/.test(message)) {
    return 'yt-dlp não foi encontrado. Em Configurações > Downloads, informe o caminho do executável.'
  }

  // YouTube specific errors - more detailed matching
  if (/403|forbidden/.test(message)) {
    return action === 'search'
      ? 'A fonte bloqueou esta busca (403). Tente novamente mais tarde ou use outro termo.'
      : 'Esta faixa tem restrição de acesso (403). Tente outra música.'
  }

  if (/404|not found/.test(message)) {
    return action === 'search'
      ? 'Nenhum resultado encontrado para esta busca.'
      : 'Esta faixa não foi encontrada no YouTube. Pode ter sido removida.'
  }

  if (/age.?restrict|age.?gate|sign.?in.?to.?confirm|login/.test(message)) {
    return 'Esta faixa tem restrição de idade e requer login. Tente outra música.'
  }

  if (/geo.?block|country|region|unavailable.?in|not.?available.?in/.test(message)) {
    return 'Esta faixa não está disponível na sua região. Tente outra música.'
  }

  if (/private|deleted|removed|unavailable/.test(message)) {
    return action === 'search'
      ? 'Alguns resultados não estão mais disponíveis.'
      : 'Esta faixa não está mais disponível (privada/excluída). Tente outra música.'
  }

  if (/copyright|claim/.test(message)) {
    return 'Esta faixa tem reivindicação de direitos autorais. Tente outra música.'
  }

  if (/live.?stream|premiere|upcoming/.test(message)) {
    return 'Não é possível reproduzir transmissões ao vivo ou estreias. Tente a versão gravada.'
  }

  if (/format|codec|unsupported|decode/.test(message)) {
    return 'Formato de áudio não suportado. Tente outra faixa.'
  }

  if (/rate.?limit|too.?many.?request/.test(message)) {
    return 'Muitas requisições. Aguarde um momento e tente novamente.'
  }

  // Generic fallbacks
  return action === 'search'
    ? 'Não foi possível buscar agora. Verifique a conexão e tente novamente.'
    : 'Não foi possível reproduzir esta faixa. Tente outra música.'
}

interface AppState {
  view: 'search' | 'library' | 'playlists' | 'settings'; setView: (v: AppState['view']) => void
  theme: 'dark' | 'light'; toggleTheme: () => void; init: () => Promise<void>
  currentTrack: Track | null; queue: Track[]; queueIndex: number; isPlaying: boolean; playbackLoading: boolean; volume: number; position: number; duration: number; repeat: 'off' | 'all' | 'one'; shuffle: boolean
  setCurrentTrack: (t: Track | null, q?: Track[], idx?: number) => Promise<void>; togglePlay: () => Promise<void>
  nextTrack: () => Promise<void>; prevTrack: () => Promise<void>; seek: (p: number) => Promise<void>
  setVolume: (v: number) => Promise<void>; toggleRepeat: () => void; toggleShuffle: () => void
  addToQueue: (t: Track) => void; removeFromQueue: (i: number) => void; clearQueue: () => void
  libraryTracks: Track[]; playlists: Playlist[]; loadLibrary: () => Promise<void>; loadPlaylists: () => Promise<void>
  addTrackToLibrary: (t: Track) => Promise<void>; removeTrackFromLibrary: (id: string) => Promise<void>; importLocalTracks: () => Promise<void>
  createPlaylist: (n: string) => Promise<void>; deletePlaylist: (id: string) => Promise<void>
  addToPlaylist: (pid: string, tid: string) => Promise<void>; removeFromPlaylist: (pid: string, tid: string) => Promise<void>
  searchResults: Track[]; searchLoading: boolean; searchError: boolean; searchErrorMessage: string; search: (q: string) => Promise<void>
  currentLyrics: any; fetchLyrics: (t: Track) => Promise<void>
  toasts: { id: string; message: string; type: 'info' | 'success' | 'error' }[]; showToast: (m: string, t?: 'info' | 'success' | 'error') => void; dismissToast: (id: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      view: 'search',
      setView: (v) => set({ view: v }),
      theme: 'dark',
      toggleTheme: () => {
        const n = get().theme === 'dark' ? 'light' : 'dark';
        if (isTauri()) {
          void invoke('set_theme', { theme: n }).catch(() => {
            get().showToast('Não foi possível salvar o tema.', 'error')
          })
        }
        document.documentElement.setAttribute('data-theme', n);
        set({ theme: n })
      },
      init: async () => {
        if (!isTauri()) return
        await Promise.all([get().loadLibrary(), get().loadPlaylists()]);
        try {
          const storedTheme = await invoke<string>('get_theme');
          const theme = storedTheme === 'light' ? 'light' : 'dark';
          set({ theme });
          document.documentElement.setAttribute('data-theme', theme);
        } catch {
          get().showToast('Não foi possível carregar o tema salvo.', 'error')
        }
      },
      currentTrack: null,
      queue: [],
      queueIndex: -1,
      isPlaying: false,
      playbackLoading: false,
      volume: 0.8,
      position: 0,
      duration: 0,
      repeat: 'off',
      shuffle: false,
      setCurrentTrack: async (t, q = [], idx = 0) => {
        if (!t) {
          playbackRequestId += 1;
          try {
            if (isTauri()) await invoke('stop');
            else stopBrowserAudio();
          } catch {
            get().showToast('Não foi possível parar a reprodução.', 'error');
          }
          set({ currentTrack: null, queue: [], queueIndex: -1, isPlaying: false, playbackLoading: false, position: 0, duration: 0 });
          return;
        }

        const requestId = ++playbackRequestId;
        const queue = q.length ? q : [t];
        set({ playbackLoading: true });
        if (!isTauri()) {
          const browserUrl = t.source === 'local'
            ? t.url || (t.sourceId.startsWith('blob:') ? t.sourceId : '')
            : '';
          if (!browserUrl) {
            set({ playbackLoading: false });
            get().showToast('No navegador, importe um arquivo de áudio para reproduzir.', 'info');
            return;
          }
          try {
            await playBrowserAudio(browserUrl, get().volume);
            if (requestId !== playbackRequestId) return;
            set({ currentTrack: t, queue, queueIndex: idx, position: 0, duration: t.duration || 0, isPlaying: true, playbackLoading: false });
          } catch (error) {
            if (requestId !== playbackRequestId) return;
            set({ playbackLoading: false });
            get().showToast(getFailureMessage(error, 'playback'), 'error');
          }
          return;
        }

        try {
          await invoke('set_volume', { volume: get().volume });
          await invoke('play_track', { track: t });
          if (requestId !== playbackRequestId) return;
          set({ currentTrack: t, queue, queueIndex: idx, position: 0, duration: t.duration || 0, isPlaying: true, playbackLoading: false });
        } catch (error) {
          if (requestId !== playbackRequestId) return;
          set({ playbackLoading: false });
          get().showToast(getFailureMessage(error, 'playback'), 'error');
        }
      },
      togglePlay: async () => {
        const { isPlaying, playbackLoading } = get();
        if (playbackLoading || !get().currentTrack) return;
        try {
          if (!isTauri()) {
            if (isPlaying) pauseBrowserAudio();
            else await resumeBrowserAudio();
          } else {
            await invoke(isPlaying ? 'pause' : 'resume');
          }
          set({ isPlaying: !isPlaying });
        } catch (error) {
          get().showToast(getFailureMessage(error, 'playback'), 'error');
        }
      },
      nextTrack: async () => {
        const { queue, queueIndex, repeat, shuffle } = get();
        if (!queue.length) return;
        if (repeat === 'one' && queueIndex >= 0) {
          await get().setCurrentTrack(queue[queueIndex], queue, queueIndex);
          return;
        }
        let next = queueIndex + 1;
        if (shuffle) next = Math.floor(Math.random() * queue.length);
        if (next >= queue.length) {
          if (repeat === 'all') next = 0;
          else {
            playbackRequestId += 1;
            try {
              if (isTauri()) await invoke('stop');
              else stopBrowserAudio();
              set({ currentTrack: null, queueIndex: -1, isPlaying: false, playbackLoading: false, position: 0, duration: 0 });
            } catch (error) {
              get().showToast(getFailureMessage(error, 'playback'), 'error');
            }
            return;
          }
        }
        await get().setCurrentTrack(queue[next], queue, next);
      },
      prevTrack: async () => {
        const { queue, queueIndex, position } = get();
        if (position > 3) {
          await get().seek(0);
          return;
        }
        const prev = queueIndex - 1;
        if (prev >= 0) {
          await get().setCurrentTrack(queue[prev], queue, prev);
        } else if (get().currentTrack) {
          await get().seek(0);
        }
      },
      seek: async (pos) => {
        if (!Number.isFinite(pos) || pos < 0) return;
        const duration = get().duration;
        const position = duration > 0 ? Math.min(pos, duration) : pos;
        try {
          if (isTauri()) await invoke('seek', { position });
          else seekBrowserAudio(position);
          set({ position });
        } catch (error) {
          get().showToast(getFailureMessage(error, 'playback'), 'error');
        }
      },
      setVolume: async (vol) => {
        if (!Number.isFinite(vol)) return;
        const volume = Math.max(0, Math.min(1, vol));
        try {
          if (isTauri()) await invoke('set_volume', { volume });
          else setBrowserAudioVolume(volume);
          set({ volume });
        } catch (error) {
          get().showToast(getFailureMessage(error, 'playback'), 'error');
        }
      },
      toggleRepeat: () => set((s) => ({ repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' })),
      toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
      addToQueue: (t) => set((s) => ({ queue: [...s.queue, t] })),
      removeFromQueue: (i) => set((s) => ({ queue: s.queue.filter((_, j) => j !== i), queueIndex: s.queueIndex > i ? s.queueIndex - 1 : s.queueIndex })),
      clearQueue: () => set({ queue: [], queueIndex: -1 }),
      libraryTracks: [],
      playlists: [],
      loadLibrary: async () => {
        if (!isTauri()) {
          set({ libraryTracks: [] });
          return
        }
        try {
          const tracks = await invoke<Track[]>('get_library_tracks');
          set({ libraryTracks: tracks })
        } catch {
          get().showToast('Não foi possível carregar a biblioteca.', 'error')
        }
      },
      loadPlaylists: async () => {
        if (!isTauri()) {
          set({ playlists: [] });
          return
        }
        try {
          const loadedPlaylists = await invoke<Playlist[]>('get_playlists');
          set({ playlists: loadedPlaylists })
        } catch {
          get().showToast('Não foi possível carregar as playlists.', 'error')
        }
      },
      addTrackToLibrary: async (track) => {
        if (!isTauri()) {
          get().showToast('A biblioteca local está disponível no app desktop.', 'info');
          return
        }
        try {
          await invoke('add_to_library', { track });
          await get().loadLibrary()
        } catch {
          get().showToast('Não foi possível adicionar a música à biblioteca.', 'error')
        }
      },
      removeTrackFromLibrary: async (id) => {
        if (!isTauri()) {
          const track = get().libraryTracks.find((item) => item.id === id);
          if (get().currentTrack?.id === id) await get().setCurrentTrack(null);
          else {
            const queueIndex = get().queue.findIndex((item) => item.id === id);
            if (queueIndex >= 0) get().removeFromQueue(queueIndex);
          }
          if (track?.url?.startsWith('blob:')) URL.revokeObjectURL(track.url);
          set((state) => ({ libraryTracks: state.libraryTracks.filter((item) => item.id !== id) }));
          return
        }
        try {
          await invoke('remove_from_library', { trackId: id });
          await get().loadLibrary()
        } catch {
          get().showToast('Não foi possível remover a música da biblioteca.', 'error')
        }
      },
      importLocalTracks: async () => {
        if (!isTauri()) {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus';
          input.multiple = true;
          input.onchange = () => {
            const files = Array.from(input.files ?? []).filter((file) =>
              file.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|flac|ogg|opus)$/i.test(file.name)
            );
            if (!files.length) {
              get().showToast('Selecione arquivos de áudio compatíveis.', 'info');
              return;
            }
            const existingIds = new Set(get().libraryTracks.map((track) => track.sourceId));
            const newTracks = files
              .map((file) => ({
                file,
                sourceId: `browser-file:${file.name}:${file.size}:${file.lastModified}`,
              }))
              .filter(({ sourceId }) => !existingIds.has(sourceId))
              .map(({ file, sourceId }): Track => ({
                id: crypto.randomUUID(),
                title: file.name.replace(/\.[^/.]+$/, ''),
                artists: ['Arquivo local'],
                album: 'Músicas importadas',
                albumArt: '/favicon.svg',
                duration: 0,
                source: 'local',
                sourceId,
                url: URL.createObjectURL(file),
                addedAt: Date.now(),
              }));
            if (!newTracks.length) {
              get().showToast('Esses arquivos já estão na biblioteca.', 'info');
              return;
            }
            set((state) => ({ libraryTracks: [...state.libraryTracks, ...newTracks] }));
            get().showToast(`${newTracks.length} faixa(s) adicionada(s) à biblioteca.`, 'success');
          };
          input.click();
          return;
        }
        try {
          const selected = await invoke<Track[]>('pick_local_tracks');
          if (!selected.length) return;
          const existingPaths = new Set(get().libraryTracks.map((track) => track.sourceId));
          const newTracks = selected.filter((track) => !existingPaths.has(track.sourceId));
          if (!newTracks.length) {
            get().showToast('Esses arquivos já estão na biblioteca.', 'info');
            return;
          }
          for (const track of newTracks) {
            await invoke('add_to_library', { track });
          }
          await get().loadLibrary();
          get().showToast(`${newTracks.length} faixa(s) adicionada(s) à biblioteca.`, 'success');
        } catch {
          get().showToast('Não foi possível importar os arquivos de áudio.', 'error');
        }
      },
      createPlaylist: async (name) => {
        if (!isTauri()) {
          get().showToast('Criar playlists está disponível no app desktop.', 'info');
          return
        }
        try {
          await invoke('create_playlist', { name });
          await get().loadPlaylists()
        } catch {
          get().showToast('Não foi possível criar a playlist.', 'error')
        }
      },
      deletePlaylist: async (id) => {
        if (!isTauri()) {
          get().showToast('Playlists locais estão disponíveis no app desktop.', 'info');
          return
        }
        try {
          await invoke('delete_playlist', { id });
          await get().loadPlaylists()
        } catch {
          get().showToast('Não foi possível excluir a playlist.', 'error')
        }
      },
      addToPlaylist: async (playlistId, trackId) => {
        if (!isTauri()) {
          get().showToast('Playlists locais estão disponíveis no app desktop.', 'info');
          return
        }
        try {
          await invoke('add_to_playlist', { playlistId, trackId });
          await get().loadPlaylists()
        } catch {
          get().showToast('Não foi possível adicionar a música à playlist.', 'error')
        }
      },
      removeFromPlaylist: async (playlistId, trackId) => {
        if (!isTauri()) {
          get().showToast('Playlists locais estão disponíveis no app desktop.', 'info');
          return
        }
        try {
          await invoke('remove_from_playlist', { playlistId, trackId });
          await get().loadPlaylists()
        } catch {
          get().showToast('Não foi possível remover a música da playlist.', 'error')
        }
      },
      searchResults: [],
      searchLoading: false,
      searchError: false,
      searchErrorMessage: '',
      search: async (q) => {
        if (!q.trim()) {
          searchRequestId += 1;
          set({ searchResults: [], searchLoading: false, searchError: false, searchErrorMessage: '' });
          return;
        }
        if (!isTauri()) {
          const message = 'A prévia no navegador não tem um servidor de busca. Use o app desktop para buscar e reproduzir faixas.';
          set({ searchResults: [], searchLoading: false, searchError: true, searchErrorMessage: message });
          get().showToast('Busca real disponível no app desktop.', 'info');
          return;
        }

        const requestId = ++searchRequestId;
        set({ searchLoading: true, searchError: false, searchErrorMessage: '' });
        try {
          const results = await invoke<Track[]>('search_tracks', { query: q });
          if (requestId === searchRequestId) set({ searchResults: results, searchError: false, searchErrorMessage: '' });
        } catch (error) {
          if (requestId !== searchRequestId) return;
          const message = getFailureMessage(error, 'search');
          set({ searchResults: [], searchError: true, searchErrorMessage: message });
          get().showToast(message, 'error');
        } finally {
          if (requestId === searchRequestId) set({ searchLoading: false });
        }
      },
      currentLyrics: null,
      fetchLyrics: async (t) => {
        if (!isTauri()) {
          get().showToast('Buscar letras está disponível no app desktop.', 'info');
          return
        }
        try {
          const lyrics = await invoke<{ synced: any; plain: string } | null>('fetch_lyrics', { title: t.title, artist: t.artists[0] });
          set({ currentLyrics: lyrics })
        } catch {
          get().showToast('Não foi possível carregar a letra desta música.', 'error')
        }
      },
      toasts: [],
      showToast: (m, t = 'info') => {
        const id = crypto.randomUUID() as string;
        set((s) => ({ toasts: [...s.toasts, { id, message: m, type: t }] }));
        setTimeout(() => get().dismissToast(id), 4000)
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }),
    { name: 'tgtmusic-store', partialize: (s) => ({ theme: s.theme, volume: s.volume, repeat: s.repeat, shuffle: s.shuffle }) }
  )
)

if (typeof window !== 'undefined') {
  subscribeToBrowserAudio((event) => {
    if (event.type === 'time') {
      useAppStore.setState({ position: event.position, duration: event.duration })
    } else if (event.type === 'ended') {
      void useAppStore.getState().nextTrack()
    }
  })
}