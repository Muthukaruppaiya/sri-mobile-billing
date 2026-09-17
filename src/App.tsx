import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { SplashPage } from './pages/Splash'
import { DashboardPage } from './pages/Dashboard'
import { BillingPage } from './pages/Billing'
import { ServicePage } from './pages/Service'
import { StockPage } from './pages/Stock'
import { HistoryPage } from './pages/History'
import { CustomersPage } from './pages/Customers'

export default function App() {
  return (
    <BrowserRouter basename="/sri-mobile-billing">
      <Routes>
        <Route path="/" element={<SplashPage />} />
        <Route path="/app" element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="service" element={<ServicePage />} />
          <Route path="stock" element={<StockPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="customers" element={<CustomersPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
