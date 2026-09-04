const bcrypt = require('bcryptjs');

async function hashPassword(plain) {
  if (!plain) return plain;
  const isAlreadyHashed = /^[a-f0-9]{64}$/i.test(plain);
  if (isAlreadyHashed) return plain;
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

async function comparePassword(stored, candidate) {
  if (!candidate) return false;
  const isStoredSHA256 = /^[a-f0-9]{64}$/i.test(stored);
  if (isStoredSHA256) return stored === candidate;
  return bcrypt.compare(candidate, stored);
}

module.exports = { hashPassword, comparePassword };
