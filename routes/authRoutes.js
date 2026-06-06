const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Route pour l'inscription (Register)
router.post('/register', authController.register);

// Route pour la connexion (Sign In)
router.post('/login', authController.login);

// نزيدو الـ Route ديال تحديث البروفايل هنايا بنفس الطريقة المنظمة
router.put('/update', authController.updateProfile);

module.exports = router;