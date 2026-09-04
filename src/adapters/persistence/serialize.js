const {
  prestamoProgresoPago,
  prestamoDiasRestantes,
  cuotaProgresoPago
} = require('../../domain/prestamoCuota');

function stripId(obj) {
  const { id, ...rest } = obj;
  return { ...rest, _id: id };
}

/** Usuario como en toJSON de Mongoose (sin password ni binarios internos) */
function serializeUser(u) {
  if (!u) return null;
  const {
    id,
    password: _pw,
    profileImageData,
    profileImageContentType,
    ...rest
  } = u;
  const base = {
    ...stripId({ id, ...rest }),
    profileImageData: profileImageData
      ? { data: profileImageData, contentType: profileImageContentType }
      : undefined
  };
  if (u.cuentaDefaultId) base.cuentaDefault = u.cuentaDefaultId;
  delete base.cuentaDefaultId;
  if (base.role !== undefined && base.role !== null) {
    base.role = base.role === 'SUPER_ADMIN' ? 'super_admin' : 'user';
  }
  return base;
}

function serializeUserPublic(u) {
  const s = serializeUser(u);
  if (s && s.profileImageData) delete s.profileImageData;
  return s;
}

function serializeIngreso(row, userMini) {
  const base = stripId(row);
  base.user = userMini || row.userId;
  delete base.userId;
  if (row.cuentaId) base.cuenta = row.cuentaId;
  delete base.cuentaId;
  return base;
}

function serializeGasto(row, userMini) {
  const base = stripId(row);
  base.user = userMini || row.userId;
  if (row.cuotaId) base.cuota = row.cuotaId;
  delete base.cuotaId;
  if (row.cuentaId) base.cuenta = row.cuentaId;
  delete base.cuentaId;
  delete base.userId;
  return base;
}

function serializeCuenta(c) {
  const base = stripId(c);
  base.user = base.userId;
  delete base.userId;
  return base;
}

function serializeTarjeta(t) {
  const base = stripId(t);
  base.user = base.userId;
  delete base.userId;
  if (t.tipo === 'credito' && t.limiteCredito != null) {
    base.disponible = Math.max(0, t.limiteCredito - (t.saldoActual || 0));
  }
  return base;
}

function serializeCuota(c, tarjetaMini) {
  const montoPendiente = Math.max(
    0,
    c.montoTotal - c.cuotasPagadas * c.montoCuota
  );
  const base = stripId(c);
  base.user = base.userId;
  delete base.userId;
  if (c.tarjetaId) {
    base.tarjeta = tarjetaMini || c.tarjetaId;
  }
  delete base.tarjetaId;
  base.montoPendiente = montoPendiente;
  base.progreso = cuotaProgresoPago(c);
  return base;
}

function serializePrestamo(p) {
  const montoPendiente = Math.max(0, p.montoTotal - p.montoPagado);
  const base = stripId(p);
  base.user = base.userId;
  delete base.userId;
  base.montoPendiente = montoPendiente;
  base.progreso = prestamoProgresoPago(p);
  base.diasRestantes = prestamoDiasRestantes(p);
  return base;
}

function serializeTipoTransaccion(t) {
  return stripId(t);
}

function serializeIngresoRecurrente(r) {
  const base = stripId(r);
  base.user = base.userId;
  delete base.userId;
  if (r.cuentaId) base.cuenta = r.cuentaId;
  delete base.cuentaId;
  return base;
}

function serializeGastoRecurrente(r) {
  const base = stripId(r);
  base.user = base.userId;
  delete base.userId;
  if (r.cuentaId) base.cuenta = r.cuentaId;
  delete base.cuentaId;
  return base;
}

function serializeTransaccionGenerada(t) {
  const base = stripId(t);
  base.user = base.userId;
  delete base.userId;
  return base;
}

module.exports = {
  stripId,
  serializeUser,
  serializeUserPublic,
  serializeIngreso,
  serializeGasto,
  serializeCuenta,
  serializeTarjeta,
  serializeCuota,
  serializePrestamo,
  serializeTipoTransaccion,
  serializeIngresoRecurrente,
  serializeGastoRecurrente,
  serializeTransaccionGenerada
};
