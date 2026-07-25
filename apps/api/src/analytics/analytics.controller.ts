import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OptionalJwtGuard } from '../common/guards/optional-jwt.guard';
import { AnalyticsService } from './analytics.service';

type VisitBody = {
  path?: string;
  referrer?: string | null;
};

@Controller('analytics')
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Post('visit')
  @UseGuards(OptionalJwtGuard)
  trackVisit(
    @Body() body: VisitBody,
    @Req() req: Request,
    @CurrentUser('id') userId?: string,
  ) {
    return this.analytics.trackVisit({
      userId,
      path: body.path,
      referrer: body.referrer,
      req,
    });
  }
}
