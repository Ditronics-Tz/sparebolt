import { Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, DisputeStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async dashboard() {
    const [
      users,
      sellers,
      drivers,
      pendingSellers,
      pendingDrivers,
      listings,
      orders,
      heldEscrow,
      openDisputes,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.sellerProfile.count({ where: { status: 'APPROVED' } }),
      this.prisma.driverProfile.count({ where: { status: 'APPROVED' } }),
      this.prisma.sellerProfile.count({ where: { status: 'PENDING' } }),
      this.prisma.driverProfile.count({ where: { status: 'PENDING' } }),
      this.prisma.listing.count({ where: { isActive: true } }),
      this.prisma.order.count(),
      this.prisma.escrow.aggregate({
        where: { status: 'HELD' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.dispute.count({ where: { status: 'OPEN' } }),
    ]);

    const recentOrders = await this.prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        payment: true,
      },
    });

    return {
      stats: {
        users,
        sellers,
        drivers,
        pendingSellers,
        pendingDrivers,
        listings,
        orders,
        escrowHeld: Number(heldEscrow._sum.amount ?? 0),
        escrowCount: heldEscrow._count,
        openDisputes,
        needsAttention: pendingSellers + pendingDrivers + openDisputes,
      },
      recentOrders,
    };
  }

  async listUsers(role?: string) {
    return this.prisma.user.findMany({
      where: role ? { role: role as never } : undefined,
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        sellerProfile: true,
        driverProfile: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async visitAnalytics(range = '30d') {
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const since = new Date(Date.now() - days * 86_400_000);
    const where = { createdAt: { gte: since } };

    const [totalVisits, uniqueRows, topPaths, topLocations, recentVisits] =
      await Promise.all([
        this.prisma.visitEvent.count({ where }),
        this.prisma.visitEvent.findMany({
          where: { ...where, ipHash: { not: null } },
          distinct: ['ipHash'],
          select: { ipHash: true },
        }),
        this.prisma.visitEvent.groupBy({
          by: ['path'],
          where,
          _count: { _all: true },
          orderBy: { _count: { path: 'desc' } },
          take: 10,
        }),
        this.prisma.visitEvent.groupBy({
          by: ['country', 'region', 'city'],
          where,
          _count: { _all: true },
          orderBy: { _count: { country: 'desc' } },
          take: 10,
        }),
        this.prisma.visitEvent.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 25,
          select: {
            id: true,
            path: true,
            referrer: true,
            country: true,
            region: true,
            city: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        }),
      ]);

    return {
      range: `${days}d`,
      totalVisits,
      uniqueVisitors: uniqueRows.length,
      topPaths: topPaths.map((row) => ({
        path: row.path,
        visits: row._count._all,
      })),
      topLocations: topLocations.map((row) => ({
        country: row.country || 'Unknown',
        region: row.region,
        city: row.city,
        visits: row._count._all,
      })),
      recentVisits,
    };
  }

  async setUserActive(userId: string, isActive: boolean) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });
  }

  async listSellers(status?: string) {
    return this.prisma.sellerProfile.findMany({
      where: status ? { status: status as ApprovalStatus } : undefined,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async approveSeller(
    sellerId: string,
    status: ApprovalStatus,
    rejectionReason?: string,
  ) {
    const profile = await this.prisma.sellerProfile.update({
      where: { id: sellerId },
      data: {
        status,
        rejectionReason:
          status === 'REJECTED' ? rejectionReason || 'Rejected by admin' : null,
      },
    });

    await this.notifications.notify(profile.userId, {
      type: 'APPROVAL',
      title:
        status === 'APPROVED'
          ? 'Seller account approved'
          : status === 'REJECTED'
            ? 'Seller application rejected'
            : `Seller status: ${status}`,
      body:
        status === 'APPROVED'
          ? 'You can now create listings and sell parts.'
          : rejectionReason || `Your seller status is now ${status}`,
    });

    return profile;
  }

  async listDrivers(status?: string) {
    return this.prisma.driverProfile.findMany({
      where: status ? { status: status as ApprovalStatus } : undefined,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async approveDriver(
    driverId: string,
    status: ApprovalStatus,
    rejectionReason?: string,
  ) {
    const profile = await this.prisma.driverProfile.update({
      where: { id: driverId },
      data: {
        status,
        licenseVerified: status === 'APPROVED',
        rejectionReason:
          status === 'REJECTED' ? rejectionReason || 'Rejected by admin' : null,
      },
    });

    await this.notifications.notify(profile.userId, {
      type: 'APPROVAL',
      title:
        status === 'APPROVED'
          ? 'Driver account approved'
          : status === 'REJECTED'
            ? 'Driver application rejected'
            : `Driver status: ${status}`,
      body:
        status === 'APPROVED'
          ? 'You can now go online and accept delivery jobs.'
          : rejectionReason || `Your driver status is now ${status}`,
    });

    return profile;
  }

  async listDisputes() {
    return this.prisma.dispute.findMany({
      include: {
        order: {
          include: {
            customer: {
              select: { firstName: true, lastName: true, phone: true },
            },
            escrow: true,
            items: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveDispute(
    disputeId: string,
    adminId: string,
    resolution: 'customer' | 'seller',
    notes?: string,
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { order: { include: { escrow: true } } },
    });
    if (!dispute) throw new NotFoundException();

    const status: DisputeStatus =
      resolution === 'customer' ? 'RESOLVED_CUSTOMER' : 'RESOLVED_SELLER';

    await this.prisma.$transaction(async (tx) => {
      await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status,
          resolution: notes,
          resolvedBy: adminId,
          resolvedAt: new Date(),
        },
      });

      if (resolution === 'customer' && dispute.order.escrow) {
        await tx.escrow.update({
          where: { orderId: dispute.orderId },
          data: {
            status: 'REFUNDED_TO_CUSTOMER',
            refundedAt: new Date(),
            notes,
          },
        });
        await tx.order.update({
          where: { id: dispute.orderId },
          data: { status: 'REFUNDED' },
        });
        await tx.payment.update({
          where: { orderId: dispute.orderId },
          data: { status: 'REFUNDED' },
        });
      } else if (dispute.order.escrow) {
        await tx.escrow.update({
          where: { orderId: dispute.orderId },
          data: {
            status: 'RELEASED_TO_SELLER',
            releasedAt: new Date(),
            notes,
          },
        });
        await tx.order.update({
          where: { id: dispute.orderId },
          data: { status: 'CONFIRMED', confirmedAt: new Date() },
        });
      }
    });

    return this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { order: { include: { escrow: true } } },
    });
  }

  async moderateListing(listingId: string, isActive: boolean) {
    return this.prisma.listing.update({
      where: { id: listingId },
      data: { isActive },
    });
  }

  async listEscrows() {
    return this.prisma.escrow.findMany({
      include: {
        order: {
          select: {
            orderNumber: true,
            status: true,
            total: true,
            createdAt: true,
            customer: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
              },
            },
            items: {
              select: {
                title: true,
                quantity: true,
                lineTotal: true,
                sellerId: true,
              },
              take: 8,
            },
            dispute: {
              select: { id: true, status: true, reason: true },
            },
          },
        },
      },
      orderBy: { heldAt: 'desc' },
      take: 200,
    });
  }
}
