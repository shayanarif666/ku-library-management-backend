require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const SEED_USERS = [
  {
    name: 'Super Admin',
    email: 'superadmin@university.edu',
    password: 'superadmin123',
    role: 'superadmin',
    studentId: 'SA001',
    department: 'Library Administration',
  },
  {
    name: 'Head Librarian',
    email: 'librarian@university.edu',
    password: 'librarian123',
    role: 'admin',
    studentId: 'LIB001',
    department: 'Library',
  },
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('Connected to MongoDB');

    for (const userData of SEED_USERS) {
      const existing = await User.findOne({ email: userData.email });
      if (existing) {
        console.log(`⚠  Skipped (already exists): ${userData.email}`);
        continue;
      }
      await User.create(userData);
      console.log(`✓  Created [${userData.role}]: ${userData.email} / ${userData.password}`);
    }

    console.log('\nSeed complete. Change passwords after first login!');
  } catch (err) {
    console.error('Seed error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

seed();
