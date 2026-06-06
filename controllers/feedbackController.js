const db = require('../db');

exports.createFeedback = (req, res) => {
  const { user_id, event_id, rating, comment } = req.body;

  if (!user_id || !event_id || !rating) {
    return res.status(400).json({ error: "Données incomplètes" });
  }

  const query = "INSERT INTO feedbacks (user_id, event_id, rating, comment) VALUES (?, ?, ?, ?)";
  db.query(query, [user_id, event_id, rating, comment], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Avis ajouté avec succès !" });
  });
};