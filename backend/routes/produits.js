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


// ─── Route Seeder (initialiser les produits + admin) ─────────────────────────
// POST /api/produits/seed  — protégée par clé secrète
router.post('/seed', async (req, res) => {
  const { cleSecrete } = req.body;
  if (cleSecrete !== process.env.SEED_SECRET) {
    return res.status(403).json({ succes: false, message: 'Clé secrète invalide' });
  }
  try {
    const User = require('../models/User');

    const produits = [
      { nom: 'Robe Soirée Minuit', description: 'Robe de soirée élégante en soie noire', prix: 189000, categorie: 'mode', marque: 'Élise Paris', emoji: '👗', stock: 15, tags: ['new'], notemoyenne: 5 },
      { nom: 'Sac Baguette Caramel', description: 'Sac baguette en cuir véritable, coloris caramel', prix: 245000, prixAncien: 320000, categorie: 'accessoires', marque: 'Studio Riviera', emoji: '👜', stock: 8, tags: ['sale'], notemoyenne: 4 },
      { nom: 'Escarpins Éternels', description: 'Escarpins classiques en cuir noir, talon 8cm', prix: 165000, categorie: 'chaussures', marque: 'Maison Clarté', emoji: '👠', stock: 20, notemoyenne: 5 },
      { nom: 'Manteau Cachemire', description: 'Manteau long en pur cachemire, couleur camel', prix: 425000, prixAncien: 590000, categorie: 'mode', marque: 'Atelier Nord', emoji: '🧥', stock: 5, tags: ['sale'], notemoyenne: 5 },
      { nom: 'Collier Solstice', description: 'Collier fin en or 18 carats avec pendentif', prix: 89000, categorie: 'accessoires', marque: 'Or & Lumière', emoji: '💍', stock: 30, tags: ['new'], notemoyenne: 4 },
      { nom: 'Chapeau Paille Doré', description: 'Chapeau en paille tressée, ruban doré', prix: 65000, categorie: 'accessoires', marque: 'Chapelle Mode', emoji: '👒', stock: 25, notemoyenne: 4 },
      { nom: 'Lunettes Cinéma', description: 'Lunettes de soleil ovales, monture écaille', prix: 120000, prixAncien: 150000, categorie: 'accessoires', marque: 'Côte Vision', emoji: '🕶️', stock: 12, tags: ['sale'], notemoyenne: 5 },
      { nom: 'Porte-monnaie Ivoire', description: 'Petit porte-monnaie en cuir ivoire', prix: 55000, categorie: 'accessoires', marque: 'Petit Luxe', emoji: '👛', stock: 40, tags: ['new'], notemoyenne: 4 },
    ];

    await Produit.deleteMany({});
    await User.deleteMany({ role: 'admin' });
    await Produit.insertMany(produits);
    await User.create({
      nom: 'Admin',
      prenom: 'Maison Luxe',
      email: 'admin@maisonluxe.ml',
      motDePasse: 'Admin@2025!',
      role: 'admin'
    });

    res.json({
      succes: true,
      message: `✅ ${produits.length} produits ajoutés + compte admin créé`,
      admin: { email: 'admin@maisonluxe.ml', motDePasse: 'Admin@2025!' }
    });
  } catch (error) {
    res.status(500).json({ succes: false, message: error.message });
  }
});
