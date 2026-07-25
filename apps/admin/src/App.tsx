import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useTheme } from '@sparebolt/shared/use-theme';
import { ProtectedRoute } from '@/components/protected-route';
import { AdminPage } from '@/pages/admin';
import { LoginPage } from '@/pages/login';

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
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
