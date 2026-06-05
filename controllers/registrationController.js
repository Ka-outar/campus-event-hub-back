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
// جلب تسجيلات الطالب بـ ID ديالو
// جلب تسجيلات الطالب بـ ID ديالو - النسخة المصححة والمضمونة
exports.getUserRegistrations = (req, res) => {
  const { userId } = req.params;

  // 💡 هنا زدنا كاع الاحتمالات (event_id, id, status, registration_status...) باش الفرونت ميتلفش
  const query = `
    SELECT 
      r.id AS registration_id, 
      r.event_id AS event_id, 
      r.status AS status,
      r.status AS registration_status, 
      r.user_id AS user_id,
      r.user_id AS student_id,
      r.qr_code_data, 
      r.registered_at,
      e.id AS id, 
      e.title, 
      e.category,
      e.date_event, 
      e.time_event, 
      e.location, 
      e.image_url
    FROM registrations r
    JOIN events e ON r.event_id = e.id
    WHERE r.user_id = ?
  `;

  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

// 3. إلغاء تسجيل الطالب في حدث
exports.cancelRegistration = (req, res) => {
  const { registrationId } = req.params;

  console.log("Tentative d'annulation pour l'ID:", registrationId);

  db.query("SELECT event_id FROM registrations WHERE id = ?", [registrationId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Inscription non trouvée" });
    }

    const eventId = results[0].event_id;

    db.query("DELETE FROM registrations WHERE id = ?", [registrationId], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
      }

      db.query("UPDATE events SET available_seats = available_seats + 1 WHERE id = ?", [eventId], (err) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: err.message });
        }
        res.json({ message: "Inscription annulée avec succès !" });
      });
    });
  });
};