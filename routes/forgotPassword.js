const express = require('express');
const crypto = require('crypto');
const prisma = require('../src/adapters/persistence/prismaClient');
const { hashPassword } = require('../src/domain/password');
const emailService = require('../services/emailService');
const { body, validationResult } = require('express-validator');

const router = express.Router();

router.post(
  '/forgot-password',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Por favor proporciona un email válido')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors: errors.array()
        });
      }

      const { email } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        return res.json({
          success: true,
          message:
            'Si el email existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña'
        });
      }

      if (user.googleId && !user.password) {
        return res.status(400).json({
          success: false,
          message:
            'Esta cuenta está vinculada con Google. Usa el botón "Iniciar sesión con Google"'
        });
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 3600000);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken: resetToken,
          resetPasswordExpires: resetExpires
        }
      });

      const emailResult = await emailService.sendResetPasswordEmail(
        user.email,
        user.name,
        resetToken
      );

      if (!emailResult.success) {
        console.error('Error enviando email:', emailResult.error);
        console.warn('⚠️ Email no enviado, pero token generado:', {
          userId: user.id,
          email: user.email,
          resetToken: resetToken.substring(0, 10) + '...',
          error: emailResult.error
        });
      }

      res.json({
        success: true,
        message:
          'Si el email existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña'
      });
    } catch (error) {
      console.error('Error en forgot-password:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
);

router.get('/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { gt: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }

    res.json({
      success: true,
      message: 'Token válido',
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Error verificando token:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Token requerido'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('La contraseña debe tener al menos 6 caracteres')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors: errors.array()
        });
      }

      const { token, password } = req.body;

      const user = await prisma.user.findFirst({
        where: {
          resetPasswordToken: token,
          resetPasswordExpires: { gt: new Date() }
        }
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Token inválido o expirado'
        });
      }

      const hashed = await hashPassword(password);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashed,
          resetPasswordToken: null,
          resetPasswordExpires: null
        }
      });

      try {
        const emailResult = await emailService.sendPasswordChangedEmail(
          user.email,
          user.name
        );
        if (!emailResult.success) {
          console.warn(`⚠️ Email de confirmación no enviado:`, emailResult.error);
        }
      } catch (emailError) {
        console.warn(`⚠️ Error enviando email de confirmación:`, emailError.message);
      }

      res.json({
        success: true,
        message: 'Contraseña actualizada exitosamente'
      });
    } catch (error) {
      console.error('Error en reset-password:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
);

module.exports = router;
