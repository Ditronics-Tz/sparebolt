import { PrismaClient, PartCondition, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

/**
 * Seed regions / districts / wards from Census 2022 JSON.
 * District display names are pre-processed: first occurrence keeps base name;
 * duplicates get second part (Town / District / Municipal / City).
 */
async function seedLocations() {
  const filePath = path.join(__dirname, 'data', 'tanzania-locations.json');
  if (!fs.existsSync(filePath)) {
    console.warn('Location data file missing, skip locations seed:', filePath);
    return;
  }

  const existing = await prisma.region.count();
  if (existing > 0) {
    console.log(`Locations already seeded (${existing} regions), skip.`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<
    string,
    Record<string, string[]>
  >;

  let regionCount = 0;
  let districtCount = 0;
  let wardCount = 0;
  let sortOrder = 0;

  for (const [regionName, districts] of Object.entries(data)) {
    const region = await prisma.region.create({
      data: { name: regionName, sortOrder: sortOrder++ },
    });
    regionCount++;

    for (const [districtName, wards] of Object.entries(districts)) {
      const district = await prisma.district.create({
        data: {
          name: districtName,
          regionId: region.id,
        },
      });
      districtCount++;

      if (wards?.length) {
        // createMany for speed
        await prisma.ward.createMany({
          data: wards.map((w) => ({
            name: w,
            districtId: district.id,
          })),
          skipDuplicates: true,
        });
        wardCount += wards.length;
      }
    }
  }

  console.log(
    `Locations seeded: ${regionCount} regions, ${districtCount} districts, ${wardCount} wards`,
  );
}

async function main() {
  console.log('Seeding SpareBolt…');
  await seedLocations();

  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@sparebolt.tz' },
    update: {},
    create: {
      email: 'admin@sparebolt.tz',
      phone: '+255700000001',
      passwordHash,
      firstName: 'Admin',
      lastName: 'SpareBolt',
      role: Role.ADMIN,
      emailVerified: true,
      phoneVerified: true,
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@sparebolt.tz' },
    update: {},
    create: {
      email: 'customer@sparebolt.tz',
      phone: '+255700000002',
      passwordHash,
      firstName: 'Amina',
      lastName: 'Mwangi',
      role: Role.CUSTOMER,
      emailVerified: true,
      phoneVerified: true,
    },
  });

  const sellerUser = await prisma.user.upsert({
    where: { email: 'seller@sparebolt.tz' },
    update: {},
    create: {
      email: 'seller@sparebolt.tz',
      phone: '+255700000003',
      passwordHash,
      firstName: 'Juma',
      lastName: 'Hassan',
      role: Role.SELLER,
      emailVerified: true,
      phoneVerified: true,
    },
  });

  const driverUser = await prisma.user.upsert({
    where: { email: 'driver@sparebolt.tz' },
    update: {},
    create: {
      email: 'driver@sparebolt.tz',
      phone: '+255700000004',
      passwordHash,
      firstName: 'Baraka',
      lastName: 'Kimaro',
      role: Role.DRIVER,
      emailVerified: true,
      phoneVerified: true,
    },
  });

  const seller = await prisma.sellerProfile.upsert({
    where: { userId: sellerUser.id },
    update: {},
    create: {
      userId: sellerUser.id,
      businessName: 'Juma Auto Parts',
      businessType: 'individual',
      description: 'Genuine & quality used parts for Japanese and European cars.',
      legalFullName: 'Juma Hassan',
      nationalId: '19880115-12345-00001-45',
      nationalIdFrontUrl:
        'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&q=80',
      nationalIdBackUrl:
        'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&q=80',
      selfieUrl:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
      addressStreet: 'Nyerere Road, Gerezani',
      addressArea: 'Gerezani',
      addressWard: 'Kariakoo',
      city: 'Dar es Salaam',
      region: 'Dar es Salaam',
      addressLandmark: 'Near Kariakoo market',
      latitude: -6.7924,
      longitude: 39.2083,
      shopExteriorUrl:
        'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=600&q=80',
      payoutMethod: 'mobile_money',
      payoutPhone: '+255700000003',
      payoutAccountName: 'Juma Hassan',
      yearsTrading: 8,
      termsAcceptedAt: new Date(),
      dataConsentAt: new Date(),
      accurateListingAt: new Date(),
      status: 'APPROVED',
      ratingAvg: 4.7,
      ratingCount: 23,
    },
  });

  await prisma.driverProfile.upsert({
    where: { userId: driverUser.id },
    update: {},
    create: {
      userId: driverUser.id,
      legalFullName: 'Baraka Kimaro',
      nationalId: '19900101-12345-00001-23',
      nationalIdFrontUrl:
        'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&q=80',
      nationalIdBackUrl:
        'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&q=80',
      selfieUrl:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
      addressStreet: 'Mwenge Magomeni Street',
      addressArea: 'Mwenge',
      addressWard: 'Makumbusho',
      city: 'Dar es Salaam',
      addressLandmark: 'Near Mwenge bus stand',
      vehicleType: 'motorcycle',
      vehiclePlate: 'T 123 ABC',
      vehicleMake: 'TVS',
      vehicleModel: 'Star HLX',
      vehicleColor: 'Red',
      vehicleYear: 2021,
      vehiclePhotoSideUrl:
        'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=600&q=80',
      vehiclePhotoRearUrl:
        'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=600&q=80',
      vehiclePhotoWithDriverUrl:
        'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=600&q=80',
      licenseNumber: 'DL-DSM-44521',
      licenseClass: 'A',
      licensePhotoUrl:
        'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&q=80',
      licenseVerified: true,
      payoutMethod: 'mobile_money',
      payoutPhone: '+255700000004',
      payoutAccountName: 'Baraka Kimaro',
      emergencyName: 'Grace Kimaro',
      emergencyPhone: '+255700000099',
      emergencyRelation: 'Spouse',
      guarantorName: 'John Mushi',
      guarantorPhone: '+255700000088',
      guarantorIdNumber: '19850505-11111-00002-11',
      guarantorAddress: 'Kinondoni, Dar es Salaam',
      termsAcceptedAt: new Date(),
      dataConsentAt: new Date(),
      trackingConsentAt: new Date(),
      latitude: -6.8,
      longitude: 39.28,
      isOnline: true,
      status: 'APPROVED',
      ratingAvg: 4.9,
      ratingCount: 41,
    },
  });

  await prisma.address.create({
    data: {
      userId: customer.id,
      label: 'Home',
      street: 'Mikocheni Light Industrial Area',
      area: 'Mikocheni',
      city: 'Dar es Salaam',
      region: 'Dar es Salaam',
      latitude: -6.765,
      longitude: 39.25,
      isDefault: true,
    },
  });

  const categories = [
    { nameEn: 'Engine', nameSw: 'Injini', slug: 'engine', icon: 'engine', sortOrder: 1 },
    { nameEn: 'Brakes', nameSw: 'Breki', slug: 'brakes', icon: 'brakes', sortOrder: 2 },
    { nameEn: 'Suspension', nameSw: 'Suspension', slug: 'suspension', icon: 'suspension', sortOrder: 3 },
    { nameEn: 'Electrical', nameSw: 'Umeme', slug: 'electrical', icon: 'electrical', sortOrder: 4 },
    { nameEn: 'Body & Exterior', nameSw: 'Mwili', slug: 'body', icon: 'body', sortOrder: 5 },
    { nameEn: 'Filters & Fluids', nameSw: 'Vichujio', slug: 'filters', icon: 'filters', sortOrder: 6 },
    { nameEn: 'Tyres & Wheels', nameSw: 'Tairi', slug: 'tyres', icon: 'tyres', sortOrder: 7 },
    { nameEn: 'Lighting', nameSw: 'Taa', slug: 'lighting', icon: 'lighting', sortOrder: 8 },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  // Vehicle catalogue is maintained in data/vehicle-makes.json (make → models).
  const makesFile = path.join(__dirname, 'data', 'vehicle-makes.json');
  const makes: { name: string; models: string[] }[] = fs.existsSync(makesFile)
    ? Object.entries(
        JSON.parse(fs.readFileSync(makesFile, 'utf8')) as Record<
          string,
          string[]
        >,
      ).map(([name, models]) => ({ name, models }))
    : [
        { name: 'Toyota', models: ['Corolla', 'Hilux', 'Land Cruiser'] },
        { name: 'Nissan', models: ['X-Trail', 'Note', 'Patrol'] },
      ];

  for (const m of makes) {
    const make = await prisma.vehicleMake.upsert({
      where: { name: m.name },
      update: {},
      create: { name: m.name },
    });
    for (const modelName of m.models) {
      await prisma.vehicleModel.upsert({
        where: { makeId_name: { makeId: make.id, name: modelName } },
        update: {},
        create: { makeId: make.id, name: modelName },
      });
    }
  }

  const allCats = await prisma.category.findMany();
  const cat = (slug: string) => allCats.find((c) => c.slug === slug)!.id;

  const listings = [
    {
      title: 'Toyota Hilux Front Brake Pads (OEM)',
      description:
        'Genuine-quality ceramic brake pads for Toyota Hilux 2015–2022. Low dust, quiet braking. Includes fitting hardware.',
      partNumber: '04465-0K280',
      condition: PartCondition.NEW,
      price: 85000,
      compareAtPrice: 110000,
      quantity: 12,
      make: 'Toyota',
      model: 'Hilux',
      yearFrom: 2015,
      yearTo: 2022,
      categoryId: cat('brakes'),
      // Use stable Unsplash photo IDs only (invalid IDs return 404 and blank UI)
      images: [
        'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&q=80',
      ],
    },
    {
      title: 'Oil Filter – Toyota Corolla 1.8',
      description:
        'High-efficiency oil filter compatible with Corolla 2008–2018 1NZ/2ZR engines. Protects your engine on Tanzanian roads.',
      partNumber: '90915-YZZD3',
      condition: PartCondition.NEW,
      price: 18000,
      quantity: 40,
      make: 'Toyota',
      model: 'Corolla',
      yearFrom: 2008,
      yearTo: 2018,
      categoryId: cat('filters'),
      images: [
        'https://images.unsplash.com/photo-1625047509168-a7026f36de04?w=800&q=80',
        'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80',
      ],
    },
    {
      title: 'Used Alternator – Nissan X-Trail T31',
      description:
        'Tested used alternator, 12V 110A. Bench tested and guaranteed 30 days. Ideal budget replacement.',
      partNumber: '23100-JG00A',
      condition: PartCondition.USED,
      price: 120000,
      compareAtPrice: 165000,
      quantity: 2,
      make: 'Nissan',
      model: 'X-Trail',
      yearFrom: 2007,
      yearTo: 2013,
      categoryId: cat('electrical'),
      images: [
        'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=800&q=80',
      ],
    },
    {
      title: 'Shock Absorber Pair – Honda Fit GE',
      description:
        'Refurbished front shocks for Honda Fit 2008–2013. Restored ride quality after pothole damage.',
      condition: PartCondition.REFURBISHED,
      price: 95000,
      quantity: 4,
      make: 'Honda',
      model: 'Fit',
      yearFrom: 2008,
      yearTo: 2013,
      categoryId: cat('suspension'),
      images: [
        'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80',
      ],
    },
    {
      title: 'Headlight Assembly LH – Toyota Land Cruiser 200',
      description:
        'Left-hand headlight for Land Cruiser 200 series. Clear lens, new bulbs included. OEM-style fitment.',
      condition: PartCondition.NEW,
      price: 280000,
      compareAtPrice: 350000,
      quantity: 3,
      make: 'Toyota',
      model: 'Land Cruiser',
      yearFrom: 2008,
      yearTo: 2015,
      categoryId: cat('lighting'),
      images: [
        'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80',
      ],
    },
    {
      title: 'Timing Belt Kit – Mitsubishi Lancer 4G15',
      description:
        'Complete timing belt kit with tensioner and water pump. Critical maintenance part — install before failure.',
      partNumber: 'MD182293',
      condition: PartCondition.NEW,
      price: 145000,
      quantity: 6,
      make: 'Mitsubishi',
      model: 'Lancer',
      yearFrom: 2000,
      yearTo: 2010,
      categoryId: cat('engine'),
      images: [
        'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=800&q=80',
      ],
    },
    {
      title: 'All-Terrain Tyre 265/70R16 (Set of 4)',
      description:
        'Durable AT tyres for Hilux, D-Max, Navara. Excellent for city + rough roads. Free balancing at partner shop.',
      condition: PartCondition.NEW,
      price: 520000,
      compareAtPrice: 640000,
      quantity: 8,
      make: 'Toyota',
      model: 'Hilux',
      yearFrom: 2010,
      yearTo: 2024,
      categoryId: cat('tyres'),
      images: [
        'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80',
      ],
    },
    {
      title: 'Side Mirror RH Electric – Isuzu D-Max',
      description:
        'Right-side electric folding mirror with indicator. Paint-ready housing.',
      condition: PartCondition.NEW,
      price: 110000,
      quantity: 5,
      make: 'Isuzu',
      model: 'D-Max',
      yearFrom: 2012,
      yearTo: 2020,
      categoryId: cat('body'),
      images: [
        'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=800&q=80',
      ],
    },
  ];

  const existingCount = await prisma.listing.count();
  if (existingCount === 0) {
    const imagePool = [
      'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&q=80',
      'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80',
      'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=800&q=80',
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80',
      'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=800&q=80',
      'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80',
    ];
    for (const [idx, l] of listings.entries()) {
      const { images, ...data } = l;
      // Enforce at least 3 photos per listing
      const photoUrls = [...images];
      let p = 0;
      while (photoUrls.length < 3) {
        photoUrls.push(imagePool[(idx + p) % imagePool.length]);
        p++;
      }
      await prisma.listing.create({
        data: {
          ...data,
          sellerId: seller.id,
          city: 'Dar es Salaam',
          latitude: -6.7924,
          longitude: 39.2083,
          currency: 'TZS',
          images: {
            create: photoUrls.map((url, i) => ({
              url,
              sortOrder: i,
              isPrimary: i === 0,
            })),
          },
        },
      });
    }
  }

  // Home carousel promos (3 active ads for seller product promotion)
  const promoCount = await prisma.promoAd.count();
  if (promoCount === 0) {
    const topListings = await prisma.listing.findMany({
      take: 3,
      include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
      orderBy: { createdAt: 'asc' },
    });

    const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const promoCopy = [
      {
        title: 'Hilux brake pads — OEM quality',
        subtitle: 'Stop safer. Free city delivery this week.',
        ctaLabel: 'View deal',
      },
      {
        title: 'Tyre sets from 520,000 TZS',
        subtitle: 'All-terrain rubber for Dar roads.',
        ctaLabel: 'Shop tyres',
      },
      {
        title: 'Genuine filters & engine kits',
        subtitle: 'Protect your engine — trusted sellers only.',
        ctaLabel: 'Browse now',
      },
    ];

    for (let i = 0; i < Math.min(3, topListings.length); i++) {
      const listing = topListings[i];
      await prisma.promoAd.create({
        data: {
          sellerId: seller.id,
          listingId: listing.id,
          title: promoCopy[i]?.title || listing.title,
          subtitle: promoCopy[i]?.subtitle,
          imageUrl:
            listing.images[0]?.url ||
            'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1200&q=80',
          ctaLabel: promoCopy[i]?.ctaLabel || 'Shop now',
          package: i === 0 ? 'PREMIUM' : i === 1 ? 'STANDARD' : 'STARTER',
          status: 'ACTIVE',
          sortOrder: i,
          endsAt,
          pricePaid: i === 0 ? 75000 : i === 1 ? 35000 : 15000,
        },
      });
    }
  }

  console.log('Seed complete.');
  console.log('Demo accounts (password: password123):');
  console.log('  admin@sparebolt.tz');
  console.log('  customer@sparebolt.tz');
  console.log('  seller@sparebolt.tz');
  console.log('  driver@sparebolt.tz');
  console.log(`Admin id: ${admin.id}`);
  console.log(
    `Regions: ${await prisma.region.count()}, districts: ${await prisma.district.count()}, wards: ${await prisma.ward.count()}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
