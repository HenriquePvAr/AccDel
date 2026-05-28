import { useState, type FormEvent } from 'react'
import { Save, Settings, SlidersHorizontal } from 'lucide-react'

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
  AiAttendantSettings,
  AiAttendantTone,
  UpdateAiAttendantSettingsPayload,
} from '@/contracts/ai-attendant'

import { aiModeLabels, aiModes, aiToneLabels, aiTones } from './ai-attendant-labels'

interface SettingsFormState {
  isEnabled: boolean
  mode: AiAttendantMode
  minDelaySeconds: number
  maxDelaySeconds: number
  messageGroupingSeconds: number
  answerOnlyDuringBusinessHours: boolean
  transferOnLowConfidence: boolean
  transferOnComplaint: boolean
  transferOnCancellation: boolean
  tone: AiAttendantTone
  useEmojis: boolean
  callCustomerByName: boolean
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
          A API nao retornou as configuracoes do Atendente IA para a loja atual.
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

    const payload: UpdateAiAttendantSettingsPayload = {
      isEnabled: form.isEnabled,
      mode: form.isEnabled ? form.mode : 'off',
      minDelaySeconds: form.minDelaySeconds,
      maxDelaySeconds: form.maxDelaySeconds,
      messageGroupingSeconds: form.messageGroupingSeconds,
      answerOnlyDuringBusinessHours: form.answerOnlyDuringBusinessHours,
      transferOnLowConfidence: form.transferOnLowConfidence,
      transferOnComplaint: form.transferOnComplaint,
      transferOnCancellation: form.transferOnCancellation,
      tone: form.tone,
      useEmojis: form.useEmojis,
      callCustomerByName: form.callCustomerByName,
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
            Operacao da IA
          </CardTitle>
          <CardDescription>
            Controle se a IA responde, sugere ou transfere conversas para humanos.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <ToggleRow
            label="Atendente IA ativo"
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            Ritmo de resposta
          </CardTitle>
          <CardDescription>
            Ajustes salvos na API e usados pelo pipeline antes de enviar mensagens automaticas.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <NumberField
            label="Delay minimo"
            value={form.minDelaySeconds}
            min={1}
            max={120}
            suffix="seg"
            onChange={(value) => setForm((current) => ({ ...current, minDelaySeconds: value }))}
          />
          <NumberField
            label="Delay maximo"
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
          <CardTitle>Personalizacao e transferencia</CardTitle>
          <CardDescription>
            Preferencias usadas na geracao de respostas e nas regras de escalonamento.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
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
            description="Pedidos de cancelamento saem do fluxo automatico."
            checked={form.transferOnCancellation}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, transferOnCancellation: checked }))
            }
          />
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
    minDelaySeconds: settings.minDelaySeconds,
    maxDelaySeconds: settings.maxDelaySeconds,
    messageGroupingSeconds: settings.messageGroupingSeconds,
    answerOnlyDuringBusinessHours: settings.answerOnlyDuringBusinessHours,
    transferOnLowConfidence: settings.transferOnLowConfidence,
    transferOnComplaint: settings.transferOnComplaint,
    transferOnCancellation: settings.transferOnCancellation,
    tone: settings.tone,
    useEmojis: settings.useEmojis,
    callCustomerByName: settings.callCustomerByName,
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
  onChange: (value: string) => void
}

function TextAreaField({ label, value, placeholder, onChange }: TextAreaFieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={5}
        maxLength={500}
        className="min-h-32 w-full resize-y rounded-xl border border-white/10 bg-[#071525] px-3 py-2 text-sm leading-6 text-slate-100 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
        placeholder={placeholder}
      />
    </div>
  )
}
