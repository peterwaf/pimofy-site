const { User } = require('../models');
const bcryptjs = require('bcryptjs');

class AuthController {
  static setAuthError(req, message = 'Invalid email or password') {
    req.session.errors = [{ field: 'form', message }];
  }

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
      const normalizedEmail = String(email || '').trim().toLowerCase();

      // Find user by email
      const user = await User.findOne({ where: { email: normalizedEmail } });

      if (!user) {
        AuthController.setAuthError(req);
        return res.redirect('/auth/login');
      }

      // Check if user is active
      if (!user.active) {
        AuthController.setAuthError(req);
        return res.redirect('/auth/login');
      }

      // Compare passwords
      const passwordMatch = await bcryptjs.compare(password, user.password);

      if (!passwordMatch) {
        AuthController.setAuthError(req);
        return res.redirect('/auth/login');
      }

      return req.session.regenerate((regenerateError) => {
        if (regenerateError) {
          return next(regenerateError);
        }

        req.session.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };

        return req.session.save((saveError) => {
          if (saveError) {
            return next(saveError);
          }
          return res.redirect('/admin');
        });
      });
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
