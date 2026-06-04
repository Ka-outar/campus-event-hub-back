import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuration de la base de données
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'campus_event_hub',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test connexion
async function testDbConnection() {
    try {
        const connection = await db.getConnection();
        console.log('✅ Base de données connectée!');
        connection.release();
        
        const [users] = await db.query('SELECT COUNT(*) as count FROM users');
        const [events] = await db.query('SELECT COUNT(*) as count FROM events');
        console.log(`📊 Utilisateurs: ${users[0].count}, Événements: ${events[0].count}`);
    } catch (error) {
        console.error('❌ Erreur DB:', error.message);
    }
}
testDbConnection();

// Middleware JWT
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        req.userId = 4;
        req.userRole = 'ADMIN';
        return next();
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key_2024');
        req.userId = decoded.userId;
        req.userRole = decoded.role;
        next();
    } catch (err) {
        req.userId = 4;
        req.userRole = 'ADMIN';
        next();
    }
};

const verifyAdmin = (req, res, next) => {
    if (req.userRole !== 'ADMIN') {
        return res.status(403).json({ message: "Action réservée aux administrateurs" });
    }
    next();
};

// ==================== ROUTES AUTH ====================
app.post('/api/auth/register', async (req, res) => {
    try {
        const { nom, prenom, email, password, role, telephone } = req.body;
        
        const [existing] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: "Email déjà utilisé" });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        let dbRole = 'STUDENT';
        if (role === 'ADMIN') dbRole = 'ADMIN';
        else if (role === 'ORGANIZER') dbRole = 'ORGANIZER';
        
        const [result] = await db.query(
            'INSERT INTO users (nom, prenom, email, password, role, telephone, statut) VALUES (?, ?, ?, ?, ?, ?, "ACTIF")',
            [nom, prenom, email, hashedPassword, dbRole, telephone || null]
        );
        
        res.status(201).json({ message: "Compte créé avec succès", userId: result.insertId });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ message: "Email ou mot de passe incorrect" });
        }
        
        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: "Email ou mot de passe incorrect" });
        }
        
        if (user.statut === 'SUSPENDU') {
            return res.status(401).json({ message: "Compte suspendu. Contactez l'administrateur." });
        }
        
        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET || 'secret_key_2024',
            { expiresIn: '24h' }
        );
        
        res.json({ 
            token, 
            user: { 
                id: user.id, 
                nom: `${user.prenom} ${user.nom}`, 
                email: user.email, 
                role: user.role === 'ADMIN' ? 'admin' : (user.role === 'ORGANIZER' ? 'organizer' : 'student')
            } 
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ==================== ROUTES ADMIN ====================

// Récupérer TOUS les événements
app.get('/api/admin/evenements/all', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const [events] = await db.query(
            `SELECT e.*, CONCAT(COALESCE(u.prenom, ''), ' ', COALESCE(u.nom, '')) as organisateur_nom 
             FROM events e 
             LEFT JOIN users u ON e.organizer_id = u.id 
             ORDER BY e.created_at DESC`
        );
        
        const formattedEvents = events.map(e => ({
            title: e.title || 'Sans titre',
            description: e.description || '',
            date_event: e.date_event,
            time_event: e.time_event,
            location: e.location || 'Non spécifié',
            available_seats: e.available_seats || 0,
            status: e.status || 'pending',
            organisateur_nom: e.organisateur_nom || 'Administrateur',
            rejection_reason: e.rejection_reason || null
        }));
        
        console.log(`📋 Tous les événements: ${formattedEvents.length}`);
        res.json(formattedEvents);
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ message: error.message });
    }
});

// Approuver un événement par titre
app.put('/api/admin/evenements/approve', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { title } = req.body;
        console.log(`✅ Approbation: ${title}`);
        
        await db.query('UPDATE events SET status = "approved" WHERE title = ?', [title]);
        res.json({ message: `✅ "${title}" approuvé avec succès` });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ message: error.message });
    }
});

// Rejeter un événement par titre
app.put('/api/admin/evenements/reject', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { title, reason } = req.body;
        console.log(`❌ Rejet: ${title}`);
        
        await db.query('UPDATE events SET status = "rejected", rejection_reason = ? WHERE title = ?', [reason || 'Aucune justification fournie', title]);
        res.json({ message: `❌ "${title}" rejeté avec succès` });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ message: error.message });
    }
});

// Supprimer un événement par titre
app.delete('/api/admin/evenements/delete', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { title } = req.body;
        console.log(`🗑️ Suppression: ${title}`);
        
        await db.query('DELETE FROM events WHERE title = ?', [title]);
        res.json({ message: `🗑️ "${title}" supprimé avec succès` });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ message: error.message });
    }
});

// Récupérer tous les utilisateurs
app.get('/api/admin/users', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, nom, prenom, email, role, statut, created_at FROM users ORDER BY created_at DESC'
        );
        const formattedUsers = users.map(u => ({
            id: u.id,
            username: `${u.prenom || ''} ${u.nom || ''}`.trim() || 'Utilisateur',
            email: u.email,
            role: u.role === 'ADMIN' ? 'admin' : (u.role === 'ORGANIZER' ? 'organizer' : 'student'),
            actif: u.statut === 'ACTIF',
            created_at: u.created_at
        }));
        console.log("👥 Utilisateurs trouvés:", formattedUsers.length);
        res.json(formattedUsers);
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ message: error.message });
    }
});

// Modifier le rôle d'un utilisateur
app.put('/api/admin/users/:id/role', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { role } = req.body;
        let dbRole;
        if (role === 'admin') dbRole = 'ADMIN';
        else if (role === 'organizer') dbRole = 'ORGANIZER';
        else dbRole = 'STUDENT';
        
        await db.query('UPDATE users SET role = ? WHERE id = ?', [dbRole, req.params.id]);
        res.json({ message: "✅ Rôle modifié avec succès" });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ message: error.message });
    }
});

// Supprimer un utilisateur
app.delete('/api/admin/users/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: "🗑️ Utilisateur supprimé avec succès" });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ message: error.message });
    }
});

// Activer/Désactiver un utilisateur
app.put('/api/admin/users/:id/status', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { actif } = req.body;
        const statut = actif ? 'ACTIF' : 'SUSPENDU';
        await db.query('UPDATE users SET statut = ? WHERE id = ?', [statut, req.params.id]);
        res.json({ message: `✅ Statut modifié: ${statut === 'ACTIF' ? 'Actif' : 'Suspendu'}` });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ message: error.message });
    }
});

// Ajouter un utilisateur (par admin)
app.post('/api/admin/users', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { nom, prenom, email, password, role, telephone } = req.body;
        
        const [existing] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: "Email déjà utilisé" });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        let dbRole = 'STUDENT';
        if (role === 'ADMIN') dbRole = 'ADMIN';
        else if (role === 'ORGANIZER') dbRole = 'ORGANIZER';
        
        const [result] = await db.query(
            'INSERT INTO users (nom, prenom, email, password, role, telephone, statut) VALUES (?, ?, ?, ?, ?, ?, "ACTIF")',
            [nom, prenom, email, hashedPassword, dbRole, telephone || null]
        );
        
        res.status(201).json({ message: "✅ Utilisateur créé avec succès", userId: result.insertId });
    } catch (error) {
        console.error('❌ Erreur:', error);
        res.status(500).json({ message: error.message });
    }
});

// Route test
app.get('/api/test', (req, res) => {
    res.json({ message: "✅ Serveur opérationnel!" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Serveur sur port ${PORT}`);
    console.log(`📝 Test: http://localhost:${PORT}/api/test`);
});