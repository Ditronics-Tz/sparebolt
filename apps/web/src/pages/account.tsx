import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  ChevronRight,
  HelpCircle,
  Languages,
  LogOut,
  Moon,
  Package,
  Pencil,
  ShoppingCart,
  Store,
  Sun,
  Truck,
  User,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useCartStore } from '@/stores/cart-store';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';
import { EditProfileSheet } from '@/components/edit-profile-sheet';
import { SafeImage } from '@/components/safe-image';
import { cn } from '@/lib/utils';

const SUPPORT_EMAIL = 'support@ditronics.co.tz';
const COPYRIGHT_YEAR = new Date().getFullYear();

type MenuRow = {
  key: string;
  label: string;
  icon: typeof Package;
  to?: string;
  onClick?: () => void;
  trailing?: ReactNode;
  hint?: string;
};

function MenuSection({
  title,
  rows,
}: {
  title?: string;
  rows: MenuRow[];
}) {
  if (!rows.length) return null;
  return (
    <div className="space-y-2">
      {title && (
        <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
      )}
      <ul className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {rows.map(({ key, to, icon: Icon, label, onClick, trailing, hint }) => {
          const interactive = Boolean(to || onClick);
          const body = (
            <>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-foreground">
                  {label}
                </span>
                {hint && (
                  <span className="block text-xs text-muted-foreground">
                    {hint}
                  </span>
                )}
              </span>
              {trailing}
              {interactive && (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </>
          );

          const className = cn(
            'flex min-h-[52px] w-full items-center gap-3 px-4 py-3.5 text-left transition',
            interactive && 'hover:bg-muted',
          );

          return (
            <li key={key} className="border-b border-border last:border-0">
              {to ? (
                <Link to={to} className={className}>
                  {body}
                </Link>
              ) : onClick ? (
                <button
                  type="button"
                  onClick={onClick}
                  className={cn(className, 'cursor-pointer')}
                >
                  {body}
                </button>
              ) : (
                <div className={className}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AccountFooter() {
  return (
    <footer className="pt-2 pb-1 text-center">
      <p className="text-xs text-muted-foreground">
        © {COPYRIGHT_YEAR} Ditronics
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground/80">
        SpareBolt · All rights reserved
      </p>
    </footer>
  );
}

export function AccountPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const cartCount = useCartStore((s) => s.totalItems());
  const { isDark, toggleTheme } = useTheme();
  const [editOpen, setEditOpen] = useState(false);

  const toggleLang = () => {
    const next = i18n.language === 'en' ? 'sw' : 'en';
    void i18n.changeLanguage(next);
    localStorage.setItem('sb_locale', next);
  };

  if (!user) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-5 py-10">
        <div className="space-y-4 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <User className="h-7 w-7 text-muted-foreground" />
          </span>
          <div>
            <h1 className="font-display text-xl font-bold">{t('account')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('accountGuestHint')}
            </p>
          </div>
          <div className="flex justify-center gap-2">
            <Button asChild>
              <Link to="/auth/login">{t('login')}</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/auth/register">{t('register')}</Link>
            </Button>
          </div>
        </div>

        <MenuSection
          title={t('preferences')}
          rows={[
            {
              key: 'lang',
              label: t('language'),
              icon: Languages,
              onClick: toggleLang,
              hint: i18n.language === 'en' ? 'English' : 'Kiswahili',
              trailing: (
                <span className="rounded-lg bg-muted px-2 py-1 text-[11px] font-bold uppercase text-muted-foreground">
                  {i18n.language === 'en' ? 'EN' : 'SW'}
                </span>
              ),
            },
            {
              key: 'theme',
              label: t('appearance'),
              icon: isDark ? Moon : Sun,
              onClick: toggleTheme,
              hint: isDark ? t('darkMode') : t('lightMode'),
              trailing: isDark ? (
                <Moon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Sun className="h-4 w-4 text-muted-foreground" />
              ),
            },
          ]}
        />

        <MenuSection
          title={t('support')}
          rows={[
            {
              key: 'help',
              label: t('helpSupport'),
              icon: HelpCircle,
              onClick: () => {
                window.location.href = `mailto:${SUPPORT_EMAIL}?subject=SpareBolt%20Support`;
              },
              hint: SUPPORT_EMAIL,
            },
          ]}
        />

        <AccountFooter />
      </div>
    );
  }

  const initials =
    `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() ||
    'SB';

  const shopping: MenuRow[] = [];
  // Drivers / sellers can still shop; secondary to their work home
  if (user.role === 'DRIVER' || user.role === 'SELLER') {
    shopping.push({
      key: 'shop',
      label: t('shopAsCustomer'),
      icon: ShoppingCart,
      to: '/browse',
      hint: t('shopAsCustomerHint'),
    });
  }
  shopping.push(
    {
      key: 'orders',
      label: t('orders'),
      icon: Package,
      to: '/orders',
      hint: t('ordersHint'),
    },
    {
      key: 'cart',
      label: t('cart'),
      icon: ShoppingCart,
      to: '/cart',
      hint:
        cartCount > 0
          ? t('cartItems', { count: cartCount })
          : t('cartEmptyShort'),
      trailing:
        cartCount > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-signal px-1.5 text-[10px] font-bold text-steel-950">
            {cartCount}
          </span>
        ) : undefined,
    },
    {
      key: 'notifications',
      label: t('notifications'),
      icon: Bell,
      to: '/notifications',
      hint: t('notificationsHint'),
    },
  );

  const earn: MenuRow[] = [];
  if (user.role === 'SELLER' || user.role === 'ADMIN') {
    earn.push(
      {
        key: 'seller-dash',
        label: t('dashboard'),
        icon: Store,
        to: '/seller',
        hint: t('sellerDashHint'),
      },
      {
        key: 'listings',
        label: t('myListings'),
        icon: Package,
        to: '/seller/listings',
      },
    );
  } else {
    earn.push({
      key: 'become-seller',
      label: t('becomeSeller'),
      icon: Store,
      to: '/account/become-seller',
      hint: t('becomeSellerHint'),
    });
  }

  if (user.role === 'DRIVER' || user.role === 'ADMIN') {
    earn.push({
      key: 'driver',
      label: t('jobs'),
      icon: Truck,
      to: '/driver',
      hint: t('driverJobsHint'),
    });
  } else {
    earn.push({
      key: 'become-driver',
      label: t('becomeDriver'),
      icon: Truck,
      to: '/account/become-driver',
      hint: t('becomeDriverHint'),
    });
  }

  // The admin console is a separate app (apps/admin) with its own login,
  // so it is intentionally not linked from the customer account menu.

  const preferences: MenuRow[] = [
    {
      key: 'lang',
      label: t('language'),
      icon: Languages,
      onClick: toggleLang,
      hint: i18n.language === 'en' ? 'English' : 'Kiswahili',
      trailing: (
        <span className="rounded-lg bg-muted px-2 py-1 text-[11px] font-bold uppercase text-muted-foreground">
          {i18n.language === 'en' ? 'EN' : 'SW'}
        </span>
      ),
    },
    {
      key: 'theme',
      label: t('appearance'),
      icon: isDark ? Moon : Sun,
      onClick: toggleTheme,
      hint: isDark ? t('darkMode') : t('lightMode'),
    },
  ];

  const defaultAddr =
    user.addresses?.find((a) => a.isDefault) || user.addresses?.[0];
  const locationHint = defaultAddr
    ? [defaultAddr.area, defaultAddr.city, defaultAddr.region]
        .filter(Boolean)
        .join(', ')
    : undefined;

  const support: MenuRow[] = [
    {
      key: 'edit-profile',
      label: t('editProfile'),
      icon: Pencil,
      onClick: () => setEditOpen(true),
      hint: locationHint || t('personalDetails'),
    },
    {
      key: 'help',
      label: t('helpSupport'),
      icon: HelpCircle,
      onClick: () => {
        window.location.href = `mailto:${SUPPORT_EMAIL}?subject=SpareBolt%20Support`;
      },
      hint: SUPPORT_EMAIL,
    },
  ];

  return (
    <div className="mx-auto max-w-md space-y-5 md:max-w-3xl">
      {/* Profile card — avatar + role, name, phone (high contrast) */}
      <button
        type="button"
        onClick={() => setEditOpen(true)}
        className="w-full rounded-3xl border border-bolt-900/20 bg-bolt-800 p-5 text-left text-white shadow-md cursor-pointer dark:border-bolt-700/40 dark:bg-bolt-950"
      >
        <div className="flex items-center gap-4">
          <span
            className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/20 text-lg font-extrabold tracking-wide text-white ring-2 ring-white/30"
            aria-hidden
          >
            {user.avatarUrl ? (
              <SafeImage
                src={user.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-bolt-100">
              {user.role}
            </p>
            <h1 className="mt-0.5 font-display text-xl font-extrabold leading-snug text-white sm:text-2xl">
              {user.firstName} {user.lastName}
            </h1>
            {user.phone ? (
              <p className="mt-1.5 text-base font-medium text-white/95">
                {user.phone}
              </p>
            ) : (
              <p className="mt-1.5 text-sm font-medium text-white/70">
                {t('noContact')}
              </p>
            )}
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
            <Pencil className="h-4 w-4" />
          </span>
        </div>
      </button>

      {user.sellerProfile?.status === 'PENDING' && (
        <div className="panel-warning p-4 text-sm">
          <p className="font-bold">{t('sellerPendingTitle')}</p>
          <p className="mt-1 opacity-80">{t('sellerPendingBody')}</p>
        </div>
      )}
      {user.sellerProfile?.status === 'REJECTED' && (
        <div className="panel-danger p-4 text-sm">
          <p className="font-bold">{t('sellerRejectedTitle')}</p>
          <p className="mt-1 opacity-80">
            {user.sellerProfile.rejectionReason || t('contactSupport')}
          </p>
        </div>
      )}
      {user.driverProfile?.status === 'PENDING' && (
        <div className="panel-warning p-4 text-sm">
          <p className="font-bold">{t('driverPendingTitle')}</p>
          <p className="mt-1 opacity-80">{t('driverPendingBody')}</p>
        </div>
      )}
      {user.driverProfile?.status === 'REJECTED' && (
        <div className="panel-danger p-4 text-sm">
          <p className="font-bold">{t('driverRejectedTitle')}</p>
          <p className="mt-1 opacity-80">
            {user.driverProfile.rejectionReason || t('contactSupport')}
          </p>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <MenuSection title={t('shopping')} rows={shopping} />
        <MenuSection title={t('earnWithUs')} rows={earn} />
        <MenuSection title={t('preferences')} rows={preferences} />
        <MenuSection title={t('support')} rows={support} />
      </div>

      <Button
        variant="secondary"
        className="w-full md:max-w-xs"
        onClick={() => {
          logout();
          void navigate('/');
        }}
      >
        <LogOut className="h-4 w-4" />
        {t('logout')}
      </Button>

      <AccountFooter />

      <EditProfileSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        user={user}
      />
    </div>
  );
}

export { BecomeSellerPage } from '@/pages/become-seller';
export { BecomeDriverPage } from '@/pages/become-driver';
