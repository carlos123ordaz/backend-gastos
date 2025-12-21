const express = require('express');
const router = express.Router();
const {
  getResumen,
  getEstadisticas
} = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

router.get('/resumen', protect, getResumen);
router.get('/estadisticas', protect, getEstadisticas);

module.exports = router;