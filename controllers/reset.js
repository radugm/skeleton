'use strict';

/**
 * Module Dependencies
 */

var bcrypt        = require('bcrypt-nodejs');
var mongoose      = require('mongoose');
var nodemailer    = require("nodemailer");
var User          = require('../models/User');
var config        = require('../config/config');

/**
 * Reset Page Controller
 */

module.exports.controller = function(app) {

  /**
   * GET /reset/:id/:token
   * Reset your password page
   */

  app.get('/reset/:id/:token', function(req, res) {
    if (req.user) return res.redirect('/');  //user already logged in!

    var conditions = {
      _id: req.params.id,
      resetPasswordExpires: { $gt: Date.now() }
    };

    // Get the user
    User.findOne(conditions, function(err, user) {
      if (err) {
        req.flash('errors', err);
        return res.render('account/reset', {
          url: req.url,
          title: app.locals.title,
          validToken: false
        });
      }
      if (!user) {
        req.flash('warning', { msg: 'Your reset request is invalid.  It may have expired.' });
        return res.render('account/reset', {
          url: req.url,
          title: app.locals.title,
          validToken: false
        });
      }
      // Validate the token
      bcrypt.compare(req.params.token, user.resetPasswordToken, function(err, isValid) {
        if (err) {
          req.flash('errors', err);
          return res.render('account/reset', {
            url: req.url,
            title: app.locals.title,
            validToken: false
          });
        }
        if (!isValid) {
          req.flash('errors', { msg: 'Your reset request token is invalid.' });
          return res.render('account/reset', {
            url: req.url,
            title: app.locals.title,
            validToken: false
          });
        } else {
          req.flash('success', { msg: 'Token accepted. Reset your password!' });
          return res.render('account/reset', {
            url: req.url,
            title: app.locals.title,
            validToken: true
          });
        }
      });
    });
  });

  /**
   * POST /reset/:id/:token
   * Process the POST to reset your password
   */

  app.post('/reset/:id/:token', function(req, res) {

    // Create a workflow
    var workflow = new (require('events').EventEmitter)();

    /**
     * Step 1: Validate the password(s) meet complexity requirements and match.
     */

    workflow.on('validate', function() {

      req.assert('password', 'Password must be at least 4 characters long.').len(4);
      req.assert('confirm', 'Passwords must match.').equals(req.body.password);
      var errors = req.validationErrors();

      if (errors) {
        req.flash('errors', errors);
        return res.render('account/reset', {
            url: req.url,
            title: app.locals.title
        });
      }

      // next step
      workflow.emit('findUser');
    });

    /**
     * Step 2: Lookup the User
     * We are doing this again in case the user changed the URL
     */

    workflow.on('findUser', function() {

      var conditions = {
        _id: req.params.id,
        resetPasswordExpires: { $gt: Date.now() }
      };

      // Get the user
      User.findOne(conditions, function(err, user) {
        if (err) {
          req.flash('errors', err);
          return res.render('account/reset', {
              url: req.url,
              title: app.locals.title
          });
        }

        if (!user) {
          req.flash('warning', { msg: 'Your reset request is invalid.  It may have expired.' });
          return res.render('account/reset', {
              url: req.url,
              title: app.locals.title
          });
        }

        // Validate the token
        bcrypt.compare(req.params.token, user.resetPasswordToken, function(err, isValid) {
          if (err) {
            req.flash('errors', err);
            return res.render('account/reset', {
                url: req.url,
                title: app.locals.title
            });
          }
          if (!isValid) {
            req.flash('errors', { msg: 'Your reset request token is invalid.' });
            return res.render('account/reset', {
                url: req.url,
                title: app.locals.title
            });
          }
        });

        // next step
        workflow.emit('updatePassword', user);
      });
    });

    /**
     * Step 3: Update the User's Password and clear the
     * clear the reset token
     */

    workflow.on('updatePassword', function(user) {

      user.password = req.body.password;
      user.resetPasswordToken = '';
      user.resetPasswordExpires = Date.now();

      // update the user record
      user.save(function(err) {
        if (err) {
          req.flash('errors', err);
          return res.render('account/reset', {
              url: req.url,
              title: app.locals.title
          });
        }
        // Log the user in
        req.logIn(user, function(err) {
          if (err) {
            req.flash('errors', err);
            return res.render('account/reset', {
                url: req.url,
                title: app.locals.title
            });
          }
          // next step
          workflow.emit('sendEmail', user);
        });
      });
    });

    /**
     * Step 4: Send the User an email letting them know thier
     * password was changed.  This is important in case the
     * user did not initiate the reset!
     */

    workflow.on('sendEmail', function(user) {

      // Create a reusable nodemailer transport method (opens a pool of SMTP connections)
      var smtpTransport = nodemailer.createTransport("SMTP",{
          service: "Gmail",
          auth: {
              user: config.gmail.user,
              pass: config.gmail.password
          }
          // See nodemailer docs for other transports
          // https://github.com/andris9/Nodemailer
      });

      // create email
      var mailOptions = {
        to:       user.profile.name + ' <' + user.email + '>',
        from:     config.smtp.name + ' <' + config.smtp.address + '>',
        subject:  'Password Reset Notice',
        text:     'This is a courtesy message from ' + app.locals.title + '.  Your password was just reset.  Cheers!'
      };

      // send email
      smtpTransport.sendMail(mailOptions, function(err) {
        if (err) {
          req.flash('errors', { msg: err.message });
          req.flash('info', { msg: 'You are logged in with your new password!' });
          res.redirect('/');
        } else {
          // Message to user
          req.flash('info', { msg: 'You are logged in with your new password!' });
          res.redirect('/');
        }
      });

      // shut down the connection pool, no more messages
      smtpTransport.close();

    });

  /**
   * Initiate the workflow
   */

    workflow.emit('validate');

  });
}
