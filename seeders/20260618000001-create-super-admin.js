'use strict';

const bcryptjs = require('bcryptjs');

module.exports = {
  async up(queryInterface) {
    if (!process.env.SUPER_ADMIN_NAME || !process.env.SUPER_ADMIN_EMAIL || !process.env.SUPER_ADMIN_PASSWORD) {
      throw new Error('SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL, and SUPER_ADMIN_PASSWORD are required to seed the initial admin account.');
    }

    const hashedPassword = await bcryptjs.hash(process.env.SUPER_ADMIN_PASSWORD, 10);

    await queryInterface.bulkInsert('users', [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: process.env.SUPER_ADMIN_NAME,
        email: process.env.SUPER_ADMIN_EMAIL,
        password: hashedPassword,
        role: 'superadmin',
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', {
      email: process.env.SUPER_ADMIN_EMAIL || 'admin@pimofydigital.com',
    });
  },
};
