import { ArrowLeft, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { currency } from '@/lib/format'
import type { DraftItem, DraftSelection, MenuProduct, WaiterMenu } from '@/types'
import { QuantityStepper } from './QuantityStepper'

interface ProductCatalogProps {
  menu: WaiterMenu
  onAdd(item: DraftItem): void
  onClose(): void
}

export function ProductCatalog({ menu, onAdd, onClose }: ProductCatalogProps) {
  const [categoryId, setCategoryId] = useState(menu.categories.find((entry) => entry.available)?.id ?? 'all')
  const [search, setSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<MenuProduct | null>(null)
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR')
  const products = useMemo(
    () => menu.categories.flatMap((category) => category.products).filter((product) => {
      if (categoryId !== 'all' && product.categoryId !== categoryId) return false
      return !normalizedSearch || `${product.name} ${product.description}`.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
    }),
    [categoryId, menu.categories, normalizedSearch],
  )

  function chooseProduct(product: MenuProduct) {
    if (!product.orderable) return
    if (product.optionGroups.length) setSelectedProduct(product)
    else onAdd(toDraftItem(product, 1, [], '', []))
  }

  return (
    <div className="catalog-overlay" role="dialog" aria-modal="true" aria-label="Adicionar produtos">
      <header className="catalog-header">
        <button className="icon-button" type="button" aria-label="Voltar para comanda" onClick={onClose}><ArrowLeft /></button>
        <div><span className="eyebrow">Cardápio atual</span><h2>Adicionar produtos</h2></div>
        <button className="icon-button desktop-close" type="button" aria-label="Fechar catálogo" onClick={onClose}><X /></button>
      </header>
      <div className="catalog-tools">
        <label className="search-field"><Search size={19} /><span className="sr-only">Buscar produtos</span><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto" /></label>
        <CategoryRail categories={menu.categories} value={categoryId} onChange={setCategoryId} />
      </div>
      <div className="quick-product-grid">
        {products.map((product) => <QuickProductCard key={product.id} product={product} onSelect={() => chooseProduct(product)} />)}
      </div>
      {!products.length && <p className="catalog-empty">Nenhum produto corresponde à busca.</p>}
      {selectedProduct && (
        <ModifierSelector
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAdd={(item) => {
            onAdd(item)
            setSelectedProduct(null)
          }}
        />
      )}
    </div>
  )
}

export function CategoryRail({
  categories,
  value,
  onChange,
}: {
  categories: WaiterMenu['categories']
  value: string
  onChange(value: string): void
}) {
  return (
    <div className="category-rail" role="tablist" aria-label="Categorias">
      <button type="button" role="tab" aria-selected={value === 'all'} className={value === 'all' ? 'active' : ''} onClick={() => onChange('all')}>Todos</button>
      {categories.filter((category) => category.available).map((category) => (
        <button type="button" role="tab" aria-selected={value === category.id} className={value === category.id ? 'active' : ''} key={category.id} onClick={() => onChange(category.id)}>{category.name}</button>
      ))}
    </div>
  )
}

export function QuickProductCard({ product, onSelect }: { product: MenuProduct; onSelect(): void }) {
  return (
    <button className="quick-product-card" type="button" disabled={!product.orderable} onClick={onSelect}>
      <span className="product-copy"><strong>{product.name}</strong><small>{product.description}</small></span>
      <span className="product-price">{currency.format(product.price)}</span>
      {!product.orderable && <span className="unavailable-label">Indisponível · {product.unavailableReason ?? 'temporariamente'}</span>}
    </button>
  )
}

export function ModifierSelector({ product, onAdd, onClose }: { product: MenuProduct; onAdd(item: DraftItem): void; onClose(): void }) {
  const [selected, setSelected] = useState<DraftSelection[]>([])
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [attempted, setAttempted] = useState(false)
  const invalidGroups = product.optionGroups.filter((group) => {
    const count = selected.filter((entry) => entry.groupId === group.id).reduce((sum, entry) => sum + entry.quantity, 0)
    return count < group.minSelections || count > group.maxSelections
  })

  function toggle(groupId: string, optionId: string, maxSelections: number) {
    setSelected((current) => {
      const exists = current.some((entry) => entry.groupId === groupId && entry.optionId === optionId)
      if (exists) return current.filter((entry) => !(entry.groupId === groupId && entry.optionId === optionId))
      const inGroup = current.filter((entry) => entry.groupId === groupId)
      if (maxSelections === 1) return [...current.filter((entry) => entry.groupId !== groupId), { groupId, optionId, quantity: 1 }]
      if (inGroup.length >= maxSelections) return current
      return [...current, { groupId, optionId, quantity: 1 }]
    })
  }

  function submit() {
    setAttempted(true)
    if (invalidGroups.length) return
    const optionLabels = product.optionGroups.flatMap((group) => group.options.filter((option) => selected.some((entry) => entry.groupId === group.id && entry.optionId === option.id)).map((option) => option.name))
    onAdd(toDraftItem(product, quantity, selected, notes, optionLabels))
  }

  const optionsTotal = product.optionGroups.flatMap((group) => group.options).filter((option) => selected.some((entry) => entry.optionId === option.id)).reduce((sum, option) => sum + option.priceDelta, 0)

  return (
    <div className="modifier-backdrop">
      <section className="modifier-selector" aria-labelledby="modifier-title">
        <header><div><span className="eyebrow">Personalizar</span><h2 id="modifier-title">{product.name}</h2></div><button className="icon-button" type="button" aria-label="Fechar adicionais" onClick={onClose}><X /></button></header>
        <div className="modifier-scroll">
          {product.optionGroups.map((group) => {
            const invalid = attempted && invalidGroups.some((entry) => entry.id === group.id)
            return (
              <fieldset key={group.id} className={invalid ? 'invalid' : ''}>
                <legend>{group.name} <small>{group.required ? 'Obrigatório' : 'Opcional'} · escolha {group.minSelections === group.maxSelections ? group.minSelections : `${group.minSelections}–${group.maxSelections}`}</small></legend>
                {group.options.map((option) => {
                  const checked = selected.some((entry) => entry.groupId === group.id && entry.optionId === option.id)
                  return <label className={`modifier-option ${!option.orderable ? 'disabled' : ''}`} key={option.id}><input type={group.maxSelections === 1 ? 'radio' : 'checkbox'} name={group.id} checked={checked} disabled={!option.orderable} onChange={() => toggle(group.id, option.id, group.maxSelections)} /><span>{option.name}<small>{option.description}</small></span><strong>{option.priceDelta ? `+ ${currency.format(option.priceDelta)}` : 'Incluso'}</strong></label>
                })}
                {invalid && <p className="field-error">Complete as escolhas obrigatórias.</p>}
              </fieldset>
            )
          })}
          <label className="notes-field"><span>Observação para a cozinha <small>(opcional)</small></span><textarea maxLength={280} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: sem cebola" /></label>
        </div>
        <footer><QuantityStepper value={quantity} onChange={setQuantity} /><button className="button primary" type="button" onClick={submit}>Adicionar · {currency.format((product.price + optionsTotal) * quantity)}</button></footer>
      </section>
    </div>
  )
}

function toDraftItem(product: MenuProduct, quantity: number, options: DraftSelection[], notes: string, optionLabels: string[]): DraftItem {
  const optionIds = new Set(options.map((entry) => entry.optionId))
  const optionsTotal = product.optionGroups.flatMap((group) => group.options).filter((option) => optionIds.has(option.id)).reduce((sum, option) => sum + option.priceDelta, 0)
  return { clientId: crypto.randomUUID(), productId: product.id, name: product.name, quantity, unitPrice: product.price + optionsTotal, notes: notes.trim() || undefined, options, optionLabels }
}
