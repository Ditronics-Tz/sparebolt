import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  LoginDto,
  RegisterDto,
  RegisterDriverDto,
  RegisterSellerDto,
  RequestOtpDto,
  UpdateProfileDto,
  VerifyOtpDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private notifications: NotificationsService,
  ) {}

  private signToken(user: {
    id: string;
    email: string | null;
    phone: string | null;
    role: Role;
  }) {
    const payload = {
      sub: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };
    return {
      accessToken: this.jwt.sign(payload),
      user: this.sanitize(user),
    };
  }

  private sanitize(user: Record<string, unknown>) {
    const { passwordHash: _, ...rest } = user as {
      passwordHash?: string;
      [k: string]: unknown;
    };
    return rest;
  }

  async register(dto: RegisterDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Email or phone is required');
    }
    if (dto.email) {
      const exists = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (exists) throw new ConflictException('Email already registered');
    }
    if (dto.phone) {
      const exists = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (exists) throw new ConflictException('Phone already registered');
    }

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : null;

    const allowedRoles: Role[] = [Role.CUSTOMER, Role.SELLER, Role.DRIVER];
    const role =
      dto.role && allowedRoles.includes(dto.role) ? dto.role : Role.CUSTOMER;

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        role,
      },
    });

    return this.signToken(user);
  }

  async login(dto: LoginDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Email or phone is required');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          dto.email ? { email: dto.email } : undefined,
          dto.phone ? { phone: dto.phone } : undefined,
        ].filter(Boolean) as { email?: string; phone?: string }[],
      },
      include: { sellerProfile: true, driverProfile: true },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.signToken(user);
  }

  async requestOtp(dto: RequestOtpDto) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.otpCode.create({
      data: {
        phone: dto.phone,
        code,
        purpose: 'login',
        expiresAt,
      },
    });

    // In production: send via SMS provider
    const isDev = this.config.get('NODE_ENV') !== 'production';
    return {
      message: 'OTP sent',
      ...(isDev ? { debugCode: code } : {}),
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const otp = await this.prisma.otpCode.findFirst({
      where: {
        phone: dto.phone,
        code: dto.code,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) throw new UnauthorizedException('Invalid or expired OTP');

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { used: true },
    });

    let user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      include: { sellerProfile: true, driverProfile: true },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone: dto.phone,
          firstName: dto.firstName || 'User',
          lastName: dto.lastName || '',
          phoneVerified: true,
          role: Role.CUSTOMER,
        },
        include: { sellerProfile: true, driverProfile: true },
      });
    } else if (!user.phoneVerified) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { phoneVerified: true },
        include: { sellerProfile: true, driverProfile: true },
      });
    }

    return this.signToken(user);
  }

  async registerSeller(userId: string, dto: RegisterSellerDto) {
    const existing = await this.prisma.sellerProfile.findUnique({
      where: { userId },
    });
    // Only a previously REJECTED applicant may resubmit; an approved, pending,
    // or suspended profile cannot re-register.
    if (existing && existing.status !== 'REJECTED') {
      throw new ConflictException('Already a seller');
    }

    if (
      !dto.termsAccepted ||
      !dto.dataConsent ||
      !dto.accurateListingConsent
    ) {
      throw new BadRequestException(
        'You must accept seller terms, data processing, and accurate listing consents',
      );
    }

    if (dto.payoutMethod === 'mobile_money' && !dto.payoutPhone) {
      throw new BadRequestException(
        'Mobile money number is required for payout',
      );
    }
    if (
      dto.payoutMethod === 'bank' &&
      (!dto.bankName || !dto.bankAccountNumber)
    ) {
      throw new BadRequestException(
        'Bank name and account number are required',
      );
    }

    if (
      dto.businessType === 'company' &&
      !dto.registrationNumber?.trim()
    ) {
      throw new BadRequestException(
        'Business registration number is required for companies',
      );
    }

    const now = new Date();
    const isResubmission = Boolean(existing);
    const data = {
      businessName: dto.businessName,
      businessType: dto.businessType,
      description: dto.description,
      registrationNumber: dto.registrationNumber,
      tinNumber: dto.tinNumber,
      yearsTrading: dto.yearsTrading,
      legalFullName: dto.legalFullName,
      nationalId: dto.nationalId,
      nationalIdFrontUrl: dto.nationalIdFrontUrl,
      nationalIdBackUrl: dto.nationalIdBackUrl,
      selfieUrl: dto.selfieUrl,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
      secondaryPhone: dto.secondaryPhone,
      addressStreet: dto.addressStreet,
      addressArea: dto.addressArea,
      addressWard: dto.addressWard,
      city: dto.city,
      region: dto.region,
      addressLandmark: dto.addressLandmark,
      latitude: dto.latitude,
      longitude: dto.longitude,
      shopExteriorUrl: dto.shopExteriorUrl,
      shopInteriorUrl: dto.shopInteriorUrl,
      payoutMethod: dto.payoutMethod,
      payoutPhone: dto.payoutPhone,
      payoutAccountName: dto.payoutAccountName,
      bankName: dto.bankName,
      bankAccountNumber: dto.bankAccountNumber,
      licenseNumber: dto.licenseNumber,
      termsAcceptedAt: now,
      dataConsentAt: now,
      accurateListingAt: now,
      status: 'PENDING' as const,
      // Clear any prior rejection so the row re-enters the review queue clean.
      rejectionReason: null,
    };

    const profile = existing
      ? await this.prisma.sellerProfile.update({ where: { userId }, data })
      : (
          await this.prisma.$transaction([
            this.prisma.sellerProfile.create({ data: { userId, ...data } }),
            this.prisma.user.update({
              where: { id: userId },
              data: { role: Role.SELLER },
            }),
          ])
        )[0];

    await this.notifications.notify(userId, {
      type: 'APPROVAL',
      title: isResubmission
        ? 'Seller application resubmitted'
        : 'Seller application received',
      body: 'Your documents are under review. You can list parts after approval.',
    });

    // Alert admins so the KYC queue is actioned promptly (in-app + push).
    void this.notifications.notifyAdmins({
      type: 'APPROVAL',
      title: isResubmission
        ? 'Seller application resubmitted'
        : 'New seller application',
      body: `${dto.businessName} ${
        isResubmission ? 'resubmitted' : 'submitted'
      } seller KYC and is awaiting review.`,
      data: { kind: 'seller_application', sellerId: profile.id },
    });

    return {
      ...profile,
      message: isResubmission
        ? 'Application resubmitted. Admin will review your updated details.'
        : 'Application submitted. Admin will verify your identity and shop before you can sell.',
    };
  }

  async registerDriver(userId: string, dto: RegisterDriverDto) {
    const existing = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    // Only a previously REJECTED applicant may resubmit; an approved, pending,
    // or suspended profile cannot re-register.
    if (existing && existing.status !== 'REJECTED') {
      throw new ConflictException('Already a driver');
    }

    if (!dto.termsAccepted || !dto.dataConsent || !dto.trackingConsent) {
      throw new BadRequestException(
        'You must accept terms, data processing, and location tracking consents',
      );
    }

    if (dto.payoutMethod === 'mobile_money' && !dto.payoutPhone) {
      throw new BadRequestException(
        'Mobile money number is required for payout',
      );
    }
    if (
      dto.payoutMethod === 'bank' &&
      (!dto.bankName || !dto.bankAccountNumber)
    ) {
      throw new BadRequestException(
        'Bank name and account number are required',
      );
    }

    const now = new Date();
    const isResubmission = Boolean(existing);
    const data = {
      legalFullName: dto.legalFullName,
      nationalId: dto.nationalId,
      nationalIdFrontUrl: dto.nationalIdFrontUrl,
      nationalIdBackUrl: dto.nationalIdBackUrl,
      selfieUrl: dto.selfieUrl,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
      secondaryPhone: dto.secondaryPhone,
      addressStreet: dto.addressStreet,
      addressArea: dto.addressArea,
      addressWard: dto.addressWard,
      city: dto.city,
      addressLandmark: dto.addressLandmark,
      homeLatitude: dto.homeLatitude,
      homeLongitude: dto.homeLongitude,
      vehicleType: dto.vehicleType,
      vehiclePlate: dto.vehiclePlate.toUpperCase().trim(),
      vehicleMake: dto.vehicleMake,
      vehicleModel: dto.vehicleModel,
      vehicleColor: dto.vehicleColor,
      vehicleYear: dto.vehicleYear,
      vehiclePhotoSideUrl: dto.vehiclePhotoSideUrl,
      vehiclePhotoRearUrl: dto.vehiclePhotoRearUrl,
      vehiclePhotoWithDriverUrl: dto.vehiclePhotoWithDriverUrl,
      licenseNumber: dto.licenseNumber,
      licenseClass: dto.licenseClass,
      licensePhotoUrl: dto.licensePhotoUrl,
      insuranceDocUrl: dto.insuranceDocUrl,
      insuranceExpiresAt: dto.insuranceExpiresAt
        ? new Date(dto.insuranceExpiresAt)
        : null,
      payoutMethod: dto.payoutMethod,
      payoutPhone: dto.payoutPhone,
      payoutAccountName: dto.payoutAccountName,
      bankName: dto.bankName,
      bankAccountNumber: dto.bankAccountNumber,
      emergencyName: dto.emergencyName,
      emergencyPhone: dto.emergencyPhone,
      emergencyRelation: dto.emergencyRelation,
      guarantorName: dto.guarantorName,
      guarantorPhone: dto.guarantorPhone,
      guarantorIdNumber: dto.guarantorIdNumber,
      guarantorAddress: dto.guarantorAddress,
      termsAcceptedAt: now,
      dataConsentAt: now,
      trackingConsentAt: now,
      // Pending admin document verification before jobs
      status: 'PENDING' as const,
      // Clear any prior rejection so the row re-enters the review queue clean.
      rejectionReason: null,
    };

    const profile = existing
      ? await this.prisma.driverProfile.update({ where: { userId }, data })
      : (
          await this.prisma.$transaction([
            this.prisma.driverProfile.create({ data: { userId, ...data } }),
            this.prisma.user.update({
              where: { id: userId },
              data: { role: Role.DRIVER },
            }),
          ])
        )[0];

    await this.notifications.notify(userId, {
      type: 'APPROVAL',
      title: isResubmission
        ? 'Driver application resubmitted'
        : 'Driver application received',
      body: 'Your documents are under review. You can accept jobs after approval.',
    });

    // Alert admins so the KYC queue is actioned promptly (in-app + push).
    void this.notifications.notifyAdmins({
      type: 'APPROVAL',
      title: isResubmission
        ? 'Driver application resubmitted'
        : 'New driver application',
      body: `${dto.legalFullName || 'A new driver'} ${
        isResubmission ? 'resubmitted' : 'submitted'
      } driver KYC and is awaiting review.`,
      data: { kind: 'driver_application', driverId: profile.id },
    });

    return {
      ...profile,
      message: isResubmission
        ? 'Application resubmitted. Admin will review your updated details.'
        : 'Application submitted. Admin will verify your ID and vehicle before you can take jobs.',
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { sellerProfile: true, driverProfile: true, addresses: true },
    });
    if (!user) throw new UnauthorizedException();
    return this.sanitize(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existing) throw new UnauthorizedException();

    if (dto.email !== undefined && dto.email !== existing.email) {
      if (dto.email) {
        const taken = await this.prisma.user.findFirst({
          where: { email: dto.email, NOT: { id: userId } },
        });
        if (taken) throw new ConflictException('Email already in use');
      }
    }
    if (dto.phone !== undefined && dto.phone !== existing.phone) {
      if (dto.phone) {
        const taken = await this.prisma.user.findFirst({
          where: { phone: dto.phone, NOT: { id: userId } },
        });
        if (taken) throw new ConflictException('Phone already in use');
      }
    }

    const data: {
      firstName?: string;
      lastName?: string;
      email?: string | null;
      phone?: string | null;
      avatarUrl?: string | null;
      locale?: string;
    } = {};

    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName.trim();
    if (dto.email !== undefined) data.email = dto.email || null;
    if (dto.phone !== undefined) data.phone = dto.phone || null;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl || null;
    if (dto.locale !== undefined) {
      data.locale = dto.locale === 'sw' ? 'sw' : 'en';
    }

    const hasLocation =
      dto.addressStreet !== undefined ||
      dto.addressCity !== undefined ||
      dto.addressRegion !== undefined ||
      dto.addressArea !== undefined;

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.user.update({ where: { id: userId }, data });
      }

      if (hasLocation) {
        const street = (dto.addressStreet || '').trim();
        const city = (dto.addressCity || '').trim();
        const region = dto.addressRegion?.trim() || null;
        const area = dto.addressArea?.trim() || null;
        const label = (dto.addressLabel || 'Home').trim() || 'Home';

        if (street && city) {
          const currentDefault = await tx.address.findFirst({
            where: { userId, isDefault: true },
          });
          if (currentDefault) {
            await tx.address.update({
              where: { id: currentDefault.id },
              data: {
                label,
                street,
                city,
                region,
                area,
                isDefault: true,
              },
            });
          } else {
            await tx.address.create({
              data: {
                userId,
                label,
                street,
                city,
                region,
                area,
                isDefault: true,
              },
            });
          }
        }
      }
    });

    return this.me(userId);
  }
}
