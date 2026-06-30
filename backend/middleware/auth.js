const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Vérifier le token JWT
// ── Stratégie d'optimisation ────────────────────────────────────────────────
// Avant : chaque requête protégée faisait un User.findById() en base, même
//         pour juste vérifier le rôle (middleware admin).
// Maintenant : on stocke id, role et actif dans le JWT à la génération.
//   • Si la route a seulement besoin de l'id et du role → pas de requête DB.
//   • Si la route a besoin des données complètes (profil, email...) → elle
//     appelle explicitement User.findById(req.utilisateur.id) elle-même.
// On garde quand même une vérification DB légère si le compte est désactivé,
// mais seulement pour les tokens trop vieux (émis avant qu'on ajoute le champ).
exports.proteger = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ succes: false, message: 'Accès non autorisé. Token manquant.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Si le token contient déjà role et actif (tokens émis avec la nouvelle version)
    if (decoded.role !== undefined && decoded.actif !== undefined) {
      if (!decoded.actif) {
        return res.status(401).json({ succes: false, message: 'Compte désactivé.' });
      }
      // Pas de requête DB — toutes les infos nécessaires sont dans le token
      req.utilisateur = { _id: decoded.id, id: decoded.id, role: decoded.role, actif: decoded.actif };
      return next();
    }

    // Fallback pour les anciens tokens (sans role dans le payload) : requête DB unique
    const user = await User.findById(decoded.id).select('_id role actif');
    if (!user || !user.actif) {
      return res.status(401).json({ succes: false, message: 'Utilisateur introuvable ou désactivé.' });
    }
    req.utilisateur = user;
    next();
  } catch (error) {
    return res.status(401).json({ succes: false, message: 'Token invalide ou expiré.' });
  }
};

// Restreindre l'accès aux admins
exports.admin = (req, res, next) => {
  if (req.utilisateur.role !== 'admin') {
    return res.status(403).json({ succes: false, message: 'Accès réservé aux administrateurs.' });
  }
  next();
};

// Générer un token JWT
// On inclut maintenant role et actif dans le payload pour éviter les requêtes DB
// dans le middleware proteger sur chaque requête.
exports.genererToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, actif: user.actif !== false },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};
