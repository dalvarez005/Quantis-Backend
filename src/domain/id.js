const crypto = require('crypto');

/** Genera un id estilo ObjectId (24 hex) compatible con datos migrados de MongoDB */
function newObjectId() {
  return crypto.randomBytes(12).toString('hex');
}

module.exports = { newObjectId };
