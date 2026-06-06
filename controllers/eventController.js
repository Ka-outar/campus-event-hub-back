const db = require('../db'); 

// جلب الأحداث ديريكت بالاعتماد على العمود النصي category
exports.getAllEvents = (req, res) => {
  // كنجيبو الأحداث كاملين ديريكت
  let query = "SELECT * FROM events";
  
  db.query(query, (err, results) => {
    if (err) {
      console.error("Erreur lors de la récupération des événements:", err);
      return res.status(500).json({ error: "Erreur serveur" });
    }
    res.json(results);
  });
};

// هاد الدالة وخا تعيطي ليها ف الفرونت غاترجع مصفوفة خاوية باش ما تفرقعش الكود
exports.getAllCategories = (req, res) => {
  res.json([]); 
};