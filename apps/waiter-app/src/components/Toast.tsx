import { CheckCircle2, XCircle } from 'lucide-react'

export interface ToastMessage {
  tone: 'success' | 'error'
  text: string
}

export function Toast({ message }: { message: ToastMessage | null }) {
  if (!message) return null
  return (
    <div className={`toast ${message.tone}`} role={message.tone === 'error' ? 'alert' : 'status'}>
      {message.tone === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
      {message.text}
    </div>
  )
}
