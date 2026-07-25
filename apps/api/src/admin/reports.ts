import { PrismaService } from '../prisma/prisma.service';

export type ReportPeriod = 'day' | 'week' | 'month' | 'quarter' | 'halfYear' | 'year';

type DateRange = {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  label: string;
};

type PeriodRow = {
  orders: number;
  revenue: number;
  platformFees: number;
  sellerPayouts: number;
  refunds: number;
  newUsers: number;
  newSellers: number;
  newDrivers: number;
  newListings: number;
  visits: number;
  uniqueVisitors: number;
  deliveries: number;
  delivered: number;
  failedDeliveries: number;
  disputesOpened: number;
  disputesResolved: number;
  escrowHeld: number;
  escrowReleased: number;
  escrowRefunded: number;
  orderStatuses: Record<string, number>;
  paymentMethods: Record<string, number>;
  sellerSales: { sellerId: string; sales: number }[];
  series: ReportSeriesRow[];
};

export type ReportSeriesRow = {
  date: string;
  revenue: number;
  orders: number;
  users: number;
  visits: number;
};

const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

export function normalizeReportPeriod(value?: string): ReportPeriod {
  if (value === 'day' || value === 'daily') return 'day';
  if (value === 'week' || value === 'weekly') return 'week';
  if (value === 'month' || value === 'monthly') return 'month';
  if (value === 'quarter' || value === 'quarterly') return 'quarter';
  if (value === 'halfYear' || value === 'half-year' || value === 'semiannual') {
    return 'halfYear';
  }
  return 'year';
}

function localDate(anchor?: string) {
  if (anchor && /^\d{4}-\d{2}-\d{2}$/.test(anchor)) {
    const [year, month, day] = anchor.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
  const now = new Date(Date.now() + TZ_OFFSET_MS);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function periodRange(period: ReportPeriod, anchor?: string): DateRange {
  const date = localDate(anchor);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  let startMonth = month;
  let endMonth = month;
  let startDay = day;
  let endDay = day;
  let label = date.toISOString().slice(0, 10);

  if (period === 'week') {
    const mondayOffset = (date.getUTCDay() + 6) % 7;
    startDay = day - mondayOffset;
    endDay = startDay + 6;
    label = 'Week of ' + dateOnly(new Date(Date.UTC(year, month, startDay)));
  } else if (period === 'month') {
    startDay = 1;
    endDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  } else if (period === 'quarter') {
    startMonth = Math.floor(month / 3) * 3;
    endMonth = startMonth + 2;
    startDay = 1;
    endDay = new Date(Date.UTC(year, endMonth + 1, 0)).getUTCDate();
    label = `Q${Math.floor(month / 3) + 1} ${year}`;
  } else if (period === 'halfYear') {
    startMonth = month < 6 ? 0 : 6;
    endMonth = startMonth + 5;
    startDay = 1;
    endDay = new Date(Date.UTC(year, endMonth + 1, 0)).getUTCDate();
    label = `${startMonth === 0 ? 'H1' : 'H2'} ${year}`;
  } else if (period === 'year') {
    startMonth = 0;
    endMonth = 11;
    startDay = 1;
    endDay = 31;
    label = String(year);
  }

  const startLocal = new Date(Date.UTC(year, startMonth, startDay));
  const endLocalExclusive = new Date(Date.UTC(year, endMonth, endDay + 1));
  const duration = endLocalExclusive.getTime() - startLocal.getTime();
  const start = new Date(startLocal.getTime() - TZ_OFFSET_MS);
  const end = new Date(endLocalExclusive.getTime() - TZ_OFFSET_MS - 1);
  const previousStart = new Date(start.getTime() - duration);
  const previousEnd = new Date(start.getTime() - 1);

  return { start, end, previousStart, previousEnd, label };
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function amount(value: unknown) {
  return Number(value ?? 0);
}

function bucketKey(date: Date, period: ReportPeriod) {
  const local = new Date(date.getTime() + TZ_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  if (period === 'year' || period === 'halfYear' || period === 'quarter') {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  }
  if (period === 'day') {
    return `${dateOnly(local)} ${String(local.getUTCHours()).padStart(2, '0')}:00`;
  }
  return dateOnly(local);
}

function seriesKeys(range: DateRange, period: ReportPeriod) {
  const keys: string[] = [];
  const cursor = new Date(range.start);
  const end = new Date(range.end);
  while (cursor <= end) {
    keys.push(bucketKey(cursor, period));
    if (period === 'day') cursor.setUTCHours(cursor.getUTCHours() + 1);
    else if (period === 'year' || period === 'halfYear' || period === 'quarter') {
      cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
    } else cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return [...new Set(keys)];
}

function increment(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

async function collectPeriod(
  prisma: PrismaService,
  range: { start: Date; end: Date },
  period: ReportPeriod,
): Promise<PeriodRow> {
  const [payments, orders, users, sellers, drivers, listings, deliveries, disputes, escrows, visits] =
    await Promise.all([
      prisma.payment.findMany({
        where: { status: 'COMPLETED', paidAt: { gte: range.start, lte: range.end } },
        select: {
          amount: true,
          method: true,
          order: { select: { platformFee: true, items: { select: { sellerId: true, lineTotal: true } } } },
          paidAt: true,
        },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: range.start, lte: range.end } },
        select: { status: true, total: true, createdAt: true },
      }),
      prisma.user.findMany({ where: { createdAt: { gte: range.start, lte: range.end } }, select: { createdAt: true } }),
      prisma.sellerProfile.findMany({ where: { createdAt: { gte: range.start, lte: range.end } }, select: { createdAt: true } }),
      prisma.driverProfile.findMany({ where: { createdAt: { gte: range.start, lte: range.end } }, select: { createdAt: true } }),
      prisma.listing.findMany({ where: { createdAt: { gte: range.start, lte: range.end } }, select: { createdAt: true } }),
      prisma.delivery.findMany({
        where: { createdAt: { gte: range.start, lte: range.end } },
        select: { status: true, createdAt: true },
      }),
      prisma.dispute.findMany({
        where: { OR: [{ createdAt: { gte: range.start, lte: range.end } }, { resolvedAt: { gte: range.start, lte: range.end } }] },
        select: { createdAt: true, resolvedAt: true },
      }),
      prisma.escrow.findMany({
        where: { OR: [{ heldAt: { gte: range.start, lte: range.end } }, { releasedAt: { gte: range.start, lte: range.end } }, { refundedAt: { gte: range.start, lte: range.end } }] },
        select: { amount: true, platformFee: true, sellerAmount: true, status: true, heldAt: true, releasedAt: true, refundedAt: true },
      }),
      prisma.visitEvent.findMany({
        where: { createdAt: { gte: range.start, lte: range.end } },
        select: { createdAt: true, ipHash: true },
      }),
    ]);

  const orderStatuses: Record<string, number> = {};
  const paymentMethods: Record<string, number> = {};
  const sellerSales = new Map<string, number>();
  const series = new Map<string, ReportSeriesRow>();
  for (const key of seriesKeys(range as DateRange, period)) {
    series.set(key, { date: key, revenue: 0, orders: 0, users: 0, visits: 0 });
  }
  const addSeries = (date: Date | null | undefined, field: keyof Omit<ReportSeriesRow, 'date'>, value: number) => {
    if (!date) return;
    const row = series.get(bucketKey(date, period));
    if (row) row[field] += value;
  };

  let revenue = 0;
  let platformFees = 0;
  for (const payment of payments) {
    revenue += amount(payment.amount);
    platformFees += amount(payment.order.platformFee);
    increment(paymentMethods, payment.method || 'Unknown');
    for (const item of payment.order.items) {
      sellerSales.set(item.sellerId, (sellerSales.get(item.sellerId) ?? 0) + amount(item.lineTotal));
    }
    addSeries(payment.paidAt, 'revenue', amount(payment.amount));
  }
  for (const order of orders) {
    increment(orderStatuses, order.status);
    addSeries(order.createdAt, 'orders', 1);
  }
  for (const user of users) addSeries(user.createdAt, 'users', 1);
  for (const visit of visits) addSeries(visit.createdAt, 'visits', 1);

  let refunds = 0;
  let escrowHeld = 0;
  let escrowReleased = 0;
  let escrowRefunded = 0;
  for (const escrow of escrows) {
    if (escrow.heldAt >= range.start && escrow.heldAt <= range.end) {
      escrowHeld += amount(escrow.amount);
    }
    if (escrow.releasedAt && escrow.releasedAt >= range.start && escrow.releasedAt <= range.end) {
      escrowReleased += amount(escrow.sellerAmount);
    }
    if (escrow.refundedAt && escrow.refundedAt >= range.start && escrow.refundedAt <= range.end) {
      escrowRefunded += amount(escrow.amount);
      refunds += amount(escrow.amount);
    }
  }
  const delivered = deliveries.filter((row) => row.status === 'DELIVERED').length;
  const failedDeliveries = deliveries.filter((row) => row.status === 'FAILED').length;
  const disputesOpened = disputes.filter((row) => row.createdAt >= range.start && row.createdAt <= range.end).length;
  const disputesResolved = disputes.filter((row) => row.resolvedAt && row.resolvedAt >= range.start && row.resolvedAt <= range.end).length;

  return {
    orders: orders.length,
    revenue,
    platformFees,
    sellerPayouts: Math.max(0, revenue - platformFees),
    refunds,
    newUsers: users.length,
    newSellers: sellers.length,
    newDrivers: drivers.length,
    newListings: listings.length,
    visits: visits.length,
    uniqueVisitors: new Set(visits.map((row) => row.ipHash || row.createdAt.toISOString())).size,
    deliveries: deliveries.length,
    delivered,
    failedDeliveries,
    disputesOpened,
    disputesResolved,
    escrowHeld,
    escrowReleased,
    escrowRefunded,
    orderStatuses,
    paymentMethods,
    sellerSales: [...sellerSales.entries()]
      .map(([sellerId, sales]) => ({ sellerId, sales }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10),
    series: [...series.values()],
  };
}

function change(current: number, previous: number) {
  return previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / previous) * 100;
}

function metric(current: number, previous: number) {
  return { value: current, previous, change: change(current, previous) };
}

export async function buildAdminReport(
  prisma: PrismaService,
  requestedPeriod?: string,
  anchor?: string,
) {
  const period = normalizeReportPeriod(requestedPeriod);
  const range = periodRange(period, anchor);
  const [current, previous, snapshot] = await Promise.all([
    collectPeriod(prisma, range, period),
    collectPeriod(prisma, { start: range.previousStart, end: range.previousEnd }, period),
    Promise.all([
      prisma.user.count(),
      prisma.sellerProfile.count({ where: { status: 'APPROVED' } }),
      prisma.driverProfile.count({ where: { status: 'APPROVED' } }),
      prisma.listing.count({ where: { isActive: true } }),
    ]),
  ]);

  const [users, sellers, drivers, activeListings] = snapshot;
  const sellerIds = current.sellerSales.map((row) => row.sellerId);
  const sellerRows = sellerIds.length
    ? await prisma.sellerProfile.findMany({
        where: { id: { in: sellerIds } },
        select: { id: true, businessName: true },
      })
    : [];
  const sellerNames = new Map(sellerRows.map((row) => [row.id, row.businessName]));
  return {
    period: {
      type: period,
      label: range.label,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      previousStart: range.previousStart.toISOString(),
      previousEnd: range.previousEnd.toISOString(),
    },
    summary: {
      revenue: metric(current.revenue, previous.revenue),
      orders: metric(current.orders, previous.orders),
      averageOrderValue: metric(current.orders ? current.revenue / current.orders : 0, previous.orders ? previous.revenue / previous.orders : 0),
      platformFees: metric(current.platformFees, previous.platformFees),
      sellerPayouts: metric(current.sellerPayouts, previous.sellerPayouts),
      refunds: metric(current.refunds, previous.refunds),
      visits: metric(current.visits, previous.visits),
      uniqueVisitors: metric(current.uniqueVisitors, previous.uniqueVisitors),
      newUsers: metric(current.newUsers, previous.newUsers),
      newSellers: metric(current.newSellers, previous.newSellers),
      newDrivers: metric(current.newDrivers, previous.newDrivers),
      newListings: metric(current.newListings, previous.newListings),
      deliveries: metric(current.deliveries, previous.deliveries),
      delivered: metric(current.delivered, previous.delivered),
      disputesOpened: metric(current.disputesOpened, previous.disputesOpened),
      disputesResolved: metric(current.disputesResolved, previous.disputesResolved),
      escrowHeld: metric(current.escrowHeld, previous.escrowHeld),
      escrowReleased: metric(current.escrowReleased, previous.escrowReleased),
      escrowRefunded: metric(current.escrowRefunded, previous.escrowRefunded),
    },
    snapshots: { users, sellers, drivers, activeListings },
    sales: {
      orderStatuses: Object.entries(current.orderStatuses).map(([status, count]) => ({ status, count })),
      paymentMethods: Object.entries(current.paymentMethods).map(([method, count]) => ({ method, count })),
      sellerSales: current.sellerSales.map((row) => ({
        seller: sellerNames.get(row.sellerId) ?? 'Unknown seller',
        sales: row.sales,
      })),
    },
    operations: {
      deliveries: current.deliveries,
      delivered: current.delivered,
      failed: current.failedDeliveries,
      completionRate: current.deliveries ? (current.delivered / current.deliveries) * 100 : 0,
    },
    trust: {
      escrowHeld: current.escrowHeld,
      escrowReleased: current.escrowReleased,
      escrowRefunded: current.escrowRefunded,
      disputesOpened: current.disputesOpened,
      disputesResolved: current.disputesResolved,
    },
    series: current.series,
  };
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function reportCsv(report: Awaited<ReturnType<typeof buildAdminReport>>) {
  const rows: string[][] = [
    ['SpareBolt admin report', report.period.label],
    ['Period start', report.period.start],
    ['Period end', report.period.end],
    [],
    ['Metric', 'Value', 'Previous period', 'Change %'],
  ];
  for (const [name, data] of Object.entries(report.summary)) {
    rows.push([name, String(data.value), String(data.previous), data.change == null ? 'n/a' : data.change.toFixed(2)]);
  }
  rows.push([], ['Date', 'Revenue', 'Orders', 'New users', 'Visits']);
  for (const row of report.series) rows.push([row.date, String(row.revenue), String(row.orders), String(row.users), String(row.visits)]);
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}
