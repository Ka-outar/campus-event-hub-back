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

// ==================== CONFIGURATION BASE DE DONNÉES ====================
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'campus_event_hub',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test de connexion DB au démarrage
async function testDbConnection() {
    try {
        const connection = await db.getConnection();
        console.log('✅ Base de données connectée avec succès !');
        connection.release();
        
        const [users] = await db.query('SELECT COUNT(*) as count FROM users');
        const [events] = await db.query('SELECT COUNT(*) as count FROM events');
        console.log(`📊 Utilisateurs: ${users[0].count}, Événements: ${events[0].count}`);
    } catch (error) {
        console.error('❌ Erreur de connexion à la base de données :', error.message);
    }
}
testDbConnection();

// ==================== MIDDLEWARE D'AUTHENTIFICATION ====================
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // Gestion du token de test temporaire
    if (token === "fake-token-for-test") {
        req.user = { id: 1, role: 'admin', name: 'Admin Test' };
        return next();
    }

    if (!token) {
        return res.status(401).json({ message: "Accès refusé. Aucun token fourni." });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'votre_secret_jwt');
        req.user = verified;
        next();
    } catch (error) {
        res.status(403).json({ message: "Token invalide ou expiré." });
    }
};

const verifyAdmin = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: "Action réservée aux administrateurs" });
    }
    next();
};

// ==================== ROUTES AUTH ====================
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, role } = req.body;
        
        const [existing] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: "Email déjà utilisé" });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const userRole = role || 'student';
        
        const [result] = await db.query(
            'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, userRole]
        );
        
        res.status(201).json({ message: "Compte créé avec succès", userId: result.insertId });
    } catch (error) {
        console.error('Erreur:', error);
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
        
        const token = jwt.sign(
            { id: user.id, role: user.role, name: user.username },
            process.env.JWT_SECRET || 'votre_secret_jwt',
            { expiresIn: '24h' }
        );
        
        res.json({ 
            token, 
            user: { 
                id: user.id, 
                nom: user.username,
                email: user.email, 
                role: user.role 
            } 
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ==================== ROUTES ORGANISATEUR ====================

// 1. Créer un événement
app.post('/api/evenements', authenticateToken, async (req, res) => {
    const { titre, description, date, capacite, location } = req.body;

    if (!titre || !date || !capacite || !location) {
        return res.status(400).json({ message: "Veuillez remplir tous les champs obligatoires." });
    }

    try {
        const [date_event, time_event] = date.split('T');
        const organizer_id = req.user.id || 1;

        const query = `
            INSERT INTO events (title, description, date_event, time_event, location, available_seats, organizer_id, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
        `;

        const [result] = await db.query(query, [
            titre, 
            description || '', 
            date_event, 
            time_event || '00:00:00', 
            location, 
            capacite, 
            organizer_id
        ]);

        res.status(201).json({ 
            success: true, 
            message: "Événement enregistré avec succès !", 
            eventId: result.insertId 
        });
    } catch (error) {
        console.error("Erreur création événement:", error);
        res.status(500).json({ message: "Erreur lors de la sauvegarde: " + error.message });
    }
});

// 2. Récupérer les événements de l'organisateur
app.get('/api/organisateur/evenements', authenticateToken, async (req, res) => {
    try {
        const organizer_id = req.user.id || 1;

        const query = `
            SELECT 
                id, 
                title AS titre, 
                description, 
                CONCAT(date_event, 'T', time_event) AS date, 
                location, 
                available_seats AS capacite, 
                status,
                (SELECT COUNT(*) FROM registrations WHERE event_id = events.id) AS participants_count
            FROM events
            WHERE organizer_id = ?
            ORDER BY date_event DESC, time_event DESC
        `;
        
        const [events] = await db.query(query, [organizer_id]);
        res.json(events);
    } catch (error) {
        console.error("Erreur récupération événements:", error);
        res.status(500).json({ message: "Erreur serveur." });
    }
});

// 3. Statistiques du tableau de bord
app.get('/api/organisateur/stats', authenticateToken, async (req, res) => {
    try {
        const organizer_id = req.user.id || 1;

        const [eventsCount] = await db.query('SELECT COUNT(*) as total FROM events WHERE organizer_id = ?', [organizer_id]);
        const [registrationsCount] = await db.query(`
            SELECT COUNT(*) as total 
            FROM registrations r 
            JOIN events e ON r.event_id = e.id 
            WHERE e.organizer_id = ?
        `, [organizer_id]);
        const [upcomingCount] = await db.query('SELECT COUNT(*) as total FROM events WHERE organizer_id = ? AND date_event >= CURDATE()', [organizer_id]);

        res.json({
            totalEvents: eventsCount[0].total || 0,
            totalInscriptions: registrationsCount[0].total || 0,
            upcomingEvents: upcomingCount[0].total || 0
        });
    } catch (error) {
        console.error("Erreur statistiques:", error);
        res.status(500).json({ message: "Erreur lors du calcul des statistiques." });
    }
});

// 4. Liste des participants d'un événement
app.get('/api/evenements/:id/participants', authenticateToken, async (req, res) => {
    try {
        const [participants] = await db.query(`
            SELECT r.id as registration_id, u.id, u.username as nom, u.email, 
                   r.status as statut, r.registered_at as date_inscription
            FROM registrations r 
            JOIN users u ON r.user_id = u.id 
            WHERE r.event_id = ?
        `, [req.params.id]);
        
        res.json(participants);
    } catch (error) {
        console.error("Erreur participants:", error);
        res.status(500).json({ message: "Erreur serveur." });
    }
});

// 5. Mettre à jour la présence
app.put('/api/inscriptions/:id/presence', authenticateToken, async (req, res) => {
    try {
        const { presence } = req.body;
        // Note: La table registrations n'a pas de colonne presence
        res.json({ message: "Présence mise à jour (simulation)" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 6. Liste des salles
app.get('/api/salles', async (req, res) => {
    try {
        const [locations] = await db.query('SELECT DISTINCT location FROM events WHERE location IS NOT NULL AND location != ""');
        if (locations.length > 0) {
            res.json(locations.map((l, i) => ({ id: i + 1, nom: l.location, capacite: 100 })));
        } else {
            res.json([
                { id: 1, nom: "Amphithéâtre A", capacite: 200 },
                { id: 2, nom: "Salle B101", capacite: 50 },
                { id: 3, nom: "Salle C202", capacite: 30 }
            ]);
        }
    } catch (error) {
        res.json([
            { id: 1, nom: "Amphithéâtre A", capacite: 200 },
            { id: 2, nom: "Salle B101", capacite: 50 }
        ]);
    }
});

// ==================== ROUTES ADMIN ====================

// 1. Récupérer tous les événements
app.get('/api/admin/evenements/all', authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const [events] = await db.query(`
            SELECT e.*, u.username as organisateur_nom 
            FROM events e 
            LEFT JOIN users u ON e.organizer_id = u.id 
            ORDER BY e.created_at DESC
        `);
        
        const formattedEvents = events.map(e => ({
            id: e.id,
            title: e.title,
            description: e.description,
            date_event: e.date_event,
            time_event: e.time_event,
            location: e.location,
            available_seats: e.available_seats,
            status: e.status,
            organisateur_nom: e.organisateur_nom || 'Inconnu',
            rejection_reason: e.rejection_reason || null
        }));
        
        res.json(formattedEvents);
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ message: error.message });
    }
});

// 2. Approuver un événement
app.put('/api/admin/evenements/approve', authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const { title } = req.body;
        await db.query('UPDATE events SET status = "approved" WHERE title = ?', [title]);
        res.json({ message: `✅ "${title}" approuvé` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 3. Rejeter un événement
app.put('/api/admin/evenements/reject', authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const { title, reason } = req.body;
        await db.query('UPDATE events SET status = "rejected", rejection_reason = ? WHERE title = ?', [reason || 'Aucune justification', title]);
        res.json({ message: `❌ "${title}" rejeté` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 4. Supprimer un événement
app.delete('/api/admin/evenements/delete', authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const { title } = req.body;
        await db.query('DELETE FROM events WHERE title = ?', [title]);
        res.json({ message: `🗑️ "${title}" supprimé` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 5. Récupérer tous les utilisateurs
app.get('/api/admin/users', authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const [users] = await db.query('SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 6. Modifier le rôle d'un utilisateur
app.put('/api/admin/users/:id/role', authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const { role } = req.body;
        await db.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
        res.json({ message: "Rôle modifié" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 7. Supprimer un utilisateur
app.delete('/api/admin/users/:id', authenticateToken, verifyAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: "Utilisateur supprimé" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 8. Ajouter un utilisateur
app.post('/api/admin/users', authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const { username, email, password, role } = req.body;
        
        const [existing] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: "Email déjà utilisé" });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, role || 'student']
        );
        
        res.status(201).json({ message: "Utilisateur créé", userId: result.insertId });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ==================== ROUTES ÉTUDIANT ====================

// Récupérer tous les événements validés
app.get('/api/evenements', async (req, res) => {
    try {
        const [events] = await db.query(`
            SELECT e.*, u.username as organisateur_nom
            FROM events e
            LEFT JOIN users u ON e.organizer_id = u.id
            WHERE e.status = 'approved' OR e.status = 'VALIDEE'
            ORDER BY e.date_event ASC
        `);
        res.json(events);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// S'inscrire à un événement
app.post('/api/inscriptions', authenticateToken, async (req, res) => {
    try {
        const { event_id } = req.body;
        const user_id = req.user.id;
        
        const [existing] = await db.query(
            'SELECT * FROM registrations WHERE user_id = ? AND event_id = ?',
            [user_id, event_id]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ message: "Déjà inscrit" });
        }
        
        const [result] = await db.query(
            'INSERT INTO registrations (user_id, event_id, status) VALUES (?, ?, "confirmed")',
            [user_id, event_id]
        );
        
        res.status(201).json({ message: "Inscription réussie", id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ==================== ROUTE TEST ====================
app.get('/api/test', (req, res) => {
    res.json({ status: "running", message: "L'API de Campus Event Hub fonctionne parfaitement !" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port http://localhost:${PORT}`);
});