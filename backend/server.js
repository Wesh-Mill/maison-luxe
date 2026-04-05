// Charge .env en local uniquement (Render injecte les variables directement)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');

const app = express();

// ─── Connexion base de données ────────────────────────────────────────────────
connectDB();

// ─── Middlewares de sécurité ──────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://wesh-mill.github.io',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
  ],
  credentials: true
}));

// Rate limiting global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { succes: false, message: 'Trop de requêtes, réessayez dans 15 minutes.' }
});
app.use('/api/', limiter);

// Rate limiting strict pour l'auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { succes: false, message: 'Trop de tentatives de connexion.' }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/produits', require('./routes/produits'));
app.use('/api/commandes', require('./routes/commandes'));
app.use('/api/paiements', require('./routes/paiements'));

// Route de santé
app.get('/api/health', (req, res) => {
  res.json({
    succes: true,
    message: '✅ Maison Luxe API opérationnelle',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ─── Gestion des erreurs 404 ──────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ succes: false, message: 'Route introuvable' });
});

// ─── Gestion globale des erreurs ──────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Erreur:', err.stack);
  res.status(err.status || 500).json({
    succes: false,
    message: err.message || 'Erreur interne du serveur'
  });
});

// ─── Démarrage serveur ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║     🛍️  MAISON LUXE API - v1.0.0       ║
  ║     Serveur démarré sur port ${PORT}     ║
  ║     Environnement: ${process.env.NODE_ENV || 'development'}         ║
  ╚════════════════════════════════════════╝
  `);
});

module.exports = app;
