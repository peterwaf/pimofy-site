const { User } = require('../models');
const bcryptjs = require('bcryptjs');

class AuthController {
  // Show login page
  static async loginPage(req, res, next) {
    try {
      if (req.session.user) {
        return res.redirect('/admin');
      }

      res.render('auth/login', {
        title: 'Admin Login | Pimofy Digital',
        description: 'Login to your Pimofy Digital admin account',
        errors: req.session.errors || [],
      });

      // Clear errors after rendering
      req.session.errors = [];
    } catch (error) {
      next(error);
    }
  }

  // Handle login
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // Find user by email
      const user = await User.findOne({ where: { email } });

      if (!user) {
        req.session.errors = [{ field: 'email', message: 'Email not found' }];
        return res.redirect('/auth/login');
      }

      // Check if user is active
      if (!user.active) {
        req.session.errors = [{ field: 'email', message: 'This account has been disabled' }];
        return res.redirect('/auth/login');
      }

      // Compare passwords
      const passwordMatch = await bcryptjs.compare(password, user.password);

      if (!passwordMatch) {
        req.session.errors = [{ field: 'password', message: 'Invalid password' }];
        return res.redirect('/auth/login');
      }

      // Set session user
      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      };

      // Redirect to admin dashboard
      res.redirect('/admin');
    } catch (error) {
      next(error);
    }
  }

  // Handle logout
  static async logout(req, res, next) {
    try {
      req.session.destroy((err) => {
        if (err) {
          return next(err);
        }
        res.redirect('/');
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
