const bcrypt = require("bcrypt");

module.exports = {
  hashPassword(password) {
    return bcrypt.hash(password, 10);
  },
  comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }
};
