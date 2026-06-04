const db = require('../db'); 

// Récupération des événements avec recherche ET filtre par catégorie obligatoire
exports.getAllEvents = (req, res) => {
  const { search, category } = req.query;
  
  let query = "SELECT * FROM events WHERE status = 'approved'";
  let queryParams = [];

  // Recherche par titre ou description
  if (search) {
    query += " AND (title LIKE ? OR description LIKE ?)";
    queryParams.push(`%${search}%`, `%${search}%`);
  }

  // Filtrage par catégorie (si une catégorie spécifique est choisie)
  if (category && category !== 'Tous') {
    query += " AND category = ?";
    queryParams.push(category);
  }

  // Tri par date d'événement
  query += " ORDER BY date_event ASC";

  db.query(query, queryParams, (err, results) => {
    if (err) {
      console.error("Erreur lors de la récupération des événements:", err);
      return res.status(500).json({ error: "Erreur serveur" });
    }
    res.json(results);
  });
};