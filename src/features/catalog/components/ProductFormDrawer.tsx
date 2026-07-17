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
import type { Category, Product, ProductChannel } from '@/types'

interface ProductFormDrawerProps {
  product: Product | null
  categories: Category[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (product: Product) => void
  busy?: boolean
  defaultCategoryId?: string
}

export function ProductFormDrawer({
  product,
  categories,
  open,
  onOpenChange,
  onSave,
  busy = false,
  defaultCategoryId,
}: ProductFormDrawerProps) {
  const initial = useMemo<Product>(
    () =>
      product ?? {
        id: crypto.randomUUID(),
        categoryId: defaultCategoryId ?? categories[0]?.id ?? 'cat_burgers',
        name: '',
        description: '',
        price: 0,
        image:
          'https://images.unsplash.com/photo-1550317138-10000687a72b?auto=format&fit=crop&w=800&q=80',
        featured: false,
        active: true,
        preparationStation: 'assembly',
        sortOrder: 0,
        tags: [],
        availability: (
          ['dine_in', 'delivery', 'digital_menu', 'counter'] as ProductChannel[]
        ).map((channel) => ({
          channel,
          available: true,
          visible: true,
          soldOut: false,
        })),
      },
    [categories, defaultCategoryId, product],
  )
  const [draft, setDraft] = useState(initial)
  const [tagsInput, setTagsInput] = useState(initial.tags.join(', '))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{product ? 'Editar produto' : 'Novo produto'}</SheetTitle>
          <SheetDescription>
            Edite o cardápio, os canais e o setor de preparo.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nome</label>
            <Input
              value={draft.name}
              onChange={(event) => setDraft((state) => ({ ...state, name: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Categoria</label>
            <Select
              value={draft.categoryId}
              onValueChange={(value) => setDraft((state) => ({ ...state, categoryId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Descricao</label>
            <Input
              value={draft.description}
              onChange={(event) =>
                setDraft((state) => ({ ...state, description: event.target.value }))
              }
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Preco</label>
              <Input
                value={String(draft.price)}
                onChange={(event) =>
                  setDraft((state) => ({
                    ...state,
                    price: Number(event.target.value.replace(',', '.')) || 0,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Setor / preparo</label>
              <Input
                value={draft.preparationStation}
                onChange={(event) =>
                  setDraft((state) => ({
                    ...state,
                    preparationStation: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Imagem</label>
            <Input
              value={draft.image}
              onChange={(event) => setDraft((state) => ({ ...state, image: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Tags</label>
            <Input
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              onBlur={() =>
                setDraft((state) => ({
                  ...state,
                  tags: tagsInput
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                }))
              }
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/10">
              <div>
                <p className="font-medium">Produto ativo</p>
                <p className="text-sm text-muted-foreground">Mostra o item no catalogo.</p>
              </div>
              <Switch
                checked={draft.active}
                onCheckedChange={(checked) =>
                  setDraft((state) => ({ ...state, active: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/10">
              <div>
                <p className="font-medium">Destaque</p>
                <p className="text-sm text-muted-foreground">Aparece primeiro na vitrine.</p>
              </div>
              <Switch
                checked={draft.featured}
                onCheckedChange={(checked) =>
                  setDraft((state) => ({ ...state, featured: checked }))
                }
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Disponibilidade por canal</label>
            {draft.availability.map((entry) => (
              <div
                key={entry.channel}
                className="rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/10"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{entry.channel}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.soldOut ? 'Esgotado' : entry.available ? 'Disponivel' : 'Oculto'}
                    </p>
                  </div>
                  <Switch
                    checked={entry.available && !entry.soldOut}
                    onCheckedChange={(checked) =>
                      setDraft((state) => ({
                        ...state,
                        availability: state.availability.map((availability) =>
                          availability.channel === entry.channel
                            ? {
                                ...availability,
                                available: checked,
                                visible: checked,
                                soldOut: false,
                              }
                            : availability,
                        ),
                      }))
                    }
                  />
                </div>
                <Button
                  variant={entry.soldOut ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() =>
                    setDraft((state) => ({
                      ...state,
                      availability: state.availability.map((availability) =>
                        availability.channel === entry.channel
                          ? {
                              ...availability,
                              soldOut: !availability.soldOut,
                              available: availability.soldOut ? availability.available : false,
                            }
                          : availability,
                      ),
                    }))
                  }
                >
                  {entry.soldOut ? 'Reativar canal' : 'Marcar esgotado'}
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto flex justify-end gap-2 border-t border-border/60 pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              onSave({
                ...draft,
                tags: tagsInput
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              })
              onOpenChange(false)
            }}
          >
            {busy ? 'Salvando...' : 'Salvar produto'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
