/**
 * Pruebas mínimas con el servidor en marcha.
 * Uso: node scripts/smoke-test.js
 * SMOKE_URL=http://localhost:5000/api/health
 * SMOKE_BASE=http://localhost:5000 (opcional; prueba GET /api/cuentas sin token → 401)
 */
const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

async function main() {
  const healthUrl = process.env.SMOKE_URL || 'http://127.0.0.1:5000/api/health';
  const r1 = await get(healthUrl);
  if (r1.statusCode !== 200) {
    console.error('Smoke health: status', r1.statusCode, r1.body);
    process.exit(1);
  }
  const j = JSON.parse(r1.body);
  if (!j.success) {
    console.error('Smoke health: respuesta inesperada', r1.body);
    process.exit(1);
  }
  console.log('Smoke OK:', healthUrl);

  const base =
    process.env.SMOKE_BASE ||
    healthUrl.replace(/\/api\/health\/?$/, '').replace(/\/$/, '');
  const cuentasUrl = `${base}/api/cuentas`;
  const r2 = await get(cuentasUrl);
  if (r2.statusCode !== 401) {
    console.error(
      'Smoke cuentas: se esperaba 401 sin Authorization, recibido',
      r2.statusCode
    );
    process.exit(1);
  }
  console.log('Smoke OK:', cuentasUrl, '(401 sin token)');
  process.exit(0);
}

main().catch((err) => {
  console.error('Smoke: no se pudo conectar. ¿Está el servidor en marcha?', err.message);
  process.exit(1);
});
