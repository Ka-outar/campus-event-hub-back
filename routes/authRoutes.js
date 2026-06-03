const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Quand le Frontend envoie une requête POST sur /api/auth/register, on appelle la fonction register
router.post('/register', authController.register);

module.exports = router;