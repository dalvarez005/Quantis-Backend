const express = require('express');
const { body } = require('express-validator');
const {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword
} = require('../controllers/authController');
const auth = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');
const prisma = require('../src/adapters/persistence/prismaClient');
const { serializeUserPublic } = require('../src/adapters/persistence/serialize');

const router = express.Router();

const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Debe ser un email válido')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres')
];

const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Debe ser un email válido')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('La contraseña es requerida')
];

const updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres'),
  body('currency')
    .optional()
    .isIn(['GTQ', 'USD'])
    .withMessage('La moneda debe ser GTQ o USD')
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('La contraseña actual es requerida'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('La nueva contraseña debe tener al menos 6 caracteres')
];

router.post('/register', registerValidation, register);

router.post('/login', loginValidation, login);

router.get('/profile', auth, getProfile);

router.put('/profile', auth, updateProfileValidation, updateProfile);

router.post(
  '/upload-avatar',
  auth,
  upload.single('avatar'),
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No se proporcionó ningún archivo'
        });
      }

      const userRow = await prisma.user.update({
        where: { id: req.user._id },
        data: {
          profileImageData: req.file.buffer,
          profileImageContentType: req.file.mimetype,
          profileImage: `/api/auth/avatar/${req.user._id}`
        }
      });

      res.json({
        success: true,
        message: 'Imagen de perfil actualizada exitosamente',
        data: {
          user: serializeUserPublic(userRow)
        }
      });
    } catch (error) {
      console.error('Error subiendo avatar:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
);

router.get('/avatar/:userId', async (req, res) => {
  try {
    const userRow = await prisma.user.findUnique({
      where: { id: req.params.userId }
    });

    if (!userRow || !userRow.profileImageData) {
      return res.status(404).json({
        success: false,
        message: 'Imagen de perfil no encontrada'
      });
    }

    res.set('Content-Type', userRow.profileImageContentType || 'image/jpeg');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.send(Buffer.from(userRow.profileImageData));
  } catch (error) {
    console.error('Error obteniendo avatar:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

router.delete('/delete-avatar', auth, async (req, res) => {
  try {
    const userRow = await prisma.user.update({
      where: { id: req.user._id },
      data: {
        profileImageData: null,
        profileImageContentType: null,
        profileImage: null
      }
    });

    res.json({
      success: true,
      message: 'Imagen de perfil eliminada exitosamente',
      data: {
        user: serializeUserPublic(userRow)
      }
    });
  } catch (error) {
    console.error('Error eliminando avatar:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

router.put('/change-password', auth, changePasswordValidation, changePassword);

module.exports = router;
