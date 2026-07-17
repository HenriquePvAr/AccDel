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
import type { Driver } from '@/types'

interface DriverFormDrawerProps {
  driver: Driver | null
  open: boolean
  busy?: boolean
  onOpenChange: (open: boolean) => void
  onSave: (driver: {
    id?: string
    name: string
    email?: string
    phone: string
    vehicle: string
    active: boolean
    availability: Driver['availability']
  }) => void
}

export function DriverFormDrawer({
  driver,
  open,
  busy = false,
  onOpenChange,
  onSave,
}: DriverFormDrawerProps) {
  const initial = useMemo(
    () => ({
      id: driver?.id,
      name: driver?.name ?? '',
      email: driver?.email ?? '',
      phone: driver?.phone ?? '',
      vehicle: driver?.vehicle ?? 'Moto',
      active: driver?.active ?? true,
      availability: driver?.availability ?? ('available' as const),
    }),
    [driver],
  )
  const [draft, setDraft] = useState(initial)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{driver ? 'Editar motoboy' : 'Novo motoboy'}</SheetTitle>
          <SheetDescription>
            Cadastro para atribuir e acompanhar pedidos.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nome</label>
            <Input
              value={draft.name}
              onChange={(event) =>
                setDraft((state) => ({ ...state, name: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">E-mail de acesso</label>
            <Input
              value={draft.email}
              onChange={(event) =>
                setDraft((state) => ({ ...state, email: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Telefone</label>
            <Input
              value={draft.phone}
              onChange={(event) =>
                setDraft((state) => ({ ...state, phone: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Veiculo</label>
            <Input
              value={draft.vehicle}
              onChange={(event) =>
                setDraft((state) => ({ ...state, vehicle: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select
              value={draft.availability}
              onValueChange={(value) =>
                setDraft((state) => ({
                  ...state,
                  availability: value as Driver['availability'],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Disponivel</SelectItem>
                <SelectItem value="delivering">Em entrega</SelectItem>
                <SelectItem value="paused">Pausado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/10">
            <div>
              <p className="font-medium">Acesso ativo</p>
              <p className="text-sm text-muted-foreground">
                Desabilitar remove o motoboy da fila de despacho.
              </p>
            </div>
            <Switch
              checked={draft.active}
              onCheckedChange={(checked) =>
                setDraft((state) => ({
                  ...state,
                  active: checked,
                  availability: checked ? state.availability : 'paused',
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
            disabled={busy || !draft.name || !draft.email || !draft.phone}
            onClick={() => {
              onSave(draft)
              onOpenChange(false)
            }}
          >
            {busy ? 'Salvando...' : 'Salvar motoboy'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
