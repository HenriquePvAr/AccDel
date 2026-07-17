import type { LucideIcon } from 'lucide-react'
import {
  BookOpenText,
  Bot,
  ChartColumn,
  ChartNoAxesCombined,
  CookingPot,
  CreditCard,
  Eye,
  LayoutDashboard,
  Activity,
  MapPinned,
  Receipt,
  Printer,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Store,
  TicketPercent,
  Truck,
  Users,
  UtensilsCrossed,
} from 'lucide-react'
import type { AdminPermission } from '@/types'

export interface NavigationItem {
  label: string
  to: string
  icon: LucideIcon
  permission: AdminPermission
}

export interface NavigationGroup {
  label: string
  items: NavigationItem[]
}

export const navigationGroups: NavigationGroup[] = [
  {
    label: 'Loja',
    items: [
      { label: 'Visão geral', to: '/dashboard', icon: LayoutDashboard, permission: 'dashboard:view' },
      { label: 'Central de pedidos', to: '/orders', icon: Receipt, permission: 'orders:view' },
      { label: 'Novo pedido', to: '/orders/new', icon: ShoppingCart, permission: 'orders:create' },
      { label: 'Cozinha', to: '/kitchen', icon: CookingPot, permission: 'kitchen:view' },
      { label: 'Entrega', to: '/drivers/location', icon: MapPinned, permission: 'drivers:view' },
      { label: 'Salão e mesas', to: '/dining/tables', icon: UtensilsCrossed, permission: 'dining:view' },
      { label: 'Caixa', to: '/cash-register', icon: CreditCard, permission: 'cash:view' },
      { label: 'Atendimento', to: '/ai-attendant', icon: Bot, permission: 'ai_attendant:view' },
      { label: 'Impressão', to: '/settings/printing', icon: Printer, permission: 'printing:view' },
    ],
  },
  {
    label: 'Equipe e controle',
    items: [
      { label: 'Clientes', to: '/customers', icon: Users, permission: 'orders:create' },
      { label: 'Entregadores', to: '/drivers', icon: Truck, permission: 'drivers:view' },
      { label: 'Garçons', to: '/dining/waiters', icon: Users, permission: 'dining:view' },
      { label: 'Sistema', to: '/operations/readiness', icon: Activity, permission: 'dashboard:view' },
      { label: 'Histórico', to: '/history/orders', icon: ChartColumn, permission: 'history:view' },
      { label: 'Relatórios', to: '/reports', icon: ChartNoAxesCombined, permission: 'reports:view' },
    ],
  },
  {
    label: 'Cardápio',
    items: [
      { label: 'Produtos', to: '/catalog/products', icon: Store, permission: 'catalog:products:view' },
      { label: 'Categorias', to: '/catalog/categories', icon: BookOpenText, permission: 'catalog:categories:view' },
      { label: 'Promoções', to: '/catalog/promotions', icon: TicketPercent, permission: 'catalog:promotions:view' },
      { label: 'Cupons', to: '/catalog/coupons', icon: ShieldCheck, permission: 'catalog:coupons:view' },
      { label: 'Ver cardápio', to: '/catalog/preview', icon: Eye, permission: 'catalog:preview:view' },
    ],
  },
  {
    label: 'Ajustes',
    items: [
      { label: 'Loja', to: '/settings/store', icon: Settings2, permission: 'settings:store:view' },
      { label: 'Usuários', to: '/settings/users', icon: Users, permission: 'users:view' },
      { label: 'Delivery', to: '/settings/delivery', icon: Truck, permission: 'settings:delivery:view' },
      { label: 'Pagamentos', to: '/settings/payments', icon: CreditCard, permission: 'settings:preferences:view' },
      { label: 'Preferências', to: '/settings/preferences', icon: Settings2, permission: 'settings:preferences:view' },
    ],
  },
]

export function getAuthorizedNavigationGroups(permissions: AdminPermission[]) {
  return navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => permissions.includes(item.permission)),
    }))
    .filter((group) => group.items.length > 0)
}

export function getFirstAuthorizedPath(permissions: AdminPermission[]) {
  return getAuthorizedNavigationGroups(permissions)[0]?.items[0]?.to ?? '/login'
}
