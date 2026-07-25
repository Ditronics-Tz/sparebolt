import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ListingsModule } from './listings/listings.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SellerModule } from './seller/seller.module';
import { AdsModule } from './ads/ads.module';
import { UploadsModule } from './uploads/uploads.module';
import { LocationsModule } from './locations/locations.module';
import { CartModule } from './cart/cart.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    ListingsModule,
    OrdersModule,
    PaymentsModule,
    DeliveriesModule,
    AdminModule,
    NotificationsModule,
    SellerModule,
    AdsModule,
    UploadsModule,
    LocationsModule,
    CartModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
