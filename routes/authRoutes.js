const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Route pour l'inscription (Register)
router.post('/register', authController.register);

// Route pour la connexion (Sign In) - LA LIGNE À RAJOUTER :
router.post('/login', authController.login);

module.exports = router;