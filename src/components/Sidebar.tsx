import { useAppStore } from '../stores/useAppStore'
import { Disc3, Music, ListMusic, Settings, Plus, ChevronLeft } from 'lucide-react'
import { useState } from 'react'

const NAV = [
  { id: 'search', label: 'Descobrir', icon: Disc3 },
  { id: 'library', label: 'Coleção', icon: Music },
  { id: 'playlists', label: 'Mixes', icon: ListMusic },
  { id: 'settings', label: 'Configurações', icon: Settings },
] as const

export function Sidebar() {
  const { view, setView, playlists, createPlaylist, deletePlaylist, theme, toggleTheme } = useAppStore()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
    <aside
      className={`hidden lg:flex relative top-0 h-screen bg-sidebar-bg border-r border-sidebar-border flex-col z-40 transition-all duration-300 ease-out ${collapsed ? 'w-[72px]' : 'w-[280px]'}`}
    >
      {/* Brand Header */}
      <div className={`flex shrink-0 items-center border-b border-sidebar-border py-5 ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
        {collapsed ? (
          <button onClick={() => setCollapsed(false)} className="btn-ghost btn-icon h-11 w-11" aria-label="Expandir sidebar">
            <Disc3 className="h-6 w-6 text-brand-primary" aria-hidden="true" />
          </button>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem_0.35rem_1rem_0.35rem] bg-[var(--hero-lime)] text-[var(--hero-bg)] shadow-[0_0_24px_rgba(196,240,122,0.18)]">
                <Disc3 className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0 animate-in">
                <h1 className="truncate text-xl font-extrabold tracking-tight text-fg-primary" style={{ fontFamily: 'var(--font-display)' }}>
                  TGTmusic
                </h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-tertiary">central de som</p>
              </div>
            </div>
            <button onClick={() => setCollapsed(true)} className="btn-ghost btn-icon h-11 w-11 shrink-0 p-1.5" aria-label="Colapsar sidebar">
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto" role="navigation" aria-label="Navegação principal">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setView(id as any)}
            className={`sidebar-item w-full justify-start gap-3 transition-all duration-200 ${
              view === id ? 'active' : ''
            } ${collapsed ? 'justify-center px-2' : ''}`}
            title={collapsed ? label : undefined}
            aria-current={view === id ? 'page' : undefined}
          >
            <Icon className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
            {!collapsed && (
              <span className="text-body font-medium truncate animate-in delay-1">{label}</span>
            )}
          </button>
        ))}

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={`sidebar-item w-full justify-start gap-3 transition-all duration-200 ${collapsed ? 'justify-center px-2' : ''}`}
          title={collapsed ? (theme === 'dark' ? 'Tema claro' : 'Tema escuro') : undefined}
        >
          {theme === 'dark' ? (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
          {!collapsed && (
            <span className="text-body font-medium truncate animate-in delay-2">
              {theme === 'dark' ? 'Tema escuro' : 'Tema claro'}
            </span>
          )}
        </button>
      </nav>

      {/* Playlists Section */}
      <div className="p-3 border-t border-sidebar-border shrink-0" style={{ opacity: collapsed ? 0 : 1, pointerEvents: collapsed ? 'none' : 'auto' }}>
        <div className="flex items-center justify-between mb-3">
          {!collapsed && (
            <h3 className="text-caption text-fg-tertiary animate-in">Seus mixes</h3>
          )}
          <button
            onClick={() => {
              const name = prompt('Nome da playlist:')
              if (name?.trim()) createPlaylist(name.trim())
            }}
            className={`btn-ghost btn-icon p-1.5 ${collapsed ? 'mx-auto' : ''}`}
            aria-label="Nova playlist"
            title={collapsed ? 'Nova playlist' : undefined}
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            {!collapsed && <span className="text-body font-medium">Nova</span>}
          </button>
        </div>

        <ul className="space-y-1 max-h-[300px] overflow-y-auto" role="list">
          {playlists.length === 0 ? (
            !collapsed && (
              <li className="text-center py-6 text-fg-tertiary text-sm animate-in">
                Nenhuma playlist ainda
              </li>
            )
          ) : (
            playlists.map((pl) => (
              <li key={pl.id} className="group flex items-center gap-1">
                <button
                  onClick={() => setView('playlists')}
                  className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200 ${
                    view === 'playlists' ? 'bg-brand-primary/10 text-brand-primary' : 'text-fg-secondary hover:bg-sidebar-hover hover:text-fg-primary'
                  } ${collapsed ? 'justify-center px-2' : ''}`}
                  title={collapsed ? pl.name : undefined}
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 transition-transform duration-200 group-hover:scale-105">
                    <ListMusic className="h-5 w-5 text-brand-primary" aria-hidden="true" />
                  </div>
                  {!collapsed && (
                    <div className="min-w-0 flex-1 animate-in">
                      <p className="truncate text-body font-medium">{pl.name}</p>
                      <p className="truncate text-caption text-fg-tertiary">{pl.trackIds.length} {pl.trackIds.length === 1 ? 'música' : 'músicas'}</p>
                    </div>
                  )}
                </button>
                {!collapsed && (
                  <button
                    onClick={() => {
                      if (confirm(`Excluir playlist "${pl.name}"?`)) deletePlaylist(pl.id)
                    }}
                    className="btn-ghost btn-icon-sm p-1 text-red-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-300 focus-visible:opacity-100"
                    aria-label={`Excluir ${pl.name}`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border shrink-0" style={{ opacity: collapsed ? 0 : 1 }}>
        <p className="text-caption text-fg-tertiary text-center animate-in">
          TGTmusic v1.0.0
        </p>
        <p className="mt-1 text-center text-xs text-fg-tertiary animate-in delay-1">
          Sua próxima faixa espera.
        </p>
      </div>
    </aside>
    <nav
      className="fixed left-0 right-0 z-[60] flex items-stretch border-t border-sidebar-border bg-sidebar-bg lg:hidden"
      style={{ bottom: 'calc(96px + env(safe-area-inset-bottom))' }}
      aria-label="Navegação principal"
    >
      {NAV.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setView(id as any)}
          className={`flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-xs transition-colors ${view === id ? 'text-brand-primary' : 'text-fg-tertiary hover:text-fg-primary'}`}
          aria-current={view === id ? 'page' : undefined}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </button>
      ))}
    </nav>
    </>
  )
}