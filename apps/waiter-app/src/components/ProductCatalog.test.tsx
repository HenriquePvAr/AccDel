import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { WaiterMenu } from '@/types'
import { ProductCatalog } from './ProductCatalog'

const menu: WaiterMenu = {
  generatedAt: new Date().toISOString(),
  store: { id: 'store-a', name: 'Cain Teste' },
  categories: [
    {
      id: 'burgers',
      name: 'Burguers',
      description: '',
      sortOrder: 1,
      available: true,
      products: [
        {
          id: 'simple', categoryId: 'burgers', name: 'Batata', description: 'Crocante', price: 12, featured: true, orderable: true, optionGroups: [],
        },
        {
          id: 'combo', categoryId: 'burgers', name: 'Combo Cain', description: 'Escolha o ponto', price: 32, featured: true, orderable: true,
          optionGroups: [{ id: 'point', name: 'Ponto', required: true, minSelections: 1, maxSelections: 1, options: [{ id: 'medium', name: 'Ao ponto', priceDelta: 0, orderable: true }] }],
        },
        {
          id: 'sold-out', categoryId: 'burgers', name: 'Milkshake', description: 'Chocolate', price: 18, featured: false, orderable: false, unavailableReason: 'Esgotado', optionGroups: [],
        },
      ],
    },
  ],
}

describe('catálogo rápido', () => {
  it('adiciona produto simples em um toque e exibe preço atual', () => {
    const onAdd = vi.fn()
    render(<ProductCatalog menu={menu} onAdd={onAdd} onClose={() => undefined} />)

    expect(screen.getByText('R$ 12,00')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Batata/ }))

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ productId: 'simple', quantity: 1, unitPrice: 12 }))
  })

  it('bloqueia produto indisponível e explica o motivo', () => {
    render(<ProductCatalog menu={menu} onAdd={() => undefined} onClose={() => undefined} />)
    const unavailable = screen.getByRole('button', { name: /Milkshake/ })
    expect(unavailable).toBeDisabled()
    expect(screen.getByText(/Indisponível · Esgotado/)).toBeInTheDocument()
  })

  it('exige adicional obrigatório antes de adicionar', () => {
    const onAdd = vi.fn()
    render(<ProductCatalog menu={menu} onAdd={onAdd} onClose={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: /Combo Cain/ }))
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))

    expect(screen.getByText('Complete as escolhas obrigatórias.')).toBeInTheDocument()
    expect(onAdd).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText(/Ao ponto/))
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }))
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ productId: 'combo', options: [{ groupId: 'point', optionId: 'medium', quantity: 1 }] }))
  })

  it('filtra produtos por busca sem alterar a fonte do cardápio', () => {
    render(<ProductCatalog menu={menu} onAdd={() => undefined} onClose={() => undefined} />)
    fireEvent.change(screen.getByPlaceholderText('Buscar produto'), { target: { value: 'batata' } })
    expect(screen.getByRole('button', { name: /Batata/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Combo Cain/ })).not.toBeInTheDocument()
  })
})
