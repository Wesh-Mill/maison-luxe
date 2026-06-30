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
  body('telephone').optional()
    .trim()
    .matches(/^[+\d\s\-().]{7,20}$/).withMessage('Numéro de téléphone invalide'),
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
    const token = genererToken(utilisateur);

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
    res.status(500).json({ succes: false, message: 'Erreur serveur', ...(process.env.NODE_ENV !== 'production' && { erreur: error.message }) });
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

    const token = genererToken(utilisateur);

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
    res.status(500).json({ succes: false, message: 'Erreur serveur', ...(process.env.NODE_ENV !== 'production' && { erreur: error.message }) });
  }
});

// GET /api/auth/profil (protégé)
// ⚠️  Après le Fix 10, req.utilisateur ne contient que {id, role, actif} issus du JWT.
//     Pour le profil complet, on fait une requête DB ici — c'est la seule route qui
//     a besoin des données complètes. Toutes les autres routes utilisent seulement
//     req.utilisateur._id et req.utilisateur.role, donc pas de requête DB pour elles.
router.get('/profil', proteger, async (req, res) => {
  try {
    const utilisateur = await User.findById(req.utilisateur._id).select('-motDePasse');
    if (!utilisateur) return res.status(404).json({ succes: false, message: 'Utilisateur introuvable' });
    res.json({ succes: true, utilisateur });
  } catch (error) {
    res.status(500).json({ succes: false, message: 'Erreur serveur' });
  }
});

// PUT /api/auth/profil (protégé)
// Validation et sanitisation explicite :
// - Le téléphone est validé en format (pas de script injectable)
// - email et motDePasse sont exclus du corps : un user ne peut pas changer
//   son email ou mot de passe via cette route (routes séparées à prévoir)
// - La réponse exclut motDePasse via .select()
router.put('/profil', proteger, [
  body('nom').optional().trim().notEmpty().isLength({ max: 50 }).withMessage('Nom invalide'),
  body('prenom').optional().trim().notEmpty().isLength({ max: 50 }).withMessage('Prénom invalide'),
  body('telephone').optional().trim()
    .matches(/^[\+\d\s\-\(\)]{7,20}$/).withMessage('Numéro de téléphone invalide'),
  body('adresse.rue').optional().trim().isLength({ max: 200 }),
  body('adresse.ville').optional().trim().isLength({ max: 100 }),
], async (req, res) => {
  const erreurs = validationResult(req);
  if (!erreurs.isEmpty()) {
    return res.status(400).json({ succes: false, message: 'Données invalides', erreurs: erreurs.array() });
  }
  try {
    // Whitelist stricte — email et motDePasse ne peuvent pas être modifiés ici
    const { nom, prenom, telephone, adresse } = req.body;
    const update = {};
    if (nom !== undefined) update.nom = nom;
    if (prenom !== undefined) update.prenom = prenom;
    if (telephone !== undefined) update.telephone = telephone;
    if (adresse !== undefined) update.adresse = adresse;

    const utilisateur = await User.findByIdAndUpdate(
      req.utilisateur._id,
      update,
      { new: true, runValidators: true }
    ).select('-motDePasse');

    res.json({ succes: true, utilisateur });
  } catch (error) {
    res.status(500).json({ succes: false, message: 'Erreur mise à jour' });
  }
});

module.exports = router;
