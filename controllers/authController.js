const { validationResult } = require('express-validator');
const prisma = require('../src/adapters/persistence/prismaClient');
const { newObjectId } = require('../src/domain/id');
const { hashPassword, comparePassword } = require('../src/domain/password');
const { serializeUserPublic } = require('../src/adapters/persistence/serialize');
const { generateToken } = require('../lib/jwt');

const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un usuario con este email'
      });
    }

    const hashed = await hashPassword(password);
    const userRow = await prisma.user.create({
      data: {
        id: newObjectId(),
        name: email.split('@')[0],
        email,
        password: hashed,
        currency: 'GTQ'
      }
    });

    const token = generateToken({
      userId: userRow.id,
      role: userRow.role
    });

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: {
        user: serializeUserPublic(userRow),
        token
      }
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    const userRow = await prisma.user.findUnique({ where: { email } });
    if (!userRow) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    if (!userRow.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Cuenta desactivada. Contacta al administrador'
      });
    }

    if (userRow.googleId && !userRow.password) {
      return res.status(401).json({
        success: false,
        message:
          'Esta cuenta está registrada con Google. Por favor, usa "Continuar con Google" para iniciar sesión.'
      });
    }

    const isPasswordValid = await comparePassword(userRow.password, password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    const token = generateToken({
      userId: userRow.id,
      role: userRow.role
    });

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      data: {
        user: serializeUserPublic(userRow),
        token
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const getProfile = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user
      }
    });
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'role')) {
      return res.status(400).json({
        success: false,
        message: 'No se puede modificar el rol desde el perfil'
      });
    }

    const { name, currency } = req.body;
    const userId = req.user._id;

    const data = {};
    if (name !== undefined) data.name = name;
    if (currency !== undefined) data.currency = currency;

    const userRow = await prisma.user.update({
      where: { id: userId },
      data
    });

    if (!userRow) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      data: {
        user: serializeUserPublic(userRow)
      }
    });
  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    const userRow = await prisma.user.findUnique({ where: { id: userId } });
    if (!userRow) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const isCurrentPasswordValid = await comparePassword(
      userRow.password,
      currentPassword
    );
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña actual es incorrecta'
      });
    }

    const hashed = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed }
    });

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword
};
