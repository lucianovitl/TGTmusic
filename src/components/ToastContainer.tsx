import { useAppStore } from '../stores/useAppStore'
import { X, CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react'

export function ToastContainer() {
  const { toasts, dismissToast } = useAppStore()

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
    loading: Loader2,
  }

  const styles = {
    success: 'bg-green-900/30 border-green-500/30 text-green-300',
    error: 'bg-red-900/30 border-red-500/30 text-red-300',
    info: 'bg-blue-900/30 border-blue-500/30 text-blue-300',
    loading: 'bg-violet-900/30 border-violet-500/30 text-violet-300',
  }

  const iconStyles = {
    success: 'text-green-400',
    error: 'text-red-400',
    info: 'text-blue-400',
    loading: 'text-violet-400 animate-spin',
  }

  return (
    <div className="fixed bottom-28 left-6 right-6 lg:left-auto lg:right-6 lg:bottom-28 lg:w-80 z-[900] flex flex-col-reverse gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const Icon = icons[toast.type] || Info
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto animate-slide-in-right flex items-start gap-3 px-4 py-3.5 rounded-2xl border shadow-xl backdrop-blur-sm ${styles[toast.type]}`}
            role="alert"
            aria-live="polite"
          >
            <div className={`flex-shrink-0 w-5 h-5 mt-0.5 ${iconStyles[toast.type]}`}>
              <Icon className="w-5 h-5" aria-hidden="true" />
            </div>
            <p className="flex-1 text-sm text-body leading-relaxed">{toast.message}</p>
            <button
              onClick={() => dismissToast(toast.id)}
              className="flex-shrink-0 p-1 rounded-lg text-current opacity-60 hover:opacity-100 hover:bg-white/10 transition-all duration-200"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}