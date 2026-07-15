import { useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  History,
  Loader2,
  MessageCircle,
  Power,
  QrCode,
  RefreshCcw,
  Smartphone,
  XCircle,
} from 'lucide-react'

import { EmptyState } from '@/components/shared/EmptyState'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useDisconnectWhatsappSessionMutation,
  useRestartWhatsappSessionMutation,
  useStartWhatsappSessionMutation,
  useWhatsappLogsQuery,
  useWhatsappQrCodeQuery,
  useWhatsappSessionQuery,
} from '@/hooks/queries/ai-attendant'

import {
  formatDateTime,
  integrationLogStatusLabels,
  integrationLogTypeLabels,
  whatsappStatusLabels,
} from './ai-attendant-labels'

interface AiWhatsappTabProps {
  onOpenConversations?: () => void
}

export function AiWhatsappTab({ onOpenConversations }: AiWhatsappTabProps) {
  const { data: session, isLoading } = useWhatsappSessionQuery()
  const startSessionMutation = useStartWhatsappSessionMutation()
  const disconnectMutation = useDisconnectWhatsappSessionMutation()
  const restartMutation = useRestartWhatsappSessionMutation()
  const [showQr, setShowQr] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const providerUnconfigured = session?.provider === 'unconfigured'
  const hasSessionQr = Boolean(session?.qrCode)
  const qrVisible =
    session?.status === 'waiting_qr' ||
    Boolean(session && session.status !== 'connected' && (showQr || hasSessionQr))
  const shouldFetchQr = !providerUnconfigured && qrVisible
  const { data: qrData, isLoading: qrLoading } = useWhatsappQrCodeQuery(shouldFetchQr)
  const qrCode = qrData?.qrCode ?? session?.qrCode ?? null
  const qrExpiresAt = qrData?.expiresAt ?? session?.qrCodeExpiresAt ?? null
  const qrMessage = qrData?.message ?? session?.lastError ?? null
  const qrSecondsLeft = useQrCountdown(qrExpiresAt)

  const handleStartSession = async () => {
    setActionError(null)
    try {
      await startSessionMutation.mutateAsync()
      setShowQr(true)
    } catch (error) {
      setActionError(getErrorMessage(error, 'Nao foi possivel iniciar a sessao do WhatsApp.'))
    }
  }

  const handleDisconnect = async () => {
    setActionError(null)
    try {
      await disconnectMutation.mutateAsync()
      setShowQr(false)
    } catch (error) {
      setActionError(getErrorMessage(error, 'Nao foi possivel desconectar o WhatsApp.'))
    }
  }

  const handleRestart = async () => {
    setActionError(null)
    try {
      await restartMutation.mutateAsync()
      setShowQr(true)
    } catch (error) {
      setActionError(getErrorMessage(error, 'Nao foi possivel reiniciar a sessao.'))
    }
  }

  if (isLoading) {
    return <Skeleton className="h-96" />
  }

  if (session?.provider === 'whatsapp_cloud') {
    const active = session.status === 'connected'
    return (
      <div className="space-y-4">
        <Alert variant={active ? 'success' : 'warning'}>
          <AlertTitle>
            {active ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Meta WhatsApp Cloud API
          </AlertTitle>
          <AlertDescription>
            {active
              ? 'Conta oficial vinculada e eventos assinados da Meta ja foram recebidos.'
              : 'Configuracao carregada. A integracao sera ativada quando o primeiro webhook assinado da Meta for validado.'}
          </AlertDescription>
        </Alert>
        <Card>
          <CardHeader>
            <CardTitle>Integracao oficial sem QR Code</CardTitle>
            <CardDescription>
              Token, App Secret e identificadores ficam somente no ambiente da API. Vinculo e webhook sao administrados no Meta Business.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Badge variant={active ? 'success' : 'warning'}>
              {active ? 'Webhook ativo' : 'Aguardando webhook'}
            </Badge>
            <Badge variant="default">Cloud API oficial</Badge>
            <Button onClick={onOpenConversations} disabled={!active}>
              <MessageCircle className="h-4 w-4" />
              Abrir conversas
            </Button>
          </CardContent>
        </Card>
        <IntegrationLogsPanel />
      </div>
    )
  }

  if (providerUnconfigured) {
    return (
      <div className="space-y-4">
        <Alert variant="danger">
          <AlertTitle>
            <AlertCircle className="h-4 w-4" />
            Provider de WhatsApp nao configurado
          </AlertTitle>
          <AlertDescription>
            O backend registrou esta sessao como unconfigured. Configure WHATSAPP_PROVIDER,
            WHATSAPP_PROVIDER_BASE_URL e WHATSAPP_PROVIDER_API_KEY para receber um QR Code real.
          </AlertDescription>
        </Alert>
        <SessionSummary />
        <IntegrationLogsPanel />
        <Card>
          <CardContent className="flex flex-wrap gap-2 p-5">
            <Button onClick={handleStartSession} disabled={startSessionMutation.isPending}>
              {startSessionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Tentar conectar novamente
            </Button>
            {actionError ? (
              <p className="basis-full text-sm leading-6 text-red-200">{actionError}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!session || session.status === 'disconnected') {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={<Smartphone className="h-7 w-7" />}
          title="Nenhum WhatsApp conectado"
          description="A conexao depende do provider real configurado no backend. O QR Code so aparece quando a API retornar um codigo valido."
        />
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={handleStartSession} disabled={startSessionMutation.isPending}>
            {startSessionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
            Conectar WhatsApp
          </Button>
        </div>
        {actionError ? (
          <Alert variant="danger">
            <AlertTitle>
              <AlertCircle className="h-4 w-4" />
              Nao foi possivel iniciar a sessao
            </AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}
        <IntegrationLogsPanel />
      </div>
    )
  }

  if (qrVisible && (session.status === 'waiting_qr' || session.status === 'connecting')) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Escaneie o QR Code
          </CardTitle>
          <CardDescription>
            Use o WhatsApp do celular da loja para conectar esta sessao.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {qrLoading ? (
            <div className="flex min-h-72 items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.03]">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : qrCode ? (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-[22px] border border-white/10 bg-white p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                <img
                  src={qrCode}
                  alt="QR Code real retornado pelo provider de WhatsApp"
                  className="h-64 w-64 rounded-xl"
                />
              </div>
              <p className="text-center text-sm leading-6 text-slate-400">
                {qrExpiresAt && qrSecondsLeft !== null
                  ? `Expira em ${qrSecondsLeft}s (${formatDateTime(qrExpiresAt)}).`
                  : 'A API nao informou tempo de expiracao para este QR.'}
              </p>
            </div>
          ) : (
            <Alert variant="danger">
              <AlertTitle>
                <AlertCircle className="h-4 w-4" />
                QR Code indisponivel
              </AlertTitle>
              <AlertDescription>
                {qrMessage ?? 'A API nao retornou QR Code. Gere um novo codigo ou verifique o provider.'}
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
            <p className="font-black text-white">Como conectar</p>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-slate-400">
              <li>Abra o WhatsApp no celular da loja.</li>
              <li>Entre em Aparelhos conectados.</li>
              <li>Escaneie o codigo retornado pelo provider.</li>
            </ol>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleStartSession} disabled={startSessionMutation.isPending}>
              {startSessionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Gerar novo QR Code
            </Button>
            <Button variant="ghost" onClick={() => setShowQr(false)}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (session.status === 'connecting') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-14 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div>
            <p className="text-lg font-black text-white">Conectando WhatsApp</p>
            <p className="mt-1 text-sm text-slate-400">
              Aguardando retorno do provider configurado no backend.
            </p>
          </div>
          <Button variant="outline" onClick={handleRestart} disabled={restartMutation.isPending}>
            <RefreshCcw className="h-4 w-4" />
            Reiniciar sessao
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (session.status === 'connected') {
    return (
      <div className="space-y-4">
        <Alert variant="success">
          <AlertTitle>
            <CheckCircle2 className="h-4 w-4" />
            WhatsApp conectado
          </AlertTitle>
          <AlertDescription>
            O envio e recebimento de mensagens pode operar enquanto a sessao permanecer conectada.
          </AlertDescription>
        </Alert>
        <SessionSummary />
        <Card>
          <CardContent className="flex flex-wrap gap-2 p-5">
            <Button onClick={onOpenConversations}>
              <MessageCircle className="h-4 w-4" />
              Abrir conversas
            </Button>
            <Button variant="outline" onClick={handleRestart} disabled={restartMutation.isPending}>
              {restartMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Reiniciar sessao
            </Button>
            <Button variant="danger" onClick={handleDisconnect} disabled={disconnectMutation.isPending}>
              {disconnectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
              Desconectar
            </Button>
          </CardContent>
        </Card>
        <IntegrationLogsPanel />
      </div>
    )
  }

  if (session.status === 'error' || session.status === 'expired') {
    return (
      <div className="space-y-4">
        <Alert variant="danger">
          <AlertTitle>
            <XCircle className="h-4 w-4" />
            {session.status === 'expired' ? 'Sessao expirada' : 'Erro na conexao'}
          </AlertTitle>
          <AlertDescription>
            {session.lastError ?? 'O provider informou falha, mas nao enviou detalhes.'}
          </AlertDescription>
        </Alert>
        <SessionSummary />
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleStartSession} disabled={startSessionMutation.isPending}>
            {startSessionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
            Tentar novamente
          </Button>
          <Button variant="outline" onClick={handleRestart} disabled={restartMutation.isPending}>
            <RefreshCcw className="h-4 w-4" />
            Reiniciar sessao
          </Button>
        </div>
        <IntegrationLogsPanel />
      </div>
    )
  }

  return (
    <Alert>
      <AlertTitle>
        <Smartphone className="h-4 w-4" />
        Estado do WhatsApp
      </AlertTitle>
      <AlertDescription>
        Status atual: {whatsappStatusLabels[session.status]}. Aguarde uma atualizacao ou reinicie a sessao.
      </AlertDescription>
    </Alert>
  )
}

function IntegrationLogsPanel() {
  const { data: logs = [], isLoading } = useWhatsappLogsQuery()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Logs de integracao
        </CardTitle>
        <CardDescription>
          Eventos recentes de webhook, envio, erro, delay e sessao sem tokens ou secrets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-28" />
        ) : logs.length > 0 ? (
          logs.slice(0, 10).map((log) => (
            <div
              key={log.id}
              className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-white">
                    {integrationLogTypeLabels[log.type]}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{log.message}</p>
                </div>
                <Badge
                  variant={
                    log.status === 'success'
                      ? 'success'
                      : log.status === 'error'
                        ? 'danger'
                        : log.status === 'warning'
                          ? 'warning'
                          : 'default'
                  }
                >
                  {integrationLogStatusLabels[log.status]}
                </Badge>
              </div>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {formatDateTime(log.createdAt)}
              </p>
            </div>
          ))
        ) : (
          <p className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-400">
            Nenhum log registrado ainda. Eventos reais aparecem quando a sessao, webhook,
            envio manual, teste ou pipeline de IA executarem.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function useQrCountdown(expiresAt: string | null) {
  const now = useNow(Boolean(expiresAt))

  if (!expiresAt) return null

  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000))
}

function useNow(enabled: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const intervalId = window.setInterval(update, 1000)
    return () => window.clearInterval(intervalId)

    function update() {
      setNow(Date.now())
    }
  }, [enabled])

  return now
}

function SessionSummary() {
  const { data: session } = useWhatsappSessionQuery()

  if (!session) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Sessao WhatsApp</CardTitle>
            <CardDescription>Dados reais persistidos para a loja atual.</CardDescription>
          </div>
          <Badge
            variant={
              session.status === 'connected'
                ? 'success'
                : session.status === 'error' || session.status === 'expired'
                  ? 'danger'
                  : 'warning'
            }
          >
            {whatsappStatusLabels[session.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryItem label="Numero" value={session.phoneNumber ?? 'Nao informado'} />
        <SummaryItem label="Perfil" value={session.displayName ?? 'Nao informado'} />
        <SummaryItem label="Provider" value={session.provider} />
        <SummaryItem label="Ultima conexao" value={formatDateTime(session.lastConnectedAt)} />
      </CardContent>
    </Card>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
