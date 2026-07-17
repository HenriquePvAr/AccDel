import { useState, type FormEvent } from 'react'
import { Bot, Save, Settings, ShieldCheck, ShoppingBasket, SlidersHorizontal } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  useAiAttendantSettingsQuery,
  useUpdateAiAttendantSettingsMutation,
} from '@/hooks/queries/ai-attendant'
import { useToastStore } from '@/stores/toast-store'
import type {
  AiAttendantMode,
  AiResponseLength,
  AiAttendantSettings,
  AiAttendantTone,
  UpdateAiAttendantSettingsPayload,
} from '@/contracts/ai-attendant'

import {
  aiModeLabels,
  aiModes,
  aiResponseLengthLabels,
  aiResponseLengths,
  aiToneLabels,
  aiTones,
} from './ai-attendant-labels'

interface SettingsFormState {
  isEnabled: boolean
  mode: AiAttendantMode
  assistantName: string
  mainPrompt: string
  minDelaySeconds: number
  maxDelaySeconds: number
  messageGroupingSeconds: number
  answerOnlyDuringBusinessHours: boolean
  transferOnLowConfidence: boolean
  transferOnComplaint: boolean
  transferOnCancellation: boolean
  transferOnHumanRequest: boolean
  tone: AiAttendantTone
  useEmojis: boolean
  callCustomerByName: boolean
  responseLength: AiResponseLength
  neverInventPrice: boolean
  neverInventProduct: boolean
  neverInventPromotion: boolean
  neverPromiseDeliveryTime: boolean
  allowTestWhatsappSend: boolean
  defaultTestWhatsappNumber: string
  upsellEnabled: boolean
  upsellMaxSuggestions: number
  greetingMessage: string
  outOfHoursMessage: string
  humanHandoffMessage: string
}

export function AiSettingsTab() {
  const { data: settings, isLoading } = useAiAttendantSettingsQuery()

  if (isLoading) {
    return <Skeleton className="h-[680px]" />
  }

  if (!settings) {
    return (
      <Alert variant="danger">
        <AlertTitle>Nao foi possivel carregar as configuracoes</AlertTitle>
        <AlertDescription>
          As configuracoes do atendimento automatico ainda nao estao disponiveis para esta loja.
        </AlertDescription>
      </Alert>
    )
  }

  return <SettingsForm key={`${settings.id}-${settings.updatedAt}`} settings={settings} />
}

function SettingsForm({ settings }: { settings: AiAttendantSettings }) {
  const updateSettings = useUpdateAiAttendantSettingsMutation()
  const { pushToast } = useToastStore()
  const [form, setForm] = useState<SettingsFormState>(() => mapSettingsToForm(settings))

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (form.minDelaySeconds > form.maxDelaySeconds) {
      pushToast({
        title: 'Delay minimo maior que o maximo',
        description: 'Ajuste os tempos antes de salvar.',
        variant: 'warning',
      })
      return
    }

    if (form.assistantName.trim().length < 2 || form.mainPrompt.trim().length < 20) {
      pushToast({
        title: 'Revise as respostas automáticas',
        description: 'Nome do atendente e prompt principal precisam estar preenchidos.',
        variant: 'warning',
      })
      return
    }

    const payload: UpdateAiAttendantSettingsPayload = {
      isEnabled: form.isEnabled,
      mode: form.isEnabled ? form.mode : 'off',
      assistantName: form.assistantName.trim(),
      mainPrompt: form.mainPrompt.trim(),
      minDelaySeconds: form.minDelaySeconds,
      maxDelaySeconds: form.maxDelaySeconds,
      messageGroupingSeconds: form.messageGroupingSeconds,
      answerOnlyDuringBusinessHours: form.answerOnlyDuringBusinessHours,
      transferOnLowConfidence: form.transferOnLowConfidence,
      transferOnComplaint: form.transferOnComplaint,
      transferOnCancellation: form.transferOnCancellation,
      transferOnHumanRequest: form.transferOnHumanRequest,
      tone: form.tone,
      useEmojis: form.useEmojis,
      callCustomerByName: form.callCustomerByName,
      responseLength: form.responseLength,
      neverInventPrice: form.neverInventPrice,
      neverInventProduct: form.neverInventProduct,
      neverInventPromotion: form.neverInventPromotion,
      neverPromiseDeliveryTime: form.neverPromiseDeliveryTime,
      allowTestWhatsappSend: form.allowTestWhatsappSend,
      defaultTestWhatsappNumber: normalizeNullableText(form.defaultTestWhatsappNumber),
      upsellEnabled: form.upsellEnabled,
      upsellMaxSuggestions: form.upsellMaxSuggestions,
      greetingMessage: normalizeNullableText(form.greetingMessage),
      outOfHoursMessage: normalizeNullableText(form.outOfHoursMessage),
      humanHandoffMessage: normalizeNullableText(form.humanHandoffMessage),
    }

    await updateSettings.mutateAsync(payload)
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Respostas automáticas
          </CardTitle>
          <CardDescription>
            Escolha quando responder, sugerir ou transferir conversas para a equipe.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <ToggleRow
            label="Resposta automática ativa"
            description="Quando desligado, o modo salvo sera enviado como off."
            checked={form.isEnabled}
            onCheckedChange={(checked) =>
              setForm((current) => ({
                ...current,
                isEnabled: checked,
                mode: checked && current.mode === 'off' ? 'hybrid' : current.mode,
              }))
            }
          />

          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              Modo
            </label>
            <Select
              value={form.mode}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  mode: value as AiAttendantMode,
                  isEnabled: value !== 'off' ? true : current.isEnabled,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {aiModes.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {aiModeLabels[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ToggleRow
            label="Responder apenas no horario comercial"
            description="Fora do horario, usa a mensagem padrao de loja fechada."
            checked={form.answerOnlyDuringBusinessHours}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, answerOnlyDuringBusinessHours: checked }))
            }
          />

        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Como responder
          </CardTitle>
          <CardDescription>
            Defina como o atendimento automatico deve falar e agir nas conversas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px]">
            <div className="space-y-2">
              <label htmlFor="ai-assistant-name" className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                Nome do atendente
              </label>
              <Input
                id="ai-assistant-name"
                value={form.assistantName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, assistantName: event.target.value }))
                }
                maxLength={80}
                placeholder="Atendente Cain"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                Tom de voz
              </label>
              <Select
                value={form.tone}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, tone: value as AiAttendantTone }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {aiTones.map((tone) => (
                    <SelectItem key={tone} value={tone}>
                      {aiToneLabels[tone]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                Tamanho
              </label>
              <Select
                value={form.responseLength}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, responseLength: value as AiResponseLength }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {aiResponseLengths.map((length) => (
                    <SelectItem key={length} value={length}>
                      {aiResponseLengthLabels[length]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <TextAreaField
            label="Orientacoes principais"
            value={form.mainPrompt}
            onChange={(value) => setForm((current) => ({ ...current, mainPrompt: value }))}
            placeholder="Voce e um atendente virtual de delivery..."
            rows={9}
            maxLength={4000}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <ToggleRow
              label="Usar emojis"
              description="Permite emojis quando o tom escolhido combinar com a conversa."
              checked={form.useEmojis}
              onCheckedChange={(checked) => setForm((current) => ({ ...current, useEmojis: checked }))}
            />
            <ToggleRow
              label="Chamar cliente pelo nome"
              description="Usa o nome quando o cliente estiver identificado."
              checked={form.callCustomerByName}
              onCheckedChange={(checked) =>
                setForm((current) => ({ ...current, callCustomerByName: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            Ritmo de resposta
          </CardTitle>
          <CardDescription>
            Defina a espera e o agrupamento antes de enviar respostas automaticas.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <NumberField
            label="Espera minima"
            value={form.minDelaySeconds}
            min={1}
            max={120}
            suffix="seg"
            onChange={(value) => setForm((current) => ({ ...current, minDelaySeconds: value }))}
          />
          <NumberField
            label="Espera maxima"
            value={form.maxDelaySeconds}
            min={1}
            max={300}
            suffix="seg"
            onChange={(value) => setForm((current) => ({ ...current, maxDelaySeconds: value }))}
          />
          <NumberField
            label="Agrupar mensagens"
            value={form.messageGroupingSeconds}
            min={1}
            max={60}
            suffix="seg"
            onChange={(value) =>
              setForm((current) => ({ ...current, messageGroupingSeconds: value }))
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBasket className="h-5 w-5 text-primary" />
            Venda assistida
          </CardTitle>
          <CardDescription>
            Regras comerciais para sugerir combos e adicionais disponiveis no cardapio.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <ToggleRow
            label="Sugestoes de venda"
            description="Permite sugerir combos, cupons e adicionais somente quando existirem dados reais no catálogo."
            checked={form.upsellEnabled}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, upsellEnabled: checked }))
            }
          />
          <NumberField
            label="Max. sugestoes"
            value={form.upsellMaxSuggestions}
            min={0}
            max={6}
            suffix="itens"
            onChange={(value) =>
              setForm((current) => ({ ...current, upsellMaxSuggestions: value }))
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Regras de seguranca
          </CardTitle>
          <CardDescription>
            Limites usados nas respostas e na transferencia para um atendente.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <ToggleRow
            label="Nunca inventar preco"
            description="Se nao houver preco oficial, a IA deve dizer que nao encontrou."
            checked={form.neverInventPrice}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, neverInventPrice: checked }))
            }
          />
          <ToggleRow
            label="Nunca inventar produto"
            description="Produtos fora do cardapio real devem ser tratados como nao encontrados."
            checked={form.neverInventProduct}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, neverInventProduct: checked }))
            }
          />
          <ToggleRow
            label="Nunca inventar promocao"
            description="A IA so pode citar promocoes e cupons ativos no banco."
            checked={form.neverInventPromotion}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, neverInventPromotion: checked }))
            }
          />
          <ToggleRow
            label="Nunca prometer prazo sem regra"
            description="Sem regra de entrega cadastrada, pergunta bairro/endereco em vez de prometer."
            checked={form.neverPromiseDeliveryTime}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, neverPromiseDeliveryTime: checked }))
            }
          />
          <ToggleRow
            label="Transferir baixa confianca"
            description="Se a IA nao estiver confiante, a conversa aguarda humano."
            checked={form.transferOnLowConfidence}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, transferOnLowConfidence: checked }))
            }
          />
          <ToggleRow
            label="Transferir reclamacoes"
            description="Reclamacoes detectadas sao direcionadas para atendimento humano."
            checked={form.transferOnComplaint}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, transferOnComplaint: checked }))
            }
          />
          <ToggleRow
            label="Transferir cancelamentos"
            description="Pedidos de cancelamento aguardam a equipe."
            checked={form.transferOnCancellation}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, transferOnCancellation: checked }))
            }
          />
          <ToggleRow
            label="Transferir pedido de atendente"
            description="Quando o cliente pedir uma pessoa, a conversa aguarda a equipe."
            checked={form.transferOnHumanRequest}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, transferOnHumanRequest: checked }))
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Testes e modo seguro</CardTitle>
          <CardDescription>
            Controla envio real para numero de teste. Isso nao habilita disparo em massa.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <ToggleRow
            label="Permitir envio para numero de teste"
            description="Quando desligado, nenhuma mensagem de teste e enviada ao WhatsApp."
            checked={form.allowTestWhatsappSend}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, allowTestWhatsappSend: checked }))
            }
          />

          <div className="space-y-2">
            <label htmlFor="default-test-whatsapp-number" className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              Numero de teste padrao
            </label>
            <Input
              id="default-test-whatsapp-number"
              value={form.defaultTestWhatsappNumber}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  defaultTestWhatsappNumber: event.target.value,
                }))
              }
              placeholder="5592999999999"
              maxLength={32}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mensagens padrao</CardTitle>
          <CardDescription>
            Textos usados em saudacao, loja fora do horario e passagem para humano.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <TextAreaField
            label="Saudacao"
            value={form.greetingMessage}
            onChange={(value) => setForm((current) => ({ ...current, greetingMessage: value }))}
            placeholder="Ola! Como posso te ajudar hoje?"
          />
          <TextAreaField
            label="Fora do horario"
            value={form.outOfHoursMessage}
            onChange={(value) => setForm((current) => ({ ...current, outOfHoursMessage: value }))}
            placeholder="No momento estamos fechados."
          />
          <TextAreaField
            label="Transferencia humana"
            value={form.humanHandoffMessage}
            onChange={(value) => setForm((current) => ({ ...current, humanHandoffMessage: value }))}
            placeholder="Estou transferindo voce para um atendente."
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={updateSettings.isPending}>
          <Save className="h-4 w-4" />
          Salvar configuracoes
        </Button>
      </div>
    </form>
  )
}

function mapSettingsToForm(settings: AiAttendantSettings): SettingsFormState {
  return {
    isEnabled: settings.isEnabled,
    mode: settings.mode,
    assistantName: settings.assistantName,
    mainPrompt: settings.mainPrompt,
    minDelaySeconds: settings.minDelaySeconds,
    maxDelaySeconds: settings.maxDelaySeconds,
    messageGroupingSeconds: settings.messageGroupingSeconds,
    answerOnlyDuringBusinessHours: settings.answerOnlyDuringBusinessHours,
    transferOnLowConfidence: settings.transferOnLowConfidence,
    transferOnComplaint: settings.transferOnComplaint,
    transferOnCancellation: settings.transferOnCancellation,
    transferOnHumanRequest: settings.transferOnHumanRequest,
    tone: settings.tone,
    useEmojis: settings.useEmojis,
    callCustomerByName: settings.callCustomerByName,
    responseLength: settings.responseLength,
    neverInventPrice: settings.neverInventPrice,
    neverInventProduct: settings.neverInventProduct,
    neverInventPromotion: settings.neverInventPromotion,
    neverPromiseDeliveryTime: settings.neverPromiseDeliveryTime,
    allowTestWhatsappSend: settings.allowTestWhatsappSend,
    defaultTestWhatsappNumber: settings.defaultTestWhatsappNumber ?? '',
    upsellEnabled: settings.upsellEnabled,
    upsellMaxSuggestions: settings.upsellMaxSuggestions,
    greetingMessage: settings.greetingMessage ?? '',
    outOfHoursMessage: settings.outOfHoursMessage ?? '',
    humanHandoffMessage: settings.humanHandoffMessage ?? '',
  }
}

function normalizeNullableText(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

interface ToggleRowProps {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

function ToggleRow({ label, description, checked, onCheckedChange }: ToggleRowProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
      <span>
        <span className="block text-sm font-semibold text-white">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-400">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  )
}

interface NumberFieldProps {
  label: string
  value: number
  min: number
  max: number
  suffix: string
  onChange: (value: number) => void
}

function NumberField({ label, value, min, max, suffix, onChange }: NumberFieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="text-sm font-semibold text-slate-400">{suffix}</span>
      </div>
    </div>
  )
}

interface TextAreaFieldProps {
  label: string
  value: string
  placeholder: string
  rows?: number
  maxLength?: number
  onChange: (value: string) => void
}

function TextAreaField({
  label,
  value,
  placeholder,
  rows = 5,
  maxLength = 500,
  onChange,
}: TextAreaFieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        maxLength={maxLength}
        className="min-h-32 w-full resize-y rounded-xl border border-white/10 bg-[#071525] px-3 py-2 text-sm leading-6 text-slate-100 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
        placeholder={placeholder}
      />
    </div>
  )
}
