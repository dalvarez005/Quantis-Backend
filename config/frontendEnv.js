const DEFAULT_FRONTEND = 'http://localhost:5173';

function parseFrontendOrigins() {
  const raw = process.env.FRONTEND_URL || DEFAULT_FRONTEND;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Primer origen: OAuth, enlaces en emails, etc. */
function getPrimaryFrontendUrl() {
  const origins = parseFrontendOrigins();
  return origins[0] || DEFAULT_FRONTEND;
}

/** Lista para CORS (puede incluir Vite 5173 y Docker 8080 a la vez). */
function getCorsOrigins() {
  return parseFrontendOrigins();
}

module.exports = {
  parseFrontendOrigins,
  getPrimaryFrontendUrl,
  getCorsOrigins,
};
