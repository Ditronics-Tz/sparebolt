import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

type TrackVisitInput = {
  userId?: string;
  path?: string;
  referrer?: string | null;
  req: Request;
};

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async trackVisit(input: TrackVisitInput) {
    const path = normalizePath(input.path);
    const location = locationFromHeaders(input.req);
    const ip = clientIp(input.req);

    await this.prisma.visitEvent.create({
      data: {
        userId: input.userId,
        path,
        referrer: input.referrer?.slice(0, 500) || null,
        userAgent: input.req.get('user-agent')?.slice(0, 500) || null,
        ipHash: ip ? hashIp(ip) : null,
        country: location.country,
        region: location.region,
        city: location.city,
      },
    });

    return { ok: true };
  }
}

function normalizePath(path?: string) {
  const value = (path || '/').trim();
  if (!value.startsWith('/')) return '/';
  return value.slice(0, 300);
}

function clientIp(req: Request) {
  const forwarded = req.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim();
  return req.ip || req.socket.remoteAddress || undefined;
}

function hashIp(ip: string) {
  return createHash('sha256').update(ip).digest('hex');
}

function decodeHeader(value?: string) {
  if (!value) return null;
  try {
    return decodeURIComponent(value).trim() || null;
  } catch {
    return value.trim() || null;
  }
}

function locationFromHeaders(req: Request) {
  const country =
    decodeHeader(req.get('cf-ipcountry')) ||
    decodeHeader(req.get('x-vercel-ip-country')) ||
    decodeHeader(req.get('x-country')) ||
    'Unknown';
  const region =
    decodeHeader(req.get('x-vercel-ip-country-region')) ||
    decodeHeader(req.get('x-appengine-region')) ||
    decodeHeader(req.get('x-region'));
  const city =
    decodeHeader(req.get('x-vercel-ip-city')) ||
    decodeHeader(req.get('x-appengine-city')) ||
    decodeHeader(req.get('x-city'));

  return { country, region, city };
}
