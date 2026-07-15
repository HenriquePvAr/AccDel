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
    label: 'Operacao',
    items: [
      { label: 'Central de pedidos', to: '/orders', icon: Receipt, permission: 'orders:view' },
      { label: 'Novo pedido', to: '/orders/new', icon: ShoppingCart, permission: 'orders:create' },
      { label: 'Cozinha', to: '/kitchen', icon: CookingPot, permission: 'kitchen:view' },
      { label: 'Expedicao', to: '/drivers/location', icon: MapPinned, permission: 'drivers:view' },
      { label: 'Salao e mesas', to: '/dining/tables', icon: UtensilsCrossed, permission: 'dining:view' },
      { label: 'Caixa', to: '/cash-register', icon: CreditCard, permission: 'cash:view' },
    ],
  },
  {
    label: 'Relacionamento',
    items: [
      { label: 'Clientes', to: '/customers', icon: Users, permission: 'orders:create' },
      { label: 'Atendente IA', to: '/ai-attendant', icon: Bot, permission: 'ai_attendant:view' },
    ],
  },
  {
    label: 'Equipe e entrega',
    items: [
      { label: 'Entregadores', to: '/drivers', icon: Truck, permission: 'drivers:view' },
      { label: 'Garcons', to: '/dining/waiters', icon: Users, permission: 'dining:view' },
    ],
  },
  {
    label: 'Catalogo',
    items: [
      { label: 'Produtos', to: '/catalog/products', icon: Store, permission: 'catalog:products:view' },
      { label: 'Categorias', to: '/catalog/categories', icon: BookOpenText, permission: 'catalog:categories:view' },
      { label: 'Promocoes', to: '/catalog/promotions', icon: TicketPercent, permission: 'catalog:promotions:view' },
      { label: 'Cupons', to: '/catalog/coupons', icon: ShieldCheck, permission: 'catalog:coupons:view' },
      { label: 'Previa do cardapio', to: '/catalog/preview', icon: Eye, permission: 'catalog:preview:view' },
    ],
  },
  {
    label: 'Gestao',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, permission: 'dashboard:view' },
      { label: 'Historico', to: '/history/orders', icon: ChartColumn, permission: 'history:view' },
      { label: 'Relatorios', to: '/reports', icon: ChartNoAxesCombined, permission: 'reports:view' },
    ],
  },
  {
    label: 'Administracao',
    items: [
      { label: 'Loja', to: '/settings/store', icon: Settings2, permission: 'settings:store:view' },
      { label: 'Usuarios', to: '/settings/users', icon: Users, permission: 'users:view' },
      { label: 'Delivery', to: '/settings/delivery', icon: Truck, permission: 'settings:delivery:view' },
      { label: 'Pagamentos', to: '/settings/payments', icon: CreditCard, permission: 'settings:preferences:view' },
      { label: 'Impressao', to: '/settings/printing', icon: Printer, permission: 'printing:view' },
      { label: 'Preferencias', to: '/settings/preferences', icon: Settings2, permission: 'settings:preferences:view' },
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
