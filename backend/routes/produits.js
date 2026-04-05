const express = require('express');
const router = express.Router();
const Produit = require('../models/Produit');
const { proteger, admin } = require('../middleware/auth');

// GET /api/produits — Liste avec filtres & pagination
router.get('/', async (req, res) => {
  try {
    const { categorie, marque, minPrix, maxPrix, tag, q, page = 1, limit = 12 } = req.query;

    const filtre = { actif: true };
    if (categorie) filtre.categorie = categorie;
    if (marque) filtre.marque = new RegExp(marque, 'i');
    if (tag) filtre.tags = tag;
    if (minPrix || maxPrix) {
      filtre.prix = {};
      if (minPrix) filtre.prix.$gte = Number(minPrix);
      if (maxPrix) filtre.prix.$lte = Number(maxPrix);
    }
    if (q) {
      filtre.$or = [
        { nom: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') },
        { marque: new RegExp(q, 'i') }
      ];
    }

    const skip = (page - 1) * limit;
    const total = await Produit.countDocuments(filtre);
    const produits = await Produit.find(filtre).skip(skip).limit(Number(limit)).sort({ createdAt: -1 });

    res.json({
      succes: true,
      total,
      pages: Math.ceil(total / limit),
      pageCourante: Number(page),
      produits
    });
  } catch (error) {
    res.status(500).json({ succes: false, message: 'Erreur serveur', erreur: error.message });
  }
});

// GET /api/produits/:id
router.get('/:id', async (req, res) => {
  try {
    const produit = await Produit.findById(req.params.id);
    if (!produit) return res.status(404).json({ succes: false, message: 'Produit introuvable' });
    res.json({ succes: true, produit });
  } catch (error) {
    res.status(500).json({ succes: false, message: 'Erreur serveur' });
  }
});

// POST /api/produits — Admin seulement
router.post('/', proteger, admin, async (req, res) => {
  try {
    const produit = await Produit.create(req.body);
    res.status(201).json({ succes: true, produit });
  } catch (error) {
    res.status(400).json({ succes: false, message: error.message });
  }
});

// PUT /api/produits/:id — Admin seulement
router.put('/:id', proteger, admin, async (req, res) => {
  try {
    const produit = await Produit.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!produit) return res.status(404).json({ succes: false, message: 'Produit introuvable' });
    res.json({ succes: true, produit });
  } catch (error) {
    res.status(400).json({ succes: false, message: error.message });
  }
});

// DELETE /api/produits/:id — Admin (désactiver seulement)
router.delete('/:id', proteger, admin, async (req, res) => {
  try {
    await Produit.findByIdAndUpdate(req.params.id, { actif: false });
    res.json({ succes: true, message: 'Produit désactivé' });
  } catch (error) {
    res.status(500).json({ succes: false, message: 'Erreur serveur' });
  }
});

// POST /api/produits/:id/avis — Client connecté
router.post('/:id/avis', proteger, async (req, res) => {
  try {
    const produit = await Produit.findById(req.params.id);
    if (!produit) return res.status(404).json({ succes: false, message: 'Produit introuvable' });

    const dejaAvis = produit.avis.find(a => a.utilisateur.toString() === req.utilisateur._id.toString());
    if (dejaAvis) return res.status(400).json({ succes: false, message: 'Vous avez déjà laissé un avis.' });

    produit.avis.push({
      utilisateur: req.utilisateur._id,
      nom: `${req.utilisateur.prenom} ${req.utilisateur.nom}`,
      note: req.body.note,
      commentaire: req.body.commentaire
    });

    produit.calculerNotemoyenne();
    await produit.save();

    res.status(201).json({ succes: true, message: 'Avis ajouté', produit });
  } catch (error) {
    res.status(400).json({ succes: false, message: error.message });
  }
});

module.exports = router;
