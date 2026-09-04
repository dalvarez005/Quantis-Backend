const jwt = require('jsonwebtoken');
const prisma = require('../src/adapters/persistence/prismaClient');
const { serializeUserPublic } = require('../src/adapters/persistence/serialize');
const { getJwtSecret } = require('../lib/jwt');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token de acceso requerido'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, getJwtSecret());

    const userRow = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!userRow) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido - Usuario no encontrado'
      });
    }

    if (!userRow.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Cuenta desactivada'
      });
    }

    if (
      decoded.role != null &&
      decoded.role !== userRow.role
    ) {
      console.warn(
        '[auth] JWT role distinto al rol actual en BD (token emitido antes de un cambio de rol)',
        { userId: userRow.id, tokenRole: decoded.role, dbRole: userRow.role }
      );
    }

    req.user = serializeUserPublic(userRow);
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido',
        code: 'INVALID_TOKEN'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message:
          'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
        code: 'TOKEN_EXPIRED',
        expiredAt: error.expiredAt
      });
    }

    console.error('Error inesperado en middleware de autenticación:', error);

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

module.exports = auth;
