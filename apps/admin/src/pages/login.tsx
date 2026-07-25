import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Bolt } from 'lucide-react';
import { useAuthStore } from '@sparebolt/shared/auth-store';
import { Button } from '@sparebolt/shared/ui/button';
import { Input } from '@sparebolt/shared/ui/input';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const loading = useAuthStore((s) => s.loading);
  const user = useAuthStore((s) => s.user);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Already signed in as an admin? Skip the form.
  useEffect(() => {
    if (user?.role === 'ADMIN') {
      void navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ email: email.trim(), password });
      const signedIn = useAuthStore.getState().user;
      if (signedIn?.role === 'ADMIN') {
        toast.success('Welcome back');
        void navigate('/', { replace: true });
      } else {
        logout();
        toast.error('This account does not have admin access.');
      }
    } catch {
      toast.error('Invalid email or password');
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bolt-600 text-white">
            <Bolt className="h-6 w-6 fill-current" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-foreground">
            SpareBolt Admin
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to the operations console
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="text-sm font-semibold text-foreground"
            >
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@sparebolt.tz"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="text-sm font-semibold text-foreground"
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <Button type="submit" className="w-full" loading={loading}>
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Admin access only. All activity is logged.
        </p>
      </div>
    </div>
  );
}
