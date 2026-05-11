export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDistance(value?: number | null) {
  if (!value || value <= 0) {
    return '--'
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)} km`
  }

  return `${Math.round(value)} m`
}

export function formatEta(value?: number | null) {
  if (!value || value <= 0) {
    return '--'
  }

  if (value >= 60) {
    const hours = Math.floor(value / 60)
    const minutes = value % 60
    return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`
  }

  return `${value} min`
}

export function formatTimeAgo(iso?: string | null) {
  if (!iso) {
    return 'Sem atualizacao'
  }

  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000))

  if (diffMinutes < 1) {
    return 'Agora mesmo'
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min atras`
  }

  const hours = Math.floor(diffMinutes / 60)
  const minutes = diffMinutes % 60
  return minutes > 0 ? `${hours}h ${minutes}min atras` : `${hours}h atras`
}

export function formatClock(iso?: string | null) {
  if (!iso) {
    return '--'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function toInitials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? '')
    .join('')
}
