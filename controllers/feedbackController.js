const prisma = require('../src/adapters/persistence/prismaClient');
const { newObjectId } = require('../src/domain/id');

const STATUS_API_TO_DB = {
  new: 'NEW',
  in_progress: 'IN_PROGRESS',
  resolved: 'RESOLVED'
};

const STATUS_DB_TO_API = {
  NEW: 'new',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved'
};

function serializeFeedback(row, userMini) {
  return {
    id: row.id,
    _id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    message: row.message,
    meta: row.meta,
    status: STATUS_DB_TO_API[row.status] || row.status,
    adminOpenedAt: row.adminOpenedAt ?? null,
    adminNote: row.adminNote,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(userMini ? { user: userMini } : {})
  };
}

const createFeedback = async (req, res) => {
  try {
    const { type, title, message, meta } = req.body;
    const allowedTypes = ['bug', 'suggestion', 'other'];

    if (!type || !allowedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'type debe ser bug, suggestion u other'
      });
    }
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'title es requerido'
      });
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'message es requerido'
      });
    }

    const row = await prisma.feedback.create({
      data: {
        id: newObjectId(),
        userId: req.user._id,
        type,
        title: title.trim(),
        message: message.trim(),
        meta: meta === undefined ? undefined : meta
      }
    });

    res.status(201).json({
      success: true,
      ok: true,
      data: serializeFeedback(row)
    });
  } catch (error) {
    console.error('Error creando feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const listFeedback = async (req, res) => {
  try {
    const {
      status: statusQ,
      type: typeQ,
      q,
      page = '1',
      limit = '20'
    } = req.query;

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where = {};

    // Bandeja admin: no listar resueltos (siguen en BD pero no en esta vista)
    if (statusQ && STATUS_API_TO_DB[statusQ]) {
      const st = STATUS_API_TO_DB[statusQ];
      if (st === 'RESOLVED') {
        return res.json({
          success: true,
          items: [],
          total: 0,
          data: []
        });
      }
      where.status = st;
    } else {
      where.status = { not: 'RESOLVED' };
    }

    if (typeQ && typeof typeQ === 'string') {
      where.type = typeQ;
    }

    if (q && typeof q === 'string' && q.trim()) {
      const term = q.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { message: { contains: term, mode: 'insensitive' } }
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              profileImage: true,
              avatar: true
            }
          }
        }
      }),
      prisma.feedback.count({ where })
    ]);

    const items = rows.map((r) => {
      const { user, ...rest } = r;
      const mini = user
        ? {
            _id: user.id,
            name: user.name,
            email: user.email,
            profileImage: user.profileImage,
            avatar: user.avatar
          }
        : undefined;
      return serializeFeedback(rest, mini);
    });

    res.json({
      success: true,
      items,
      total,
      data: items
    });
  } catch (error) {
    console.error('Error listando feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const userSelectFeedback = {
  id: true,
  name: true,
  email: true,
  profileImage: true,
  avatar: true
};

const patchFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNote, markOpened } = req.body;

    const existing = await prisma.feedback.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Feedback no encontrado'
      });
    }

    const data = {};
    if (status !== undefined) {
      if (!STATUS_API_TO_DB[status]) {
        return res.status(400).json({
          success: false,
          message: 'status inválido (new, in_progress, resolved)'
        });
      }
      data.status = STATUS_API_TO_DB[status];
    }
    if (adminNote !== undefined) {
      data.adminNote =
        adminNote === null || adminNote === ''
          ? null
          : String(adminNote);
    }
    if (markOpened === true && !existing.adminOpenedAt) {
      data.adminOpenedAt = new Date();
    }

    const sendRow = (row) => {
      if (!row) {
        return res.status(404).json({
          success: false,
          message: 'Feedback no encontrado'
        });
      }
      const { user, ...rest } = row;
      const mini = user
        ? {
            _id: user.id,
            name: user.name,
            email: user.email,
            profileImage: user.profileImage,
            avatar: user.avatar
          }
        : undefined;
      return res.json({
        success: true,
        data: serializeFeedback(rest, mini)
      });
    };

    if (Object.keys(data).length === 0) {
      if (markOpened === true && existing.adminOpenedAt) {
        const row = await prisma.feedback.findUnique({
          where: { id },
          include: { user: { select: userSelectFeedback } }
        });
        return sendRow(row);
      }
      // Misma nota que ya estaba guardada (o body vacío): devolver 200 con el registro actual
      if (adminNote !== undefined) {
        const row = await prisma.feedback.findUnique({
          where: { id },
          include: { user: { select: userSelectFeedback } }
        });
        return sendRow(row);
      }
      return res.status(400).json({
        success: false,
        message: 'No hay cambios'
      });
    }

    const row = await prisma.feedback.update({
      where: { id },
      data,
      include: {
        user: {
          select: userSelectFeedback
        }
      }
    });

    return sendRow(row);
  } catch (error) {
    console.error('Error actualizando feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  createFeedback,
  listFeedback,
  patchFeedback
};
