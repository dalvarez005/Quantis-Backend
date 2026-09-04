/**
 * Debe ir después de `auth`. El rol se toma de `req.user` (BD vía serializeUserPublic).
 */
function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'No tienes permisos para esta acción'
    });
  }
  next();
}

module.exports = requireSuperAdmin;
