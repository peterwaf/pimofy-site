const nodemailer = require('nodemailer');
const { matchedData } = require('express-validator');
const config = require('../config/environment');

let transporter;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getMailer() {
  if (transporter) {
    return transporter;
  }

  if (!config.email.smtpHost || !config.email.smtpUser || !config.email.smtpPass) {
    throw new Error('Email service is not configured. Missing SMTP settings.');
  }

  transporter = nodemailer.createTransport({
    host: config.email.smtpHost,
    port: config.email.smtpPort,
    secure: config.email.smtpPort === 465,
    requireTLS: config.email.smtpPort === 587,
    auth: {
      user: config.email.smtpUser,
      pass: config.email.smtpPass,
    },
  });

  return transporter;
}

class ContactController {
  // Show contact page
  static async page(req, res, next) {
    try {
      const successFromQuery =
        String(req.query.success || '').toLowerCase() === 'true' || String(req.query.success || '') === '1';
      const contactSuccess = successFromQuery || req.session.contactSuccess || false;
      const errors = req.session.errors || [];
      const formData = req.session.formData || {};

      req.session.contactSuccess = false;
      req.session.errors = [];
      req.session.formData = {};

      res.render('pages/contact', {
        title: 'Book a Free Consultation | Pimofy Digital',
        description:
          'Talk to a Pimofy consultant about your data operations. Book a free call and get a complimentary Operations Capacity Audit.',
        contactSuccess,
        errors,
        formData,
      });
    } catch (error) {
      next(error);
    }
  }

  // Handle contact form submission
  static async submit(req, res, next) {
    try {
      const data = matchedData(req, { locations: ['body'] });
      const submittedAt = new Date();
      const name = data.name || '';
      const email = data.email || '';
      const company = data.company || '';
      const type = data.type || 'Not provided';
      const website = data.website || 'Not provided';
      const message = data.message || '';

      const textBody = [
        'New contact form submission',
        '',
        `Submitted At: ${submittedAt.toISOString()}`,
        `Name: ${name}`,
        `Email: ${email}`,
        `Company: ${company}`,
        `Company Type: ${type}`,
        `Website: ${website}`,
        '',
        'Message:',
        message,
      ].join('\n');

      const htmlBody = `
        <h2>New contact form submission</h2>
        <p><strong>Submitted At:</strong> ${escapeHtml(submittedAt.toISOString())}</p>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Company:</strong> ${escapeHtml(company)}</p>
        <p><strong>Company Type:</strong> ${escapeHtml(type)}</p>
        <p><strong>Website:</strong> ${escapeHtml(website)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, '<br />')}</p>
      `;

      await getMailer().sendMail({
        from: `Pimofy Website <${config.email.smtpUser}>`,
        to: config.email.contactEmail || config.email.adminEmail || config.email.smtpUser,
        replyTo: email,
        subject: `New Contact Request - ${name}`,
        text: textBody,
        html: htmlBody,
      });

      // Auto-reply should not block successful form submission if it fails.
      try {
        const confirmationText = [
          `Hi ${name},`,
          '',
          'Thanks for reaching out to Pimofy Digital.',
          'We have received your request and will reply within one business day.',
          '',
          'Summary of your submission:',
          `Company: ${company}`,
          `Company Type: ${type}`,
          `Website: ${website}`,
          '',
          'Best regards,',
          'Pimofy Digital',
          'info@pimofydigital.com',
        ].join('\n');

        const confirmationHtml = `
          <p>Hi ${escapeHtml(name)},</p>
          <p>Thanks for reaching out to <strong>Pimofy Digital</strong>.</p>
          <p>We have received your request and will reply within one business day.</p>
          <p><strong>Summary of your submission:</strong></p>
          <ul>
            <li><strong>Company:</strong> ${escapeHtml(company)}</li>
            <li><strong>Company Type:</strong> ${escapeHtml(type)}</li>
            <li><strong>Website:</strong> ${escapeHtml(website)}</li>
          </ul>
          <p>Best regards,<br />Pimofy Digital<br />info@pimofydigital.com</p>
        `;

        await getMailer().sendMail({
          from: `Pimofy Digital <${config.email.smtpUser}>`,
          to: email,
          subject: 'We received your request - Pimofy Digital',
          text: confirmationText,
          html: confirmationHtml,
        });
      } catch (autoReplyError) {
        console.warn('Contact form auto-reply failed:', autoReplyError.message);
      }

      req.session.contactSuccess = true;
      req.session.errors = [];
      req.session.formData = {};
      res.redirect('/contact?success=1#contact-feedback-anchor');
    } catch (error) {
      console.error('Contact form email failed:', error.message);
      req.session.contactSuccess = false;
      req.session.errors = [
        {
          field: 'form',
          message:
            'Sorry, we could not send your request right now. Please try again in a few minutes or email info@pimofydigital.com directly.',
        },
      ];
      req.session.formData = {
        name: req.body?.name || '',
        email: req.body?.email || '',
        company: req.body?.company || '',
        type: req.body?.type || '',
        website: req.body?.website || '',
        message: req.body?.message || '',
      };
      res.redirect('/contact?error=1#contact-feedback-anchor');
    }
  }
}

module.exports = ContactController;
