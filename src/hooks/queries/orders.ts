import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type {
  CreateCustomerRequest,
  CreateOrderRequest,
  CreatePublicOrderRequest,
  GetOrderTrackingRequest,
  ListOrdersRequest,
  ListCustomersRequest,
  UpdateCustomerRequest,
  UpdateOrderStatusRequest,
} from '@/contracts'
import { customerService, orderService } from '@/services'
import { queryKeys } from '@/hooks/queries/query-keys'
import { useToastStore } from '@/stores/toast-store'

export function useOrdersQuery(request?: ListOrdersRequest) {
  return useQuery({
    queryKey: queryKeys.orders.list(request?.filters ?? {}),
    queryFn: () => orderService.listOrders(request),
  })
}

export function useOrderByIdQuery(orderId: string | null) {
  return useQuery({
    enabled: Boolean(orderId),
    queryKey: queryKeys.orders.detail(orderId),
    queryFn: () => orderService.getOrderById({ orderId: orderId! }),
  })
}

export function useOrderTrackingQuery(request: GetOrderTrackingRequest | null) {
  return useQuery({
    enabled: Boolean(request?.orderId),
    queryKey: queryKeys.orders.tracking(request?.orderId ?? null),
    queryFn: () => orderService.getOrderTracking({ orderId: request!.orderId }),
    refetchInterval: 60_000,
  })
}

export function useCustomersQuery(
  request?: ListCustomersRequest,
  options?: { enabled?: boolean },
) {
  return useQuery({
    enabled: options?.enabled ?? true,
    queryKey: queryKeys.customers.list(request?.filters ?? {}),
    queryFn: () => customerService.listCustomers(request),
  })
}

export function useCustomerMetricsSummaryQuery() {
  return useQuery({
    queryKey: queryKeys.customers.metricsSummary,
    queryFn: () => customerService.getMetricsSummary(),
  })
}

export function useCustomerByIdQuery(customerId: string | null) {
  return useQuery({
    enabled: Boolean(customerId),
    queryKey: queryKeys.customers.detail(customerId),
    queryFn: () => customerService.getCustomer(customerId!),
  })
}

export function useCreateCustomerMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: CreateCustomerRequest) => customerService.createCustomer(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
      useToastStore.getState().pushToast({
        title: 'Cliente salvo',
        description: 'O cadastro ja pode ser usado no novo pedido.',
        variant: 'success',
      })
    },
  })
}

export function useUpdateCustomerMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: UpdateCustomerRequest) => customerService.updateCustomer(request),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(response.data.id) })
      useToastStore.getState().pushToast({
        title: 'Cliente atualizado',
        description: 'Nome, WhatsApp e endereco foram sincronizados.',
        variant: 'success',
      })
    },
  })
}

export function useCreateOrderMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: CreateOrderRequest) => orderService.createOrder(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dining.tables })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.snapshot({}) })
      useToastStore.getState().pushToast({
        title: 'Pedido criado',
        description: 'O pedido ja entrou no fluxo operacional.',
        variant: 'success',
      })
    },
  })
}

export function useCreatePublicOrderMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: CreatePublicOrderRequest) => orderService.createPublicOrder(request),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.snapshot({}) })
      useToastStore.getState().pushToast({
        title: 'Pedido enviado',
        description: `${response.data.number} entrou no Cain Delivery.`,
        variant: 'success',
      })
    },
  })
}

export function useUpdateOrderStatusMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: UpdateOrderStatusRequest) => orderService.updateOrderStatus(request),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(response.data.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.tracking(response.data.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.drivers.list })
      queryClient.invalidateQueries({ queryKey: queryKeys.drivers.locations })
      queryClient.invalidateQueries({ queryKey: ['drivers', 'route'] })
      queryClient.invalidateQueries({ queryKey: ['drivers', 'dispatch-candidates'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.snapshot({}) })
      useToastStore.getState().pushToast({
        title: 'Pedido atualizado',
        description: `${response.data.number} atualizado com sucesso.`,
        variant: 'success',
      })
    },
  })
}

export function useRepeatOrderMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (orderId: string) => orderService.repeatOrder({ orderId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.snapshot({}) })
      useToastStore.getState().pushToast({
        title: 'Pedido repetido',
        description: 'Uma nova cópia entrou em análise.',
        variant: 'success',
      })
    },
  })
}
