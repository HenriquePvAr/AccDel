import { Suspense, lazy, type ReactNode } from 'react'
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom'

import { AdminLayout } from '@/app/layout/AdminLayout'
import { getFirstAuthorizedPath } from '@/app/navigation'
import { RequireAuth, RequirePermission } from '@/app/router/ProtectedRoute'
import { RouteErrorBoundary } from '@/app/router/RouteErrorBoundary'
import { useAuthStore } from '@/stores/auth-store'
import type { AdminPermission } from '@/types'

const LoginPage = lazy(() => import('@/pages/LoginPage').then((module) => ({ default: module.LoginPage })))
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const OrdersPage = lazy(() => import('@/pages/OrdersPage').then((module) => ({ default: module.OrdersPage })))
const OrderDetailsPage = lazy(() =>
  import('@/pages/OrderDetailsPage').then((module) => ({ default: module.OrderDetailsPage })),
)
const NewOrderPage = lazy(() => import('@/pages/NewOrderPage').then((module) => ({ default: module.NewOrderPage })))
const CustomersPage = lazy(() => import('@/pages/CustomersPage').then((module) => ({ default: module.CustomersPage })))
const DiningTablesPage = lazy(() =>
  import('@/pages/DiningTablesPage').then((module) => ({ default: module.DiningTablesPage })),
)
const WaitersPage = lazy(() => import('@/pages/WaitersPage').then((module) => ({ default: module.WaitersPage })))
const KitchenPage = lazy(() => import('@/pages/KitchenPage').then((module) => ({ default: module.KitchenPage })))
const DriversPage = lazy(() => import('@/pages/DriversPage').then((module) => ({ default: module.DriversPage })))
const DriverLocationPage = lazy(() =>
  import('@/pages/DriverLocationPage').then((module) => ({ default: module.DriverLocationPage })),
)
const CategoriesPage = lazy(() =>
  import('@/pages/CategoriesPage').then((module) => ({ default: module.CategoriesPage })),
)
const ProductsPage = lazy(() => import('@/pages/ProductsPage').then((module) => ({ default: module.ProductsPage })))
const PromotionsPage = lazy(() =>
  import('@/pages/PromotionsPage').then((module) => ({ default: module.PromotionsPage })),
)
const CouponsPage = lazy(() => import('@/pages/CouponsPage').then((module) => ({ default: module.CouponsPage })))
const CatalogPreviewPage = lazy(() =>
  import('@/pages/CatalogPreviewPage').then((module) => ({ default: module.CatalogPreviewPage })),
)
const CashRegisterPage = lazy(() =>
  import('@/pages/CashRegisterPage').then((module) => ({ default: module.CashRegisterPage })),
)
const OrderHistoryPage = lazy(() =>
  import('@/pages/OrderHistoryPage').then((module) => ({ default: module.OrderHistoryPage })),
)
const ReportsPage = lazy(() => import('@/pages/ReportsPage').then((module) => ({ default: module.ReportsPage })))
const StoreSettingsPage = lazy(() =>
  import('@/pages/StoreSettingsPage').then((module) => ({ default: module.StoreSettingsPage })),
)
const UsersSettingsPage = lazy(() =>
  import('@/pages/UsersSettingsPage').then((module) => ({ default: module.UsersSettingsPage })),
)
const DeliverySettingsPage = lazy(() =>
  import('@/pages/DeliverySettingsPage').then((module) => ({ default: module.DeliverySettingsPage })),
)
const PaymentSettingsPage = lazy(() =>
  import('@/pages/PaymentSettingsPage').then((module) => ({ default: module.PaymentSettingsPage })),
)
const PreferencesSettingsPage = lazy(() =>
  import('@/pages/PreferencesSettingsPage').then((module) => ({ default: module.PreferencesSettingsPage })),
)
const AiAttendantPage = lazy(() =>
  import('@/pages/AiAttendantPage').then((module) => ({ default: module.AiAttendantPage })),
)

function withSuspense(node: ReactNode) {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-10 lg:px-8">
          <div className="panel-surface flex min-h-[220px] items-center justify-center text-sm font-medium text-muted-foreground">
            Carregando módulo do admin...
          </div>
        </div>
      }
    >
      {node}
    </Suspense>
  )
}

function protectedPage(permission: AdminPermission, node: ReactNode) {
  return <RequirePermission permission={permission}>{withSuspense(node)}</RequirePermission>
}

function DefaultAdminRedirect() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? [])
  return <Navigate to={getFirstAuthorizedPath(permissions)} replace />
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: withSuspense(<LoginPage />),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AdminLayout />
      </RequireAuth>
    ),
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <DefaultAdminRedirect /> },
      { path: 'dashboard', element: protectedPage('dashboard:view', <DashboardPage />) },
      { path: 'ai-attendant', element: protectedPage('ai_attendant:view', <AiAttendantPage />) },
      { path: 'orders', element: protectedPage('orders:view', <OrdersPage />) },
      { path: 'orders/new', element: protectedPage('orders:create', <NewOrderPage />) },
      { path: 'customers', element: protectedPage('orders:create', <CustomersPage />) },
      { path: 'orders/:orderId', element: protectedPage('orders:view', <OrderDetailsPage />) },
      { path: 'dining/tables', element: protectedPage('dining:view', <DiningTablesPage />) },
      { path: 'dining/waiters', element: protectedPage('dining:view', <WaitersPage />) },
      { path: 'kitchen', element: protectedPage('kitchen:view', <KitchenPage />) },
      { path: 'drivers', element: protectedPage('drivers:view', <DriversPage />) },
      { path: 'drivers/location', element: protectedPage('drivers:view', <DriverLocationPage />) },
      { path: 'catalog/categories', element: protectedPage('catalog:categories:view', <CategoriesPage />) },
      { path: 'catalog/products', element: protectedPage('catalog:products:view', <ProductsPage />) },
      { path: 'catalog/promotions', element: protectedPage('catalog:promotions:view', <PromotionsPage />) },
      { path: 'catalog/coupons', element: protectedPage('catalog:coupons:view', <CouponsPage />) },
      { path: 'catalog/preview', element: protectedPage('catalog:preview:view', <CatalogPreviewPage />) },
      { path: 'cash-register', element: protectedPage('cash:view', <CashRegisterPage />) },
      { path: 'history/orders', element: protectedPage('history:view', <OrderHistoryPage />) },
      { path: 'reports', element: protectedPage('reports:view', <ReportsPage />) },
      { path: 'settings/store', element: protectedPage('settings:store:view', <StoreSettingsPage />) },
      { path: 'settings/users', element: protectedPage('users:view', <UsersSettingsPage />) },
      { path: 'settings/delivery', element: protectedPage('settings:delivery:view', <DeliverySettingsPage />) },
      { path: 'settings/payments', element: protectedPage('settings:preferences:view', <PaymentSettingsPage />) },
      { path: 'settings/preferences', element: protectedPage('settings:preferences:view', <PreferencesSettingsPage />) },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
