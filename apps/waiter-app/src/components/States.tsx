import { AlertTriangle, Inbox, RefreshCw, WifiOff } from 'lucide-react'

export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="state-view" role="status">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="skeleton-page" aria-label="Carregando conteúdo" aria-busy="true">
      <div className="skeleton skeleton-title" />
      <div className="skeleton-grid">
        {Array.from({ length: 6 }, (_, index) => <div className="skeleton skeleton-card" key={index} />)}
      </div>
    </div>
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="state-view">
      <Inbox size={32} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-view state-error" role="alert">
      <AlertTriangle size={32} aria-hidden="true" />
      <h2>Algo não saiu como esperado</h2>
      <p>{message}</p>
      {onRetry && <button className="button secondary" type="button" onClick={onRetry}><RefreshCw size={18} /> Tentar novamente</button>}
    </div>
  )
}

export function OfflineActionNotice() {
  return (
    <div className="inline-notice warning" role="alert">
      <WifiOff size={19} aria-hidden="true" />
      Conecte-se à internet para concluir esta ação.
    </div>
  )
}
