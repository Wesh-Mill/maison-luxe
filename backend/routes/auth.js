const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { genererToken, proteger } = require('../middleware/auth');

// POST /api/auth/inscription
router.post('/inscription', [
  body('nom').notEmpty().trim().withMessage('Nom requis'),
  body('prenom').notEmpty().trim().withMessage('Prénom requis'),
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('motDePasse').isLength({ min: 6 }).withMessage('Mot de passe minimum 6 caractères'),
], async (req, res) => {
  const erreurs = validationResult(req);
  if (!erreurs.isEmpty()) {
    return res.status(400).json({ succes: false, erreurs: erreurs.array() });
  }

  try {
    const { nom, prenom, email, motDePasse, telephone } = req.body;

    const existant = await User.findOne({ email });
    if (existant) {
      return res.status(400).json({ succes: false, message: 'Cet email est déjà utilisé.' });
    }

    const utilisateur = await User.create({ nom, prenom, email, motDePasse, telephone });
    const token = genererToken(utilisateur._id);

    res.status(201).json({
      succes: true,
      message: 'Compte créé avec succès',
      token,
      utilisateur: {
        id: utilisateur._id,
        nom: utilisateur.nom,
        prenom: utilisateur.prenom,
        email: utilisateur.email,
        role: utilisateur.role
      }
    });
  } catch (error) {
    res.status(500).json({ succes: false, message: 'Erreur serveur', erreur: error.message });
  }
});

// POST /api/auth/connexion
router.post('/connexion', [
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('motDePasse').notEmpty().withMessage('Mot de passe requis'),
], async (req, res) => {
  const erreurs = validationResult(req);
  if (!erreurs.isEmpty()) {
    return res.status(400).json({ succes: false, erreurs: erreurs.array() });
  }

  try {
    const { email, motDePasse } = req.body;

    const utilisateur = await User.findOne({ email }).select('+motDePasse');
    if (!utilisateur) {
      return res.status(401).json({ succes: false, message: 'Email ou mot de passe incorrect.' });
    }

    const motDePasseValide = await utilisateur.comparerMotDePasse(motDePasse);
    if (!motDePasseValide) {
      return res.status(401).json({ succes: false, message: 'Email ou mot de passe incorrect.' });
    }

    if (!utilisateur.actif) {
      return res.status(401).json({ succes: false, message: 'Compte désactivé. Contactez le support.' });
    }

    const token = genererToken(utilisateur._id);

    res.json({
      succes: true,
      message: 'Connexion réussie',
      token,
      utilisateur: {
        id: utilisateur._id,
        nom: utilisateur.nom,
        prenom: utilisateur.prenom,
        email: utilisateur.email,
        role: utilisateur.role
      }
    });
  } catch (error) {
    res.status(500).json({ succes: false, message: 'Erreur serveur', erreur: error.message });
  }
});

// GET /api/auth/profil (protégé)
router.get('/profil', proteger, async (req, res) => {
  res.json({ succes: true, utilisateur: req.utilisateur });
});

// PUT /api/auth/profil (protégé)
router.put('/profil', proteger, async (req, res) => {
  try {
    const { nom, prenom, telephone, adresse } = req.body;
    const utilisateur = await User.findByIdAndUpdate(
      req.utilisateur._id,
      { nom, prenom, telephone, adresse },
      { new: true, runValidators: true }
    );
    res.json({ succes: true, utilisateur });
  } catch (error) {
    res.status(500).json({ succes: false, message: 'Erreur mise à jour', erreur: error.message });
  }
});

module.exports = router;


// ─── Reset Admin (une seule fois) ─────────────────────────────────────────────
// POST /api/auth/reset-admin
router.post('/reset-admin', async (req, res) => {
  const { cleSecrete } = req.body;
  if (cleSecrete !== process.env.SEED_SECRET) {
    return res.status(403).json({ succes: false, message: 'Clé invalide' });
  }
  try {
    // Supprimer tous les admins existants
    await User.deleteMany({ role: 'admin' });
    
    // Créer le nouvel admin — le hook pre('save') va hasher le mot de passe
    const admin = new User({
      nom: 'Admin',
      prenom: 'MaisonLuxe',
      email: 'admin@maisonluxe.ml',
      motDePasse: 'Admin2025',
      role: 'admin'
    });
    await admin.save(); // pre('save') déclenché → mot de passe hashé

    res.json({
      succes: true,
      message: '✅ Admin réinitialisé',
      email: 'admin@maisonluxe.ml',
      motDePasse: 'Admin2025'
    });
  } catch (error) {
    res.status(500).json({ succes: false, message: error.message });
  }
});
