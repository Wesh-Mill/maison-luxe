require('dotenv').config();

// ─── Validation des variables d'environnement critiques ───────────────────────
// Le serveur doit impérativement avoir une base MongoDB et un secret JWT.
// Les variables de paiement peuvent être absentes au premier déploiement ;
// dans ce cas, l'API démarre en mode "paiement non configuré".
const ENV_REQUIS = ['MONGODB_URI', 'JWT_SECRET'];
const ENV_OPTIONNELLES = [
  'CINETPAY_API_KEY',
  'CINETPAY_SITE_ID',
  'CINETPAY_SECRET_KEY',
  'CINETPAY_NOTIFY_URL',
  'CINETPAY_RETURN_URL',
  'FRONTEND_URL',
];

const envManquants = ENV_REQUIS.filter(k => !process.env[k]);
if (envManquants.length > 0) {
  console.error('❌ Variables d\'environnement manquantes :', envManquants.join(', '));
  console.error('   Configurez ces variables avant de démarrer l\'application.');
  process.exit(1);
}

const envOptionnellesManquantes = ENV_OPTIONNELLES.filter(k => !process.env[k]);
if (envOptionnellesManquantes.length > 0) {
  console.warn('⚠️ Variables de paiement/frontend non définies :', envOptionnellesManquantes.join(', '));
  console.warn('   L\'API démarrera, mais les paiements seront indisponibles tant que la configuration Render sera complétée.');
}

process.env.CINETPAY_NOTIFY_URL ||= 'https://maison-luxe-y6fm.onrender.com/api/paiements/notify';
process.env.CINETPAY_RETURN_URL ||= 'https://wesh-mill.github.io/maison-luxe/';
process.env.FRONTEND_URL ||= 'https://wesh-mill.github.io';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const connectDB = require('./config/database');

const app = express();

// Supprime le header "X-Powered-By: Express" — évite le fingerprinting de la stack
app.disable('x-powered-by');

// ─── Connexion base de données ────────────────────────────────────────────────
connectDB();

// ─── Middlewares de sécurité ──────────────────────────────────────────────────
// ─── Compression gzip/brotli ──────────────────────────────────────────────────
// Réduit la taille des réponses JSON de 60-80%. À placer AVANT tous les autres
// middlewares pour que toutes les réponses soient compressées.
app.use(compression({ threshold: 1024 })); // compresse seulement si > 1 Ko

app.use(helmet({
  // Force HTTPS pendant 1 an en production (HSTS).
  // En dev, on désactive pour pouvoir tester en HTTP local.
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true }
    : false,
  // Empêche le navigateur de deviner le Content-Type (MIME sniffing)
  noSniff: true,
  // Empêche l'app d'être chargée dans un iframe (clickjacking)
  frameguard: { action: 'deny' },
  // Cache-Control : pas de mise en cache des réponses API
  noCache: true,
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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

// 10mb était beaucoup trop large — vecteur DoS.
// 50kb suffit largement pour tous les payloads d'un e-commerce (panier, adresse, avis).
// Si des images sont envoyées, elles doivent passer par un upload multipart séparé,
// pas dans le body JSON.
// Limite stricte : une API e-commerce n'envoie jamais plus de 50kb.
// 10mb (ancienne valeur) = vecteur DoS trivial sur Render 512mb.
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/produits', require('./routes/produits'));
app.use('/api/commandes', require('./routes/commandes'));
app.use('/api/paiements', require('./routes/paiements'));

// Route de santé — renvoie uniquement un statut OK, sans info interne
// (version, env, timestamp précis) qui pourraient aider à fingerprinter l'app.
app.get('/api/health', (req, res) => {
  res.json({ succes: true, status: 'ok' });
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
