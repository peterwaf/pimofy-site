'use strict';

const bcryptjs = require('bcryptjs');

module.exports = {
  async up(queryInterface) {
    // Hash the super admin password
    const hashedPassword = await bcryptjs.hash(process.env.SUPER_ADMIN_PASSWORD || 'change_this', 10);

    await queryInterface.bulkInsert('users', [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: process.env.SUPER_ADMIN_NAME || 'Super Admin',
        email: process.env.SUPER_ADMIN_EMAIL || 'admin@pimofydigital.com',
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
