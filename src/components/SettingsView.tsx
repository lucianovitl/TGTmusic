import { useAppStore } from '../stores/useAppStore'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { Save, Download, FolderOpen, Music, Trash2, Sun, Moon, Palette, HardDrive, Shield, Info, Check, SlidersHorizontal, Search, Database, Globe, Key, RefreshCw, Chrome, Wifi, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

interface BrowserCookie {
  browser: string
  profile: string
  path: string
  type: string
}

export function SettingsView() {
  const { theme, toggleTheme, showToast, libraryTracks, playlists, crossfadeEnabled, setCrossfadeEnabled, crossfadeDuration, setCrossfadeDuration } = useAppStore()
  const [downloadPath, setDownloadPath] = useState('')
  const [ytdlpPath, setYtdlpPath] = useState('')
  const [activeSection, setActiveSection] = useState<'appearance' | 'downloads' | 'data' | 'about'>('appearance')
  const [browsers, setBrowsers] = useState<BrowserCookie[]>([])
  const [detectingBrowsers, setDetectingBrowsers] = useState(false)
  const [importingCookies, setImportingCookies] = useState<string | null>(null)
  const [crossSourceFallback, setCrossSourceFallback] = useState(true)
  const [downloadThenPlay, setDownloadThenPlay] = useState(false)
  const [ytdlpProxy, setYtdlpProxy] = useState('')
  const [ytdlpInvidious, setYtdlpInvidious] = useState('')
  const [ytdlpCookies, setYtdlpCookies] = useState('')

  useEffect(() => {
    if (!isTauri()) return
    let active = true
    void Promise.all([
      invoke<string>('get_download_path').catch(() => ''),
      invoke<string>('get_ytdlp_path').catch(() => ''),
      invoke<string | null>('get_ytdlp_cookies').catch(() => null),
      invoke<string | null>('get_ytdlp_proxy').catch(() => null),
      invoke<string | null>('get_ytdlp_invidious').catch(() => null),
      invoke<boolean>('get_cross_source_fallback').catch(() => true),
      invoke<boolean>('get_download_then_play').catch(() => false),
    ]).then(([savedDownloadPath, savedYtdlpPath, savedCookies, savedProxy, savedInvidious, savedCrossSource, savedDownloadThenPlay]) => {
      if (!active) return
      setDownloadPath(savedDownloadPath)
      setYtdlpPath(savedYtdlpPath)
      setYtdlpCookies(savedCookies || '')
      setYtdlpProxy(savedProxy || '')
      setYtdlpInvidious(savedInvidious || '')
      setCrossSourceFallback(savedCrossSource)
      setDownloadThenPlay(savedDownloadThenPlay)
    })
    return () => { active = false }
  }, [])

  const handleSaveSettings = async () => {
    if (!isTauri()) {
      showToast('Configurações de arquivos estão disponíveis no app desktop.', 'info')
      return
    }
    try {
      await invoke('set_download_path', { path: downloadPath })
      await invoke('set_ytdlp_path', { path: ytdlpPath })
      await invoke('set_cross_source_fallback', { enabled: crossSourceFallback })
      await invoke('set_download_then_play', { enabled: downloadThenPlay })
      if (ytdlpProxy.trim()) {
        await invoke('set_ytdlp_proxy', { proxy: ytdlpProxy.trim() })
      }
      if (ytdlpInvidious.trim()) {
        await invoke('set_ytdlp_invidious', { instance: ytdlpInvidious.trim() })
      }
      showToast('Configurações salvas', 'success')
    } catch {
      showToast('Não foi possível salvar as configurações.', 'error')
    }
  }

  const handlePickDownloadFolder = async () => {
    if (!isTauri()) {
      showToast('Escolher pastas está disponível no app desktop.', 'info')
      return
    }
    try {
      const path = await invoke<string | null>('pick_folder')
      if (path) setDownloadPath(path)
    } catch {
      showToast('Não foi possível escolher a pasta de download.', 'error')
    }
  }

  const handleTestYtDlp = async () => {
    if (!isTauri()) {
      showToast('Teste disponível no app desktop.', 'info')
      return
    }
    try {
      const result = await invoke<string>('test_yt_dlp')
      showToast(result, 'success')
    } catch (e) {
      showToast(`Erro: ${e}`, 'error')
    }
  }

  const handleTestYtDlpSearch = async () => {
    if (!isTauri()) {
      showToast('Teste disponível no app desktop.', 'info')
      return
    }
    try {
      const result = await invoke<string>('test_yt_dlp_search', { query: 'the weeknd blinding lights' })
      showToast(result, 'success')
    } catch (e) {
      showToast(`Erro: ${e}`, 'error')
    }
  }

  const handleTestYtDlpRaw = async () => {
    if (!isTauri()) {
      showToast('Teste disponível no app desktop.', 'info')
      return
    }
    try {
      const result = await invoke<string>('test_yt_dlp_raw', { query: 'the weeknd blinding lights' })
      showToast(result, 'info')
    } catch (e) {
      showToast(`Erro: ${e}`, 'error')
    }
  }

  const handleTestYtDlpSearchDirect = async () => {
    if (!isTauri()) {
      showToast('Teste disponível no app desktop.', 'info')
      return
    }
    try {
      const result = await invoke<string>('test_yt_dlp_search_direct', { query: 'the weeknd blinding lights' })
      showToast(result, 'info')
    } catch (e) {
      showToast(`Erro: ${e}`, 'error')
    }
  }

  const handleDetectBrowsers = async () => {
    if (!isTauri()) {
      showToast('Disponível apenas no app desktop.', 'info')
      return
    }
    setDetectingBrowsers(true)
    try {
      const result = await invoke<BrowserCookie[]>('detect_browser_cookies')
      setBrowsers(result)
      showToast(`Encontrados ${result.length} perfis de navegador`, 'success')
    } catch (e) {
      showToast(`Erro ao detectar navegadores: ${e}`, 'error')
    } finally {
      setDetectingBrowsers(false)
    }
  }

  const handleImportCookies = async (browser: string, profile: string) => {
    if (!isTauri()) {
      showToast('Disponível apenas no app desktop.', 'info')
      return
    }
    setImportingCookies(`${browser} (${profile})`)
    try {
      const result = await invoke<string>('import_browser_cookies', { browser, profile })
      showToast(result, 'success')
      // Refresh cookies path
      const cookiesPath = await invoke<string | null>('get_ytdlp_cookies').catch(() => null)
      setYtdlpCookies(cookiesPath || '')
    } catch (e) {
      showToast(`Erro ao importar cookies: ${e}`, 'error')
    } finally {
      setImportingCookies(null)
    }
  }

  const handleClearCookies = async () => {
    if (!isTauri()) {
      showToast('Disponível apenas no app desktop.', 'info')
      return
    }
    try {
      await invoke('clear_ytdlp_cookies')
      setYtdlpCookies('')
      showToast('Cookies removidos', 'success')
    } catch (e) {
      showToast(`Erro ao remover cookies: ${e}`, 'error')
    }
  }

  const handleSaveProxy = async () => {
    if (!isTauri()) return
    try {
      await invoke('set_ytdlp_proxy', { proxy: ytdlpProxy })
      showToast('Proxy salvo', 'success')
    } catch (e) {
      showToast(`Erro: ${e}`, 'error')
    }
  }

  const handleClearProxy = async () => {
    if (!isTauri()) return
    try {
      await invoke('clear_ytdlp_proxy')
      setYtdlpProxy('')
      showToast('Proxy removido', 'success')
    } catch (e) {
      showToast(`Erro: ${e}`, 'error')
    }
  }

  const handleSaveInvidious = async () => {
    if (!isTauri()) return
    try {
      await invoke('set_ytdlp_invidious', { instance: ytdlpInvidious })
      showToast('Invidious salvo', 'success')
    } catch (e) {
      showToast(`Erro: ${e}`, 'error')
    }
  }

  const handleClearInvidious = async () => {
    if (!isTauri()) return
    try {
      await invoke('clear_ytdlp_invidious')
      setYtdlpInvidious('')
      showToast('Invidious removido', 'success')
    } catch (e) {
      showToast(`Erro: ${e}`, 'error')
    }
  }

  const handleSaveCrossSourceFallback = async () => {
    if (!isTauri()) return
    try {
      await invoke('set_cross_source_fallback', { enabled: crossSourceFallback })
      showToast('Cross-source fallback salvo', 'success')
    } catch (e) {
      showToast(`Erro: ${e}`, 'error')
    }
  }

  const handleSaveDownloadThenPlay = async () => {
    if (!isTauri()) return
    try {
      await invoke('set_download_then_play', { enabled: downloadThenPlay })
      showToast('Download-then-play salvo', 'success')
    } catch (e) {
      showToast(`Erro: ${e}`, 'error')
    }
  }

  const handleExportData = async () => {
    if (!isTauri()) {
      showToast('Exportar dados está disponível no app desktop.', 'info')
      return
    }
    const data = JSON.stringify({ libraryTracks, playlists }, null, 2)
    try {
      const saved = await invoke<boolean>('save_file', { content: data, defaultName: 'tgtmusic-backup.json' })
      if (saved) showToast('Backup exportado', 'success')
    } catch {
      showToast('Não foi possível exportar o backup.', 'error')
    }
  }

  const handleImportData = async () => {
    if (!isTauri()) {
      showToast('Importar dados está disponível no app desktop.', 'info')
      return
    }
    try {
      const result = await invoke<string | null>('open_file')
      if (result === null) return
      const data = JSON.parse(result)
      if (!Array.isArray(data.libraryTracks) || !Array.isArray(data.playlists)) {
        throw new Error('Invalid backup structure')
      }
      await invoke('import_library', { tracks: data.libraryTracks })
      await invoke('import_playlists', { playlists: data.playlists })
      showToast('Dados importados', 'success')
      window.location.reload()
    } catch {
      showToast('Não foi possível importar o backup. Verifique se o JSON é válido.', 'error')
    }
  }

  const handleClearAll = async () => {
    if (!isTauri()) {
      showToast('A limpeza de dados está disponível no app desktop.', 'info')
      return
    }
    if (confirm('APAGAR TUDO? Biblioteca, playlists, configurações. Irreversível.')) {
      try {
        await invoke('clear_all_data')
        showToast('Todos os dados limpos', 'success')
        window.location.reload()
      } catch {
        showToast('Não foi possível limpar os dados.', 'error')
      }
    }
  }

  const sections = [
    { id: 'appearance', label: 'Aparência', icon: Palette, desc: 'Tema, cores e visualização' },
    { id: 'downloads', label: 'Downloads', icon: HardDrive, desc: 'Pasta, qualidade e yt-dlp' },
    { id: 'data', label: 'Dados', icon: Shield, desc: 'Backup, importação e limpeza' },
    { id: 'about', label: 'Sobre', icon: Info, desc: 'Versão, licenças e créditos' },
  ] as const

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-display text-fg-primary">Configurações</h2>
          <p className="text-fg-secondary mt-1">Personalize sua experiência</p>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="card overflow-hidden">
        <nav className="flex flex-wrap bg-bg-tertiary/50 p-1" role="tablist" aria-label="Seções de configurações">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeSection === section.id
                  ? 'bg-brand-primary/10 text-brand-primary shadow-sm'
                  : 'text-fg-secondary hover:text-fg-primary hover:bg-bg-hover'
              }`}
              role="tab"
              aria-selected={activeSection === section.id}
              aria-controls={`panel-${section.id}`}
            >
              <section.icon className="w-4 h-4" aria-hidden="true" />
              {section.label}
            </button>
          ))}
        </nav>

        {/* Panels */}
        <div className="p-6">
          {/* Appearance */}
          <div id="panel-appearance" role="tabpanel" aria-labelledby="appearance" className={activeSection === 'appearance' ? 'animate-in' : 'hidden'}>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-fg-primary mb-4 flex items-center gap-2">
                  <Sun className="w-5 h-5 text-amber-400" />
                  Tema
                </h3>
                <p className="text-fg-secondary text-sm mb-4">Escolha como o app aparece</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={() => theme !== 'light' && toggleTheme()}
                    className={`relative p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-3 ${
                      theme === 'light'
                        ? 'border-brand-primary bg-brand-primary/5'
                        : 'border-border-default hover:border-brand-primary/50'
                    }`}
                    role="radio"
                    aria-checked={theme === 'light'}
                  >
                    <div className="w-16 h-16 rounded-xl bg-white border border-neutral-200 flex items-center justify-center">
                      <Sun className="w-8 h-8 text-amber-400" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-fg-primary">Claro</p>
                      <p className="text-sm text-fg-tertiary">Interface clara</p>
                    </div>
                    {theme === 'light' && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-brand-primary flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>

                  <button
                    onClick={() => theme !== 'dark' && toggleTheme()}
                    className={`relative p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-3 ${
                      theme === 'dark'
                        ? 'border-brand-primary bg-brand-primary/5'
                        : 'border-border-default hover:border-brand-primary/50'
                    }`}
                    role="radio"
                    aria-checked={theme === 'dark'}
                  >
                    <div className="w-16 h-16 rounded-xl bg-neutral-900 border border-neutral-700 flex items-center justify-center">
                      <Moon className="w-8 h-8 text-blue-400" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-fg-primary">Escuro</p>
                      <p className="text-sm text-fg-tertiary">Interface escura (padrão)</p>
                    </div>
                    {theme === 'dark' && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-brand-primary flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <h3 className="font-semibold text-fg-primary mb-4 flex items-center gap-2">
                  <Palette className="w-5 h-5 text-violet-400" />
                  Cor de destaque
                </h3>
                <p className="text-fg-secondary text-sm mb-4">Em breve: personalize a cor principal do app</p>
                <div className="flex items-center gap-3">
                  <button className="btn-ghost w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary" disabled />
                  <button className="btn-ghost w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500" disabled />
                  <button className="btn-ghost w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500" disabled />
                  <button className="btn-ghost w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500" disabled />
                  <span className="text-fg-tertiary text-sm ml-2">Em desenvolvimento</span>
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <h3 className="font-semibold text-fg-primary mb-4 flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-cyan-400" />
                  Crossfade
                </h3>
                <p className="text-fg-secondary text-sm mb-4">Transição suave entre faixas</p>
                <div className="space-y-4">
                  <label className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-fg-primary">Crossfade</p>
                      <p className="text-sm text-fg-tertiary">Transição suave entre faixas consecutivas</p>
                    </div>
                    <button
                      onClick={() => setCrossfadeEnabled(!crossfadeEnabled)}
                      className={`relative w-12 h-7 rounded-full transition-colors ${
                        crossfadeEnabled ? 'bg-brand-primary' : 'bg-bg-tertiary'
                      }`}
                      role="switch"
                      aria-checked={crossfadeEnabled}
                    >
                      <span
                        className={`absolute top-0.5 transition-transform duration-200 w-6 h-6 rounded-full bg-white shadow ${
                          crossfadeEnabled ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </label>

                  <div className={crossfadeEnabled ? '' : 'opacity-50 pointer-events-none'}>
                    <label className="block">
                      <p className="text-sm text-fg-secondary mb-2">Duração: {crossfadeDuration}s</p>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={crossfadeDuration}
                        onChange={(e) => setCrossfadeDuration(Number(e.target.value))}
                        className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none accent-brand-primary"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Downloads */}
          <div id="panel-downloads" role="tabpanel" aria-labelledby="downloads" className={activeSection === 'downloads' ? 'animate-in' : 'hidden'}>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-fg-primary mb-4 flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-brand-primary" />
                  Pasta de download
                </h3>
                <p className="text-fg-secondary text-sm mb-4">Onde salvar as músicas baixadas</p>
                <div className="flex gap-3">
                  <input
                    value={downloadPath}
                    onChange={(e) => setDownloadPath(e.target.value)}
                    className="input flex-1"
                    placeholder="Selecione a pasta..."
                    readOnly
                  />
                  <button
                    onClick={handlePickDownloadFolder}
                    className="btn-ghost btn-icon p-3"
                    aria-label="Escolher pasta"
                  >
                    <FolderOpen className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <h3 className="font-semibold text-fg-primary mb-4 flex items-center gap-2">
                  <Music className="w-5 h-5 text-violet-400" />
                  yt-dlp
                </h3>
                <p className="text-fg-secondary text-sm mb-4">Caminho do executável yt-dlp (opcional)</p>
                <input
                  value={ytdlpPath}
                  onChange={(e) => setYtdlpPath(e.target.value)}
                  className="input"
                  placeholder="C:\\caminho\\para\\yt-dlp.exe (opcional)"
                />
                <p className="text-xs text-fg-tertiary mt-2">Informe o caminho completo do executável ou deixe vazio para detecção automática.</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <button onClick={handleTestYtDlp} className="btn-secondary gap-2">
                  <Music className="w-4 h-4" />
                  Testar yt-dlp
                </button>
                <button onClick={handleTestYtDlpSearch} className="btn-secondary gap-2">
                  <Search className="w-4 h-4" />
                  Testar busca
                </button>
                <button onClick={handleTestYtDlpRaw} className="btn-ghost gap-2">
                  <Search className="w-4 h-4" />
                  Debug raw
                </button>
                <button onClick={handleTestYtDlpSearchDirect} className="btn-ghost gap-2">
                  <Search className="w-4 h-4" />
                  Debug search
                </button>
              </div>
              </div>

              {/* Cookies from Browser */}
              <div className="border-t border-border pt-6">
                <h3 className="font-semibold text-fg-primary mb-4 flex items-center gap-2">
                  <Key className="w-5 h-5 text-amber-400" />
                  Cookies do navegador (para conteúdo restrito)
                </h3>
                <p className="text-fg-secondary text-sm mb-4">Importe cookies do Chrome/Edge/Firefox para acessar conteúdo com restrição de idade ou região no YouTube</p>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleDetectBrowsers}
                      disabled={detectingBrowsers}
                      className="btn-secondary gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${detectingBrowsers ? 'animate-spin' : ''}`} />
                      {detectingBrowsers ? 'Detectando...' : 'Detectar navegadores'}
                    </button>
                    {ytdlpCookies && (
                      <button onClick={handleClearCookies} className="btn-ghost gap-2 text-red-400 hover:text-red-300">
                        <Trash2 className="w-4 h-4" />
                        Remover cookies
                      </button>
                    )}
                  </div>

                  {browsers.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-fg-secondary">Perfis encontrados:</p>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {browsers.map((browser) => (
                          <div key={`${browser.browser}-${browser.profile}`} className="card p-3 border-border">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {browser.type === 'chromium' ? (
                                  <Chrome className="w-5 h-5 text-brand-primary" />
                                ) : (
                                  <Globe className="w-5 h-5 text-orange-500" />
                                )}
                                <div>
                                  <p className="font-medium text-fg-primary text-sm">{browser.browser}</p>
                                  <p className="text-xs text-fg-tertiary">{browser.profile}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleImportCookies(browser.browser, browser.profile)}
                                disabled={importingCookies !== null}
                                className={`btn-primary btn-sm gap-1 ${importingCookies === `${browser.browser} (${browser.profile})` ? 'opacity-50' : ''}`}
                              >
                                {importingCookies === `${browser.browser} (${browser.profile})` ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    Importando...
                                  </>
                                ) : (
                                  <>
                                    <Database className="w-3 h-3" />
                                    Importar
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {browsers.length === 0 && !detectingBrowsers && (
                    <div className="card p-4 border-border bg-bg-tertiary/50">
                      <p className="text-fg-secondary text-sm text-center">
                        Nenhum navegador detectado. Clique em "Detectar navegadores" para procurar perfis do Chrome, Edge, Firefox, Brave, Vivaldi e Opera.
                      </p>
                    </div>
                  )}

                  {ytdlpCookies && (
                    <div className="card p-3 border-green-500/30 bg-green-500/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-green-400">
                          <ShieldCheck className="w-4 h-4" />
                          <span className="text-sm font-medium">Cookies configurados</span>
                        </div>
                        <span className="text-xs text-fg-tertiary truncate max-w-xs">{ytdlpCookies}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Cross-source Fallback */}
              <div className="border-t border-border pt-6">
                <h3 className="font-semibold text-fg-primary mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-cyan-400" />
                  Fallback entre fontes
                </h3>
                <p className="text-fg-secondary text-sm mb-4">Se o YouTube falhar (403, restrição, etc.), tenta automaticamente SoundCloud, Bandcamp, Internet Archive, Jamendo</p>
                <label className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-fg-primary">Fallback entre fontes</p>
                    <p className="text-sm text-fg-tertiary">Tenta outras fontes gratuitas automaticamente</p>
                  </div>
                  <button
                    onClick={() => {
                      setCrossSourceFallback(!crossSourceFallback)
                      handleSaveCrossSourceFallback()
                    }}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      crossSourceFallback ? 'bg-brand-primary' : 'bg-bg-tertiary'
                    }`}
                    role="switch"
                    aria-checked={crossSourceFallback}
                  >
                    <span
                      className={`absolute top-0.5 transition-transform duration-200 w-6 h-6 rounded-full bg-white shadow ${
                        crossSourceFallback ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </label>
              </div>

              {/* Download then Play */}
              <div className="border-t border-border pt-6">
                <h3 className="font-semibold text-fg-primary mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-violet-400" />
                  Baixar antes de tocar
                </h3>
                <p className="text-fg-secondary text-sm mb-4">Baixa a faixa completa antes de iniciar a reprodução (mais robusto para conexões instáveis ou conteúdo problemático)</p>
                <label className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-fg-primary">Download-then-play</p>
                    <p className="text-sm text-fg-tertiary">Baixa inteiro antes de tocar (usa mais disco, mais confiável)</p>
                  </div>
                  <button
                    onClick={() => {
                      setDownloadThenPlay(!downloadThenPlay)
                      handleSaveDownloadThenPlay()
                    }}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      downloadThenPlay ? 'bg-brand-primary' : 'bg-bg-tertiary'
                    }`}
                    role="switch"
                    aria-checked={downloadThenPlay}
                  >
                    <span
                      className={`absolute top-0.5 transition-transform duration-200 w-6 h-6 rounded-full bg-white shadow ${
                        downloadThenPlay ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </label>
              </div>

              {/* Proxy */}
              <div className="border-t border-border pt-6">
                <h3 className="font-semibold text-fg-primary mb-4 flex items-center gap-2">
                  <Wifi className="w-5 h-5 text-amber-400" />
                  Proxy para yt-dlp
                </h3>
                <p className="text-fg-secondary text-sm mb-4">Configure um proxy HTTP/SOCKS5 para contornar bloqueios de região (ex: http://user:pass@host:port ou socks5://host:port)</p>
                <div className="flex gap-3">
                  <input
                    value={ytdlpProxy}
                    onChange={(e) => setYtdlpProxy(e.target.value)}
                    className="input flex-1"
                    placeholder="http://user:pass@proxy:port ou socks5://host:port"
                  />
                  {ytdlpProxy ? (
                    <button onClick={handleClearProxy} className="btn-ghost gap-2 text-red-400 hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                      Limpar
                    </button>
                  ) : (
                    <button onClick={handleSaveProxy} className="btn-primary gap-2">
                      <Save className="w-4 h-4" />
                      Salvar
                    </button>
                  )}
                </div>
              </div>

              {/* Invidious Instance */}
              <div className="border-t border-border pt-6">
                <h3 className="font-semibold text-fg-primary mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-green-400" />
                  Instância Invidious (YouTube alternativo)
                </h3>
                <p className="text-fg-secondary text-sm mb-4">Use uma instância Invidious para evitar bloqueios do YouTube (ex: https://yewtu.be, https://inv.nadeko.net). Deixe vazio para usar YouTube direto.</p>
                <div className="flex gap-3">
                  <input
                    value={ytdlpInvidious}
                    onChange={(e) => setYtdlpInvidious(e.target.value)}
                    className="input flex-1"
                    placeholder="https://yewtu.be"
                  />
                  {ytdlpInvidious ? (
                    <button onClick={handleClearInvidious} className="btn-ghost gap-2 text-red-400 hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                      Limpar
                    </button>
                  ) : (
                    <button onClick={handleSaveInvidious} className="btn-primary gap-2">
                      <Save className="w-4 h-4" />
                      Salvar
                    </button>
                  )}
                </div>
                <p className="text-xs text-fg-tertiary mt-2">Instâncias públicas: yewtu.be, inv.nadeko.net, inv.tux.pizza, y.com.cm, invidious.snopyta.org</p>
              </div>

              <div className="border-t border-border pt-6">
                <h3 className="font-semibold text-fg-primary mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-amber-400" />
                  Qualidade de áudio
                </h3>
                <p className="text-fg-secondary text-sm mb-4">Em breve: escolha a qualidade padrão dos downloads</p>
                <div className="flex flex-wrap gap-3">
                  <button className="btn-secondary">MP3 320kbps</button>
                  <button className="btn-ghost">MP3 256kbps</button>
                  <button className="btn-ghost">MP3 128kbps</button>
                  <button className="btn-ghost">Opus 160kbps</button>
                </div>
              </div>

              <button onClick={handleSaveSettings} className="btn-primary px-8 py-3 gap-2 w-full sm:w-auto">
                <Save className="w-4 h-4" />
                Salvar configurações
              </button>
            </div>
          </div>

          {/* Data */}
          <div id="panel-data" role="tabpanel" aria-labelledby="data" className={activeSection === 'data' ? 'animate-in' : 'hidden'}>
            <div className="space-y-6">
              <div className="card p-6 border-brand-primary/20">
                <h3 className="font-semibold text-fg-primary mb-4 flex items-center gap-2">
                  <Download className="w-5 h-5 text-brand-primary" />
                  Exportar dados
                </h3>
                <p className="text-fg-secondary text-sm mb-4">Baixe um backup completo da sua biblioteca e playlists</p>
                <button onClick={handleExportData} className="btn-primary gap-2">
                  <Download className="w-4 h-4" />
                  Exportar backup (JSON)
                </button>
              </div>

              <div className="card p-6 border-violet-500/20">
                <h3 className="font-semibold text-fg-primary mb-4 flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-violet-400" />
                  Importar backup
                </h3>
                <p className="text-fg-secondary text-sm mb-4">Restaure sua biblioteca a partir de um arquivo de backup</p>
                <button onClick={handleImportData} className="btn-secondary gap-2">
                  <FolderOpen className="w-4 h-4" />
                  Selecionar arquivo
                </button>
              </div>

              <div className="card p-6 border-red-500/20">
                <h3 className="font-semibold text-fg-primary mb-4 flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-red-400" />
                  Limpar tudo
                </h3>
                <p className="text-fg-secondary text-sm mb-4 text-red-400/80">
                  <strong>Atenção:</strong> Esta ação é irreversível. Apaga biblioteca, playlists e configurações.
                </p>
                <button onClick={handleClearAll} className="btn-danger gap-2">
                  <Trash2 className="w-4 h-4" />
                  Limpar TUDO
                </button>
              </div>
            </div>
          </div>

          {/* About */}
          <div id="panel-about" role="tabpanel" aria-labelledby="about" className={activeSection === 'about' ? 'animate-in' : 'hidden'}>
            <div className="space-y-6">
              <div className="card p-6 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-brand-primary to-violet-500 flex items-center justify-center">
                  <Music className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-display text-fg-primary mb-2">TGTmusic</h3>
                <p className="text-fg-secondary">Player desktop com busca de faixas e controles de reprodução.</p>
                <div className="mt-4 flex items-center justify-center gap-4 text-sm text-fg-tertiary">
                  <span>v1.0.0</span>
                  <span>•</span>
                  <span>Tauri 2 + React + Rust</span>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="card p-5">
                  <h4 className="font-semibold text-fg-primary mb-3 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-green-400" />
                    Privacidade
                  </h4>
                  <ul className="space-y-2 text-sm text-fg-secondary">
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-400" />Biblioteca e playlists salvas neste dispositivo</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-400" />A busca envia sua consulta ao Spotify</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-400" />A reprodução depende da fonte vinculada</li>
                  </ul>
                </div>

                <div className="card p-5">
                  <h4 className="font-semibold text-fg-primary mb-3 flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-brand-primary" />
                    Tecnologias
                  </h4>
                  <ul className="space-y-2 text-sm text-fg-secondary">
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-primary" />Tauri 2 (Rust)</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-primary" />React 18 + TypeScript</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-primary" />Tailwind CSS</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-primary" />Zustand</li>
                  </ul>
                </div>
              </div>

              <div className="card p-5">
                <h4 className="font-semibold text-fg-primary mb-3 flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-400" />
                  Fontes de música
                </h4>
                <div className="flex flex-wrap gap-2">
                  <span className="badge badge-neutral">Metadados (Spotify API)</span>
                  <span className="badge badge-neutral">Áudio (YouTube)</span>
                </div>
                <p className="mt-3 text-sm text-fg-tertiary">A disponibilidade, anúncios e limites dependem das fontes de dados.</p>
              </div>

              <div className="text-center text-sm text-fg-tertiary pt-4 border-t border-border">
                <p>Feito com ❤️ para amantes de música</p>
                <p className="mt-1">A reprodução depende da disponibilidade e das condições da fonte.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}