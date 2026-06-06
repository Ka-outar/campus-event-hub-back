const db = require('../db');

// ==========================================
// 1. FONCTION REGISTER (INSCRIPTION)
// ==========================================
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

// ==========================================
// 2. FONCTION LOGIN (CONNEXION)
// ==========================================
// ==========================================
// 2. FONCTION LOGIN (CONNEXION)
// ==========================================
exports.login = (req, res) => {
    const { loginEmail, loginPassword } = req.body;

    if (!loginEmail || !loginPassword) {
        return res.status(400).json({ success: false, message: "Veuillez remplir tous les champs." });
    }

    const query = "SELECT * FROM users WHERE email = ? AND password = ?";
    
    db.query(query, [loginEmail, loginPassword], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: "Erreur de la base de données.", error: err });
        }

        if (result.length > 0) {
            const user = result[0];
            return res.status(200).json({ 
                success: true, 
                message: "Connexion réussie !",
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    profile_image: user.profile_image // <--- هاد السطر كان ناقص وزدناه باش الصورة ترجع ف الـ Login
                }
            });
        } else {
            return res.status(401).json({ success: false, message: "Email ou mot de passe incorrect." });
        }
    });
};

// ==========================================
// 3. FONCTION UPDATE PROFILE (تحديث البروفايل) - AJOUTÉE ICI
// ==========================================
// ==========================================
// 3. FONCTION UPDATE PROFILE (تحديث البروفايل) - نسخة آمنة بدون صورة
// ==========================================
exports.updateProfile = (req, res) => {
    const { id, username, email, password } = req.body; // <--- حيدنا الـ profile_image من هنا

    // 1. Validation minimale
    if (!id || !username || !email) {
        return res.status(400).json({ success: false, message: "Le nom et l'email sont obligatoires." });
    }

    // 2. Vérifier si l'email est déjà utilisé par un AUTRE utilisateur
    const checkEmailQuery = "SELECT * FROM users WHERE email = ? AND id != ?";
    
    db.query(checkEmailQuery, [email, id], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: "Erreur de la base de données.", error: err });
        }

        if (result.length > 0) {
            return res.status(400).json({ success: false, message: "Cet email est déjà utilisé par un autre compte." });
        }

        // 3. التحديث دابا كيقيس غير الاسم والإيميل والـ password فقط
        let updateQuery = "UPDATE users SET username = ?, email = ? WHERE id = ?";
        let queryParams = [username, email, id];

        if (password && password.trim() !== "") {
            updateQuery = "UPDATE users SET username = ?, email = ?, password = ? WHERE id = ?";
            queryParams = [username, email, password, id];
        }

        // 4. تنفيذ الاستعلام ف قاعدة البيانات
        db.query(updateQuery, queryParams, (updateErr, updateResult) => {
            if (updateErr) {
                return res.status(500).json({ success: false, message: "Échec de la mise à jour du profil.", error: updateErr });
            }

            return res.status(200).json({
                success: true,
                message: "Profil mis à jour avec succès !",
                user: {
                    id: id,
                    username: username,
                    email: email
                }
            });
        });
    });
};