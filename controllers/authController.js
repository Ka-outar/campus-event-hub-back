const db = require('../db');

exports.register = (req, res) => {
    const { fullName, email, password, role } = req.body;

    // 1. Validation des champs
    if (!fullName || !email || !password || !role) {
        return res.status(400).json({ success: false, message: "Veuillez remplir tous les champs." });
    }

    // 2. Vérifier si l'email existe déjà
    const checkEmailQuery = "SELECT * FROM users WHERE email = ?";
    
    db.query(checkEmailQuery, [email], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: "Erreur de la base de données.", error: err });
        }

        if (result.length > 0) {
            return res.status(400).json({ success: false, message: "Cet email existe déjà." });
        }

        // 3. Insertion du nouvel utilisateur dans la table 'users'
        const insertQuery = "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)";
        
        db.query(insertQuery, [fullName, email, password, role], (insertErr, insertResult) => {
            if (insertErr) {
                return res.status(500).json({ success: false, message: "Échec de la création de l'utilisateur.", error: insertErr });
            }

            return res.status(201).json({ 
                success: true, 
                message: "User registered successfully in the database!" 
            });
        });
    });
};