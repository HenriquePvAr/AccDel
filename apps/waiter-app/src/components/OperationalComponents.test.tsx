import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import type { DiningTable, SessionItem, TableSession } from '@/types'
import { OrderItemRow } from './OrderItemRow'
import { TableCard } from './TableCard'

const table: DiningTable = { id: 'table-a', code: '08', areaId: 'area-a', areaName: 'Salão', capacity: 4, status: 'occupied', version: 3, currentSessionId: 'session-a' }
const session: TableSession = { id: 'session-a', tableId: 'table-a', tableCode: '08', waiterName: 'Ana', openedAt: new Date(Date.now() - 42 * 60_000).toISOString(), guestCount: 3, subtotal: 30, discount: 0, serviceFee: 0, total: 30, status: 'open', version: 4, items: [], timeline: [] }

describe('componentes operacionais', () => {
  it('mesa não depende apenas da cor para comunicar estado e ocupação', () => {
    render(<MemoryRouter><TableCard table={table} session={session} /></MemoryRouter>)
    expect(screen.getByText('Ocupada')).toBeInTheDocument()
    expect(screen.getByText('3 pessoas')).toBeInTheDocument()
    expect(screen.getByText(/42 min/)).toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()
  })

  it.each([
    ['PENDING', 'pending', 'Impressão pendente'],
    ['FAILED', 'failed', 'Falha ao imprimir'],
    ['UNKNOWN', 'unknown', 'Impressão incerta'],
  ] as const)('exibe estado operacional de impressão %s', (_label, printStatus, expected) => {
    const item: SessionItem = { id: 'item-a', productId: 'product-a', name: 'Burger', quantity: 1, unitPrice: 30, totalPrice: 30, options: [], createdAt: new Date().toISOString(), productionStatus: 'in_preparation', printStatus }
    render(<OrderItemRow item={item} />)
    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it('exibe horário e responsável do lançamento do item', () => {
    const item: SessionItem = {
      id: 'item-a',
      productId: 'product-a',
      name: 'Burger',
      quantity: 1,
      unitPrice: 30,
      totalPrice: 30,
      options: [],
      createdAt: new Date().toISOString(),
      createdByName: 'Sara Vale',
      productionStatus: 'in_preparation',
      printStatus: 'confirmed',
    }

    render(<OrderItemRow item={item} />)

    expect(screen.getByText(/Sara Vale/)).toBeInTheDocument()
  })

  it('não inventa responsável quando o item antigo não possui snapshot', () => {
    const item: SessionItem = {
      id: 'item-a',
      productId: 'product-a',
      name: 'Burger',
      quantity: 1,
      unitPrice: 30,
      totalPrice: 30,
      options: [],
      createdAt: new Date().toISOString(),
      productionStatus: 'in_preparation',
      printStatus: 'confirmed',
    }

    render(<OrderItemRow item={item} />)

    expect(screen.getByText(/Responsável não registrado/)).toBeInTheDocument()
  })
})
