const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: { msg: 'Name is required' },
          len: [2, 255],
        },
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: { msg: 'Email already in use' },
        validate: {
          isEmail: { msg: 'Invalid email format' },
        },
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          len: [6, 255],
        },
      },
      role: {
        type: DataTypes.ENUM('superadmin', 'admin'),
        allowNull: false,
        defaultValue: 'admin',
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'users',
      timestamps: true,
      underscored: true,
      indexes: [
        {
          fields: ['email'],
          unique: true,
        },
      ],
    }
  );

  return User;
};
