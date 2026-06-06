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

app.post('/api/feedbacks', (req, res) => {
  // القراءة مباشرة بـ user_id كيمّا كاين فالداتابيز عندك
  const user_id = parseInt(req.body.user_id || req.body.student_id, 10);
  const event_id = parseInt(req.body.event_id || req.body.id, 10);
  const { rating, comment } = req.body;

  console.log("Données reçues pour Feedback:", { user_id, event_id, rating, comment });

  if (!user_id || !event_id || !rating) {
    return res.status(400).json({ success: false, error: "Données incomplètes ou ID invalides" });
  }

  // 📝 هنا دوزنا الكولون الصحيح user_id اللي عندك فالباز دو دوني
  const query = "INSERT INTO feedbacks (user_id, event_id, rating, comment) VALUES (?, ?, ?, ?)";
  db.query(query, [user_id, event_id, rating, comment], (err, result) => {
    if (err) {
      console.error("Erreur SQL Feedback:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, message: "Avis ajouté avec succès !" });
  });
});
// Port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});