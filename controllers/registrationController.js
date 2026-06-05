const db = require('../db'); 

// 1. تسجيل الطالب في حدث
exports.registerToEvent = (req, res) => {
  const { user_id, event_id } = req.body; 

  if (!user_id || !event_id) {
    return res.status(400).json({ error: "Données incomplètes" });
  }

  db.query("INSERT INTO registrations (user_id, event_id, status) VALUES (?, ?, 'confirmed')", [user_id, event_id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Inscription réussie !" });
  });
};

// 2. جلب تسجيلات الطالب 
exports.getUserRegistrations = (req, res) => {
  const { userId } = req.params;

  // زدنا r.id AS registration_id باش نضمنو كاع الكروت يكون عندهم ID مختلف تماماً
  const query = `
    SELECT e.*, r.id AS registration_id, r.status AS registration_status FROM events e
    INNER JOIN registrations r ON e.id = r.event_id
    WHERE r.user_id = ?
    ORDER BY e.date_event ASC
  `;

  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results); 
  });
};