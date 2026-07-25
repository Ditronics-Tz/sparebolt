import type { User } from '@/lib/api';

/**
 * Where to land after login / register, by role.
 * Prefer an explicit deep-link (`from`) when the user was blocked mid-flow.
 */
export function postAuthPath(
  user: User | null | undefined,
  from?: string | null,
): string {
  if (from && from !== '/' && from !== '/auth/login' && from !== '/auth/register') {
    return from;
  }
  if (!user) return '/';
  // Admins use the standalone admin app (apps/admin); in the customer app
  // they simply land on the storefront home.
  if (user.role === 'ADMIN') return '/';
  if (user.role === 'DRIVER') return '/driver';
  if (user.role === 'SELLER') return '/seller';
  return '/';
}

export function isDriverRole(role?: string | null) {
  return role === 'DRIVER';
}

export function isSellerRole(role?: string | null) {
  return role === 'SELLER';
}
