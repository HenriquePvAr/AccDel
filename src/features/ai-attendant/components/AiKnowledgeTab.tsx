import { useState, type FormEvent } from 'react'
import { Brain, CheckCircle2, Pencil, Plus, Save, Search, Sparkles, Trash2, XCircle } from 'lucide-react'

import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useCreateKnowledgeEntryMutation,
  useDeleteKnowledgeEntryMutation,
  useKnowledgeEntriesQuery,
  useUpdateKnowledgeEntryMutation,
} from '@/hooks/queries/ai-attendant'
import { useToastStore } from '@/stores/toast-store'
import type {
  AiKnowledgeEntry,
  AiKnowledgeEntryChannel,
  AiKnowledgeEntryType,
} from '@/contracts/ai-attendant'

import { formatDateTime, knowledgeTypeLabels, knowledgeTypes } from './ai-attendant-labels'

interface KnowledgeFormState {
  type: AiKnowledgeEntryType
  title: string
  content: string
  isActive: boolean
  priority: number
  channels: AiKnowledgeEntryChannel[]
}

const emptyForm: KnowledgeFormState = {
  type: 'faq',
  title: '',
  content: '',
  isActive: true,
  priority: 0,
  channels: ['whatsapp'],
}

const knowledgeChannelLabels: Record<AiKnowledgeEntryChannel, string> = {
  whatsapp: 'WhatsApp',
  digital_menu: 'Cardapio Digital',
  delivery: 'Delivery',
  counter: 'Balcao',
  dine_in: 'Salao',
}

const knowledgeChannels = Object.keys(knowledgeChannelLabels) as AiKnowledgeEntryChannel[]

const exampleEntries: Array<Pick<KnowledgeFormState, 'type' | 'title' | 'content' | 'channels'>> = [
  {
    type: 'store_info',
    title: 'Horario de funcionamento',
    content: 'Funcionamos de segunda a domingo, das 18h as 23h.',
    channels: ['whatsapp', 'digital_menu'],
  },
  {
    type: 'delivery_area',
    title: 'Taxa de entrega',
    content: 'A taxa de entrega depende do bairro. Se o cliente nao informar o bairro, peca essa informacao antes de confirmar valores.',
    channels: ['whatsapp', 'digital_menu', 'delivery'],
  },
  {
    type: 'payment',
    title: 'Formas de pagamento',
    content: 'Aceitamos Pix, dinheiro, cartao de credito e debito. Pagamento online so deve ser citado quando houver integracao configurada.',
    channels: ['whatsapp', 'digital_menu', 'delivery', 'counter', 'dine_in'],
  },
  {
    type: 'cancellation',
    title: 'Politica de cancelamento',
    content: 'Pedidos em preparo precisam ser avaliados por um atendente humano antes de cancelar.',
    channels: ['whatsapp', 'digital_menu'],
  },
]

export function AiKnowledgeTab() {
  const { data: entries = [], isLoading } = useKnowledgeEntriesQuery()
  const createEntry = useCreateKnowledgeEntryMutation()
  const updateEntry = useUpdateKnowledgeEntryMutation()
  const deleteEntry = useDeleteKnowledgeEntryMutation()
  const { pushToast } = useToastStore()
  const [form, setForm] = useState<KnowledgeFormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [entryToDelete, setEntryToDelete] = useState<AiKnowledgeEntry | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | AiKnowledgeEntryType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const editingEntry = entries.find((entry) => entry.id === editingId)
  const isSaving = createEntry.isPending || updateEntry.isPending
  const filteredEntries = entries.filter((entry) => {
    const normalizedSearch = search.trim().toLowerCase()
    const matchesSearch = normalizedSearch
      ? `${entry.title} ${entry.content}`.toLowerCase().includes(normalizedSearch)
      : true
    const matchesType = typeFilter === 'all' || entry.type === typeFilter
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' ? entry.isActive : !entry.isActive)

    return matchesSearch && matchesType && matchesStatus
  })

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const title = form.title.trim()
    const content = form.content.trim()

    if (title.length < 2 || content.length < 2) {
      pushToast({
        title: 'Preencha titulo e conteudo',
        description: 'Cada campo precisa ter pelo menos 2 caracteres.',
        variant: 'warning',
      })
      return
    }

    const payload = {
      type: form.type,
      title,
      content,
      isActive: form.isActive,
      priority: form.priority,
      channels: form.channels,
    }

    if (editingId) {
      await updateEntry.mutateAsync({ id: editingId, payload })
    } else {
      await createEntry.mutateAsync(payload)
    }

    resetForm()
  }

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const handleEdit = (entry: AiKnowledgeEntry) => {
    setEditingId(entry.id)
    setForm({
      type: entry.type,
      title: entry.title,
      content: entry.content,
      isActive: entry.isActive,
      priority: entry.priority,
      channels: entry.channels.length ? entry.channels : ['whatsapp'],
    })
  }

  const handleToggleActive = async (entry: AiKnowledgeEntry) => {
    await updateEntry.mutateAsync({
      id: entry.id,
      payload: { isActive: !entry.isActive },
    })
  }

  const handleExample = (example: Pick<KnowledgeFormState, 'type' | 'title' | 'content' | 'channels'>) => {
    setForm((current) => ({
      ...current,
      ...example,
      isActive: true,
    }))
  }

  const toggleChannel = (channel: AiKnowledgeEntryChannel) => {
    setForm((current) => {
      const nextChannels = current.channels.includes(channel)
        ? current.channels.filter((entry) => entry !== channel)
        : [...current.channels, channel]

      return {
        ...current,
        channels: nextChannels.length ? nextChannels : [channel],
      }
    })
  }

  const handleDelete = async () => {
    if (!entryToDelete) {
      return
    }

    await deleteEntry.mutateAsync(entryToDelete.id)
    if (editingId === entryToDelete.id) {
      resetForm()
    }
    setEntryToDelete(null)
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <Skeleton className="h-[520px]" />
        <Skeleton className="h-[520px]" />
      </div>
    )
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {editingEntry ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
            {editingEntry ? 'Editar entrada' : 'Nova entrada'}
          </CardTitle>
          <CardDescription>
            Cadastre conteudo real para a IA consultar ao responder clientes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                Tipo
              </label>
              <Select
                value={form.type}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, type: value as AiKnowledgeEntryType }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {knowledgeTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {knowledgeTypeLabels[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                Exemplos rapidos
              </label>
              <div className="flex flex-wrap gap-2">
                {exampleEntries.map((example) => (
                  <Button
                    key={example.title}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleExample(example)}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {example.title}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="knowledge-title" className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                Titulo
              </label>
              <Input
                id="knowledge-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Ex: Horario de funcionamento"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="knowledge-content" className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                Conteudo
              </label>
              <textarea
                id="knowledge-content"
                value={form.content}
                onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                rows={10}
                className="min-h-48 w-full resize-y rounded-xl border border-white/10 bg-[#071525] px-3 py-2 text-sm leading-6 text-slate-100 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
                placeholder="Escreva a resposta, regra ou informacao que a IA deve considerar."
              />
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] p-3">
              <span>
                <span className="block text-sm font-semibold text-white">Entrada ativa</span>
                <span className="block text-xs leading-5 text-slate-400">
                  Entradas inativas ficam salvas, mas saem do contexto da IA.
                </span>
              </span>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                className="h-4 w-4 accent-primary"
              />
            </label>

            <div className="space-y-2">
              <label htmlFor="knowledge-priority" className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                Prioridade
              </label>
              <Input
                id="knowledge-priority"
                value={String(form.priority)}
                inputMode="numeric"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    priority: Number(event.target.value) || 0,
                  }))
                }
                placeholder="0"
              />
              <p className="text-xs leading-5 text-slate-500">
                Entradas com prioridade maior entram primeiro no contexto da IA.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                Canais
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {knowledgeChannels.map((channel) => (
                  <label
                    key={channel}
                    className="flex items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] p-3 text-sm"
                  >
                    <span className="font-semibold text-white">{knowledgeChannelLabels[channel]}</span>
                    <input
                      type="checkbox"
                      checked={form.channels.includes(channel)}
                      onChange={() => toggleChannel(channel)}
                      className="h-4 w-4 accent-primary"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={isSaving}>
                <Save className="h-4 w-4" />
                {editingEntry ? 'Salvar alteracoes' : 'Criar entrada'}
              </Button>
              {editingEntry ? (
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Cancelar edicao
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  Base de conhecimento
                </CardTitle>
                <CardDescription>
                  {entries.length === 1 ? '1 orientacao cadastrada.' : `${entries.length} orientacoes cadastradas.`}
                </CardDescription>
              </div>
              <Badge variant={entries.some((entry) => entry.isActive) ? 'success' : 'warning'}>
                {entries.filter((entry) => entry.isActive).length} ativas
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_180px_160px]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar titulo ou conteudo"
                  className="pl-9"
                />
              </label>
              <Select
                value={typeFilter}
                onValueChange={(value) => setTypeFilter(value as 'all' | AiKnowledgeEntryType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {knowledgeTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {knowledgeTypeLabels[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as 'all' | 'active' | 'inactive')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativas</SelectItem>
                  <SelectItem value="inactive">Inativas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {entries.length === 0 ? (
              <EmptyState
                icon={<Brain className="h-7 w-7" />}
                title="Base ainda vazia"
                description="Crie a primeira entrada com dados reais da loja, politicas ou perguntas frequentes."
              />
            ) : filteredEntries.length === 0 ? (
              <EmptyState
                icon={<Search className="h-7 w-7" />}
                title="Nada encontrado"
                description="Ajuste busca ou filtros para ver outras entradas da base."
              />
            ) : (
              <div className="space-y-3">
                {filteredEntries.map((entry) => (
                  <article
                    key={entry.id}
                    className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 transition hover:border-white/16 hover:bg-white/[0.06]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge>{knowledgeTypeLabels[entry.type]}</Badge>
                          <Badge variant={entry.isActive ? 'success' : 'warning'}>
                            {entry.isActive ? 'Ativa' : 'Inativa'}
                          </Badge>
                          <Badge>Prioridade {entry.priority}</Badge>
                        </div>
                        <h3 className="break-words text-base font-black tracking-[-0.01em] text-white">
                          {entry.title}
                        </h3>
                        <p className="line-clamp-3 text-sm leading-6 text-slate-400">{entry.content}</p>
                        <p className="text-xs text-slate-500">
                          Canais: {entry.channels.map((channel) => knowledgeChannelLabels[channel]).join(', ') || 'Todos'}
                        </p>
                        <p className="text-xs text-slate-500">
                          Atualizada em {formatDateTime(entry.updatedAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => handleEdit(entry)}>
                          <Pencil className="h-4 w-4" />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleActive(entry)}
                          disabled={updateEntry.isPending}
                        >
                          {entry.isActive ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                          {entry.isActive ? 'Inativar' : 'Ativar'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          onClick={() => setEntryToDelete(entry)}
                          disabled={deleteEntry.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {!entries.some((entry) => entry.isActive) ? (
          <Alert variant="warning">
            <AlertTitle>
              <AlertCircleIcon />
              Nenhuma entrada ativa
            </AlertTitle>
            <AlertDescription>
              A IA pode responder com menos contexto enquanto todas as entradas estiverem inativas.
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <ConfirmActionDialog
        open={Boolean(entryToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setEntryToDelete(null)
          }
        }}
        title="Excluir entrada da base?"
        description={
          entryToDelete
            ? `A orientacao "${entryToDelete.title}" sera removida.`
            : 'A orientacao sera removida.'
        }
        confirmLabel="Excluir"
        onConfirm={handleDelete}
      />
    </div>
  )
}

function AlertCircleIcon() {
  return <XCircle className="h-4 w-4" />
}
