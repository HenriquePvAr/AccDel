import { Cloud, CloudOff } from 'lucide-react'

import { useOnlineStatus } from '@/lib/online'

export function ConnectionStatus() {
  const online = useOnlineStatus()
  return (
    <span className={`connection-status ${online ? 'online' : 'offline'}`} role="status">
      {online ? <Cloud size={15} /> : <CloudOff size={15} />}
      {online ? 'Conectado' : 'Offline'}
    </span>
  )
}
