import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from './firebase.service';

export type NotifyPayload = {
  type: NotificationType | keyof typeof NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private firebase: FirebaseService,
  ) {}

  async list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  async registerPushToken(
    userId: string,
    token: string,
    platform = 'web',
  ) {
    if (!token?.trim()) {
      throw new Error('token is required');
    }
    return this.prisma.pushToken.upsert({
      where: { userId_token: { userId, token: token.trim() } },
      create: { userId, token: token.trim(), platform: platform || 'web' },
      update: { platform: platform || 'web' },
    });
  }

  async unregisterPushToken(userId: string, token: string) {
    return this.prisma.pushToken.deleteMany({
      where: { userId, token },
    });
  }

  /**
   * Create in-app notification and fan-out FCM push to the user's devices.
   */
  async notify(userId: string, payload: NotifyPayload) {
    const dataJson =
      payload.data === undefined
        ? undefined
        : (payload.data as Prisma.InputJsonValue);

    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type: payload.type as NotificationType,
        title: payload.title,
        body: payload.body,
        data: dataJson,
      },
    });

    // Push async — never block the main request on FCM latency
    void this.pushToUser(userId, {
      title: payload.title,
      body: payload.body,
      data: this.flattenData(payload.data, {
        notificationId: notification.id,
        type: payload.type,
      }),
    });

    return notification;
  }

  /**
   * Fan a notification out to every active admin (in-app row + FCM push each).
   * Self-contained error handling so callers can fire-and-forget without
   * risking the originating request (e.g. a seller/driver registration).
   */
  async notifyAdmins(payload: NotifyPayload) {
    try {
      const admins = await this.prisma.user.findMany({
        where: { role: Role.ADMIN, isActive: true },
        select: { id: true },
      });
      await Promise.all(admins.map((a) => this.notify(a.id, payload)));
      return admins.length;
    } catch (err) {
      this.logger.error(
        `notifyAdmins failed: ${err instanceof Error ? err.message : err}`,
      );
      return 0;
    }
  }

  /**
   * Send push only (e.g. after a transaction already wrote the DB row).
   */
  async pushToUser(
    userId: string,
    payload: {
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ) {
    if (!this.firebase.isReady()) return { success: 0, failed: [] as string[] };

    const tokens = await this.prisma.pushToken.findMany({
      where: { userId },
      select: { token: true },
    });
    if (!tokens.length) return { success: 0, failed: [] as string[] };

    try {
      const result = await this.firebase.sendToTokens(
        tokens.map((t) => t.token),
        payload,
      );

      if (result.failed.length) {
        await this.prisma.pushToken.deleteMany({
          where: { token: { in: result.failed } },
        });
        this.logger.log(
          `Pruned ${result.failed.length} invalid FCM token(s) for user ${userId}`,
        );
      }

      if (result.success > 0) {
        this.logger.debug(
          `Pushed to ${result.success} device(s) for user ${userId}`,
        );
      }

      return result;
    } catch (err) {
      this.logger.error(
        `Push fan-out failed: ${err instanceof Error ? err.message : err}`,
      );
      return { success: 0, failed: [] as string[] };
    }
  }

  private flattenData(
    data: Record<string, unknown> | undefined,
    extra: Record<string, string>,
  ): Record<string, string> {
    const out: Record<string, string> = { ...extra };
    if (!data) return out;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined || v === null) continue;
      out[k] = typeof v === 'string' ? v : JSON.stringify(v);
    }
    return out;
  }
}
