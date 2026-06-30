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

    // Limiter à 100 max pour éviter qu'un admin envoie limit=999999
    // et charge toute la collection en RAM d'un coup.
    const safeLimitAdmin = Math.min(Math.max(1, Number(limit) || 20), 100);
    const filtre = {};
    if (statut) {
      const statutsValides = ['en_attente','payee','en_preparation','expediee','livree','annulee'];
      if (!statutsValides.includes(statut)) {
        return res.status(400).json({ succes: false, message: 'Statut invalide' });
      }
      filtre.statut = statut;
    }

    const skip = (page - 1) * safeLimitAdmin;
    const total = await Commande.countDocuments(filtre);
    const commandes = await Commande.find(filtre)
      .populate('utilisateur', 'nom prenom email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimitAdmin);

    res.json({ succes: true, total, commandes });
  } catch (error) {
    res.status(500).json({ succes: false, message: 'Erreur serveur' });
  }
});

// PUT /api/commandes/:id/statut — Mettre à jour le statut (admin)
router.put('/:id/statut', proteger, admin, async (req, res) => {
  try {
    const { statut } = req.body;

    // Valider contre l'enum avant d'écrire en base.
    // Sans ça, envoyer statut:"$gt" ou statut:"<script>" passe dans Mongoose
    // et produit une erreur dont le message brut est renvoyé au client.
    const statutsValides = ['en_attente','payee','en_preparation','expediee','livree','annulee'];
    if (!statut || !statutsValides.includes(statut)) {
      return res.status(400).json({ succes: false, message: `Statut invalide. Valeurs acceptées : ${statutsValides.join(', ')}` });
    }

    const commande = await Commande.findByIdAndUpdate(
      req.params.id,
      { statut },
      { new: true }
    );
    if (!commande) return res.status(404).json({ succes: false, message: 'Commande introuvable' });
    res.json({ succes: true, commande });
  } catch (error) {
    res.status(400).json({ succes: false, message: 'Erreur mise à jour statut' });
  }
});

module.exports = router;
