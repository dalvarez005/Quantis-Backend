const jwt = require('jsonwebtoken');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET no está configurado');
  }
  return secret;
}

/**
 * Firma un JWT con el rol en el momento del login (reflejo de BD).
 * La autorización de rutas sensibles debe usar siempre el usuario cargado desde Prisma.
 */
function generateToken({ userId, role }) {
  return jwt.sign({ userId, role }, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

module.exports = {
  generateToken,
  getJwtSecret
};
