import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApprovalStatus, Role } from '@prisma/client';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('analytics/visits')
  visitAnalytics(@Query('range') range?: string) {
    return this.admin.visitAnalytics(range);
  }

  @Get('users')
  users(@Query('role') role?: string) {
    return this.admin.listUsers(role);
  }

  @Patch('users/:id/active')
  setActive(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.admin.setUserActive(id, body.isActive);
  }

  @Get('sellers')
  sellers(@Query('status') status?: string) {
    return this.admin.listSellers(status);
  }

  @Patch('sellers/:id/status')
  sellerStatus(
    @Param('id') id: string,
    @Body() body: { status: ApprovalStatus; reason?: string },
  ) {
    return this.admin.approveSeller(id, body.status, body.reason);
  }

  @Get('drivers')
  drivers(@Query('status') status?: string) {
    return this.admin.listDrivers(status);
  }

  @Patch('drivers/:id/status')
  driverStatus(
    @Param('id') id: string,
    @Body() body: { status: ApprovalStatus; reason?: string },
  ) {
    return this.admin.approveDriver(id, body.status, body.reason);
  }

  @Get('disputes')
  disputes() {
    return this.admin.listDisputes();
  }

  @Post('disputes/:id/resolve')
  resolve(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body() body: { resolution: 'customer' | 'seller'; notes?: string },
  ) {
    return this.admin.resolveDispute(
      id,
      adminId,
      body.resolution,
      body.notes,
    );
  }

  @Patch('listings/:id')
  moderate(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.admin.moderateListing(id, body.isActive);
  }

  @Get('escrows')
  escrows() {
    return this.admin.listEscrows();
  }
}
