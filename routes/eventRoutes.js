const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');

// Route لجلب الأحداث
router.get('/', eventController.getAllEvents);

module.exports = router;