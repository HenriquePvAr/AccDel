import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { EmptyState } from '@/components/shared/EmptyState'
import { FilterBar } from '@/components/shared/FilterBar'
import { PageShell } from '@/components/shared/PageShell'
import { SearchInput } from '@/components/shared/SearchInput'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { OrderDrawer } from '@/features/orders/components/OrderDrawer'
import {
  useOrderByIdQuery,
  useOrdersQuery,
  useRepeatOrderMutation,
  useUpdateOrderStatusMutation,
} from '@/hooks/queries'
import { usePageTitle } from '@/hooks/use-page-title'
import { useCan } from '@/hooks/use-permissions'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { useDrawerStore, useOrderSelectionStore } from '@/stores'
import { History } from 'lucide-react'

import type { OrderAction } from '@/features/orders/components/order-actions'

export function OrderHistoryPage() {
  usePageTitle('Histórico de pedidos')
  const [search, setSearch] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useOrderSelectionStore(
    useShallow((state) => [state.selectedOrderId, state.setSelectedOrderId]),
  )
  const [activeDrawer, openDrawer, closeDrawer] = useDrawerStore(
    useShallow((state) => [state.activeDrawer, state.openDrawer, state.closeDrawer]),
  )
  const ordersQuery = useOrdersQuery({ filters: { search } })
  const selectedOrderQuery = useOrderByIdQuery(selectedOrderId)
  const repeatOrderMutation = useRepeatOrderMutation()
  const updateOrderStatus = useUpdateOrderStatusMutation()
  const canCreateOrders = useCan('orders:create')
  const canUpdateOrders = useCan('orders:update')
  const orders = ordersQuery.data?.data ?? []

  const historyOrders = orders.filter((order) => {
    const query = search.toLowerCase()

    return (
      !query ||
      order.customerName.toLowerCase().includes(query) ||
      order.number.toLowerCase().includes(query)
    )
  })

  const selectedOrder =
    selectedOrderQuery.data?.data ??
    historyOrders.find((order) => order.id === selectedOrderId) ??
    null

  const handleAction = (orderId: string, action: OrderAction) => {
    if (!canUpdateOrders) {
      return
    }

    updateOrderStatus.mutate({
      orderId,
      action,
      actor: 'Histórico / Operação',
    })
  }

  return (
    <PageShell>
      <SectionHeader
        title="Histórico de pedidos"
        description="Busca avancada, detalhe completo e repeticao usando a fonte de pedidos ativa."
      />

      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar cliente ou número do pedido"
        />
      </FilterBar>

      {ordersQuery.isLoading ? (
        <Skeleton className="h-[420px] rounded-[24px]" />
      ) : historyOrders.length ? (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.04] text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <tr>
                  <th className="px-5 py-4">Pedido</th>
                  <th className="px-5 py-4">Cliente</th>
                  <th className="px-5 py-4">Canal</th>
                  <th className="px-5 py-4">Data</th>
                  <th className="px-5 py-4">Valor</th>
                  <th className="px-5 py-4">Ações</th>
                </tr>
              </thead>
              <tbody>
                {historyOrders.map((order) => (
                  <tr key={order.id} className="border-b border-white/10">
                    <td className="px-5 py-4 font-semibold">{order.number}</td>
                    <td className="px-5 py-4">{order.customerName}</td>
                    <td className="px-5 py-4">{order.source}</td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {formatDateTime(order.createdAt)}
                    </td>
                    <td className="px-5 py-4 font-mono">{formatCurrency(order.total)}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setSelectedOrderId(order.id)
                            openDrawer('order')
                          }}
                        >
                          Ver
                        </Button>
                        {canCreateOrders ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              repeatOrderMutation.mutate({
                                orderId: order.id,
                                paymentMethod: order.paymentMethod,
                              })
                            }
                          >
                            Repetir
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={<History className="h-5 w-5" />}
          title="Nenhum pedido no histórico"
          description="Assim que os pedidos forem criados ou repetidos, eles aparecem aqui."
        />
      )}

      <OrderDrawer
        order={selectedOrder}
        open={activeDrawer === 'order'}
        onOpenChange={(open) => {
          if (!open) {
            closeDrawer()
            setSelectedOrderId(null)
          }
        }}
        onAction={handleAction}
        canUpdate={canUpdateOrders}
      />
    </PageShell>
  )
}
