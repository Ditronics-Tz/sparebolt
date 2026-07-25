import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

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

export const CUSTOM_REPORT_TYPES = [
  'orders',
  'payments',
  'escrows',
  'disputes',
  'deliveries',
  'visits',
] as const;

export type CustomReportType = (typeof CUSTOM_REPORT_TYPES)[number];
export type CustomReportFieldGroup = CustomReportType | 'customers' | 'sellers' | 'drivers';

export type CustomReportFields = Partial<Record<CustomReportFieldGroup, string[]>>;

export type CustomReportConfig = {
  types: CustomReportType[];
  startDate: string;
  endDate: string;
  filters?: { search?: string; status?: string; method?: string };
  recordIds?: Partial<Record<CustomReportType, string[]>>;
  fields?: CustomReportFields;
};

export type CustomRecord = {
  id: string;
  date: string;
  label: string;
  status: string;
  amount: number | null;
  detail: string;
  cells: Record<string, string>;
};

export type CustomReportColumn = { key: string; label: string };

export const CUSTOM_REPORT_FIELD_OPTIONS: Record<CustomReportFieldGroup, CustomReportColumn[]> = {
  orders: [
    { key: 'orderDate', label: 'Order date' },
    { key: 'orderId', label: 'Order ID' },
    { key: 'orderAmount', label: 'Amount' },
    { key: 'orderStatus', label: 'Order status' },
  ],
  customers: [
    { key: 'customerName', label: 'Customer name' },
    { key: 'customerPhone', label: 'Customer phone' },
    { key: 'customerEmail', label: 'Customer email' },
  ],
  sellers: [
    { key: 'sellerName', label: 'Seller name' },
    { key: 'sellerContactName', label: 'Seller contact name' },
    { key: 'sellerPhone', label: 'Seller phone' },
  ],
  drivers: [
    { key: 'driverName', label: 'Driver name' },
    { key: 'driverPhone', label: 'Driver phone' },
    { key: 'vehiclePlate', label: 'Vehicle plate' },
    { key: 'vehicleType', label: 'Vehicle type' },
  ],
  deliveries: [
    { key: 'deliveryDate', label: 'Delivery date' },
    { key: 'deliveryOrderId', label: 'Order ID' },
    { key: 'deliveryStatus', label: 'Delivery status' },
    { key: 'pickupLocation', label: 'Pickup location' },
    { key: 'dropoffLocation', label: 'Drop-off location' },
    { key: 'deliveredDate', label: 'Delivered date' },
  ],
  payments: [
    { key: 'date', label: 'Date' },
    { key: 'record', label: 'Record' },
    { key: 'status', label: 'Status' },
    { key: 'amount', label: 'Amount' },
    { key: 'method', label: 'Method' },
  ],
  escrows: [
    { key: 'date', label: 'Date' },
    { key: 'record', label: 'Record' },
    { key: 'status', label: 'Status' },
    { key: 'amount', label: 'Amount' },
  ],
  disputes: [
    { key: 'date', label: 'Date' },
    { key: 'record', label: 'Record' },
    { key: 'status', label: 'Status' },
    { key: 'reason', label: 'Reason' },
  ],
  visits: [
    { key: 'date', label: 'Date' },
    { key: 'path', label: 'Path' },
    { key: 'location', label: 'Location' },
  ],
};

const DEFAULT_CUSTOM_FIELDS: CustomReportFields = {
  orders: ['orderDate', 'orderId', 'orderAmount', 'orderStatus'],
  customers: ['customerName', 'customerPhone'],
  sellers: ['sellerName', 'sellerPhone'],
  drivers: ['driverName', 'driverPhone', 'vehiclePlate'],
  payments: ['date', 'record', 'status', 'amount', 'method'],
  escrows: ['date', 'record', 'status', 'amount'],
  disputes: ['date', 'record', 'status', 'reason'],
  deliveries: ['deliveryDate', 'deliveryOrderId', 'deliveryStatus'],
  visits: ['date', 'path', 'location'],
};

function customColumns(type: CustomReportType, fields?: CustomReportFields): CustomReportColumn[] {
  const groups: CustomReportFieldGroup[] = type === 'orders'
    ? ['orders', 'customers', 'sellers', 'drivers', 'deliveries']
    : [type];
  const selected = fields ?? DEFAULT_CUSTOM_FIELDS;
  return groups.flatMap((group) => {
    const keys = selected[group] ?? (fields ? [] : DEFAULT_CUSTOM_FIELDS[group] ?? CUSTOM_REPORT_FIELD_OPTIONS[group].map((field) => field.key));
    return CUSTOM_REPORT_FIELD_OPTIONS[group].filter((field) => keys.includes(field.key));
  });
}

function customCells(base: { date: string; label: string; status: string; amount: number | null; detail: string }) {
  return {
    date: base.date.slice(0, 10),
    record: base.label,
    status: base.status,
    amount: base.amount == null ? '' : String(base.amount),
    details: base.detail,
  };
}

function customRange(config: Pick<CustomReportConfig, 'startDate' | 'endDate'>) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(config.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(config.endDate)) {
    throw new BadRequestException('Dates must use YYYY-MM-DD format');
  }
  const start = new Date(`${config.startDate}T00:00:00+03:00`);
  const end = new Date(`${config.endDate}T23:59:59.999+03:00`);
  if (start > end) throw new BadRequestException('Start date must be before end date');
  return { start, end };
}

function validCustomTypes(types: string[]) {
  return types.filter((type): type is CustomReportType =>
    (CUSTOM_REPORT_TYPES as readonly string[]).includes(type),
  );
}

function customMatch(row: CustomRecord, config: CustomReportConfig) {
  const filters = config.filters ?? {};
  if (filters.status === 'NOT_DELIVERED') {
    if (['DELIVERED', 'CONFIRMED', 'REFUNDED', 'CANCELLED'].includes(row.status)) return false;
  } else if (filters.status && row.status !== filters.status) return false;
  if (filters.method && !row.detail.toLowerCase().includes(filters.method.toLowerCase())) return false;
  if (filters.search) {
    const search = filters.search.toLowerCase();
    if (!`${row.label} ${row.status} ${row.detail} ${Object.values(row.cells).join(' ')}`.toLowerCase().includes(search)) return false;
  }
  const selected = config.recordIds?.[config.types.find(() => true) as CustomReportType];
  return !selected || selected.length === 0 || selected.includes(row.id);
}

async function recordsForType(
  prisma: PrismaService,
  type: CustomReportType,
  range: { start: Date; end: Date },
) : Promise<CustomRecord[]> {
  if (type === 'orders') {
    const rows = await prisma.order.findMany({
      where: { createdAt: { gte: range.start, lte: range.end } },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        customer: { select: { firstName: true, lastName: true, phone: true, email: true } },
        items: { select: { sellerId: true } },
        delivery: {
          select: {
            status: true,
            pickupLabel: true,
            pickupCity: true,
            dropoffLat: true,
            dropoffLng: true,
            deliveredAt: true,
            driver: {
              select: {
                legalFullName: true,
                secondaryPhone: true,
                vehiclePlate: true,
                vehicleType: true,
                user: { select: { firstName: true, lastName: true, phone: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    const sellerIds = [...new Set(rows.flatMap((row) => row.items.map((item) => item.sellerId)))];
    const sellerRows = sellerIds.length
      ? await prisma.sellerProfile.findMany({
        where: { id: { in: sellerIds } },
        select: { id: true, businessName: true, legalFullName: true, user: { select: { phone: true } } },
      })
      : [];
    const sellerNames = new Map(sellerRows.map((seller) => [seller.id, seller]));
    return rows.flatMap((row) => {
      const date = row.createdAt.toISOString();
      const orderAmount = amount(row.total);
      const customerName = `${row.customer.firstName} ${row.customer.lastName}`;
      const driver = row.delivery?.driver;
      const driverName = driver
        ? driver.legalFullName || `${driver.user.firstName} ${driver.user.lastName}`
        : '';
      const sellerItems = row.items.length ? row.items : [{ sellerId: '' }];
      return sellerItems.map((item, sellerIndex) => {
        const seller = sellerNames.get(item.sellerId);
        const cells = {
          orderDate: date.slice(0, 10),
          orderId: row.orderNumber,
          orderAmount: String(orderAmount),
          orderStatus: row.status,
          customerName,
          customerPhone: row.customer.phone || '',
          customerEmail: row.customer.email || '',
          sellerName: seller?.businessName || 'Unknown seller',
          sellerContactName: seller?.legalFullName || '',
          sellerPhone: seller?.user.phone || '',
          driverName,
          driverPhone: driver ? driver.user.phone || driver.secondaryPhone || '' : '',
          vehiclePlate: driver?.vehiclePlate || '',
          vehicleType: driver?.vehicleType || '',
          deliveryStatus: row.delivery?.status || '',
          pickupLocation: [row.delivery?.pickupLabel, row.delivery?.pickupCity].filter(Boolean).join(', '),
          dropoffLocation: row.delivery?.dropoffLat != null && row.delivery?.dropoffLng != null
            ? `${row.delivery.dropoffLat}, ${row.delivery.dropoffLng}`
            : '',
          deliveredDate: row.delivery?.deliveredAt?.toISOString().slice(0, 10) || '',
        };
        return {
          id: `${row.id}:${item.sellerId || sellerIndex}`,
          date,
          label: row.orderNumber,
          status: row.status,
          amount: orderAmount,
          detail: `${customerName} | ${cells.sellerName} | ${driverName || 'Not assigned'}`,
          cells,
        };
      });
    });
  }
  if (type === 'payments') {
    const rows = await prisma.payment.findMany({
      where: { createdAt: { gte: range.start, lte: range.end } },
      select: { id: true, status: true, amount: true, method: true, createdAt: true, order: { select: { orderNumber: true } } },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    return rows.map((row) => {
      const base = { id: row.id, date: row.createdAt.toISOString(), label: row.order.orderNumber, status: row.status, amount: amount(row.amount), detail: row.method || 'Unknown method' };
      return { ...base, cells: { ...customCells(base), method: row.method || '' } };
    });
  }
  if (type === 'escrows') {
    const rows = await prisma.escrow.findMany({
      where: { heldAt: { gte: range.start, lte: range.end } },
      select: { id: true, status: true, amount: true, heldAt: true, order: { select: { orderNumber: true } } },
      orderBy: { heldAt: 'desc' },
      take: 1000,
    });
    return rows.map((row) => {
      const base = { id: row.id, date: row.heldAt.toISOString(), label: row.order.orderNumber, status: row.status, amount: amount(row.amount), detail: 'Escrow transaction' };
      return { ...base, cells: customCells(base) };
    });
  }
  if (type === 'disputes') {
    const rows = await prisma.dispute.findMany({
      where: { createdAt: { gte: range.start, lte: range.end } },
      select: { id: true, status: true, reason: true, createdAt: true, order: { select: { orderNumber: true } } },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    return rows.map((row) => {
      const base = { id: row.id, date: row.createdAt.toISOString(), label: row.order.orderNumber, status: row.status, amount: null, detail: row.reason };
      return { ...base, cells: { ...customCells(base), reason: row.reason } };
    });
  }
  if (type === 'deliveries') {
    const rows = await prisma.delivery.findMany({
      where: { createdAt: { gte: range.start, lte: range.end } },
      select: { id: true, status: true, createdAt: true, order: { select: { orderNumber: true } } },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    return rows.map((row) => {
      const base = { id: row.id, date: row.createdAt.toISOString(), label: row.order.orderNumber, status: row.status, amount: null, detail: 'Delivery operation' };
      return {
        ...base,
        cells: {
          deliveryDate: row.createdAt.toISOString().slice(0, 10),
          deliveryOrderId: row.order.orderNumber,
          deliveryStatus: row.status,
          pickupLocation: '',
          dropoffLocation: '',
          deliveredDate: '',
        },
      };
    });
  }
  const rows = await prisma.visitEvent.findMany({
    where: { createdAt: { gte: range.start, lte: range.end } },
    select: { id: true, createdAt: true, path: true, city: true, region: true, country: true },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });
  return rows.map((row) => {
    const location = [row.city, row.region, row.country].filter(Boolean).join(', ') || 'Unknown location';
    const base = { id: row.id, date: row.createdAt.toISOString(), label: row.path, status: 'VISIT', amount: null, detail: location };
    return { ...base, cells: { ...customCells(base), path: row.path, location } };
  });
}

export async function customRecordPicker(
  prisma: PrismaService,
  typeValue: string,
  config: Pick<CustomReportConfig, 'startDate' | 'endDate' | 'filters' | 'fields'>,
  page = 1,
) {
  const type = validCustomTypes([typeValue])[0];
  if (!type) throw new BadRequestException('Unsupported custom report type');
  const rows = await recordsForType(prisma, type, customRange(config));
  const matching = rows.filter((row) => customMatch(row, { ...config, types: [type] }));
  const safePage = Math.max(1, Math.floor(page));
  return { type, page: safePage, pageSize: 10, total: matching.length, columns: customColumns(type, config.fields), records: matching.slice((safePage - 1) * 10, safePage * 10) };
}

export async function buildCustomReport(prisma: PrismaService, config: CustomReportConfig) {
  const types = validCustomTypes(config.types);
  if (!types.length) throw new BadRequestException('Select at least one report type');
  const range = customRange(config);
  const sections = [];
  for (const type of types) {
    const rows = await recordsForType(prisma, type, range);
    const selectedIds = config.recordIds?.[type];
    const matching = rows.filter((row) => {
      if (selectedIds?.length && !selectedIds.includes(row.id)) return false;
      return customMatch(row, { ...config, types: [type], recordIds: { [type]: selectedIds } });
    });
    sections.push({ type, total: matching.length, amount: matching.reduce((sum, row) => sum + (row.amount ?? 0), 0), columns: customColumns(type, config.fields), records: matching });
  }
  return { startDate: config.startDate, endDate: config.endDate, sections };
}

export function customReportCsv(report: Awaited<ReturnType<typeof buildCustomReport>>) {
  const rows: string[][] = [['SpareBolt custom report'], ['Start date', report.startDate], ['End date', report.endDate], []];
  for (const section of report.sections) {
    rows.push([], [section.type.toUpperCase()], section.columns.map((column) => column.label));
    for (const row of section.records) rows.push(section.columns.map((column) => row.cells[column.key] ?? ''));
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}
