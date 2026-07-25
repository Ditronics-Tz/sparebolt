import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  AddTeamIcon,
  DashboardSquare01Icon,
} from '@hugeicons/core-free-icons';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Activity,
  BadgeCheck,
  Banknote,
  BarChart3,
  Bell,
  Bolt,
  Building2,
  Car,
  CheckCircle2,
  ChevronRight,
  ChevronUp,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileCheck,
  Globe2,
  IdCard,
  LayoutDashboard,
  LogOut,
  MapPin,
  Moon,
  Package,
  PanelLeft,
  PanelLeftClose,
  Percent,
  Phone,
  Printer,
  Scale,
  Save,
  Search,
  Shield,
  Store,
  Sun,
  Truck,
  Trash2,
  User,
  UserX,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { api } from '@sparebolt/shared/api';
import { cn, formatRelative, formatTZS } from '@sparebolt/shared/utils';
import { Button } from '@sparebolt/shared/ui/button';
import { Badge } from '@sparebolt/shared/ui/badge';
import { Input } from '@sparebolt/shared/ui/input';
import { SafeImage } from '@sparebolt/shared/safe-image';
import { useAuthStore } from '@sparebolt/shared/auth-store';
import { useTheme } from '@sparebolt/shared/use-theme';
import { registerAdminWebPush } from '@/lib/push';

type TabId =
  | 'overview'
  | 'users'
  | 'analytics'
  | 'reports'
  | 'sellers'
  | 'drivers'
  | 'disputes'
  | 'escrows';

type Stats = {
  users: number;
  sellers: number;
  drivers: number;
  pendingSellers: number;
  pendingDrivers: number;
  listings: number;
  orders: number;
  escrowHeld: number;
  escrowCount: number;
  openDisputes: number;
  needsAttention: number;
};

type EscrowRow = {
  id: string;
  amount: string | number;
  platformFee?: string | number;
  sellerAmount?: string | number;
  status: string;
  heldAt?: string;
  releasedAt?: string | null;
  refundedAt?: string | null;
  notes?: string | null;
  order: {
    orderNumber: string;
    status?: string;
    total?: string | number;
    createdAt?: string;
    customer?: {
      firstName: string;
      lastName: string;
      phone?: string | null;
      email?: string | null;
    };
    items?: {
      title: string;
      quantity: number;
      lineTotal: string | number;
      sellerId?: string;
    }[];
    dispute?: { id: string; status: string; reason?: string } | null;
  };
};

type SellerRow = {
  id: string;
  status: string;
  businessName: string;
  businessType?: string | null;
  legalFullName?: string | null;
  nationalId?: string | null;
  nationalIdFrontUrl?: string | null;
  nationalIdBackUrl?: string | null;
  selfieUrl?: string | null;
  shopExteriorUrl?: string | null;
  shopInteriorUrl?: string | null;
  city: string;
  region?: string | null;
  addressStreet?: string | null;
  addressWard?: string | null;
  payoutMethod?: string | null;
  payoutAccountName?: string | null;
  payoutPhone?: string | null;
  createdAt?: string;
  rejectionReason?: string | null;
  user: {
    firstName: string;
    lastName: string;
    phone?: string | null;
    email?: string | null;
  };
};

type DriverRow = {
  id: string;
  status: string;
  legalFullName?: string | null;
  nationalId?: string | null;
  nationalIdFrontUrl?: string | null;
  nationalIdBackUrl?: string | null;
  selfieUrl?: string | null;
  vehiclePlate: string;
  vehicleType: string;
  vehicleMake?: string | null;
  vehiclePhotoSideUrl?: string | null;
  vehiclePhotoRearUrl?: string | null;
  vehiclePhotoWithDriverUrl?: string | null;
  licenseNumber: string;
  licensePhotoUrl?: string | null;
  city: string;
  addressStreet?: string | null;
  payoutAccountName?: string | null;
  payoutPhone?: string | null;
  createdAt?: string;
  rejectionReason?: string | null;
  user: {
    firstName: string;
    lastName: string;
    phone?: string | null;
    email?: string | null;
  };
};

type AdminUserRow = {
  id: string;
  email?: string | null;
  phone?: string | null;
  firstName: string;
  lastName: string;
  role: 'CUSTOMER' | 'SELLER' | 'DRIVER' | 'ADMIN';
  isActive: boolean;
  createdAt?: string;
  sellerProfile?: { id: string; status: string; businessName?: string } | null;
  driverProfile?: {
    id: string;
    status: string;
    vehiclePlate?: string;
  } | null;
};

type VisitRange = '7d' | '30d' | '90d';

type VisitAnalytics = {
  range: VisitRange;
  totalVisits: number;
  uniqueVisitors: number;
  trends: {
    date: string;
    visits: number;
    uniqueVisitors: number;
  }[];
  topPaths: { path: string; visits: number }[];
  topLocations: {
    country: string;
    region?: string | null;
    city?: string | null;
    visits: number;
  }[];
  recentVisits: {
    id: string;
    path: string;
    referrer?: string | null;
    country?: string | null;
    region?: string | null;
    city?: string | null;
    createdAt: string;
    user?: {
      id: string;
      firstName: string;
      lastName: string;
      role: string;
    } | null;
  }[];
};

type ReportPeriod = 'day' | 'week' | 'month' | 'quarter' | 'halfYear' | 'year';
type CustomReportType = 'orders' | 'payments' | 'escrows' | 'disputes' | 'deliveries' | 'visits';
type CustomReportConfig = {
  types: CustomReportType[];
  startDate: string;
  endDate: string;
  filters?: { search?: string; status?: string; method?: string };
  recordIds?: Partial<Record<CustomReportType, string[]>>;
};
type CustomRecord = { id: string; date: string; label: string; status: string; amount: number | null; detail: string; related?: { customer: string; sellers: string[]; driver: string | null } };
type CustomReportPreview = { startDate: string; endDate: string; sections: { type: CustomReportType; total: number; amount: number; records: CustomRecord[] }[] };
type ReportMetric = { value: number; previous: number; change: number | null };
type AdminReport = {
  period: {
    type: ReportPeriod;
    label: string;
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
  };
  summary: Record<string, ReportMetric>;
  snapshots: { users: number; sellers: number; drivers: number; activeListings: number };
  sales: {
    orderStatuses: { status: string; count: number }[];
    paymentMethods: { method: string; count: number }[];
    sellerSales: { seller: string; sales: number }[];
  };
  operations: { deliveries: number; delivered: number; failed: number; completionRate: number };
  trust: { escrowHeld: number; escrowReleased: number; escrowRefunded: number; disputesOpened: number; disputesResolved: number };
  series: { date: string; revenue: number; orders: number; users: number; visits: number }[];
};

function OverviewIcon({ className }: { className?: string }) {
  return (
    <HugeiconsIcon
      icon={DashboardSquare01Icon}
      size={24}
      color="currentColor"
      strokeWidth={1.5}
      className={className}
    />
  );
}

function SellersIcon({ className }: { className?: string }) {
  return (
    <HugeiconsIcon
      icon={AddTeamIcon}
      size={24}
      color="currentColor"
      strokeWidth={1.5}
      className={className}
    />
  );
}

type NavIcon = typeof LayoutDashboard | typeof OverviewIcon;

const NAV: {
  id: TabId;
  label: string;
  icon: NavIcon;
}[] = [
  { id: 'overview', label: 'Overview', icon: OverviewIcon },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'reports', label: 'Reports', icon: FileCheck },
  { id: 'sellers', label: 'Sellers', icon: SellersIcon },
  { id: 'drivers', label: 'Drivers', icon: Truck },
  { id: 'disputes', label: 'Disputes', icon: Scale },
  { id: 'escrows', label: 'Escrows', icon: Wallet },
];

function statusBadge(status: string) {
  const v =
    status === 'APPROVED' || status === 'COMPLETED' || status === 'CLOSED'
      ? 'success'
      : status === 'PENDING' || status === 'OPEN' || status === 'HELD'
        ? 'warning'
        : status === 'REJECTED' || status === 'SUSPENDED'
          ? 'danger'
          : 'muted';
  return <Badge variant={v as 'success'}>{status.replace(/_/g, ' ')}</Badge>;
}

function UserAvatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  const sizeCls =
    size === 'sm' ? 'h-8 w-8 text-[10px]' : size === 'lg' ? 'h-11 w-11 text-sm' : 'h-9 w-9 text-xs';
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-bolt-700 font-bold text-white',
        sizeCls,
        className,
      )}
      aria-hidden
    >
      {initials || 'A'}
    </span>
  );
}

export function AdminPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { isDark, toggleTheme } = useTheme();
  const [tab, setTab] = useState<TabId>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // desktop collapse
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const sidebarMenuRef = useRef<HTMLDivElement>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentOrders, setRecentOrders] = useState<
    {
      id: string;
      orderNumber: string;
      status: string;
      total: string | number;
      createdAt?: string;
      customer: { firstName: string; lastName: string };
    }[]
  >([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [analytics, setAnalytics] = useState<VisitAnalytics | null>(null);
  const [analyticsRange, setAnalyticsRange] = useState<VisitRange>('30d');
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [report, setReport] = useState<AdminReport | null>(null);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('month');
  const [reportAnchor, setReportAnchor] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportLoading, setReportLoading] = useState(false);
  const [sellers, setSellers] = useState<SellerRow[]>([]);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [disputes, setDisputes] = useState<
    {
      id: string;
      reason: string;
      description?: string;
      status: string;
      createdAt?: string;
      order: { orderNumber: string; id: string };
    }[]
  >([]);
  const [escrows, setEscrows] = useState<EscrowRow[]>([]);

  const [review, setReview] = useState<
    | { type: 'seller'; data: SellerRow }
    | { type: 'driver'; data: DriverRow }
    | null
  >(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [dash, usersRes, sellersRes, driversRes, disputesRes, escrowsRes] =
        await Promise.all([
          api.get('/admin/dashboard'),
          api.get('/admin/users'),
          api.get('/admin/sellers'),
          api.get('/admin/drivers'),
          api.get('/admin/disputes'),
          api.get('/admin/escrows'),
        ]);
      setStats(dash.data.stats);
      setRecentOrders(dash.data.recentOrders ?? []);
      setUsers(usersRes.data ?? []);
      setSellers(sellersRes.data ?? []);
      setDrivers(driversRes.data ?? []);
      setDisputes(disputesRes.data ?? []);
      setEscrows(escrowsRes.data ?? []);
    } catch {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const loadAnalytics = async (range: VisitRange) => {
    setAnalyticsLoading(true);
    try {
      const res = await api.get('/admin/analytics/visits', {
        params: { range },
      });
      setAnalytics(res.data);
    } catch {
      toast.error('Failed to load visit analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    void loadAnalytics(analyticsRange);
  }, [analyticsRange]);

  useEffect(() => {
    if (tab !== 'reports') return;
    setReportLoading(true);
    void api
      .get('/admin/reports', { params: { period: reportPeriod, anchor: reportAnchor } })
      .then((res) => setReport(res.data))
      .catch(() => toast.error('Failed to load report'))
      .finally(() => setReportLoading(false));
  }, [tab, reportPeriod, reportAnchor]);

  // Enable FCM web push for this admin (prompts once, then no-ops).
  useEffect(() => {
    void registerAdminWebPush();
  }, []);

  // Close user menus on outside click
  useEffect(() => {
    if (!userMenuOpen && !headerMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        userMenuOpen &&
        sidebarMenuRef.current &&
        !sidebarMenuRef.current.contains(t)
      ) {
        setUserMenuOpen(false);
      }
      if (
        headerMenuOpen &&
        headerMenuRef.current &&
        !headerMenuRef.current.contains(t)
      ) {
        setHeaderMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [userMenuOpen, headerMenuOpen]);

  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim() || 'Admin'
    : 'Admin';
  const displayEmail = user?.email || user?.phone || 'Administrator';

  const handleLogout = () => {
    logout();
    toast.success('Signed out');
    void navigate("/login");
  };

  const pendingSellers = stats?.pendingSellers ?? 0;
  const pendingDrivers = stats?.pendingDrivers ?? 0;
  const openDisputes = stats?.openDisputes ?? 0;
  const disputesPage = useFixedPagination(disputes);

  const badgeFor = (id: TabId) => {
    if (id === 'sellers' && pendingSellers) return pendingSellers;
    if (id === 'drivers' && pendingDrivers) return pendingDrivers;
    if (id === 'disputes' && openDisputes) return openDisputes;
    return 0;
  };

  const setStatus = async (
    type: 'seller' | 'driver',
    id: string,
    status: 'APPROVED' | 'REJECTED' | 'SUSPENDED',
    reason?: string,
  ) => {
    setActionLoading(true);
    try {
      const path =
        type === 'seller'
          ? `/admin/sellers/${id}/status`
          : `/admin/drivers/${id}/status`;
      await api.patch(path, { status, reason });
      toast.success(`${type === 'seller' ? 'Seller' : 'Driver'} ${status.toLowerCase()}`);
      setReview(null);
      await loadAll();
    } catch {
      toast.error('Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const resolveDispute = async (
    id: string,
    resolution: 'customer' | 'seller',
  ) => {
    try {
      await api.post(`/admin/disputes/${id}/resolve`, { resolution });
      toast.success('Dispute resolved');
      await loadAll();
    } catch {
      toast.error('Failed to resolve');
    }
  };

  const setUserActive = async (row: AdminUserRow, isActive: boolean) => {
    setActionLoading(true);
    try {
      await api.patch(`/admin/users/${row.id}/active`, { isActive });
      toast.success(`${row.firstName} ${isActive ? 'activated' : 'deactivated'}`);
      await loadAll();
    } catch {
      toast.error('Failed to update user');
    } finally {
      setActionLoading(false);
    }
  };

  const goTab = (id: TabId) => {
    setTab(id);
    setSidebarOpen(false);
  };

  const isDesktopSidebar =
    typeof window !== 'undefined' &&
    window.matchMedia('(min-width: 1024px)').matches;
  // Icon: closed panel when collapsed (desktop) or closed drawer (mobile)
  const sidebarIsCollapsed = isDesktopSidebar
    ? sidebarCollapsed
    : !sidebarOpen;

  const toggleSidebar = () => {
    // Mobile: open/close drawer. Desktop: collapse/expand.
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 1024px)').matches
    ) {
      setSidebarCollapsed((c) => !c);
      setUserMenuOpen(false);
    } else {
      setSidebarOpen((o) => !o);
    }
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden cursor-pointer admin-backdrop-in"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-dvh max-h-dvh flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-out lg:sticky lg:top-0 lg:translate-x-0',
          sidebarCollapsed ? 'lg:w-[4.5rem]' : 'lg:w-64',
          'w-64',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div
          className={cn(
            'flex h-16 items-center border-b border-sidebar-border',
            sidebarCollapsed ? 'justify-center px-2' : 'gap-2 px-5',
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bolt-600">
            <Bolt className="h-5 w-5 fill-current" />
          </span>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <p className="font-display text-sm font-extrabold tracking-tight">
                SpareBolt
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
                Admin console
              </p>
            </div>
          )}
        </div>

        <nav className={cn('min-h-0 flex-1 overflow-hidden space-y-1 p-3', sidebarCollapsed && 'px-2')}>
          {NAV.map(({ id, label, icon: Icon }) => {
            const count = badgeFor(id);
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                title={label}
                onClick={() => goTab(id)}
                className={cn(
                  'relative flex w-full items-center rounded-xl text-sm font-semibold transition-all duration-200 ease-out cursor-pointer min-h-[44px]',
                  sidebarCollapsed
                    ? 'justify-center px-0 py-2.5'
                    : 'gap-3 px-3 py-2.5',
                  active
                    ? 'bg-bolt-600 text-white shadow-sm shadow-bolt-900/20'
                    : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground',
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-transform duration-200',
                    active && 'scale-110',
                  )}
                />
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1 text-left">{label}</span>
                    {count > 0 && (
                      <span
                        className={cn(
                          'admin-badge-pop flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                          active
                            ? 'bg-card text-bolt-800 dark:text-bolt-200'
                            : 'bg-amber-signal text-steel-950',
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </>
                )}
                {sidebarCollapsed && count > 0 && (
                  <span className="absolute ml-6 mt-[-1.25rem] h-2 w-2 rounded-full bg-amber-signal" />
                )}
              </button>
            );
          })}
        </nav>

        <div
          className={cn(
            'relative border-t border-sidebar-border p-3',
            sidebarCollapsed && 'px-2',
          )}
          ref={sidebarMenuRef}
        >
          {(stats?.needsAttention ?? 0) > 0 && !sidebarCollapsed && (
            <div className="mb-2 rounded-xl bg-amber-500/15 px-3 py-2 text-xs text-amber-100">
              <p className="font-bold text-amber-signal">
                {stats?.needsAttention} need attention
              </p>
            </div>
          )}

          {userMenuOpen && (
            <UserPopupMenu
              className={cn(
                'absolute z-50',
                sidebarCollapsed
                  ? 'bottom-3 left-[calc(100%+0.5rem)] w-56'
                  : 'bottom-[calc(100%-0.25rem)] left-3 right-3',
              )}
              onClose={() => setUserMenuOpen(false)}
              onLogout={handleLogout}
            />
          )}

          <button
            type="button"
            onClick={() => {
              setUserMenuOpen((o) => !o);
              setHeaderMenuOpen(false);
            }}
            className={cn(
              'flex w-full items-center rounded-xl text-left transition cursor-pointer hover:bg-sidebar-accent',
              sidebarCollapsed ? 'justify-center p-2' : 'gap-3 px-2.5 py-2.5',
              userMenuOpen && 'bg-sidebar-accent',
            )}
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            title={displayName}
          >
            <UserAvatar name={displayName} />
            {!sidebarCollapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-sidebar-foreground">
                    {displayName}
                  </p>
                  <p className="truncate text-[11px] text-sidebar-muted">
                    {displayEmail}
                  </p>
                </div>
                <ChevronUp
                  className={cn(
                    'h-4 w-4 shrink-0 text-sidebar-muted transition',
                    !userMenuOpen && 'rotate-180',
                  )}
                />
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card/95 px-4 backdrop-blur-md lg:px-6">
          {/* Collapse / expand sidebar */}
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center text-muted-foreground transition-all duration-200 hover:text-foreground hover:scale-105 active:scale-95 cursor-pointer"
            onClick={toggleSidebar}
            aria-label={
              sidebarIsCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
            }
            title="Toggle sidebar"
          >
            {sidebarIsCollapsed ? (
              <PanelLeft className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>

          {/* Active menu title only */}
          <h1
            key={tab}
            className="min-w-0 flex-1 truncate font-display text-lg font-extrabold text-foreground admin-fade-in lg:text-xl"
          >
            {NAV.find((n) => n.id === tab)?.label}
          </h1>

          {/* Right: plain icons (no container borders) */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            <AdminNotifications />

            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center text-muted-foreground transition-all duration-200 hover:text-foreground hover:scale-105 active:scale-95 cursor-pointer"
              aria-label={
                isDark ? 'Switch to light mode' : 'Switch to dark mode'
              }
              onClick={toggleTheme}
            >
              {isDark ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>

            <div className="relative" ref={headerMenuRef}>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center cursor-pointer"
                aria-label="Account menu"
                aria-haspopup="menu"
                aria-expanded={headerMenuOpen}
                onClick={() => {
                  setHeaderMenuOpen((o) => !o);
                  setUserMenuOpen(false);
                }}
              >
                <UserAvatar name={displayName} size="sm" />
              </button>
              {headerMenuOpen && (
                <UserPopupMenu
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56"
                  onClose={() => setHeaderMenuOpen(false)}
                  onLogout={handleLogout}
                />
              )}
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
          {loading && !stats ? (
            <div className="admin-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-2xl bg-muted"
                />
              ))}
            </div>
          ) : (
            <div key={tab} className="admin-fade-up">
              {tab === 'overview' && stats && (
                <Overview
                  stats={stats}
                  recentOrders={recentOrders}
                  onJump={goTab}
                />
              )}

              {tab === 'users' && (
                <UsersPanel
                  users={users}
                  loading={actionLoading}
                  onSetActive={(row, isActive) =>
                    setConfirm({
                      title: `${isActive ? 'Activate' : 'Deactivate'} user?`,
                      message: `${row.firstName} ${row.lastName} will ${
                        isActive
                          ? 'regain access to the system'
                          : 'lose access to sign in and use protected features'
                      }.`,
                      confirmLabel: isActive ? 'Activate' : 'Deactivate',
                      tone: isActive ? 'success' : 'danger',
                      onConfirm: () => setUserActive(row, isActive),
                    })
                  }
                />
              )}

              {tab === 'analytics' && (
                <VisitAnalyticsPanel
                  data={analytics}
                  range={analyticsRange}
                  loading={analyticsLoading}
                  onRange={setAnalyticsRange}
                />
              )}

              {tab === 'reports' && (
                <ReportsPanel
                  report={report}
                  period={reportPeriod}
                  anchor={reportAnchor}
                  loading={reportLoading}
                  onPeriod={setReportPeriod}
                  onAnchor={setReportAnchor}
                />
              )}

              {tab === 'sellers' && (
                <SellersPanel
                  sellers={sellers}
                  onReview={(s) => setReview({ type: 'seller', data: s })}
                />
              )}

              {tab === 'drivers' && (
                <DriversPanel
                  drivers={drivers}
                  onReview={(d) => setReview({ type: 'driver', data: d })}
                />
              )}

              {tab === 'disputes' && (
                <section className="space-y-4">
                  <ul className="admin-stagger space-y-3">
                    {disputesPage.pageItems.map((d) => (
                      <li
                        key={d.id}
                        className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-mono text-xs text-muted-foreground">
                              {d.order.orderNumber}
                            </p>
                            <p className="mt-1 font-semibold text-foreground">
                              {d.reason}
                            </p>
                            {d.description && (
                              <p className="mt-1 text-sm text-muted-foreground">
                                {d.description}
                              </p>
                            )}
                            {d.createdAt && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Opened {formatRelative(d.createdAt)}
                              </p>
                            )}
                          </div>
                          {statusBadge(d.status)}
                        </div>
                        {d.status === 'OPEN' && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                setConfirm({
                                  title: 'Refund the customer?',
                                  message: `Resolves the dispute on order ${d.order.orderNumber} in the customer's favour and refunds the held escrow. This cannot be undone.`,
                                  confirmLabel: 'Refund customer',
                                  tone: 'danger',
                                  onConfirm: () =>
                                    resolveDispute(d.id, 'customer'),
                                })
                              }
                            >
                              Refund customer
                            </Button>
                            <Button
                              size="sm"
                              onClick={() =>
                                setConfirm({
                                  title: 'Release funds to seller?',
                                  message: `Resolves the dispute on order ${d.order.orderNumber} in the seller's favour and releases the held escrow to the seller. This cannot be undone.`,
                                  confirmLabel: 'Release to seller',
                                  tone: 'warning',
                                  onConfirm: () => resolveDispute(d.id, 'seller'),
                                })
                              }
                            >
                              Release to seller
                            </Button>
                          </div>
                        )}
                      </li>
                    ))}
                    {!disputes.length && (
                      <Empty title="No disputes" body="All clear for now." />
                    )}
                  </ul>
                  <PaginationControls
                    page={disputesPage.page}
                    totalPages={disputesPage.totalPages}
                    totalItems={disputes.length}
                    onPage={disputesPage.setPage}
                  />
                </section>
              )}

              {tab === 'escrows' && <EscrowPanel escrows={escrows} />}
            </div>
          )}
        </main>
      </div>

      {/* Review drawer */}
      {review && (
        <ReviewDrawer
          review={review}
          loading={actionLoading}
          onClose={() => setReview(null)}
          onApprove={() =>
            setConfirm({
              title: `Approve ${review.type}?`,
              message: `${reviewLabel(review)} will be approved and gain ${
                review.type === 'seller'
                  ? 'access to list and sell parts'
                  : 'access to accept delivery jobs'
              }.`,
              confirmLabel: 'Approve',
              tone: 'success',
              onConfirm: () =>
                setStatus(review.type, review.data.id, 'APPROVED'),
            })
          }
          onReject={() =>
            setConfirm({
              title: 'Reject application?',
              message: `${reviewLabel(review)} will be rejected. The reason below is shown to the applicant, who can correct and resubmit.`,
              confirmLabel: 'Confirm reject',
              tone: 'danger',
              requireReason: true,
              reasonLabel: 'Reason (shown to applicant)',
              reasonPlaceholder: 'Documents incomplete, ID mismatch…',
              onConfirm: (reason) =>
                setStatus(
                  review.type,
                  review.data.id,
                  'REJECTED',
                  reason || 'Documents incomplete or invalid',
                ),
            })
          }
          onSuspend={() =>
            setConfirm({
              title: 'Suspend account?',
              message: `${reviewLabel(review)} will be suspended and lose access until reinstated.`,
              confirmLabel: 'Suspend',
              tone: 'danger',
              onConfirm: () =>
                setStatus(review.type, review.data.id, 'SUSPENDED'),
            })
          }
        />
      )}

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

function Overview({
  stats,
  recentOrders,
  onJump,
}: {
  stats: Stats;
  recentOrders: {
    id: string;
    orderNumber: string;
    status: string;
    total: string | number;
    createdAt?: string;
    customer: { firstName: string; lastName: string };
  }[];
  onJump: (t: TabId) => void;
}) {
  const kpis = [
    {
      label: 'Users',
      value: stats.users,
      icon: Users,
      tone: 'bg-info-soft text-info-soft-foreground',
      onClick: () => onJump('users'),
    },
    {
      label: 'Approved sellers',
      value: stats.sellers,
      icon: Store,
      tone: 'bg-accent-soft text-accent-soft-foreground',
      sub: stats.pendingSellers
        ? `${stats.pendingSellers} pending`
        : undefined,
      onClick: () => onJump('sellers'),
    },
    {
      label: 'Approved drivers',
      value: stats.drivers,
      icon: Truck,
      tone: 'bg-violet-soft text-violet-soft-foreground',
      sub: stats.pendingDrivers
        ? `${stats.pendingDrivers} pending`
        : undefined,
      onClick: () => onJump('drivers'),
    },
    {
      label: 'Active listings',
      value: stats.listings,
      icon: Package,
      tone: 'bg-success-soft text-success-soft-foreground',
    },
    {
      label: 'Orders',
      value: stats.orders,
      icon: CheckCircle2,
      tone: 'bg-background text-foreground/90',
    },
    {
      label: 'Escrow held',
      value: formatTZS(stats.escrowHeld),
      icon: Wallet,
      tone: 'bg-warning-soft text-warning-soft-foreground',
      sub: `${stats.escrowCount} open`,
      onClick: () => onJump('escrows'),
    },
    {
      label: 'Open disputes',
      value: stats.openDisputes,
      icon: AlertTriangle,
      tone: 'bg-danger-soft text-danger-soft-foreground',
      onClick: () => onJump('disputes'),
    },
    {
      label: 'Needs attention',
      value: stats.needsAttention,
      icon: Shield,
      tone: 'bg-amber-signal/20 text-amber-900 dark:text-amber-200',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="admin-stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          const Comp = k.onClick ? 'button' : 'div';
          return (
            <Comp
              key={k.label}
              type={k.onClick ? 'button' : undefined}
              onClick={k.onClick}
              className={cn(
                'rounded-2xl border border-border bg-card p-4 text-left shadow-sm',
                k.onClick &&
                  'cursor-pointer transition-all duration-200 hover:border-bolt-300 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {k.label}
                </p>
                <span
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl',
                    k.tone,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 font-display text-2xl font-extrabold tabular-nums text-foreground">
                {k.value}
              </p>
              {k.sub && (
                <p className="mt-1 text-xs font-semibold text-amber-700">
                  {k.sub}
                </p>
              )}
            </Comp>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-display font-bold text-foreground">
            Recent orders
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-border/60 text-xs font-bold uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Order</th>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentOrders.map((o) => (
                <tr key={o.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-mono text-xs">
                    {o.orderNumber}
                  </td>
                  <td className="px-4 py-3">
                    {o.customer.firstName} {o.customer.lastName}
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums">
                    {formatTZS(o.total)}
                  </td>
                  <td className="px-4 py-3">{statusBadge(o.status)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {o.createdAt ? formatRelative(o.createdAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!recentOrders.length && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No orders yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 10;

function useFixedPagination<T>(items: T[]) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [items]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(
    () => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [items, page],
  );

  return { page, setPage, totalPages, pageItems };
}

function PaginationControls({
  page,
  totalPages,
  totalItems,
  onPage,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onPage: (page: number) => void;
}) {
  if (totalItems <= PAGE_SIZE) return null;
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, totalItems);

  return (
    <div className="flex flex-col gap-2 border-t border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-semibold text-muted-foreground">
        Showing {start}-{end} of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <span className="min-w-16 text-center text-xs font-bold text-muted-foreground">
          {page} / {totalPages}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

// ─── Users and visit analytics ──────────────────────────────────────────────

type UserRoleFilter = 'ALL' | AdminUserRow['role'];
type UserStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

function userFullName(row: AdminUserRow) {
  return `${row.firstName} ${row.lastName}`.trim() || 'Unnamed user';
}

function UsersPanel({
  users,
  loading,
  onSetActive,
}: {
  users: AdminUserRow[];
  loading: boolean;
  onSetActive: (row: AdminUserRow, isActive: boolean) => void;
}) {
  const [role, setRole] = useState<UserRoleFilter>('ALL');
  const [status, setStatus] = useState<UserStatusFilter>('ALL');
  const [search, setSearch] = useState('');

  const roleCounts = useMemo(() => {
    const counts: Record<UserRoleFilter, number> = {
      ALL: users.length,
      CUSTOMER: 0,
      SELLER: 0,
      DRIVER: 0,
      ADMIN: 0,
    };
    for (const row of users) counts[row.role] += 1;
    return counts;
  }, [users]);

  const activeCount = useMemo(
    () => users.filter((row) => row.isActive).length,
    [users],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((row) => {
      if (role !== 'ALL' && row.role !== role) return false;
      if (status === 'ACTIVE' && !row.isActive) return false;
      if (status === 'INACTIVE' && row.isActive) return false;
      if (!q) return true;
      const hay = [
        userFullName(row),
        row.email,
        row.phone,
        row.role,
        row.sellerProfile?.businessName,
        row.sellerProfile?.status,
        row.driverProfile?.vehiclePlate,
        row.driverProfile?.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [users, role, status, search]);
  const usersPage = useFixedPagination(filtered);

  const roles: { id: UserRoleFilter; label: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'CUSTOMER', label: 'Customers' },
    { id: 'SELLER', label: 'Sellers' },
    { id: 'DRIVER', label: 'Drivers' },
    { id: 'ADMIN', label: 'Admins' },
  ];
  const statuses: { id: UserStatusFilter; label: string; count: number }[] = [
    { id: 'ALL', label: 'All status', count: users.length },
    { id: 'ACTIVE', label: 'Active', count: activeCount },
    { id: 'INACTIVE', label: 'Inactive', count: users.length - activeCount },
  ];

  return (
    <section className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {roles.slice(1).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setRole(item.id)}
            className={cn(
              'rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all duration-200 hover:shadow-md cursor-pointer',
              role === item.id && 'border-bolt-400 ring-2 ring-bolt-500/20',
            )}
          >
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {item.label}
            </p>
            <p className="mt-2 font-display text-2xl font-extrabold tabular-nums">
              {roleCounts[item.id]}
            </p>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, email, role, profile…"
            className="pl-10"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
          {roles.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRole(item.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold cursor-pointer min-h-[36px] transition',
                role === item.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
              <span className="rounded-md bg-background/60 px-1.5 py-0.5 text-[10px] tabular-nums">
                {roleCounts[item.id]}
              </span>
            </button>
          ))}
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
          {statuses.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStatus(item.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold cursor-pointer min-h-[36px] transition',
                status === item.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
              <span className="rounded-md bg-background/60 px-1.5 py-0.5 text-[10px] tabular-nums">
                {item.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-border bg-muted/70 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Profiles</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {usersPage.pageItems.map((row) => (
                <tr key={row.id} className="hover:bg-muted/60">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={userFullName(row)} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">
                          {userFullName(row)}
                        </p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {row.id}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground/90">
                      {row.phone || 'No phone'}
                    </p>
                    <p>{row.email || 'No email'}</p>
                  </td>
                  <td className="px-4 py-3.5">{statusBadge(row.role)}</td>
                  <td className="px-4 py-3.5">
                    <UserProfileBadges row={row} />
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge variant={row.isActive ? 'success' : 'danger'}>
                      {row.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-muted-foreground">
                    {row.createdAt ? formatRelative(row.createdAt) : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Button
                      size="sm"
                      variant={row.isActive ? 'secondary' : 'default'}
                      disabled={loading}
                      onClick={() => onSetActive(row, !row.isActive)}
                    >
                      {row.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <div className="py-16 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 font-semibold text-foreground">
              No matching users
            </p>
          </div>
        )}
        <PaginationControls
          page={usersPage.page}
          totalPages={usersPage.totalPages}
          totalItems={filtered.length}
          onPage={usersPage.setPage}
        />
      </div>

      <ul className="space-y-3 lg:hidden">
        {usersPage.pageItems.map((row) => (
          <li
            key={row.id}
            className="rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <UserAvatar name={userFullName(row)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-foreground">
                      {userFullName(row)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.phone || row.email || 'No contact'}
                    </p>
                  </div>
                  <Badge variant={row.isActive ? 'success' : 'danger'}>
                    {row.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {statusBadge(row.role)}
                  <UserProfileBadges row={row} />
                </div>
                <Button
                  size="sm"
                  variant={row.isActive ? 'secondary' : 'default'}
                  className="mt-3 w-full"
                  disabled={loading}
                  onClick={() => onSetActive(row, !row.isActive)}
                >
                  {row.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </div>
          </li>
        ))}
        {!filtered.length && <Empty title="No matching users" body=" " />}
      </ul>
      <div className="lg:hidden">
        <PaginationControls
          page={usersPage.page}
          totalPages={usersPage.totalPages}
          totalItems={filtered.length}
          onPage={usersPage.setPage}
        />
      </div>
    </section>
  );
}

function UserProfileBadges({ row }: { row: AdminUserRow }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {row.sellerProfile && (
        <Badge variant="muted">Seller {row.sellerProfile.status}</Badge>
      )}
      {row.driverProfile && (
        <Badge variant="muted">Driver {row.driverProfile.status}</Badge>
      )}
      {!row.sellerProfile && !row.driverProfile && (
        <span className="text-xs text-muted-foreground">—</span>
      )}
    </div>
  );
}

function reportNumber(value: number) {
  return new Intl.NumberFormat('en-TZ').format(Math.round(value));
}

function reportChange(change: number | null) {
  if (change == null) return 'No prior data';
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}% vs previous`;
}

function ReportMetricCard({
  label,
  metric,
  money = false,
}: {
  label: string;
  metric?: ReportMetric;
  money?: boolean;
}) {
  const value = metric?.value ?? 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-xl font-extrabold tabular-nums text-foreground">
        {money ? formatTZS(value) : reportNumber(value)}
      </p>
      <p className={cn('mt-1 text-xs font-semibold', (metric?.change ?? 0) >= 0 ? 'text-success' : 'text-danger')}>
        {reportChange(metric?.change ?? null)}
      </p>
    </div>
  );
}

function ReportsPanel({
  report,
  period,
  anchor,
  loading,
  onPeriod,
  onAnchor,
}: {
  report: AdminReport | null;
  period: ReportPeriod;
  anchor: string;
  loading: boolean;
  onPeriod: (period: ReportPeriod) => void;
  onAnchor: (anchor: string) => void;
}) {
  const [mode, setMode] = useState<'standard' | 'custom'>('standard');

  if (mode === 'custom') {
    return (
      <section className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Business intelligence</p>
            <h2 className="font-display text-xl font-extrabold text-foreground lg:text-2xl">Custom report</h2>
          </div>
          <ReportModeToggle mode={mode} onMode={setMode} />
        </div>
        <CustomReportBuilder />
      </section>
    );
  }

  const downloadCsv = async () => {
    try {
      const response = await api.get('/admin/reports/export', {
        params: { format: 'csv', period, anchor },
        responseType: 'text',
      });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `sparebolt-report-${anchor}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to export CSV');
    }
  };

  const printPdf = () => {
    if (!report) return;
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const left = 40;
    const pageBottom = 800;
    let y = 48;
    const nextLine = (height = 18) => {
      if (y + height > pageBottom) {
        pdf.addPage();
        y = 48;
      }
      const current = y;
      y += height;
      return current;
    };
    const titleCase = (value: string) => value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());

    pdf.setTextColor(23, 32, 51);
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('SpareBolt admin report', left, nextLine(24));
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(93, 104, 123);
    pdf.text(`${report.period.label} | ${report.period.start.slice(0, 10)} to ${report.period.end.slice(0, 10)}`, left, nextLine(18));

    y += 12;
    pdf.setTextColor(23, 32, 51);
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Summary', left, nextLine(20));
    pdf.setFontSize(9);
    pdf.setFillColor(241, 244, 248);
    pdf.rect(left, nextLine(18) - 12, 515, 18, 'F');
    pdf.setTextColor(23, 32, 51);
    pdf.text('Metric', left + 6, y - 6);
    pdf.text('Value', left + 260, y - 6);
    pdf.text('Previous', left + 350, y - 6);
    pdf.text('Change', left + 445, y - 6);
    for (const [name, metric] of Object.entries(report.summary)) {
      const rowY = nextLine(17);
      pdf.setFont('helvetica', 'normal');
      pdf.text(titleCase(name), left + 6, rowY);
      pdf.text(String(Math.round(metric.value)), left + 260, rowY);
      pdf.text(String(Math.round(metric.previous)), left + 350, rowY);
      pdf.text(metric.change == null ? 'n/a' : `${metric.change.toFixed(1)}%`, left + 445, rowY);
      pdf.setDrawColor(220, 225, 232);
      pdf.line(left, rowY + 5, left + 515, rowY + 5);
    }

    y += 14;
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Trend', left, nextLine(20));
    pdf.setFontSize(9);
    const trendHeaderY = nextLine(18);
    pdf.setFillColor(241, 244, 248);
    pdf.rect(left, trendHeaderY - 12, 515, 18, 'F');
    pdf.text('Date', left + 6, trendHeaderY - 6);
    pdf.text('Revenue', left + 150, trendHeaderY - 6);
    pdf.text('Orders', left + 270, trendHeaderY - 6);
    pdf.text('New users', left + 360, trendHeaderY - 6);
    pdf.text('Visits', left + 455, trendHeaderY - 6);
    for (const row of report.series) {
      const rowY = nextLine(17);
      pdf.setFont('helvetica', 'normal');
      pdf.text(row.date, left + 6, rowY);
      pdf.text(String(Math.round(row.revenue)), left + 150, rowY);
      pdf.text(String(row.orders), left + 270, rowY);
      pdf.text(String(row.users), left + 360, rowY);
      pdf.text(String(row.visits), left + 455, rowY);
      pdf.setDrawColor(220, 225, 232);
      pdf.line(left, rowY + 5, left + 515, rowY + 5);
    }
    pdf.save(`sparebolt-report-${anchor}.pdf`);
  };

  const periodOptions: { value: ReportPeriod; label: string }[] = [
    { value: 'day', label: 'Daily' },
    { value: 'week', label: 'Weekly' },
    { value: 'month', label: 'Monthly' },
    { value: 'quarter', label: 'Quarterly' },
    { value: 'halfYear', label: 'Half-yearly' },
    { value: 'year', label: 'Annual' },
  ];
  const metric = (key: string) => report?.summary[key];

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Business intelligence</p>
          <h2 className="font-display text-xl font-extrabold text-foreground lg:text-2xl">Reports</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Compare marketplace performance across calendar periods. Financial values use completed payments.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <ReportModeToggle mode={mode} onMode={setMode} />
          <select
            value={period}
            onChange={(event) => onPeriod(event.target.value as ReportPeriod)}
            className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-bolt-500/30"
            aria-label="Report period"
          >
            {periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <input
            type="date"
            value={anchor}
            onChange={(event) => onAnchor(event.target.value)}
            className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-bolt-500/30"
            aria-label="Report date"
          />
          <Button size="sm" variant="secondary" onClick={downloadCsv} disabled={!report || loading}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button size="sm" variant="secondary" onClick={printPdf} disabled={!report || loading}>
            <Printer className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {loading && !report ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : report ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="font-bold text-foreground">{report.period.label}</p>
            <p className="text-muted-foreground">Compared with the previous equivalent period</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ReportMetricCard label="Completed revenue" metric={metric('revenue')} money />
            <ReportMetricCard label="Orders" metric={metric('orders')} />
            <ReportMetricCard label="Average order" metric={metric('averageOrderValue')} money />
            <ReportMetricCard label="Platform fees" metric={metric('platformFees')} money />
            <ReportMetricCard label="Seller payouts" metric={metric('sellerPayouts')} money />
            <ReportMetricCard label="Refunds" metric={metric('refunds')} money />
            <ReportMetricCard label="Visits" metric={metric('visits')} />
            <ReportMetricCard label="New users" metric={metric('newUsers')} />
          </div>

          <div className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h3 className="font-display font-bold">Performance trend</h3>
              <p className="text-xs font-semibold text-muted-foreground">Revenue, orders, users, and visits</p>
            </div>
            <div className="h-80 p-3 sm:p-5">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={report.series} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }} minTickGap={24} />
                  <YAxis yAxisId="count" tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }} allowDecimals={false} />
                  <YAxis yAxisId="money" orientation="right" tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                  <Tooltip contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }} />
                  <Line yAxisId="money" type="monotone" dataKey="revenue" name="Revenue" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line yAxisId="count" type="monotone" dataKey="orders" name="Orders" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line yAxisId="count" type="monotone" dataKey="users" name="New users" stroke="#38bdf8" strokeWidth={2} dot={false} />
                  <Line yAxisId="count" type="monotone" dataKey="visits" name="Visits" stroke="#a78bfa" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <ReportSection title="Marketplace snapshots">
              <ReportRow label="Total users" value={reportNumber(report.snapshots.users)} />
              <ReportRow label="Approved sellers" value={reportNumber(report.snapshots.sellers)} />
              <ReportRow label="Approved drivers" value={reportNumber(report.snapshots.drivers)} />
              <ReportRow label="Active listings" value={reportNumber(report.snapshots.activeListings)} />
            </ReportSection>
            <ReportSection title="Delivery operations">
              <ReportRow label="Deliveries" value={reportNumber(report.operations.deliveries)} />
              <ReportRow label="Delivered" value={reportNumber(report.operations.delivered)} />
              <ReportRow label="Failed" value={reportNumber(report.operations.failed)} />
              <ReportRow label="Completion rate" value={`${report.operations.completionRate.toFixed(1)}%`} />
            </ReportSection>
            <ReportSection title="Trust and escrow">
              <ReportRow label="Funds held" value={formatTZS(report.trust.escrowHeld)} />
              <ReportRow label="Released to sellers" value={formatTZS(report.trust.escrowReleased)} />
              <ReportRow label="Refunded to buyers" value={formatTZS(report.trust.escrowRefunded)} />
              <ReportRow label="Disputes opened / resolved" value={`${report.trust.disputesOpened} / ${report.trust.disputesResolved}`} />
            </ReportSection>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <ReportSection title="Orders by status">
              {report.sales.orderStatuses.length ? report.sales.orderStatuses.map((row) => <ReportRow key={row.status} label={row.status.replace(/_/g, ' ')} value={reportNumber(row.count)} />) : <Empty title="No orders in this period" body="" />}
            </ReportSection>
            <ReportSection title="Completed payment methods">
              {report.sales.paymentMethods.length ? report.sales.paymentMethods.map((row) => <ReportRow key={row.method} label={row.method.replace(/_/g, ' ')} value={reportNumber(row.count)} />) : <Empty title="No completed payments" body="" />}
            </ReportSection>
          </div>

          <ReportSection title="Top sellers by completed sales">
            {report.sales.sellerSales.length ? report.sales.sellerSales.map((row) => <ReportRow key={row.seller} label={row.seller} value={formatTZS(row.sales)} />) : <Empty title="No seller sales in this period" body="" />}
          </ReportSection>
        </>
      ) : <Empty title="No report available" body="Choose a reporting period to load the report." />}
    </section>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-3 font-display font-bold">{title}</h3>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function ReportRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 py-2 text-sm"><span className="text-muted-foreground">{label}</span><strong className="text-right font-semibold text-foreground">{value}</strong></div>;
}

function ReportModeToggle({
  mode,
  onMode,
}: {
  mode: 'standard' | 'custom';
  onMode: (mode: 'standard' | 'custom') => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {(['standard', 'custom'] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onMode(value)}
          className={cn(
            'rounded-md px-3 py-2 text-xs font-bold capitalize transition cursor-pointer',
            mode === value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {value === 'standard' ? 'Presets' : 'Custom'}
        </button>
      ))}
    </div>
  );
}

const CUSTOM_TYPE_LABELS: Record<CustomReportType, string> = {
  orders: 'Orders',
  payments: 'Payments',
  escrows: 'Escrows',
  disputes: 'Disputes',
  deliveries: 'Deliveries',
  visits: 'Visits',
};

const CUSTOM_STATUS_OPTIONS: Record<CustomReportType, string[]> = {
  orders: ['NOT_DELIVERED', 'PENDING_PAYMENT', 'PAID_ESCROW', 'AWAITING_DRIVER', 'DRIVER_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CONFIRMED', 'DISPUTED', 'REFUNDED', 'CANCELLED'],
  payments: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED'],
  escrows: ['HELD', 'RELEASED_TO_SELLER', 'REFUNDED_TO_CUSTOMER', 'PARTIAL_REFUND'],
  disputes: ['OPEN', 'UNDER_REVIEW', 'RESOLVED_CUSTOMER', 'RESOLVED_SELLER', 'CLOSED'],
  deliveries: ['REQUESTED', 'ACCEPTED', 'REJECTED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED'],
  visits: ['VISIT'],
};

const CUSTOM_METHOD_OPTIONS = ['mobile_money', 'card', 'bank'];

function CustomReportBuilder() {
  const today = new Date().toISOString().slice(0, 10);
  const [types, setTypes] = useState<CustomReportType[]>(['orders']);
  const [activeType, setActiveType] = useState<CustomReportType>('orders');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<CustomRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Partial<Record<CustomReportType, string[]>>>({});
  const [preview, setPreview] = useState<CustomReportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<{ id: string; name: string; config: CustomReportConfig }[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  const config: CustomReportConfig = {
    types,
    startDate,
    endDate,
    filters: { search, status, method },
    recordIds: selected,
  };
  const selectedForType = selected[activeType] ?? [];
  const totalPages = Math.max(1, Math.ceil(total / 10));

  const loadTemplates = async () => {
    try {
      const response = await api.get('/admin/report-templates');
      setTemplates(response.data ?? []);
    } catch {
      toast.error('Failed to load report templates');
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, []);

  useEffect(() => {
    setLoading(true);
    void api
      .get('/admin/reports/records', {
        params: {
          type: activeType,
          startDate,
          endDate,
          page,
          search: search || undefined,
          status: status || undefined,
          method: method || undefined,
        },
      })
      .then((response) => {
        setRecords(response.data.records ?? []);
        setTotal(response.data.total ?? 0);
      })
      .catch(() => toast.error('Failed to load report records'))
      .finally(() => setLoading(false));
  }, [activeType, startDate, endDate, page, search, status, method]);

  const toggleType = (type: CustomReportType) => {
    if (types.includes(type)) {
      if (types.length === 1) return;
      const next = types.filter((item) => item !== type);
      setTypes(next);
      if (activeType === type) setActiveType(next[0]);
    } else {
      setTypes([...types, type]);
      setActiveType(type);
    }
    setPage(1);
  };

  const toggleRecord = (id: string) => {
    const current = selected[activeType] ?? [];
    setSelected({
      ...selected,
      [activeType]: current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    });
  };

  const previewReport = async () => {
    try {
      const response = await api.post('/admin/reports/custom/preview', config);
      setPreview(response.data);
    } catch {
      toast.error('Failed to build custom report');
    }
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('Enter a template name');
      return;
    }
    try {
      if (editingTemplateId) {
        await api.patch(`/admin/report-templates/${editingTemplateId}`, { name: templateName.trim(), config });
      } else {
        await api.post('/admin/report-templates', { name: templateName.trim(), config });
      }
      setTemplateName('');
      setEditingTemplateId(null);
      await loadTemplates();
      toast.success('Report template saved');
    } catch {
      toast.error('Failed to save report template');
    }
  };

  const loadTemplate = (id: string) => {
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    setEditingTemplateId(template.id);
    setTemplateName(template.name);
    setTypes(template.config.types);
    setActiveType(template.config.types[0] ?? 'orders');
    setStartDate(template.config.startDate);
    setEndDate(template.config.endDate);
    setSearch(template.config.filters?.search ?? '');
    setStatus(template.config.filters?.status ?? '');
    setMethod(template.config.filters?.method ?? '');
    setSelected(template.config.recordIds ?? {});
    setPage(1);
  };

  const deleteTemplate = async (id: string) => {
    try {
      await api.post(`/admin/report-templates/${id}/delete`);
      await loadTemplates();
    } catch {
      toast.error('Failed to delete report template');
    }
  };

  const exportCsv = async () => {
    try {
      const response = await api.post('/admin/reports/custom/export', config, { responseType: 'text' });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `sparebolt-custom-report-${startDate}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to export custom report');
    }
  };

  const exportPdf = () => {
    if (!preview) return;
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 40;
    let y = 44;
    const ensureSpace = (height: number) => {
      if (y + height > pageHeight - 40) {
        pdf.addPage();
        y = 44;
      }
    };
    const addText = (value: string, x: number, width: number, size = 9, weight: 'normal' | 'bold' = 'normal') => {
      pdf.setFont('helvetica', weight);
      pdf.setFontSize(size);
      const lines = pdf.splitTextToSize(value || '-', width) as string[];
      ensureSpace(lines.length * (size + 4) + 4);
      pdf.text(lines, x, y);
      y += lines.length * (size + 4);
    };
    const addSectionHeading = (title: string) => {
      ensureSpace(34);
      pdf.setFillColor(240, 244, 248);
      pdf.roundedRect(margin, y - 16, pageWidth - margin * 2, 26, 4, 4, 'F');
      addText(title, margin + 10, pageWidth - margin * 2 - 20, 12, 'bold');
      y += 8;
    };
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('SpareBolt custom report', margin, y);
    y += 20;
    addText(`${startDate} to ${endDate}`, margin, pageWidth - margin * 2, 10);
    y += 8;
    for (const section of preview.sections) {
      addSectionHeading(`${CUSTOM_TYPE_LABELS[section.type]}  |  ${section.total} records  |  ${formatTZS(section.amount)}`);
      ensureSpace(22);
      for (const row of section.records) {
        const date = row.date.slice(0, 10);
        const amountValue = row.amount == null ? '-' : formatTZS(row.amount);
        const columns = `${date}    ${row.label}    ${row.status}    ${amountValue}`;
        addText(columns, margin, pageWidth - margin * 2, 9, 'bold');
        if (row.related) {
          addText(`Customer: ${row.related.customer}`, margin + 12, pageWidth - margin * 2 - 12, 9);
          addText(`Seller(s): ${row.related.sellers.join(', ') || 'None listed'}`, margin + 12, pageWidth - margin * 2 - 12, 9);
          addText(`Driver: ${row.related.driver || 'Not assigned'}`, margin + 12, pageWidth - margin * 2 - 12, 9);
        } else {
          addText(`Details: ${row.detail}`, margin + 12, pageWidth - margin * 2 - 12, 9);
        }
        ensureSpace(8);
        pdf.setDrawColor(220, 226, 232);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 10;
      }
    }
    pdf.save(`sparebolt-custom-report-${startDate}.pdf`);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div>
          <p className="text-sm font-bold text-foreground">1. Choose report sections</p>
          <p className="mt-1 text-xs text-muted-foreground">Select the kinds of records you want to appear together in one report.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CUSTOM_TYPE_LABELS) as CustomReportType[]).map((type) => (
            <button key={type} type="button" aria-pressed={types.includes(type)} onClick={() => toggleType(type)} className={cn('rounded-lg border px-3 py-2 text-xs font-bold cursor-pointer', types.includes(type) ? 'border-bolt-500 bg-bolt-500/10 text-bolt-700 dark:text-bolt-300' : 'border-border text-muted-foreground hover:text-foreground')}>{types.includes(type) ? 'Selected: ' : ''}{CUSTOM_TYPE_LABELS[type]}</button>
          ))}
        </div>
        <div className="border-t border-border pt-3">
          <p className="text-sm font-bold text-foreground">2. Set date and filters</p>
          <p className="mt-1 text-xs text-muted-foreground">These filters apply to the active section below. Use Orders with “Not delivered” to find incomplete deliveries.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs font-bold text-muted-foreground">Start date<input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground" /></label>
          <label className="text-xs font-bold text-muted-foreground">End date<input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setPage(1); }} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground" /></label>
          <label className="text-xs font-bold text-muted-foreground">Search<input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search" className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label>
          <label className="text-xs font-bold text-muted-foreground">Status<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground"><option value="">Any status</option>{CUSTOM_STATUS_OPTIONS[activeType].map((option) => <option key={option} value={option}>{option.replace(/_/g, ' ')}</option>)}</select></label>
          <label className="text-xs font-bold text-muted-foreground">Method<select value={method} disabled={activeType !== 'payments'} onChange={(event) => { setMethod(event.target.value); setPage(1); }} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-50"><option value="">{activeType === 'payments' ? 'Any method' : 'Payments only'}</option>{activeType === 'payments' && CUSTOM_METHOD_OPTIONS.map((option) => <option key={option} value={option}>{option.replace(/_/g, ' ')}</option>)}</select></label>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <select defaultValue="" onChange={(event) => loadTemplate(event.target.value)} className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground"><option value="">Load saved template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select>
          <input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Template name" className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground" />
          <Button size="sm" variant="secondary" onClick={saveTemplate}><Save className="h-4 w-4" /> {editingTemplateId ? 'Update' : 'Save'}</Button>
          <Button size="sm" onClick={previewReport}>Preview report</Button>
          <Button size="sm" variant="secondary" onClick={exportCsv}><Download className="h-4 w-4" /> CSV</Button>
          <Button size="sm" variant="secondary" onClick={exportPdf} disabled={!preview}><Printer className="h-4 w-4" /> PDF</Button>
        </div>
        {templates.length > 0 && <div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><span>Saved:</span>{templates.map((template) => <span key={template.id} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">{template.name}<button type="button" onClick={() => deleteTemplate(template.id)} aria-label={`Delete ${template.name}`} title="Delete template" className="cursor-pointer text-muted-foreground hover:text-danger"><Trash2 className="h-3 w-3" /></button></span>)}</div>}
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-bold text-foreground">3. Select records</p>
          <p className="mt-1 text-xs text-muted-foreground">Switch between selected sections, tick individual records, then preview the final report.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">{types.map((type) => <button key={type} type="button" onClick={() => { setActiveType(type); if (type !== 'payments') setMethod(''); setPage(1); }} className={cn('rounded-lg px-3 py-2 text-xs font-bold cursor-pointer', activeType === type ? 'bg-bolt-600 text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>{CUSTOM_TYPE_LABELS[type]} ({selected[type]?.length ?? 0} selected)</button>)}</div>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-border bg-muted/70 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><tr><th className="w-12 px-4 py-3">Select</th><th className="px-4 py-3">Record</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Details</th><th className="px-4 py-3">Date</th></tr></thead><tbody className="divide-y divide-border">{records.map((row) => <tr key={row.id} className="hover:bg-muted/50"><td className="px-4 py-3"><input type="checkbox" checked={selectedForType.includes(row.id)} onChange={() => toggleRecord(row.id)} aria-label={`Select ${row.label}`} /></td><td className="px-4 py-3 font-semibold">{row.label}</td><td className="px-4 py-3">{row.status}</td><td className="px-4 py-3">{row.amount == null ? '—' : formatTZS(row.amount)}</td><td className="max-w-[20rem] truncate px-4 py-3 text-muted-foreground">{row.detail}</td><td className="px-4 py-3 text-xs text-muted-foreground">{formatRelative(row.date)}</td></tr>)}</tbody></table>{!loading && !records.length && <p className="py-10 text-center text-sm text-muted-foreground">No matching records</p>}</div>
        <PaginationControls page={page} totalPages={totalPages} totalItems={total} onPage={setPage} />
      </div>

      {preview && <div className="space-y-4"><div><h3 className="font-display text-lg font-bold">Report preview</h3><p className="mt-1 text-xs text-muted-foreground">This is the layout that will be used for PDF and CSV export.</p></div>{preview.sections.map((section) => <ReportSection key={section.type} title={`${CUSTOM_TYPE_LABELS[section.type]} · ${section.total} records`}><ReportRow label="Total amount" value={formatTZS(section.amount)} /><div className="mt-2 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-border text-[10px] font-bold uppercase text-muted-foreground"><tr><th className="px-2 py-2">Date</th><th className="px-2 py-2">Record</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Amount</th><th className="px-2 py-2">Details</th></tr></thead><tbody className="divide-y divide-border">{section.records.slice(0, 10).map((row) => <tr key={row.id} className="align-top"><td className="whitespace-nowrap px-2 py-2">{row.date.slice(0, 10)}</td><td className="px-2 py-2 font-semibold">{row.label}</td><td className="whitespace-nowrap px-2 py-2">{row.status}</td><td className="whitespace-nowrap px-2 py-2">{row.amount == null ? '-' : formatTZS(row.amount)}</td><td className="px-2 py-2 text-muted-foreground">{row.related ? <div className="space-y-1"><div><span className="font-semibold text-foreground">Customer:</span> {row.related.customer}</div><div><span className="font-semibold text-foreground">Seller(s):</span> {row.related.sellers.join(', ') || 'None listed'}</div><div><span className="font-semibold text-foreground">Driver:</span> {row.related.driver || 'Not assigned'}</div></div> : row.detail}</td></tr>)}</tbody></table></div></ReportSection>)}</div>}
    </div>
  );
}

function VisitAnalyticsPanel({
  data,
  range,
  loading,
  onRange,
}: {
  data: VisitAnalytics | null;
  range: VisitRange;
  loading: boolean;
  onRange: (range: VisitRange) => void;
}) {
  const ranges: { id: VisitRange; label: string }[] = [
    { id: '7d', label: '7 days' },
    { id: '30d', label: '30 days' },
    { id: '90d', label: '90 days' },
  ];
  const topLocation = data?.topLocations[0];
  const topPath = data?.topPaths[0];
  const maxLocationVisits = Math.max(
    1,
    ...(data?.topLocations.map((row) => row.visits) ?? [1]),
  );
  const maxPathVisits = Math.max(
    1,
    ...(data?.topPaths.map((row) => row.visits) ?? [1]),
  );
  const recentVisits = data?.recentVisits ?? [];
  const recentVisitsPage = useFixedPagination(recentVisits);

  return (
    <section className="space-y-5">
      <div className="flex justify-end">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
          {ranges.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onRange(item.id)}
              className={cn(
                'inline-flex shrink-0 items-center rounded-lg px-3 py-2 text-xs font-bold cursor-pointer min-h-[36px] transition',
                range === item.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AnalyticsKpi
          label="Total visits"
          value={data?.totalVisits ?? 0}
          icon={Activity}
          loading={loading}
        />
        <AnalyticsKpi
          label="Unique visitors"
          value={data?.uniqueVisitors ?? 0}
          icon={Users}
          loading={loading}
        />
        <AnalyticsKpi
          label="Top location"
          value={topLocation ? locationLabel(topLocation) : '—'}
          icon={Globe2}
          loading={loading}
        />
        <AnalyticsKpi
          label="Top page"
          value={topPath?.path ?? '—'}
          icon={ExternalLink}
          loading={loading}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h3 className="font-display font-bold">Visit trend</h3>
          <p className="text-xs font-semibold text-muted-foreground">
            Daily visits
          </p>
        </div>
        <VisitTrendChart rows={data?.trends ?? []} loading={loading} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-display font-bold">Locations</h3>
          </div>
          <div className="space-y-3 p-4">
            {data?.topLocations.map((row) => (
              <div key={locationLabel(row)} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <p className="min-w-0 truncate font-semibold">
                    {locationLabel(row)}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {row.visits}
                  </p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-bolt-600"
                    style={{
                      width: `${Math.max(4, (row.visits / maxLocationVisits) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            {!data?.topLocations.length && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No visits recorded for this range
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-display font-bold">Pages</h3>
          </div>
          <div className="space-y-3 p-4">
            {data?.topPaths.map((row) => (
              <div key={row.path} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <p className="min-w-0 truncate font-mono text-xs">
                    {row.path}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {row.visits}
                  </p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-600"
                    style={{
                      width: `${Math.max(4, (row.visits / maxPathVisits) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            {!data?.topPaths.length && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No page visits recorded for this range
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-display font-bold">Recent visits</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-muted/70 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Path</th>
                <th className="px-4 py-3">Visitor</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Referrer</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentVisitsPage.pageItems.map((visit) => (
                <tr key={visit.id} className="hover:bg-muted/60">
                  <td className="px-4 py-3 font-mono text-xs">{visit.path}</td>
                  <td className="px-4 py-3">
                    {visit.user
                      ? `${visit.user.firstName} ${visit.user.lastName}`
                      : 'Anonymous'}
                  </td>
                  <td className="px-4 py-3">{locationLabel(visit)}</td>
                  <td className="max-w-[14rem] truncate px-4 py-3 text-xs text-muted-foreground">
                    {visit.referrer || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatRelative(visit.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!recentVisits.length && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No recent visits
            </p>
          )}
        </div>
        <PaginationControls
          page={recentVisitsPage.page}
          totalPages={recentVisitsPage.totalPages}
          totalItems={recentVisits.length}
          onPage={recentVisitsPage.setPage}
        />
      </div>
    </section>
  );
}

function VisitTrendChart({
  rows,
  loading,
}: {
  rows: VisitAnalytics['trends'];
  loading: boolean;
}) {
  const visibleRows = rows.slice(-30).map((row) => ({
    ...row,
    label: formatTrendDay(row.date),
  }));

  return (
    <div className="p-4">
      <div
        className={cn(
          'h-64 rounded-xl bg-muted/40 px-2 py-4',
          loading && 'animate-pulse',
        )}
      >
        {visibleRows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={visibleRows}
              margin={{ top: 8, right: 16, bottom: 0, left: -16 }}
            >
              <CartesianGrid
                stroke="var(--color-border)"
                strokeDasharray="4 4"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                minTickGap={18}
                tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
              />
              <Tooltip
                cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }}
                contentStyle={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 12,
                  background: 'var(--color-card)',
                  color: 'var(--color-foreground)',
                  boxShadow: '0 12px 32px rgb(15 23 42 / 0.18)',
                }}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.date ?? ''
                }
              />
              <Line
                type="monotone"
                dataKey="visits"
                name="Visits"
                stroke="var(--color-bolt-600)"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="uniqueVisitors"
                name="Unique visitors"
                stroke="var(--color-success)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No visit trend data for this range
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-bolt-600" />
          Visits
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-success" />
          Unique visitors
        </span>
      </div>
    </div>
  );
}

function formatTrendDay(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function AnalyticsKpi({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string | number;
  icon: typeof LayoutDashboard;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-info-soft text-info-soft-foreground">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p
        className={cn(
          'mt-2 truncate font-display text-2xl font-extrabold tabular-nums text-foreground',
          loading && 'animate-pulse text-muted-foreground',
        )}
        title={String(value)}
      >
        {value}
      </p>
    </div>
  );
}

function locationLabel(row: {
  country?: string | null;
  region?: string | null;
  city?: string | null;
}) {
  return [row.city, row.region, row.country || 'Unknown']
    .filter(Boolean)
    .join(', ');
}

// ─── KYC application queues (sellers / drivers) ─────────────────────────────

type AppFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

function applicationAgingDays(createdAt?: string) {
  if (!createdAt) return 0;
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000),
  );
}

function ApplicationStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING:
      'bg-amber-100 text-amber-900 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-800',
    APPROVED:
      'bg-emerald-100 text-emerald-900 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800',
    REJECTED:
      'bg-red-100 text-red-900 ring-red-200 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-800',
    SUSPENDED:
      'bg-violet-100 text-violet-900 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-800',
  };
  const dots: Record<string, string> = {
    PENDING: 'bg-amber-500',
    APPROVED: 'bg-emerald-500',
    REJECTED: 'bg-red-500',
    SUSPENDED: 'bg-violet-500',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset',
        styles[status] || 'bg-muted text-muted-foreground ring-border',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          dots[status] || 'bg-muted-foreground',
        )}
      />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function DocCompleteness({
  present,
  total,
}: {
  present: number;
  total: number;
}) {
  const pct = total ? Math.round((present / total) * 100) : 0;
  const complete = present === total && total > 0;
  return (
    <div className="min-w-[7.5rem]">
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold">
        <span
          className={cn(
            complete
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-muted-foreground',
          )}
        >
          {present}/{total} docs
        </span>
        <span className="tabular-nums text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            complete ? 'bg-emerald-500' : pct >= 60 ? 'bg-bolt-500' : 'bg-amber-signal',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function sellerDocUrls(s: SellerRow) {
  return [
    { label: 'ID front', url: s.nationalIdFrontUrl },
    { label: 'ID back', url: s.nationalIdBackUrl },
    { label: 'Selfie', url: s.selfieUrl },
    { label: 'Shop exterior', url: s.shopExteriorUrl },
    { label: 'Shop interior', url: s.shopInteriorUrl },
  ];
}

function driverDocUrls(d: DriverRow) {
  return [
    { label: 'ID front', url: d.nationalIdFrontUrl },
    { label: 'ID back', url: d.nationalIdBackUrl },
    { label: 'Selfie', url: d.selfieUrl },
    { label: 'Vehicle side', url: d.vehiclePhotoSideUrl },
    { label: 'Vehicle rear', url: d.vehiclePhotoRearUrl },
    { label: 'With vehicle', url: d.vehiclePhotoWithDriverUrl },
    { label: 'Licence', url: d.licensePhotoUrl },
  ];
}

function countDocs(urls: { url?: string | null }[]) {
  return urls.filter((u) => Boolean(u.url)).length;
}

function useAppQueueFilter<T extends { status: string }>(
  items: T[],
  matchSearch: (item: T, q: string) => boolean,
  defaultFilter: AppFilter = 'PENDING',
) {
  const [filter, setFilter] = useState<AppFilter>(defaultFilter);
  const [search, setSearch] = useState('');

  const counts = useMemo(() => {
    const c: Record<AppFilter, number> = {
      ALL: items.length,
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      SUSPENDED: 0,
    };
    for (const item of items) {
      if (item.status in c) c[item.status as AppFilter] += 1;
    }
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (filter !== 'ALL') list = list.filter((i) => i.status === filter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((i) => matchSearch(i, q));
    return list;
  }, [items, filter, search, matchSearch]);

  return { filter, setFilter, search, setSearch, counts, filtered };
}

function AppQueueKpis({
  counts,
  agingPending,
  kind,
}: {
  counts: Record<AppFilter, number>;
  agingPending: number;
  kind: 'seller' | 'driver';
}) {
  const label = kind === 'seller' ? 'sellers' : 'drivers';
  const kpis = [
    {
      label: 'Pending review',
      value: counts.PENDING,
      sub:
        agingPending > 0
          ? `${agingPending} waiting 3d+`
          : 'In verification queue',
      icon: Clock,
      tone: 'bg-warning-soft text-warning-soft-foreground',
      accent: 'border-l-amber-signal',
    },
    {
      label: 'Approved',
      value: counts.APPROVED,
      sub: `Active ${label}`,
      icon: BadgeCheck,
      tone: 'bg-success-soft text-success-soft-foreground',
      accent: 'border-l-emerald-500',
    },
    {
      label: 'Rejected',
      value: counts.REJECTED,
      sub: 'Need re-application',
      icon: UserX,
      tone: 'bg-danger-soft text-danger-soft-foreground',
      accent: 'border-l-red-500',
    },
    {
      label: 'Suspended',
      value: counts.SUSPENDED,
      sub: 'Restricted access',
      icon: Shield,
      tone: 'bg-violet-soft text-violet-soft-foreground',
      accent: 'border-l-violet-500',
    },
  ];

  return (
    <div className="admin-stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((k) => {
        const Icon = k.icon;
        return (
          <div
            key={k.label}
            className={cn(
              'rounded-2xl border border-border border-l-4 bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
              k.accent,
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {k.label}
              </p>
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105',
                  k.tone,
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 font-display text-2xl font-extrabold tabular-nums text-foreground">
              {k.value}
            </p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              {k.sub}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function AppQueueToolbar({
  search,
  onSearch,
  filter,
  onFilter,
  counts,
  placeholder,
}: {
  search: string;
  onSearch: (v: string) => void;
  filter: AppFilter;
  onFilter: (v: AppFilter) => void;
  counts: Record<AppFilter, number>;
  placeholder: string;
}) {
  const filters: { id: AppFilter; label: string }[] = [
    { id: 'PENDING', label: 'Pending' },
    { id: 'APPROVED', label: 'Approved' },
    { id: 'REJECTED', label: 'Rejected' },
    { id: 'SUSPENDED', label: 'Suspended' },
    { id: 'ALL', label: 'All' },
  ];
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          className="pl-10"
        />
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onFilter(f.id)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold cursor-pointer min-h-[36px] transition',
              filter === f.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label}
            <span
              className={cn(
                'rounded-md px-1.5 py-0.5 text-[10px] tabular-nums',
                filter === f.id
                  ? 'bg-muted text-foreground'
                  : 'bg-background/60 text-muted-foreground',
              )}
            >
              {counts[f.id]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SellersPanel({
  sellers,
  onReview,
}: {
  sellers: SellerRow[];
  onReview: (s: SellerRow) => void;
}) {
  const matchSearch = useMemo(
    () => (s: SellerRow, q: string) => {
      const hay = [
        s.businessName,
        s.legalFullName,
        s.user.firstName,
        s.user.lastName,
        s.user.phone,
        s.user.email,
        s.nationalId,
        s.city,
        s.region,
        s.businessType,
        s.payoutPhone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    },
    [],
  );

  const { filter, setFilter, search, setSearch, counts, filtered } =
    useAppQueueFilter(sellers, matchSearch, 'PENDING');
  const sellersPage = useFixedPagination(filtered);

  const agingPending = useMemo(
    () =>
      sellers.filter(
        (s) => s.status === 'PENDING' && applicationAgingDays(s.createdAt) >= 3,
      ).length,
    [sellers],
  );

  return (
    <section className="space-y-5">
      <AppQueueKpis
        counts={counts}
        agingPending={agingPending}
        kind="seller"
      />

      {agingPending > 0 && (
        <div className="flex items-start gap-3 panel-warning px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-signal" />
          <div>
            <p className="font-bold">
              {agingPending} pending seller
              {agingPending === 1 ? '' : 's'} waiting 3+ days
            </p>
            <p className="mt-0.5 opacity-80">
              Faster KYC review keeps inventory flowing onto the marketplace.
            </p>
          </div>
        </div>
      )}

      <AppQueueToolbar
        search={search}
        onSearch={setSearch}
        filter={filter}
        onFilter={setFilter}
        counts={counts}
        placeholder="Search business, name, phone, ID, city…"
      />

      {/* Desktop */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-border bg-muted/70 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Documents</th>
                <th className="px-4 py-3">Payout</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Applied</th>
                <th className="px-4 py-3 text-right"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sellersPage.pageItems.map((s) => {
                const docs = sellerDocUrls(s);
                const present = countDocs(docs);
                const owner =
                  s.legalFullName ||
                  `${s.user.firstName} ${s.user.lastName}`;
                const days = applicationAgingDays(s.createdAt);
                return (
                  <tr
                    key={s.id}
                    className="group cursor-pointer transition-colors duration-150 hover:bg-muted/60"
                    onClick={() => onReview(s)}
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={s.businessName} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">
                            {s.businessName}
                          </p>
                          <p className="text-[11px] capitalize text-muted-foreground">
                            {(s.businessType || 'individual').replace(
                              /_/g,
                              ' ',
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-foreground">{owner}</p>
                      <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {s.user.phone || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="inline-flex items-center gap-1 text-foreground/90">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {s.city}
                        {s.region ? `, ${s.region}` : ''}
                      </p>
                      {s.addressWard && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {s.addressWard}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <DocCompleteness present={present} total={docs.length} />
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">
                      <p className="font-semibold text-foreground/90">
                        {s.payoutMethod || '—'}
                      </p>
                      <p className="truncate max-w-[9rem]">
                        {s.payoutPhone || s.payoutAccountName || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <ApplicationStatusPill status={s.status} />
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">
                      <p>{s.createdAt ? formatRelative(s.createdAt) : '—'}</p>
                      {s.status === 'PENDING' && days >= 3 && (
                        <p className="mt-0.5 font-semibold text-amber-700 dark:text-amber-300">
                          {days}d waiting
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReview(s);
                        }}
                      >
                        Review
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <div className="py-16 text-center">
            <Store className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 font-semibold text-foreground">
              No matching sellers
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {sellers.length
                ? 'Try another filter or clear search.'
                : 'Seller applications will appear here after onboarding.'}
            </p>
          </div>
        )}
        <PaginationControls
          page={sellersPage.page}
          totalPages={sellersPage.totalPages}
          totalItems={filtered.length}
          onPage={sellersPage.setPage}
        />
      </div>

      {/* Mobile */}
      <ul className="space-y-3 lg:hidden">
        {sellersPage.pageItems.map((s) => {
          const docs = sellerDocUrls(s);
          const present = countDocs(docs);
          const owner =
            s.legalFullName || `${s.user.firstName} ${s.user.lastName}`;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onReview(s)}
                className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all duration-200 hover:border-bolt-300 hover:shadow-md active:scale-[0.99] cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <UserAvatar name={s.businessName} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-foreground">
                          {s.businessName}
                        </p>
                        <p className="text-xs text-muted-foreground">{owner}</p>
                      </div>
                      <ApplicationStatusPill status={s.status} />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {s.user.phone || '—'} · {s.city}
                      {s.region ? `, ${s.region}` : ''}
                    </p>
                    <div className="mt-3">
                      <DocCompleteness present={present} total={docs.length} />
                    </div>
                    <p className="mt-3 inline-flex items-center gap-0.5 text-xs font-semibold text-bolt-700 dark:text-bolt-300">
                      Review application <ChevronRight className="h-3.5 w-3.5" />
                    </p>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
        {!filtered.length && (
          <Empty
            title="No matching sellers"
            body={
              sellers.length
                ? 'Try another filter or clear search.'
                : 'Seller applications will appear here after onboarding.'
            }
          />
        )}
      </ul>
      <div className="lg:hidden">
        <PaginationControls
          page={sellersPage.page}
          totalPages={sellersPage.totalPages}
          totalItems={filtered.length}
          onPage={sellersPage.setPage}
        />
      </div>
    </section>
  );
}

function DriversPanel({
  drivers,
  onReview,
}: {
  drivers: DriverRow[];
  onReview: (d: DriverRow) => void;
}) {
  const matchSearch = useMemo(
    () => (d: DriverRow, q: string) => {
      const hay = [
        d.legalFullName,
        d.user.firstName,
        d.user.lastName,
        d.user.phone,
        d.user.email,
        d.vehiclePlate,
        d.vehicleType,
        d.vehicleMake,
        d.licenseNumber,
        d.nationalId,
        d.city,
        d.payoutPhone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    },
    [],
  );

  const { filter, setFilter, search, setSearch, counts, filtered } =
    useAppQueueFilter(drivers, matchSearch, 'PENDING');
  const driversPage = useFixedPagination(filtered);

  const agingPending = useMemo(
    () =>
      drivers.filter(
        (d) => d.status === 'PENDING' && applicationAgingDays(d.createdAt) >= 3,
      ).length,
    [drivers],
  );

  return (
    <section className="space-y-5">
      <AppQueueKpis
        counts={counts}
        agingPending={agingPending}
        kind="driver"
      />

      {agingPending > 0 && (
        <div className="flex items-start gap-3 panel-warning px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-signal" />
          <div>
            <p className="font-bold">
              {agingPending} pending driver
              {agingPending === 1 ? '' : 's'} waiting 3+ days
            </p>
            <p className="mt-0.5 opacity-80">
              Approving qualified drivers shortens delivery ETAs for buyers.
            </p>
          </div>
        </div>
      )}

      <AppQueueToolbar
        search={search}
        onSearch={setSearch}
        filter={filter}
        onFilter={setFilter}
        counts={counts}
        placeholder="Search name, phone, plate, licence, ID…"
      />

      {/* Desktop */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-border bg-muted/70 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Licence</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Documents</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Applied</th>
                <th className="px-4 py-3 text-right"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {driversPage.pageItems.map((d) => {
                const docs = driverDocUrls(d);
                const present = countDocs(docs);
                const name =
                  d.legalFullName ||
                  `${d.user.firstName} ${d.user.lastName}`;
                const days = applicationAgingDays(d.createdAt);
                return (
                  <tr
                    key={d.id}
                    className="group cursor-pointer transition-colors duration-150 hover:bg-muted/60"
                    onClick={() => onReview(d)}
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">
                            {name}
                          </p>
                          <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {d.user.phone || '—'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                        <Car className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-mono text-xs tracking-wide">
                          {d.vehiclePlate}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">
                        {d.vehicleType}
                        {d.vehicleMake ? ` · ${d.vehicleMake}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-mono text-xs font-semibold text-foreground">
                        {d.licenseNumber || '—'}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {d.nationalId ? `NIDA ${d.nationalId}` : 'No NIDA'}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="inline-flex items-center gap-1 text-foreground/90">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        {d.city}
                      </p>
                      {d.addressStreet && (
                        <p className="mt-0.5 truncate max-w-[10rem] text-[11px] text-muted-foreground">
                          {d.addressStreet}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <DocCompleteness present={present} total={docs.length} />
                    </td>
                    <td className="px-4 py-3.5">
                      <ApplicationStatusPill status={d.status} />
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">
                      <p>{d.createdAt ? formatRelative(d.createdAt) : '—'}</p>
                      {d.status === 'PENDING' && days >= 3 && (
                        <p className="mt-0.5 font-semibold text-amber-700 dark:text-amber-300">
                          {days}d waiting
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReview(d);
                        }}
                      >
                        Review
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <div className="py-16 text-center">
            <Truck className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 font-semibold text-foreground">
              No matching drivers
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {drivers.length
                ? 'Try another filter or clear search.'
                : 'Driver applications will appear here after onboarding.'}
            </p>
          </div>
        )}
        <PaginationControls
          page={driversPage.page}
          totalPages={driversPage.totalPages}
          totalItems={filtered.length}
          onPage={driversPage.setPage}
        />
      </div>

      {/* Mobile */}
      <ul className="space-y-3 lg:hidden">
        {driversPage.pageItems.map((d) => {
          const docs = driverDocUrls(d);
          const present = countDocs(docs);
          const name =
            d.legalFullName || `${d.user.firstName} ${d.user.lastName}`;
          return (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => onReview(d)}
                className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all duration-200 hover:border-bolt-300 hover:shadow-md active:scale-[0.99] cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <UserAvatar name={name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-foreground">
                          {name}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {d.vehiclePlate} · {d.vehicleType}
                        </p>
                      </div>
                      <ApplicationStatusPill status={d.status} />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {d.user.phone || '—'} · {d.city}
                    </p>
                    <div className="mt-3">
                      <DocCompleteness present={present} total={docs.length} />
                    </div>
                    <p className="mt-3 inline-flex items-center gap-0.5 text-xs font-semibold text-bolt-700 dark:text-bolt-300">
                      Review application <ChevronRight className="h-3.5 w-3.5" />
                    </p>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
        {!filtered.length && (
          <Empty
            title="No matching drivers"
            body={
              drivers.length
                ? 'Try another filter or clear search.'
                : 'Driver applications will appear here after onboarding.'
            }
          />
        )}
      </ul>
      <div className="lg:hidden">
        <PaginationControls
          page={driversPage.page}
          totalPages={driversPage.totalPages}
          totalItems={filtered.length}
          onPage={driversPage.setPage}
        />
      </div>
    </section>
  );
}

function ReviewDrawer({
  review,
  loading,
  onClose,
  onApprove,
  onReject,
  onSuspend,
}: {
  review: { type: 'seller'; data: SellerRow } | { type: 'driver'; data: DriverRow };
  loading: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onSuspend: () => void;
}) {
  const d = review.data;
  const isSeller = review.type === 'seller';
  const seller = isSeller ? (d as SellerRow) : null;
  const driver = !isSeller ? (d as DriverRow) : null;

  const name = isSeller
    ? seller!.businessName
    : driver!.legalFullName ||
      `${d.user.firstName} ${d.user.lastName}`;

  const legalName =
    (isSeller ? seller!.legalFullName : driver!.legalFullName) ||
    `${d.user.firstName} ${d.user.lastName}`;

  const photos = isSeller ? sellerDocUrls(seller!) : driverDocUrls(driver!);
  const present = countDocs(photos);
  const days = applicationAgingDays(d.createdAt);

  const location = isSeller
    ? [seller!.addressStreet, seller!.addressWard, d.city, seller!.region]
        .filter(Boolean)
        .join(', ') || d.city
    : [driver!.addressStreet, d.city].filter(Boolean).join(', ') || d.city;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 cursor-pointer admin-backdrop-in"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex h-full w-full max-w-lg flex-col bg-card shadow-2xl admin-drawer-in">
        {/* Header */}
        <div className="shrink-0 border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <UserAvatar name={name} size="lg" />
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {isSeller ? 'Seller application' : 'Driver application'}
                </p>
                <h2 className="truncate font-display text-xl font-extrabold text-foreground">
                  {name}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ApplicationStatusPill status={d.status} />
                  {d.status === 'PENDING' && days > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {days}d in queue
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted cursor-pointer"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* Completeness strip */}
          <div className="rounded-2xl border border-border bg-muted/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-card text-bolt-700 dark:text-bolt-300 shadow-sm">
                  <FileCheck className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-foreground">
                    Document pack
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {present === photos.length
                      ? 'All required uploads present'
                      : `${photos.length - present} missing — review carefully`}
                  </p>
                </div>
              </div>
              <DocCompleteness present={present} total={photos.length} />
            </div>
          </div>

          {/* Identity */}
          <section>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <IdCard className="h-3.5 w-3.5" />
              Identity
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Info label="Legal name" value={legalName} />
              <Info label="National ID" value={d.nationalId || '—'} />
              <Info label="Phone" value={d.user.phone || '—'} />
              <Info label="Email" value={d.user.email || '—'} />
            </div>
          </section>

          {/* Business / Vehicle */}
          {isSeller ? (
            <section>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                Business
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Info label="Business name" value={seller!.businessName} />
                <Info
                  label="Type"
                  value={(seller!.businessType || 'individual').replace(
                    /_/g,
                    ' ',
                  )}
                />
                <Info label="Location" value={location} />
                <Info
                  label="Applied"
                  value={
                    d.createdAt
                      ? `${formatRelative(d.createdAt)} · ${formatDateTime(d.createdAt)}`
                      : '—'
                  }
                />
              </div>
            </section>
          ) : (
            <section>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <Car className="h-3.5 w-3.5" />
                Vehicle & licence
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Info label="Plate" value={driver!.vehiclePlate} />
                <Info
                  label="Type"
                  value={`${driver!.vehicleType}${driver!.vehicleMake ? ` · ${driver!.vehicleMake}` : ''}`}
                />
                <Info label="Licence no." value={driver!.licenseNumber || '—'} />
                <Info label="Location" value={location} />
                <Info
                  label="Applied"
                  value={
                    d.createdAt
                      ? `${formatRelative(d.createdAt)} · ${formatDateTime(d.createdAt)}`
                      : '—'
                  }
                />
              </div>
            </section>
          )}

          {/* Payout */}
          <section>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <Banknote className="h-3.5 w-3.5" />
              Payout
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {isSeller && (
                <Info label="Method" value={seller!.payoutMethod || '—'} />
              )}
              <Info label="Account name" value={d.payoutAccountName || '—'} />
              <Info label="Payout phone" value={d.payoutPhone || '—'} />
            </div>
          </section>

          {d.rejectionReason && (
            <div className="panel-danger p-4 text-sm">
              <p className="font-bold">Rejection reason</p>
              <p className="mt-1 whitespace-pre-wrap">{d.rejectionReason}</p>
            </div>
          )}

          {/* Documents gallery */}
          <section>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <FileCheck className="h-3.5 w-3.5" />
              Documents ({present}/{photos.length})
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {photos.map((p) =>
                p.url ? (
                  <a
                    key={p.label}
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group overflow-hidden rounded-xl border border-border bg-muted"
                  >
                    <div className="aspect-square">
                      <SafeImage
                        src={p.url}
                        alt={p.label}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <p className="truncate px-2 py-1.5 text-[11px] font-semibold text-muted-foreground">
                      {p.label}
                    </p>
                  </a>
                ) : (
                  <div
                    key={p.label}
                    className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-muted/40 p-2 text-center"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-signal" />
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      {p.label}
                    </p>
                    <p className="text-[10px] text-amber-700 dark:text-amber-300">
                      Missing
                    </p>
                  </div>
                ),
              )}
            </div>
          </section>
        </div>

        {/* Actions */}
        <div className="shrink-0 space-y-2 border-t border-border bg-card px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {d.status === 'PENDING' && (
            <>
              {present < photos.length && (
                <p className="text-center text-[11px] text-amber-700 dark:text-amber-300">
                  Incomplete documents — only approve if you verified offline.
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="flex-1" loading={loading} onClick={onApprove}>
                  <BadgeCheck className="h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={onReject}
                  disabled={loading}
                >
                  <UserX className="h-4 w-4" />
                  Reject
                </Button>
              </div>
            </>
          )}
          {d.status === 'APPROVED' && (
            <Button
              variant="secondary"
              className="w-full"
              loading={loading}
              onClick={onSuspend}
            >
              <Shield className="h-4 w-4" />
              Suspend account
            </Button>
          )}
          {(d.status === 'REJECTED' || d.status === 'SUSPENDED') && (
            <Button className="w-full" loading={loading} onClick={onApprove}>
              <BadgeCheck className="h-4 w-4" />
              Re-approve
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-foreground break-words">
        {value}
      </p>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card py-14 text-center">
      <p className="font-semibold text-foreground/90">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

// ─── Confirmation dialog (guards every consequential admin action) ───────────

type ConfirmTone = 'default' | 'success' | 'danger' | 'warning';

type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: ConfirmTone;
  /** Show a required free-text reason (e.g. rejection notes). */
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  onConfirm: (reason: string) => Promise<void> | void;
};

const CONFIRM_TONE: Record<
  ConfirmTone,
  {
    icon: typeof AlertTriangle;
    iconWrap: string;
    button: 'default' | 'danger' | 'amber';
  }
> = {
  default: {
    icon: Shield,
    iconWrap: 'bg-info-soft text-info-soft-foreground',
    button: 'default',
  },
  success: {
    icon: CheckCircle2,
    iconWrap: 'bg-success-soft text-success-soft-foreground',
    button: 'default',
  },
  danger: {
    icon: AlertTriangle,
    iconWrap: 'bg-danger-soft text-danger-soft-foreground',
    button: 'danger',
  },
  warning: {
    icon: AlertTriangle,
    iconWrap: 'bg-warning-soft text-warning-soft-foreground',
    button: 'amber',
  },
};

function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setReason('');
    setLoading(false);
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [request, loading, onClose]);

  if (!request) return null;
  const tone = CONFIRM_TONE[request.tone ?? 'default'];
  const Icon = tone.icon;

  const submit = async () => {
    if (request.requireReason && !reason.trim()) {
      toast.error('Please add a short reason');
      return;
    }
    setLoading(true);
    try {
      await request.onConfirm(reason.trim());
      onClose();
    } catch {
      // The action surfaces its own error toast; keep the dialog open to retry.
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="admin-backdrop-in fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        className="admin-modal-in w-full max-w-md rounded-2xl bg-card p-5 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              tone.iconWrap,
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-bold text-foreground">
              {request.title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {request.message}
            </p>
          </div>
        </div>

        {request.requireReason && (
          <div className="mt-4">
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              {request.reasonLabel ?? 'Reason'}
            </label>
            <textarea
              autoFocus
              className="field-control text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={request.reasonPlaceholder ?? 'Add a short note…'}
            />
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            disabled={loading}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant={tone.button}
            className="flex-1"
            loading={loading}
            onClick={() => void submit()}
          >
            {request.confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function reviewLabel(
  review:
    | { type: 'seller'; data: SellerRow }
    | { type: 'driver'; data: DriverRow },
): string {
  if (review.type === 'seller') return review.data.businessName;
  return (
    review.data.legalFullName ||
    `${review.data.user.firstName} ${review.data.user.lastName}`.trim() ||
    'This driver'
  );
}

type AdminNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
};

/**
 * Header notification centre — polls the admin's notification feed, shows an
 * unread badge, and lets the admin open the dropdown to read / clear items.
 */
function AdminNotifications() {
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const { data } = await api.get<AdminNotification[]>('/notifications');
      setItems(Array.isArray(data) ? data : []);
    } catch {
      /* keep last known list on transient errors */
    }
  };

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const unread = items.filter((n) => !n.read).length;

  const markAll = async () => {
    if (!unread) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await api.post('/notifications/read-all');
    } catch {
      void load();
    }
  };

  const openItem = async (n: AdminNotification) => {
    if (n.read) return;
    setItems((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
    );
    try {
      await api.patch(`/notifications/${n.id}/read`);
    } catch {
      /* optimistic update stands; next poll reconciles */
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="relative flex h-10 w-10 items-center justify-center text-muted-foreground transition-all duration-200 hover:text-foreground hover:scale-105 active:scale-95 cursor-pointer"
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="admin-badge-pop absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl admin-menu-in origin-top-right"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="font-display text-sm font-bold">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                className="cursor-pointer text-xs font-semibold text-bolt-700 hover:underline dark:text-bolt-300"
                onClick={() => void markAll()}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p className="mt-2 text-sm font-semibold text-foreground/90">
                  You&rsquo;re all caught up
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  New applications and alerts show up here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => void openItem(n)}
                      className={cn(
                        'flex w-full items-start gap-2.5 px-4 py-3 text-left transition hover:bg-muted cursor-pointer',
                        !n.read && 'bg-accent-soft/40',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                          n.read ? 'bg-transparent' : 'bg-bolt-500',
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {n.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">
                          {n.body}
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {formatRelative(n.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function UserPopupMenu({
  className,
  onClose,
  onLogout,
}: {
  className?: string;
  onClose: () => void;
  onLogout: () => void;
}) {
  const itemCls =
    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-popover-foreground transition hover:bg-muted cursor-pointer min-h-[44px]';

  return (
    <div
      role="menu"
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-popover py-1.5 shadow-xl text-popover-foreground admin-menu-in origin-top',
        className,
      )}
    >
      <a
        href={import.meta.env.VITE_STORE_URL || '/'}
        target="_blank"
        rel="noopener noreferrer"
        role="menuitem"
        className={itemCls}
        onClick={onClose}
      >
        <ExternalLink className="h-4 w-4 text-muted-foreground" />
        Visit store
      </a>
      <div className="my-1 border-t border-border" />
      <button
        type="button"
        role="menuitem"
        className={cn(itemCls, 'text-danger hover:bg-danger-soft')}
        onClick={() => {
          onClose();
          onLogout();
        }}
      >
        <LogOut className="h-4 w-4" />
        Log out
      </button>
    </div>
  );
}

// ─── Escrow ledger (professional) ────────────────────────────────────────────

type EscrowFilter = 'ALL' | 'HELD' | 'RELEASED_TO_SELLER' | 'REFUNDED_TO_CUSTOMER' | 'PARTIAL_REFUND';

function num(v: string | number | undefined | null) {
  if (v == null || v === '') return 0;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function escrowAgingDays(heldAt?: string) {
  if (!heldAt) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(heldAt).getTime()) / 86_400_000));
}

function formatDateTime(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-TZ', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function escrowStatusLabel(status: string) {
  switch (status) {
    case 'HELD':
      return 'Held';
    case 'RELEASED_TO_SELLER':
      return 'Released';
    case 'REFUNDED_TO_CUSTOMER':
      return 'Refunded';
    case 'PARTIAL_REFUND':
      return 'Partial refund';
    default:
      return status.replace(/_/g, ' ');
  }
}

function EscrowStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    HELD: 'bg-amber-100 text-amber-900 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-800',
    RELEASED_TO_SELLER:
      'bg-emerald-100 text-emerald-900 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800',
    REFUNDED_TO_CUSTOMER:
      'bg-sky-100 text-sky-900 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-800',
    PARTIAL_REFUND:
      'bg-violet-100 text-violet-900 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-800',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset',
        styles[status] || 'bg-muted text-muted-foreground ring-border',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'HELD' && 'bg-amber-500',
          status === 'RELEASED_TO_SELLER' && 'bg-emerald-500',
          status === 'REFUNDED_TO_CUSTOMER' && 'bg-sky-500',
          status === 'PARTIAL_REFUND' && 'bg-violet-500',
          !['HELD', 'RELEASED_TO_SELLER', 'REFUNDED_TO_CUSTOMER', 'PARTIAL_REFUND'].includes(
            status,
          ) && 'bg-muted-foreground',
        )}
      />
      {escrowStatusLabel(status)}
    </span>
  );
}

function AgingBadge({ days, status }: { days: number; status: string }) {
  if (status !== 'HELD') {
    return (
      <span className="text-xs text-muted-foreground">
        {days === 0 ? 'Same day' : `${days}d total`}
      </span>
    );
  }
  const tone =
    days >= 7
      ? 'text-danger bg-danger-soft'
      : days >= 3
        ? 'text-warning-soft-foreground bg-warning-soft'
        : 'text-muted-foreground bg-muted';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold tabular-nums',
        tone,
      )}
    >
      <Clock className="h-3 w-3" />
      {days === 0 ? 'Today' : `${days}d`}
      {days >= 7 ? ' · aging' : ''}
    </span>
  );
}

function FeeSplitBar({
  amount,
  platformFee,
  sellerAmount,
}: {
  amount: number;
  platformFee: number;
  sellerAmount: number;
}) {
  const total = amount || platformFee + sellerAmount || 1;
  const feePct = Math.min(100, Math.round((platformFee / total) * 100));
  const sellerPct = Math.max(0, 100 - feePct);
  return (
    <div className="space-y-1.5">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="bg-bolt-600 transition-all"
          style={{ width: `${sellerPct}%` }}
          title="Seller"
        />
        <div
          className="bg-amber-signal transition-all"
          style={{ width: `${feePct}%` }}
          title="Platform fee"
        />
      </div>
      <div className="flex justify-between gap-2 text-[10px] font-semibold text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-bolt-600" />
          Seller {formatTZS(sellerAmount)}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-signal" />
          Fee {formatTZS(platformFee)}
        </span>
      </div>
    </div>
  );
}

function EscrowPanel({ escrows }: { escrows: EscrowRow[] }) {
  const [filter, setFilter] = useState<EscrowFilter>('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<EscrowRow | null>(null);

  const summary = useMemo(() => {
    let held = 0;
    let heldCount = 0;
    let released = 0;
    let releasedCount = 0;
    let refunded = 0;
    let refundedCount = 0;
    let fees = 0;
    let agingCount = 0;
    for (const e of escrows) {
      const amt = num(e.amount);
      const fee = num(e.platformFee);
      fees += fee;
      if (e.status === 'HELD') {
        held += amt;
        heldCount += 1;
        if (escrowAgingDays(e.heldAt) >= 7) agingCount += 1;
      } else if (e.status === 'RELEASED_TO_SELLER') {
        released += amt;
        releasedCount += 1;
      } else if (
        e.status === 'REFUNDED_TO_CUSTOMER' ||
        e.status === 'PARTIAL_REFUND'
      ) {
        refunded += amt;
        refundedCount += 1;
      }
    }
    return {
      held,
      heldCount,
      released,
      releasedCount,
      refunded,
      refundedCount,
      fees,
      agingCount,
      volume: held + released + refunded,
    };
  }, [escrows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return escrows.filter((e) => {
      if (filter !== 'ALL' && e.status !== filter) return false;
      if (!q) return true;
      const customer = e.order.customer
        ? `${e.order.customer.firstName} ${e.order.customer.lastName} ${e.order.customer.phone ?? ''} ${e.order.customer.email ?? ''}`
        : '';
      const items = (e.order.items ?? []).map((i) => i.title).join(' ');
      const hay = `${e.order.orderNumber} ${e.status} ${customer} ${items} ${e.order.status ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [escrows, filter, search]);
  const escrowsPage = useFixedPagination(filtered);

  const filters: { id: EscrowFilter; label: string; count: number }[] = [
    { id: 'ALL', label: 'All', count: escrows.length },
    {
      id: 'HELD',
      label: 'Held',
      count: escrows.filter((e) => e.status === 'HELD').length,
    },
    {
      id: 'RELEASED_TO_SELLER',
      label: 'Released',
      count: escrows.filter((e) => e.status === 'RELEASED_TO_SELLER').length,
    },
    {
      id: 'REFUNDED_TO_CUSTOMER',
      label: 'Refunded',
      count: escrows.filter((e) => e.status === 'REFUNDED_TO_CUSTOMER').length,
    },
    {
      id: 'PARTIAL_REFUND',
      label: 'Partial',
      count: escrows.filter((e) => e.status === 'PARTIAL_REFUND').length,
    },
  ];

  const kpis = [
    {
      label: 'Currently held',
      value: formatTZS(summary.held),
      sub: `${summary.heldCount} open escrow${summary.heldCount === 1 ? '' : 's'}`,
      icon: Wallet,
      tone: 'bg-warning-soft text-warning-soft-foreground',
      accent: 'border-l-amber-signal',
    },
    {
      label: 'Released to sellers',
      value: formatTZS(summary.released),
      sub: `${summary.releasedCount} settled`,
      icon: ArrowUpRight,
      tone: 'bg-success-soft text-success-soft-foreground',
      accent: 'border-l-emerald-500',
    },
    {
      label: 'Refunded to buyers',
      value: formatTZS(summary.refunded),
      sub: `${summary.refundedCount} refund${summary.refundedCount === 1 ? '' : 's'}`,
      icon: ArrowDownLeft,
      tone: 'bg-info-soft text-info-soft-foreground',
      accent: 'border-l-sky-500',
    },
    {
      label: 'Platform fees',
      value: formatTZS(summary.fees),
      sub:
        summary.agingCount > 0
          ? `${summary.agingCount} aging 7d+`
          : 'Across ledger',
      icon: Percent,
      tone: 'bg-accent-soft text-accent-soft-foreground',
      accent: 'border-l-bolt-600',
    },
  ];

  return (
    <section className="space-y-5">
      {/* KPIs */}
      <div className="admin-stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.label}
              className={cn(
                'rounded-2xl border border-border border-l-4 bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
                k.accent,
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {k.label}
                </p>
                <span
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl',
                    k.tone,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 font-display text-2xl font-extrabold tabular-nums text-foreground">
                {k.value}
              </p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                {k.sub}
              </p>
            </div>
          );
        })}
      </div>

      {/* Aging alert */}
      {summary.agingCount > 0 && (
        <div className="flex items-start gap-3 panel-warning px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-signal" />
          <div>
            <p className="font-bold">
              {summary.agingCount} held escrow
              {summary.agingCount === 1 ? '' : 's'} older than 7 days
            </p>
            <p className="mt-0.5 opacity-80">
              Review delivery status or open disputes — delayed releases hurt
              seller cash flow and buyer trust.
            </p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order #, customer, phone, item…"
            className="pl-10"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold cursor-pointer min-h-[36px] transition',
                filter === f.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label}
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 text-[10px] tabular-nums',
                  filter === f.id
                    ? 'bg-muted text-foreground'
                    : 'bg-background/60 text-muted-foreground',
                )}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b border-border bg-muted/70 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Gross</th>
                <th className="px-4 py-3 min-w-[160px]">Split</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3">Held</th>
                <th className="px-4 py-3 text-right"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {escrowsPage.pageItems.map((e) => {
                const days = escrowAgingDays(e.heldAt);
                const customer = e.order.customer;
                const itemCount = e.order.items?.length ?? 0;
                return (
                  <tr
                    key={e.id}
                    className="group cursor-pointer transition-colors duration-150 hover:bg-muted/60"
                    onClick={() => setSelected(e)}
                  >
                    <td className="px-4 py-3.5">
                      <p className="font-mono text-xs font-bold text-foreground">
                        {e.order.orderNumber}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {e.order.status
                          ? e.order.status.replace(/_/g, ' ')
                          : '—'}
                        {itemCount > 0 ? ` · ${itemCount} item${itemCount === 1 ? '' : 's'}` : ''}
                      </p>
                      {e.order.dispute && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                          <Scale className="h-3 w-3" />
                          Dispute
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {customer ? (
                        <>
                          <p className="font-semibold text-foreground">
                            {customer.firstName} {customer.lastName}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {customer.phone || customer.email || '—'}
                          </p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-display text-base font-bold tabular-nums text-foreground">
                        {formatTZS(e.amount)}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <FeeSplitBar
                        amount={num(e.amount)}
                        platformFee={num(e.platformFee)}
                        sellerAmount={num(e.sellerAmount) || num(e.amount) - num(e.platformFee)}
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <EscrowStatusPill status={e.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <AgingBadge days={days} status={e.status} />
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">
                      <p>{e.heldAt ? formatRelative(e.heldAt) : '—'}</p>
                      <p className="mt-0.5 tabular-nums opacity-80">
                        {formatDateTime(e.heldAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-pointer"
                        aria-label="View escrow"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setSelected(e);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <div className="py-16 text-center">
            <Banknote className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 font-semibold text-foreground">No matching escrows</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {escrows.length
                ? 'Try another filter or clear search.'
                : 'Escrow records appear when buyers complete payment.'}
            </p>
          </div>
        )}
        <PaginationControls
          page={escrowsPage.page}
          totalPages={escrowsPage.totalPages}
          totalItems={filtered.length}
          onPage={escrowsPage.setPage}
        />
      </div>

      {/* Mobile cards */}
      <ul className="space-y-3 lg:hidden">
        {escrowsPage.pageItems.map((e) => {
          const days = escrowAgingDays(e.heldAt);
          const customer = e.order.customer;
          return (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => setSelected(e)}
                className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all duration-200 hover:border-bolt-300 hover:shadow-md active:scale-[0.99] cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-bold">
                      {e.order.orderNumber}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">
                      {customer
                        ? `${customer.firstName} ${customer.lastName}`
                        : 'Customer'}
                    </p>
                  </div>
                  <EscrowStatusPill status={e.status} />
                </div>
                <p className="mt-3 font-display text-xl font-extrabold tabular-nums">
                  {formatTZS(e.amount)}
                </p>
                <div className="mt-2">
                  <FeeSplitBar
                    amount={num(e.amount)}
                    platformFee={num(e.platformFee)}
                    sellerAmount={
                      num(e.sellerAmount) || num(e.amount) - num(e.platformFee)
                    }
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <AgingBadge days={days} status={e.status} />
                  <span className="inline-flex items-center gap-0.5 font-semibold text-bolt-700 dark:text-bolt-300">
                    Details <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </button>
            </li>
          );
        })}
        {!filtered.length && (
          <Empty
            title="No matching escrows"
            body={
              escrows.length
                ? 'Try another filter or clear search.'
                : 'Escrow records appear when buyers complete payment.'
            }
          />
        )}
      </ul>
      <div className="lg:hidden">
        <PaginationControls
          page={escrowsPage.page}
          totalPages={escrowsPage.totalPages}
          totalItems={filtered.length}
          onPage={escrowsPage.setPage}
        />
      </div>

      {selected && (
        <EscrowDetailDrawer
          escrow={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}

function EscrowDetailDrawer({
  escrow,
  onClose,
}: {
  escrow: EscrowRow;
  onClose: () => void;
}) {
  const amount = num(escrow.amount);
  const fee = num(escrow.platformFee);
  const seller = num(escrow.sellerAmount) || amount - fee;
  const customer = escrow.order.customer;
  const days = escrowAgingDays(escrow.heldAt);
  const settledAt = escrow.releasedAt || escrow.refundedAt;

  const timeline: { label: string; at?: string | null; done: boolean; tone?: string }[] = [
    { label: 'Payment held in escrow', at: escrow.heldAt, done: true },
    {
      label:
        escrow.status === 'REFUNDED_TO_CUSTOMER' ||
        escrow.status === 'PARTIAL_REFUND'
          ? 'Refunded to customer'
          : escrow.status === 'RELEASED_TO_SELLER'
            ? 'Released to seller'
            : 'Awaiting settlement',
      at: settledAt,
      done: Boolean(settledAt),
      tone:
        escrow.status === 'REFUNDED_TO_CUSTOMER' ||
        escrow.status === 'PARTIAL_REFUND'
          ? 'sky'
          : escrow.status === 'RELEASED_TO_SELLER'
            ? 'emerald'
            : 'amber',
    },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 cursor-pointer admin-backdrop-in"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex h-full w-full max-w-lg flex-col bg-card shadow-2xl admin-drawer-in">
        <div className="shrink-0 flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Escrow detail
            </p>
            <h2 className="truncate font-mono text-lg font-extrabold text-foreground">
              {escrow.order.orderNumber}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <EscrowStatusPill status={escrow.status} />
              <AgingBadge days={days} status={escrow.status} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* Amount hero */}
          <div className="rounded-2xl border border-border bg-gradient-to-br from-bolt-800 to-steel-900 p-5 text-white shadow-md">
            <p className="text-xs font-bold uppercase tracking-wider text-bolt-200">
              Gross held
            </p>
            <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">
              {formatTZS(amount)}
            </p>
            <p className="mt-2 text-xs text-bolt-100/80">
              Order total{' '}
              {escrow.order.total != null
                ? formatTZS(escrow.order.total)
                : '—'}{' '}
              · status{' '}
              {(escrow.order.status || '—').replace(/_/g, ' ')}
            </p>
          </div>

          {/* Split */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Fund split
            </p>
            <FeeSplitBar
              amount={amount}
              platformFee={fee}
              sellerAmount={seller}
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Info label="Seller payout" value={formatTZS(seller)} />
              <Info label="Platform fee" value={formatTZS(fee)} />
            </div>
          </div>

          {/* Parties */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Parties
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">
                    Buyer
                  </p>
                  <p className="truncate font-semibold text-foreground">
                    {customer
                      ? `${customer.firstName} ${customer.lastName}`
                      : '—'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {customer?.phone || customer?.email || '—'}
                  </p>
                </div>
              </div>
              {escrow.order.dispute && (
                <div className="flex items-start gap-3 panel-danger p-3">
                  <Scale className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                  <div>
                    <p className="text-xs font-bold">
                      Open dispute · {escrow.order.dispute.status}
                    </p>
                    {escrow.order.dispute.reason && (
                      <p className="mt-0.5 text-xs opacity-80">
                        {escrow.order.dispute.reason}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Line items */}
          {(escrow.order.items?.length ?? 0) > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Order items
              </p>
              <ul className="divide-y divide-border">
                {escrow.order.items!.map((item, i) => (
                  <li
                    key={`${item.title}-${i}`}
                    className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Qty {item.quantity}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-bold tabular-nums">
                      {formatTZS(item.lineTotal)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Timeline */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Timeline
            </p>
            <ol className="relative space-y-4 border-l border-border pl-4">
              {timeline.map((step) => (
                <li key={step.label} className="relative">
                  <span
                    className={cn(
                      'absolute -left-[1.3rem] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-card',
                      step.done
                        ? step.tone === 'sky'
                          ? 'bg-sky-500'
                          : step.tone === 'emerald'
                            ? 'bg-emerald-500'
                            : 'bg-bolt-600'
                        : 'bg-amber-signal',
                    )}
                  />
                  <p className="text-sm font-semibold text-foreground">
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {step.at ? formatDateTime(step.at) : 'Pending'}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          {escrow.notes && (
            <div className="rounded-2xl border border-border bg-muted/50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Notes
              </p>
              <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
                {escrow.notes}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Info label="Held at" value={formatDateTime(escrow.heldAt)} />
            <Info
              label="Settled at"
              value={formatDateTime(settledAt)}
            />
          </div>
        </div>

        <div className="shrink-0 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="mb-2 text-center text-[11px] text-muted-foreground">
            Settlements run from Disputes when a case is open, or automatically
            after confirmed delivery.
          </p>
          <Button variant="secondary" className="w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
