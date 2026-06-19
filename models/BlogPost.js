const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BlogPost = sequelize.define(
    'BlogPost',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: { msg: 'Title is required' },
        },
      },
      slug: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: { msg: 'Slug must be unique' },
        validate: {
          notEmpty: { msg: 'Slug is required' },
          isSlug(value) {
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
              throw new Error('Slug must contain only lowercase letters, numbers, and hyphens');
            }
          },
        },
      },
      excerpt: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
          notEmpty: { msg: 'Excerpt is required' },
        },
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
          notEmpty: { msg: 'Content is required' },
        },
      },
      featuredImage: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      category: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      tags: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
      },
      seoTitle: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      metaDescription: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      keywords: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      schemaMarkup: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      published: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      publishDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      views: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      authorId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
    },
    {
      tableName: 'blog_posts',
      timestamps: true,
      underscored: true,
      indexes: [
        {
          fields: ['slug'],
          unique: true,
        },
        {
          fields: ['published'],
        },
        {
          fields: ['authorId'],
        },
        {
          fields: ['publishDate'],
        },
      ],
    }
  );

  return BlogPost;
};
