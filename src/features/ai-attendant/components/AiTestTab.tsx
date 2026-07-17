import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Send,
  Smartphone,
  TestTube,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  useAiAttendantSettingsQuery,
  useTestChatMessageMutation,
  useTestWhatsappSendMutation,
  useWhatsappSessionQuery,
} from '@/hooks/queries/ai-attendant'
import { useCustomersQuery } from '@/hooks/queries/orders'
import { useToastStore } from '@/stores/toast-store'
import type {
  AiConversation,
  AiTestChannel,
  TestChatMessagePayload,
  TestChatMessageResult,
  TestReplyResult,
} from '@/contracts/ai-attendant'

import { aiTestChannelLabels, aiTestChannels, recommendedActionLabels } from './ai-attendant-labels'

type TestMode = 'simulator' | 'real_whatsapp'

interface SimulatedChatMessage {
  id: string
  role: 'customer' | 'ai'
  body: string
  result?: TestChatMessageResult
}

export function AiTestTab() {
  const [mode, setMode] = useState<TestMode>('simulator')

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 rounded-[20px] border border-white/10 bg-white/[0.04] p-2">
        <ModeButton
          active={mode === 'simulator'}
          icon={<Bot className="h-4 w-4" />}
          label="Simulador sem WhatsApp"
          onClick={() => setMode('simulator')}
        />
        <ModeButton
          active={mode === 'real_whatsapp'}
          icon={<Smartphone className="h-4 w-4" />}
          label="Teste WhatsApp real"
          onClick={() => setMode('real_whatsapp')}
        />
      </div>

      {mode === 'simulator' ? <SimulatorMode /> : <RealWhatsappMode />}
    </div>
  )
}

function SimulatorMode() {
  const [message, setMessage] = useState('')
  const [channel, setChannel] = useState<AiTestChannel>('whatsapp')
  const [customerId, setCustomerId] = useState('none')
  const [chat, setChat] = useState<SimulatedChatMessage[]>([])
  const [latestResult, setLatestResult] = useState<TestChatMessageResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const testChat = useTestChatMessageMutation()
  const { data: customersResponse } = useCustomersQuery({ filters: { pageSize: 50 } })
  const { pushToast } = useToastStore()
  const customers = customersResponse?.data ?? []

  const history: TestChatMessagePayload['history'] = useMemo(
    () =>
      chat.slice(-12).map((item) => ({
        role: item.role === 'customer' ? 'customer' : 'ai',
        content: item.body,
        direction: item.role === 'customer' ? 'inbound' : 'outbound',
      })),
    [chat],
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedMessage = message.trim()

    if (!trimmedMessage) {
      pushToast({ title: 'Digite uma mensagem para testar', variant: 'warning' })
      return
    }

    setErrorMessage(null)
    setLatestResult(null)
    const customerMessage: SimulatedChatMessage = {
      id: createLocalId(),
      role: 'customer',
      body: trimmedMessage,
    }
    setChat((current) => [...current, customerMessage])
    setMessage('')

    try {
      const response = await testChat.mutateAsync({
        message: trimmedMessage,
        channel,
        customerId: customerId === 'none' ? null : customerId,
        history,
      })
      setLatestResult(response)
      setChat((current) => [
        ...current,
        {
          id: createLocalId(),
          role: 'ai',
          body: response.reply,
          result: response,
        },
      ])
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Servico de resposta automatica nao configurado ou indisponivel.'))
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5 text-primary" />
            Chat simulado
          </CardTitle>
          <CardDescription>
            Testa a IA pela API real sem enviar mensagem ao WhatsApp e sem misturar com atendimento real.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Canal
                </label>
                <Select value={channel} onValueChange={(value) => setChannel(value as AiTestChannel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {aiTestChannels.map((item) => (
                      <SelectItem key={item} value={item}>
                        {aiTestChannelLabels[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Cliente opcional
                </label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem cliente</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} - {customer.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="ai-test-message" className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                Mensagem do cliente
              </label>
              <textarea
                id="ai-test-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={6}
                maxLength={2000}
                className="min-h-40 w-full resize-y rounded-xl border border-white/10 bg-[#071525] px-3 py-2 text-sm leading-6 text-slate-100 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
                placeholder="Ex: voces entregam no bairro Centro? Quero uma pizza grande sem cebola."
              />
            </div>

            <Alert>
              <AlertTitle>
                <Bot className="h-4 w-4" />
                Simulador sem envio real
              </AlertTitle>
              <AlertDescription>
                Este modo envia uma mensagem de teste. Se o servico nao estiver configurado, a tela mostra o erro.
              </AlertDescription>
            </Alert>

            <Button type="submit" disabled={testChat.isPending}>
              {testChat.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar para IA
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conversa de teste</CardTitle>
          <CardDescription>Historico local do simulador e detalhes do ultimo retorno.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="min-h-72 space-y-3 rounded-[22px] border border-white/10 bg-[#050d18]/70 p-4">
            {chat.length > 0 ? (
              chat.map((item) => (
                <div key={item.id} className={`flex ${item.role === 'ai' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[82%] rounded-[20px] border px-4 py-3 ${
                    item.role === 'ai'
                      ? 'border-primary/20 bg-primary/15 text-orange-50'
                      : 'border-white/10 bg-white/[0.05] text-slate-100'
                  }`}>
                    <Badge variant={item.role === 'ai' ? 'analysis' : 'default'}>
                      {item.role === 'ai' ? 'IA' : 'Cliente'}
                    </Badge>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.body}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
                <MessageCircle className="h-10 w-10 text-primary" />
                <div>
                  <p className="font-black text-white">Nenhuma mensagem simulada</p>
                  <p className="mt-1 max-w-md text-sm leading-6 text-slate-400">
                    Digite uma mensagem para validar comportamento, fontes e transferencia.
                  </p>
                </div>
              </div>
            )}
          </div>

          {testChat.isPending ? (
            <div className="flex items-center gap-2 rounded-[18px] border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Gerando resposta pela API...
            </div>
          ) : null}

          {errorMessage ? (
            <Alert variant="danger">
              <AlertTitle>
                <AlertCircle className="h-4 w-4" />
                Servico de resposta automatica indisponivel
              </AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {latestResult ? <TestResultPanel result={latestResult} responseMs={latestResult.responseMs} /> : null}
        </CardContent>
      </Card>
    </div>
  )
}

function RealWhatsappMode() {
  const { data: settings } = useAiAttendantSettingsQuery()
  const { data: session } = useWhatsappSessionQuery()
  const sendTestWhatsapp = useTestWhatsappSendMutation()
  const { pushToast } = useToastStore()
  const [phoneInput, setPhoneInput] = useState('')
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [message, setMessage] = useState('')
  const [simulateCustomerReply, setSimulateCustomerReply] = useState('')
  const [resultConversation, setResultConversation] = useState<AiConversation | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const whatsappConnected = session?.status === 'connected'
  const testSendEnabled = Boolean(settings?.allowTestWhatsappSend)
  const phone = phoneTouched
    ? phoneInput
    : phoneInput || settings?.defaultTestWhatsappNumber || ''

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setResultConversation(null)

    if (!whatsappConnected) {
      setErrorMessage('WhatsApp nao conectado. Conecte a sessao antes de enviar teste real.')
      return
    }

    if (!testSendEnabled) {
      setErrorMessage('Envio para numero de teste esta desativado nas configuracoes.')
      return
    }

    if (!phone.trim() || !message.trim()) {
      pushToast({ title: 'Informe numero e mensagem de teste', variant: 'warning' })
      return
    }

    if (/[,;\n\r]/.test(phone)) {
      pushToast({ title: 'Use apenas um numero por teste', variant: 'warning' })
      return
    }

    try {
      const response = await sendTestWhatsapp.mutateAsync({
        phone: phone.trim(),
        message: message.trim(),
        simulateCustomerReply: simulateCustomerReply.trim() || undefined,
      })
      setResultConversation(response)
      setMessage('')
      setSimulateCustomerReply('')
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Nao foi possivel enviar o teste real.'))
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Teste com WhatsApp real
          </CardTitle>
          <CardDescription>
            Envia uma mensagem real para um unico numero de teste autorizado e cria conversa do tipo test.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Alert variant="warning">
              <AlertTitle>Envio real</AlertTitle>
              <AlertDescription>
                Isso enviara uma mensagem real pelo WhatsApp conectado. Use apenas numero de teste da loja.
              </AlertDescription>
            </Alert>

            {!whatsappConnected ? (
              <Alert variant="danger">
                <AlertTitle>WhatsApp nao conectado</AlertTitle>
                <AlertDescription>
                  Conecte a sessao por QR Code antes de usar o teste real.
                </AlertDescription>
              </Alert>
            ) : null}

            {!testSendEnabled ? (
              <Alert variant="danger">
                <AlertTitle>Teste real desativado</AlertTitle>
                <AlertDescription>
                  Ative “Permitir envio para numero de teste” em Configuracoes.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <label htmlFor="test-whatsapp-phone" className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                Numero de teste
              </label>
              <Input
                id="test-whatsapp-phone"
                value={phone}
                onChange={(event) => {
                  setPhoneTouched(true)
                  setPhoneInput(event.target.value)
                }}
                placeholder="5592999999999"
                maxLength={24}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="test-whatsapp-message" className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                Mensagem enviada pela loja
              </label>
              <textarea
                id="test-whatsapp-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={5}
                maxLength={2000}
                className="min-h-32 w-full resize-y rounded-xl border border-white/10 bg-[#071525] px-3 py-2 text-sm leading-6 text-slate-100 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
                placeholder="Mensagem operacional para validar envio real."
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="simulate-customer-reply" className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                Simular resposta do cliente
              </label>
              <textarea
                id="simulate-customer-reply"
                value={simulateCustomerReply}
                onChange={(event) => setSimulateCustomerReply(event.target.value)}
                rows={3}
                maxLength={2000}
                className="min-h-24 w-full resize-y rounded-xl border border-white/10 bg-[#071525] px-3 py-2 text-sm leading-6 text-slate-100 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
                placeholder="Opcional. Use quando o webhook ainda nao estiver recebendo."
              />
            </div>

            <Button
              type="submit"
              disabled={!whatsappConnected || !testSendEnabled || sendTestWhatsapp.isPending}
            >
              {sendTestWhatsapp.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar teste real
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resultado do teste real</CardTitle>
          <CardDescription>Conversa criada/atualizada pela API, marcada como teste.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage ? (
            <Alert variant="danger">
              <AlertTitle>
                <AlertCircle className="h-4 w-4" />
                Teste real bloqueado
              </AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {resultConversation ? (
            <Alert variant="success">
              <AlertTitle>
                <CheckCircle2 className="h-4 w-4" />
                Mensagem real enviada
              </AlertTitle>
              <AlertDescription>
                Conversa {resultConversation.id} salva como teste. A IA fica pausada por seguranca.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-white/10 bg-white/[0.03] text-center">
              <Smartphone className="h-10 w-10 text-primary" />
              <div>
                <p className="font-black text-white">Nenhum envio real executado</p>
                <p className="mt-1 max-w-md text-sm leading-6 text-slate-400">
                  Informe um unico numero de teste e envie somente quando a sessao estiver conectada.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TestResultPanel({
  result,
  responseMs,
}: {
  result: TestReplyResult
  responseMs?: number
}) {
  return (
    <div className="space-y-4">
      <Alert variant="success">
        <AlertTitle>
          <CheckCircle2 className="h-4 w-4" />
          Resposta gerada pela API
        </AlertTitle>
        <AlertDescription>
          Confianca de {Math.round(result.confidence * 100)}%
          {responseMs ? ` em ${responseMs}ms` : ''}. Acao: {recommendedActionLabels[result.recommendedAction]}.
        </AlertDescription>
      </Alert>

      <div className="rounded-[22px] border border-white/10 bg-[#050d18]/70 p-5">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
          Resposta sugerida
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-100">{result.reply}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ResultMetric label="Intent" value={result.intent} />
        <ResultMetric label="Confianca" value={`${Math.round(result.confidence * 100)}%`} />
        <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            Transferencia
          </p>
          <Badge className="mt-3" variant={result.shouldTransferToHuman ? 'warning' : 'success'}>
            {result.shouldTransferToHuman ? 'Chamaria humano' : 'Nao chamaria humano'}
          </Badge>
          {result.transferReason ? (
            <p className="mt-3 text-sm leading-6 text-slate-400">{result.transferReason}</p>
          ) : null}
        </div>
        <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            Fontes usadas
          </p>
          {result.sourcesUsed.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {result.sourcesUsed.map((source) => (
                <Badge key={source}>{source}</Badge>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">Nenhuma fonte foi retornada pelo servico.</p>
          )}
        </div>
      </div>

      {result.orderDraft ? (
        <div className="rounded-[22px] border border-amber-400/20 bg-amber-400/[0.06] p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-200/80">
            Order draft
          </p>
          {result.orderDraft.parsedItems.length > 0 ? (
            <div className="mt-3 space-y-2">
              {result.orderDraft.parsedItems.map((item, index) => (
                <div key={`${item.productName}-${index}`} className="rounded-xl border border-white/10 bg-[#050d18]/70 px-3 py-2">
                  <p className="text-sm font-bold text-white">
                    {item.quantity}x {item.productName}
                  </p>
                  {item.notes ? <p className="mt-1 text-xs text-slate-400">{item.notes}</p> : null}
                </div>
              ))}
            </div>
          ) : (
          <p className="mt-3 text-sm text-slate-400">O servico retornou um rascunho sem itens reconhecidos.</p>
          )}
          {result.orderDraft.missingFields.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {result.orderDraft.missingFields.map((field) => (
                <Badge key={field} variant="warning">{field}</Badge>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-sm font-black text-white">{value}</p>
    </div>
  )
}

function ModeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-black text-slate-300 transition hover:border-white/20 hover:text-white data-[active=true]:border-primary/50 data-[active=true]:bg-primary/15 data-[active=true]:text-primary"
      data-active={active}
    >
      {icon}
      {label}
    </button>
  )
}

function createLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
