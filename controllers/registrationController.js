const db = require('../db');

// 1. تسجيل مستخدم في حدث معين (متوافق مع student_id)
exports.registerToEvent = (req, res) => {
  const { user_id, event_id } = req.body; // الـ user_id جاي من الفرونت

  if (!user_id || !event_id) {
    return res.status(400).json({ error: "Données incomplètes" });
  }

  // التأكد أولاً من توفر المقاعد
  db.query("SELECT available_seats FROM events WHERE id = ?", [event_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: "Événement non trouvé" });

    if (results[0].available_seats <= 0) {
      return res.status(400).json({ error: "Plus de places disponibles pour cet événement" });
    }

    // إدخال التسجيل ف جدول registrations باستخدام student_id الحقيقي
    db.query("INSERT INTO registrations (student_id, event_id) VALUES (?, ?)", [user_id, event_id], (err) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ error: "Vous êtes déjà inscrit à cet événement" });
        }
        return res.status(500).json({ error: err.message });
      }

      // إنقاص مقعد واحد من جدول events
      db.query("UPDATE events SET available_seats = available_seats - 1 WHERE id = ?", [event_id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Inscription réussie !" });
      });
    });
  });
};

// 2. جلب الأحداث التي تسجل فيها مستخدم معين (Tâche 7 - معدلة ومضمونة)
exports.getUserRegistrations = (req, res) => {
  const { userId } = req.params;

  // الكويري دابا كتقرأ student_id اللي كاين ف الـ Database ديالك
  const query = `
    SELECT e.* FROM events e
    INNER JOIN registrations r ON e.id = r.event_id
    WHERE r.student_id = ?
    ORDER BY e.date_event ASC
  `;

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Erreur SQL:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
};