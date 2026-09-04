const express = require('express');
const auth = require('../middleware/auth');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const {
  createFeedback,
  listFeedback,
  patchFeedback
} = require('../controllers/feedbackController');

const router = express.Router();

router.post('/feedback', auth, createFeedback);
router.get('/admin/feedback', auth, requireSuperAdmin, listFeedback);
router.patch('/admin/feedback/:id', auth, requireSuperAdmin, patchFeedback);

module.exports = router;
