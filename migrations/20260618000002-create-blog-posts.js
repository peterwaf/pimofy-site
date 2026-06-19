'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('blog_posts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      slug: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      excerpt: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      featured_image: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      category: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      tags: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: [],
      },
      seo_title: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      meta_description: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      keywords: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      schema_markup: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      published: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      publish_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      views: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      author_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Create indexes for performance
    await queryInterface.addIndex('blog_posts', ['slug']);
    await queryInterface.addIndex('blog_posts', ['published']);
    await queryInterface.addIndex('blog_posts', ['author_id']);
    await queryInterface.addIndex('blog_posts', ['publish_date']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('blog_posts');
  },
};
