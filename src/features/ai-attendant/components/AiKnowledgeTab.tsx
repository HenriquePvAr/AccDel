import { useState, type FormEvent } from 'react'
import { Brain, CheckCircle2, Pencil, Plus, Save, Trash2, XCircle } from 'lucide-react'

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
import type { AiKnowledgeEntry, AiKnowledgeEntryType } from '@/contracts/ai-attendant'

import { formatDateTime, knowledgeTypeLabels, knowledgeTypes } from './ai-attendant-labels'

interface KnowledgeFormState {
  type: AiKnowledgeEntryType
  title: string
  content: string
  isActive: boolean
}

const emptyForm: KnowledgeFormState = {
  type: 'faq',
  title: '',
  content: '',
  isActive: true,
}

export function AiKnowledgeTab() {
  const { data: entries = [], isLoading } = useKnowledgeEntriesQuery()
  const createEntry = useCreateKnowledgeEntryMutation()
  const updateEntry = useUpdateKnowledgeEntryMutation()
  const deleteEntry = useDeleteKnowledgeEntryMutation()
  const { pushToast } = useToastStore()
  const [form, setForm] = useState<KnowledgeFormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [entryToDelete, setEntryToDelete] = useState<AiKnowledgeEntry | null>(null)

  const editingEntry = entries.find((entry) => entry.id === editingId)
  const isSaving = createEntry.isPending || updateEntry.isPending

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
    })
  }

  const handleToggleActive = async (entry: AiKnowledgeEntry) => {
    await updateEntry.mutateAsync({
      id: entry.id,
      payload: { isActive: !entry.isActive },
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
                  {entries.length} entrada(s) cadastrada(s) na API.
                </CardDescription>
              </div>
              <Badge variant={entries.some((entry) => entry.isActive) ? 'success' : 'warning'}>
                {entries.filter((entry) => entry.isActive).length} ativas
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <EmptyState
                icon={<Brain className="h-7 w-7" />}
                title="Base ainda vazia"
                description="Crie a primeira entrada com dados reais da loja, politicas ou perguntas frequentes."
              />
            ) : (
              <div className="space-y-3">
                {entries.map((entry) => (
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
                        </div>
                        <h3 className="break-words text-base font-black tracking-[-0.01em] text-white">
                          {entry.title}
                        </h3>
                        <p className="line-clamp-3 text-sm leading-6 text-slate-400">{entry.content}</p>
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
            ? `A entrada "${entryToDelete.title}" sera removida da API.`
            : 'A entrada sera removida da API.'
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
