const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const prisma = require('../src/adapters/persistence/prismaClient');
const { serializeUserPublic } = require('../src/adapters/persistence/serialize');
const { generateToken, getJwtSecret } = require('../lib/jwt');
const { getPrimaryFrontendUrl } = require('../config/frontendEnv');

const router = express.Router();

const isGoogleOAuthConfigured =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;

router.get('/google', (req, res) => {
  if (!isGoogleOAuthConfigured) {
    return res.status(503).json({
      success: false,
      message: 'Google OAuth no está configurado. Contacta al administrador.'
    });
  }

  passport.authenticate('google', {
    scope: ['profile', 'email']
  })(req, res);
});

router.get('/google/callback', (req, res) => {
  if (!isGoogleOAuthConfigured) {
    const frontendUrl = getPrimaryFrontendUrl();
    return res.redirect(`${frontendUrl}/login?error=oauth_not_configured`);
  }

  passport.authenticate('google', { session: false }, async (err, user) => {
    if (err) {
      console.error('Error en Google OAuth callback:', err);
      const frontendUrl = getPrimaryFrontendUrl();
      return res.redirect(`${frontendUrl}/login?error=oauth_error`);
    }

    if (!user) {
      const frontendUrl = getPrimaryFrontendUrl();
      return res.redirect(`${frontendUrl}/login?error=oauth_denied`);
    }

    try {
      const userRow = await prisma.user.findUnique({ where: { id: user.id } });
      if (!userRow) {
        const frontendUrl = getPrimaryFrontendUrl();
        return res.redirect(`${frontendUrl}/login?error=oauth_error`);
      }

      const token = generateToken({
        userId: userRow.id,
        role: userRow.role
      });

      const frontendUrl = getPrimaryFrontendUrl();
      res.redirect(`${frontendUrl}/auth/callback?token=${token}&success=true`);
    } catch (error) {
      console.error('Error en Google OAuth callback:', error);
      const frontendUrl = getPrimaryFrontendUrl();
      res.redirect(`${frontendUrl}/login?error=oauth_error`);
    }
  })(req, res);
});

router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token requerido'
      });
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const userRow = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!userRow) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      user: serializeUserPublic(userRow),
      token
    });
  } catch (error) {
    console.error('Error verificando token:', error);
    res.status(401).json({
      success: false,
      message: 'Token inválido'
    });
  }
});

module.exports = router;
