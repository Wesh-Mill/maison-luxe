const express = require('express');
const router = express.Router();
const Commande = require('../models/Commande');
const { proteger, admin } = require('../middleware/auth');

// GET /api/commandes/mes-commandes — Commandes de l'utilisateur connecté
router.get('/mes-commandes', proteger, async (req, res) => {
  try {
    const commandes = await Commande.find({ utilisateur: req.utilisateur._id })
      .sort({ createdAt: -1 })
      .select('-paiement.transactionId');

    res.json({ succes: true, commandes });
  } catch (error) {
    res.status(500).json({ succes: false, message: 'Erreur serveur' });
  }
});

// GET /api/commandes/:id — Détail d'une commande
router.get('/:id', proteger, async (req, res) => {
  try {
    const commande = await Commande.findOne({
      _id: req.params.id,
      utilisateur: req.utilisateur._id
    });

    if (!commande) return res.status(404).json({ succes: false, message: 'Commande introuvable' });
    res.json({ succes: true, commande });
  } catch (error) {
    res.status(500).json({ succes: false, message: 'Erreur serveur' });
  }
});

// GET /api/commandes — Toutes les commandes (admin)
router.get('/', proteger, admin, async (req, res) => {
  try {
    const { statut, page = 1, limit = 20 } = req.query;
    const filtre = {};
    if (statut) filtre.statut = statut;

    const skip = (page - 1) * limit;
    const total = await Commande.countDocuments(filtre);
    const commandes = await Commande.find(filtre)
      .populate('utilisateur', 'nom prenom email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({ succes: true, total, commandes });
  } catch (error) {
    res.status(500).json({ succes: false, message: 'Erreur serveur' });
  }
});

// PUT /api/commandes/:id/statut — Mettre à jour le statut (admin)
router.put('/:id/statut', proteger, admin, async (req, res) => {
  try {
    const { statut } = req.body;
    const commande = await Commande.findByIdAndUpdate(
      req.params.id,
      { statut },
      { new: true }
    );
    if (!commande) return res.status(404).json({ succes: false, message: 'Commande introuvable' });
    res.json({ succes: true, commande });
  } catch (error) {
    res.status(400).json({ succes: false, message: error.message });
  }
});

module.exports = router;
