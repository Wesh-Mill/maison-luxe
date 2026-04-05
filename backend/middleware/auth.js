const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Vérifier le token JWT
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
    req.utilisateur = await User.findById(decoded.id);

    if (!req.utilisateur || !req.utilisateur.actif) {
      return res.status(401).json({ succes: false, message: 'Utilisateur introuvable ou désactivé.' });
    }

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
exports.genererToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};
