const express = require('express');
const cors = require('cors');
require('dotenv').config();

// 1. On importe la connexion à la base de donnée:
const db = require('./db');

// 2. On ajoute l'importation de tes nouvelles routes ici :
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const registrationRoutes = require('./routes/registrationRoutes');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// 3. On dit à l'application d'utiliser tes routes d'authentification :
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);

app.use('/api/registrations', registrationRoutes);

// Route Test
app.get('/api/test', (req, res) => {
    res.json({ message: "Serveur est bien fonctionne" });
});

// Port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});