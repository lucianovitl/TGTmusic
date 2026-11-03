import { useAppStore } from '../stores/useAppStore'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { Save, Download, FolderOpen, Music, Trash2, Sun, Moon, Palette, HardDrive, Shield, Info, Check } from 'lucide-react'
import { useEffect, useState } from 'react'

export function SettingsView() {
  const { theme, toggleTheme, showToast, libraryTracks, playlists } = useAppStore()
  const [downloadPath, setDownloadPath] = useState('')
  const [ytdlpPath, setYtdlpPath] = useState('')
  const [activeSection, setActiveSection] = useState<'appearance' | 'downloads' | 'data' | 'about'>('appearance')

  useEffect(() => {
    if (!isTauri()) return
    let active = true
    void Promise.all([
      invoke<string>('get_download_path').catch(() => ''),
      invoke<string>('get_ytdlp_path').catch(() => ''),
    ]).then(([savedDownloadPath, savedYtdlpPath]) => {
      if (!active) return
      setDownloadPath(savedDownloadPath)
      setYtdlpPath(savedYtdlpPath)
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
                  <span className="badge badge-neutral">Spotify (metadados)</span>
                  <span className="badge badge-neutral">YouTube (fonte de áudio)</span>
                </div>
                <p className="mt-3 text-sm text-fg-tertiary">A disponibilidade, os anúncios e os limites seguem as regras da fonte de áudio.</p>
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