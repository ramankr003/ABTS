/**
 * Seed script — populates DB with demo users and ambulances.
 * Run: node src/scripts/seed.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Ambulance = require('../models/Ambulance');

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/abts');
  console.log('✅ Connected to MongoDB');

  await User.deleteMany({});
  await Ambulance.deleteMany({});

  const admin = await User.create({
    name: 'Admin',
    email: 'admin@abts.com',
    phone: '1000000001',
    password: 'Admin@123',
    role: 'admin',
    isVerified: true,
  });

  const driver1 = await User.create({
    name: 'Ravi Kumar',
    email: 'driver1@abts.com',
    phone: '9000000001',
    password: 'Driver@123',
    role: 'driver',
    isVerified: true,
  });

  const driver2 = await User.create({
    name: 'Priya Singh',
    email: 'driver2@abts.com',
    phone: '9000000002',
    password: 'Driver@123',
    role: 'driver',
    isVerified: true,
  });

  await User.create({
    name: 'Test Patient',
    email: 'user@abts.com',
    phone: '8000000001',
    password: 'User@123',
    role: 'user',
    isVerified: true,
  });

  await Ambulance.create([
    {
      vehicleNumber: 'KA01AMB001',
      driverName: 'Ravi Kumar',
      driverPhone: '9000000001',
      driverLicense: 'KA0120230001',
      type: 'advanced',
      facilities: { oxygen: true, saline: true, stretcher: true, nurse: true, doctor: false },
      pricePerKm: 25,
      basePrice: 500,
      isAvailable: true,
      currentLocation: { type: 'Point', coordinates: [77.596, 12.97], address: 'Indiranagar, Bangalore' },
      rating: { average: 4.6, count: 28 },
      owner: driver1._id,
    },
    {
      vehicleNumber: 'KA03AMB002',
      driverName: 'Priya Singh',
      driverPhone: '9000000002',
      driverLicense: 'KA0320230002',
      type: 'icu',
      facilities: {
        oxygen: true, saline: true, stretcher: true,
        nurse: true, doctor: true, defibrillator: true, ventilator: true,
      },
      pricePerKm: 55,
      basePrice: 1200,
      isAvailable: true,
      currentLocation: { type: 'Point', coordinates: [77.696, 12.95], address: 'Whitefield, Bangalore' },
      rating: { average: 4.9, count: 42 },
      owner: driver2._id,
    },
    {
      vehicleNumber: 'KA05AMB003',
      driverName: 'Suresh Patil',
      driverPhone: '9000000003',
      driverLicense: 'KA0520230003',
      type: 'basic',
      facilities: { oxygen: false, saline: true, stretcher: true, nurse: false, doctor: false },
      pricePerKm: 15,
      basePrice: 300,
      isAvailable: true,
      currentLocation: { type: 'Point', coordinates: [77.5946, 12.9716], address: 'MG Road, Bangalore' },
      rating: { average: 4.2, count: 15 },
      owner: admin._id,
    },
    {
      vehicleNumber: 'KA07AMB004',
      driverName: 'Anita Sharma',
      driverPhone: '9000000004',
      driverLicense: 'KA0720230004',
      type: 'neonatal',
      facilities: { oxygen: true, saline: true, stretcher: true, nurse: true, doctor: true },
      pricePerKm: 40,
      basePrice: 800,
      isAvailable: true,
      currentLocation: { type: 'Point', coordinates: [77.5619, 12.9279], address: 'Jayanagar, Bangalore' },
      rating: { average: 4.7, count: 19 },
      owner: admin._id,
    },
  ]);

  console.log('\n🎉 Seed complete!');
  console.log('┌─────────────────────────────────────┐');
  console.log('│  Demo Accounts                      │');
  console.log('├─────────────────────────────────────┤');
  console.log('│  admin@abts.com   | Admin@123        │');
  console.log('│  driver1@abts.com | Driver@123       │');
  console.log('│  user@abts.com    | User@123         │');
  console.log('└─────────────────────────────────────┘\n');

  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
