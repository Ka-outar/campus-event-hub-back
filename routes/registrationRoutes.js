const express = require('express');
const router = express.Router();
const registrationController = require('../controllers/registrationController');

router.post('/register', registrationController.registerToEvent);
router.get('/user/:userId', registrationController.getUserRegistrations);

module.exports = router;