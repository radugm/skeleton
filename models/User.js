/**
 * Module dependencies.
 */

var bcrypt    = require('bcrypt-nodejs');
var crypto    = require('crypto');
var mongoose  = require('mongoose');

/**
 * Define User Schema
 */

var userSchema = new mongoose.Schema({

  email: { type: String, unique: true },
  password: String,
  type: { type: String, default: 'user' },
  // 'admin' for administrators! ;)

  facebook: { type: String, unique: true, sparse: true },
  twitter: { type: String, unique: true, sparse: true },
  google: { type: String, unique: true, sparse: true },
  github: { type: String, unique: true, sparse: true },
  tokens: Array,

  profile: {
    name: { type: String, default: '' },
    gender: { type: String, default: '' },
    location: { type: String, default: '' },
    website: { type: String, default: '' },
    picture: { type: String, default: '' }
  },

  activity: {
    date_established: { type: Date, default: Date.now },
    last_logon: { type: Date, default: Date.now },
    last_updated: { type: Date, default: Date.now }
  },

  resetPasswordToken: { type: String, default: '' },
  resetPasswordExpires: { type: Date, default: Date.now }

});

/**
 * Hash the password for security.
 */

userSchema.pre('save', function(next) {
  var user = this;
  var SALT_FACTOR = 5;

  if (!user.isModified('password')) return next();

  bcrypt.genSalt(SALT_FACTOR, function(err, salt) {
    if (err) return next(err);

    bcrypt.hash(user.password, salt, null, function(err, hash) {
      if (err) return next(err);
      user.password = hash;
      next();
    });
  });
});

/**
 * Check the user's password
 */

userSchema.methods.comparePassword = function(candidatePassword, cb) {
  bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
    if (err) return cb(err);
    cb(null, isMatch);
  });
};

/**
 *  Get a URL to a user's Gravatar email.
 */

userSchema.methods.gravatar = function(size, defaults) {
  if (!size) size = 200;
  if (!defaults) defaults = 'retro';
  if(!this.email) {
    return 'https://gravatar.com/avatar/?s=' + size + '&d=' + defaults;
  }
  var md5 = crypto.createHash('md5').update(this.email);
  return 'https://gravatar.com/avatar/' + md5.digest('hex').toString() + '?s=' + size + '&d=' + defaults;
};

module.exports = mongoose.model('User', userSchema);
