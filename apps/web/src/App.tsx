import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { useTheme } from '@/hooks/use-theme';
import { HomePage } from '@/pages/home';
import { BrowsePage } from '@/pages/browse';
import { ListingDetailPage } from '@/pages/listing-detail';
import { CartPage } from '@/pages/cart';
import { CheckoutPage } from '@/pages/checkout';
import { LoginPage, RegisterPage } from '@/pages/auth';
import { OrdersPage, OrderDetailPage } from '@/pages/orders';
import {
  AccountPage,
  BecomeDriverPage,
  BecomeSellerPage,
} from '@/pages/account';
import {
  NewListingPage,
  SellerDashboardPage,
  SellerListingsPage,
  SellerSalesPage,
} from '@/pages/seller';
import { SellerPromosPage } from '@/pages/seller-promos';
import { DriverPage } from '@/pages/driver';
import { NotificationsPage } from '@/pages/notifications';

function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster position="top-center" richColors closeButton theme={theme} />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemedToaster />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="browse" element={<BrowsePage />} />
          <Route path="parts/:id" element={<ListingDetailPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="auth/login" element={<LoginPage />} />
          <Route path="auth/register" element={<RegisterPage />} />
          <Route
            path="checkout"
            element={
              <ProtectedRoute>
                <CheckoutPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="orders"
            element={
              <ProtectedRoute>
                <OrdersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="orders/:id"
            element={
              <ProtectedRoute>
                <OrderDetailPage />
              </ProtectedRoute>
            }
          />
          <Route path="account" element={<AccountPage />} />
          <Route
            path="account/become-seller"
            element={
              <ProtectedRoute>
                <BecomeSellerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="account/become-driver"
            element={
              <ProtectedRoute>
                <BecomeDriverPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="seller"
            element={
              <ProtectedRoute roles={['SELLER']}>
                <SellerDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="seller/listings"
            element={
              <ProtectedRoute roles={['SELLER']}>
                <SellerListingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="seller/listings/new"
            element={
              <ProtectedRoute roles={['SELLER']}>
                <NewListingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="seller/sales"
            element={
              <ProtectedRoute roles={['SELLER']}>
                <SellerSalesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="seller/promos"
            element={
              <ProtectedRoute roles={['SELLER']}>
                <SellerPromosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="driver"
            element={
              <ProtectedRoute roles={['DRIVER']}>
                <DriverPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
