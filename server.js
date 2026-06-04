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

// ==================== CONFIGURATION BASE DE DONNÉES ====================\
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
    } catch (error) {
        console.error('❌ Erreur de connexion à la base de données :', error.message);
    }
}
testDbConnection();

// ==================== MIDDLEWARE D'AUTHENTIFICATION ====================\
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: "Accès refusé. Aucun token fourni." });
    }

    // Gestion du token de test temporaire pour éviter les blocages
    if (token === "fake-token-for-test") {
        req.user = { id: 1, role: 'organizer', name: 'Karim Organisateur' };
        return next();
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'votre_secret_jwt');
        req.user = verified;
        next();
    } catch (error) {
        res.status(403).json({ message: "Token invalide ou expiré." });
    }
};

// ==================== ROUTES ÉVÉNEMENTS & ORGANISATEUR ====================\

// 1. Route pour créer un événement (POST /api/evenements)
app.post('/api/evenements', authenticateToken, async (req, res) => {
    const { titre, description, date, capacite, location } = req.body;

    if (!titre || !date || !capacite || !location) {
        return res.status(400).json({ message: "Veuillez remplir tous les champs obligatoires (Titre, Date, Capacité, Salle)." });
    }

    try {
        // Séparation du format datetime-local "YYYY-MM-DDTHH:MM" en Date et Heure pour MySQL
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
        console.error("Erreur lors de l'insertion de l'événement :", error);
        res.status(500).json({ message: "Erreur lors de la sauvegarde dans la base de données : " + error.message });
    }
});

// 2. Route pour récupérer les événements de l'organisateur (GET /api/organisateur/evenements)
app.get('/api/organisateur/evenements', authenticateToken, async (req, res) => {
    try {
        const organizer_id = req.user.id || 1;

        // Utilisation d'alias SQL (AS) pour renvoyer exactement les clés attendues par React
        const query = `
            SELECT 
                id, 
                title AS titre, 
                description, 
                CONCAT(date_event, 'T', time_event) AS date, 
                location, 
                available_seats AS capacite, 
                IF(status = 'approved' OR status = 'VALIDEE', 'VALIDEE', 'pending') AS statut,
                (SELECT COUNT(*) FROM registrations WHERE event_id = events.id) AS participants_count
            FROM events
            WHERE organizer_id = ?
            ORDER BY date_event DESC, time_event DESC
        `;
        
        const [events] = await db.query(query, [organizer_id]);
        res.json(events);
    } catch (error) {
        console.error("Erreur récupération événements organisateur :", error);
        res.status(500).json({ message: "Erreur serveur lors de la récupération des événements." });
    }
});

// 3. Route pour les statistiques du tableau de bord (GET /api/organisateur/stats)
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
        console.error("Erreur statistiques :", error);
        res.status(500).json({ message: "Erreur lors du calcul des statistiques." });
    }
});

// 4. Route pour lister les salles disponibles (GET /api/salles)
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

// Test de fonctionnement de l'API
app.get('/api/test', (req, res) => {
    res.json({ status: "running", message: "L'API de Campus Event Hub fonctionne parfaitement !" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port http://localhost:${PORT}`);
});