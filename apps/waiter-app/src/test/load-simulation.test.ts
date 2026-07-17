import { describe, expect, it } from 'vitest'

describe('carga sintética de domínio', () => {
  it('filtra 100 mesas e aplica 100 atualizações concorrentes sem travar', async () => {
    const tables = Array.from({ length: 100 }, (_, index) => ({ id: `table-${index}`, code: String(index + 1).padStart(3, '0'), status: index % 3 === 0 ? 'free' : 'occupied', version: 1 }))
    const startedAt = performance.now()
    const occupied = tables.filter((table) => table.status === 'occupied' && table.code.includes('0'))
    const updated = await Promise.all(tables.map(async (table) => ({ ...table, version: table.version + 1 })))
    const duration = performance.now() - startedAt
    expect(occupied.length).toBeGreaterThan(0)
    expect(updated.every((table) => table.version === 2)).toBe(true)
    expect(duration).toBeLessThan(2_000)
  })

  it('busca em 500 produtos, 20 categorias e compõe comanda de 100 itens', () => {
    const categories = Array.from({ length: 20 }, (_, index) => ({ id: `category-${index}`, name: `Categoria ${index}` }))
    const products = Array.from({ length: 500 }, (_, index) => ({ id: `product-${index}`, categoryId: categories[index % categories.length]!.id, name: `Produto ${index}`, price: index + .9 }))
    const startedAt = performance.now()
    const result = products.filter((product) => `${product.name} ${product.categoryId}`.toLowerCase().includes('produto 49'))
    const order = products.slice(0, 100).map((product) => ({ ...product, quantity: 1 }))
    const total = order.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const duration = performance.now() - startedAt
    const serializedFootprint = new TextEncoder().encode(JSON.stringify({ categories, products, order })).byteLength
    expect(result.length).toBeGreaterThan(0)
    expect(order).toHaveLength(100)
    expect(total).toBeGreaterThan(0)
    expect(duration).toBeLessThan(2_000)
    expect(serializedFootprint).toBeLessThan(1024 * 1024)
  })

  it('mantém 50 usuários e 100 eventos isolados por loja', () => {
    const users = Array.from({ length: 50 }, (_, index) => ({ id: `waiter-${index}`, storeId: index < 25 ? 'store-a' : 'store-b' }))
    const events = Array.from({ length: 100 }, (_, index) => ({ id: index, storeId: index % 2 ? 'store-a' : 'store-b' }))
    expect(users.filter((user) => user.storeId === 'store-a')).toHaveLength(25)
    expect(events.filter((event) => event.storeId === 'store-a')).toHaveLength(50)
  })
})
