import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import type { Waiter } from '@/types'

export function WaiterFormDrawer({
  waiter,
  open,
  busy = false,
  onOpenChange,
  onSave,
}: {
  waiter: Waiter | null
  open: boolean
  busy?: boolean
  onOpenChange: (open: boolean) => void
  onSave: (waiter: Waiter) => void
}) {
  const initial = useMemo<Waiter>(
    () =>
      waiter ?? {
        id: crypto.randomUUID(),
        name: '',
        email: '',
        phone: '',
        active: true,
        status: 'available',
        totalOrders: 0,
        totalSales: 0,
        tablesServed: 0,
        cancellations: 0,
        averageTicket: 0,
        history: [],
      },
    [waiter],
  )
  const [draft, setDraft] = useState(initial)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{waiter ? 'Editar garcom' : 'Novo garcom'}</SheetTitle>
          <SheetDescription>
            Cadastro da equipe do salão.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nome</label>
            <Input value={draft.name} onChange={(event) => setDraft((state) => ({ ...state, name: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">E-mail</label>
            <Input
              value={draft.email ?? ''}
              onChange={(event) => setDraft((state) => ({ ...state, email: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Telefone</label>
            <Input value={draft.phone} onChange={(event) => setDraft((state) => ({ ...state, phone: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select
              value={draft.status}
              onValueChange={(value) =>
                setDraft((state) => ({ ...state, status: value as Waiter['status'] }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Disponivel</SelectItem>
                <SelectItem value="serving">Atendendo</SelectItem>
                <SelectItem value="paused">Pausado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/10">
            <div>
              <p className="font-medium">Acesso ativo</p>
              <p className="text-sm text-muted-foreground">
                Desabilitar impede novos lancamentos e fecha o turno.
              </p>
            </div>
            <Switch
              checked={draft.active}
              onCheckedChange={(checked) =>
                setDraft((state) => ({
                  ...state,
                  active: checked,
                  status: checked ? state.status : 'paused',
                }))
              }
            />
          </div>
        </div>

        <div className="mt-auto flex justify-end gap-2 border-t border-border/60 pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={busy || !draft.name || !draft.phone || !draft.email}
            onClick={() => {
              onSave({ ...draft, lastActivityAt: new Date().toISOString() })
              onOpenChange(false)
            }}
          >
            {busy ? 'Salvando...' : 'Salvar garcom'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
