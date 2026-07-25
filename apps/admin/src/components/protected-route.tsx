import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@sparebolt/shared/auth-store';

/**
 * Admin console guard. Only ADMIN users may enter; everyone else is bounced
 * to the login screen (which itself sends signed-in admins straight through).
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  if (!token || !user || user.role !== 'ADMIN') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
