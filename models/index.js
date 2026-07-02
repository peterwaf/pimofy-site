const { Sequelize } = require('sequelize');
const pg = require('pg');
const config = require('../config/database');
const UserModel = require('./User');
const BlogPostModel = require('./BlogPost');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Create Sequelize instance
const sequelize = dbConfig.url
  ? new Sequelize(dbConfig.url, {
      dialect: dbConfig.dialect,
      dialectModule: pg,
      logging: dbConfig.logging,
      dialectOptions: dbConfig.dialectOptions,
    })
  : new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
      host: dbConfig.host,
      port: dbConfig.port,
      dialect: dbConfig.dialect,
      dialectModule: pg,
      logging: dbConfig.logging,
      dialectOptions: dbConfig.dialectOptions,
    });

// Initialize models
const User = UserModel(sequelize);
const BlogPost = BlogPostModel(sequelize);

// Define relationships
User.hasMany(BlogPost, {
  foreignKey: 'authorId',
  as: 'articles',
  onDelete: 'CASCADE',
});

BlogPost.belongsTo(User, {
  foreignKey: 'authorId',
  as: 'author',
});

// Export sequelize and models
module.exports = {
  sequelize,
  User,
  BlogPost,
};
