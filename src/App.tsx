import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './lib/auth'
import { SettingsProvider } from './lib/settings'
import { AppShell } from './components/AppShell'
import { LoginPage } from './pages/Login'
import { DashboardPage } from './pages/Dashboard'
import { PurchasePage } from './pages/Purchase'
import { StockPage } from './pages/Stock'
import { SuppliersPage } from './pages/Suppliers'
import { EmployeesPage } from './pages/Employees'
import { HistoryPage } from './pages/History'
import { ReportsPage } from './pages/Reports'
import { SalePage } from './pages/Sale'
import { SaleHistoryPage } from './pages/SaleHistory'
import { ServicePage } from './pages/Service'
import { ServiceDeliveryPage } from './pages/ServiceDelivery'
import { CustomersPage } from './pages/Customers'
import { SettingsPage } from './pages/Settings'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

const basename = import.meta.env.PROD ? '/sri-mobile-billing' : '/'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SettingsProvider>
          <BrowserRouter basename={basename}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/app" element={<AppShell />}>
                <Route index element={<DashboardPage />} />

                <Route path="purchase" element={<Navigate to="/app/purchase/new" replace />} />
                <Route path="purchase/:mode" element={<PurchasePage />} />
                <Route path="history" element={<HistoryPage />} />
                <Route path="suppliers" element={<SuppliersPage />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="reports" element={<ReportsPage />} />

                <Route path="stock" element={<Navigate to="/app/stock/products" replace />} />
                <Route path="stock/:tab" element={<StockPage />} />

                <Route path="employees" element={<EmployeesPage />} />
                <Route path="settings" element={<SettingsPage />} />

                <Route path="billing" element={<Navigate to="/app/billing/new" replace />} />
                <Route path="billing/history" element={<SaleHistoryPage />} />
                <Route path="billing/:kind" element={<SalePage />} />

                <Route path="service" element={<Navigate to="/app/service/booking" replace />} />
                <Route path="service/booking" element={<ServicePage />} />
                <Route path="service/delivery" element={<ServiceDeliveryPage />} />
                <Route
                  path="service/:kind"
                  element={<Navigate to="/app/service/booking" replace />}
                />
              </Route>
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>
        </SettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
