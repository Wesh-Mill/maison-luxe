const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Produit = require('../models/Produit');
const { proteger, admin } = require('../middleware/auth');

// ─── Cache mémoire léger ──────────────────────────────────────────────────────
// Evite de frapper MongoDB à chaque chargement de page pour la liste des produits.
// TTL de 5 min : les produits changent rarement, le cache est vidé dès qu'un admin
// crée, modifie ou supprime un produit.
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCacheKey(query) { return JSON.stringify(query); }

function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { cache.delete(key); return null; }
  return entry.data;
}

function setCache(key, data) { cache.set(key, { data, ts: Date.now() }); }
function invalidateCache() { cache.clear(); }

// GET /api/produits — Liste avec filtres & pagination
router.get('/', async (req, res) => {
  try {
    const { categorie, marque, minPrix, maxPrix, tag, q, page = 1, limit = 12 } = req.query;

    // Vérifier le cache avant d'aller en base
    const cacheKey = getCacheKey(req.query);
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

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
      // Utiliser l'index texte créé dans le modèle
      filtre.$text = { $search: q };
    }

    const skip = (page - 1) * limit;
    const [total, produits] = await Promise.all([
      Produit.countDocuments(filtre),
      Produit.find(filtre).skip(skip).limit(Number(limit)).sort({ createdAt: -1 })
    ]);

    const result = { succes: true, total, pages: Math.ceil(total / limit), pageCourante: Number(page), produits };
    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ succes: false, message: 'Erreur serveur', ...(process.env.NODE_ENV !== 'production' && { erreur: error.message }) });
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
const validerProduit = [
  body('nom').notEmpty().trim().withMessage('Nom requis'),
  body('prix').isFloat({ min: 0 }).withMessage('Prix invalide'),
  body('stock').isInt({ min: 0 }).withMessage('Stock invalide'),
  body('categorie').notEmpty().trim().withMessage('Catégorie requise'),
];

router.post('/', proteger, admin, validerProduit, async (req, res) => {
  const erreurs = validationResult(req);
  if (!erreurs.isEmpty()) {
    return res.status(400).json({ succes: false, message: 'Données invalides', erreurs: erreurs.array() });
  }
  try {
    // On n'utilise JAMAIS req.body directement dans create() — risque de mass assignment.
    // On liste explicitement les champs autorisés : un admin ne peut pas injecter
    // actif:true, notemoyenne:5, __proto__, etc.
    const {
      nom, description, prix, prixAncien, categorie, marque,
      images, emoji, stock, tags
    } = req.body;

    // Valider que chaque URL d'image est bien http/https
    const imagesValidees = (Array.isArray(images) ? images : [])
      .filter(url => {
        try { const u = new URL(url); return u.protocol === 'http:' || u.protocol === 'https:'; }
        catch { return false; }
      });

    const produit = await Produit.create({
      nom, description, prix, prixAncien, categorie, marque,
      images: imagesValidees, emoji, stock, tags
    });
    invalidateCache();
    res.status(201).json({ succes: true, produit });
  } catch (error) {
    res.status(400).json({ succes: false, message: error.message });
  }
});

// PUT /api/produits/:id — Admin seulement
router.put('/:id', proteger, admin, async (req, res) => {
  try {
    // Whitelist explicite : on n'accepte jamais req.body entier.
    // Sans ça, un admin peut injecter actif:false, notemoyenne:0, __proto__, etc.
    const {
      nom, description, prix, prixAncien, categorie, marque,
      images, emoji, stock, tags, actif
    } = req.body;

    const imagesValidees = (Array.isArray(images) ? images : [])
      .filter(url => {
        try { const u = new URL(url); return u.protocol === 'http:' || u.protocol === 'https:'; }
        catch { return false; }
      });

    const updateData = {};
    if (nom !== undefined) updateData.nom = nom;
    if (description !== undefined) updateData.description = description;
    if (prix !== undefined) updateData.prix = prix;
    if (prixAncien !== undefined) updateData.prixAncien = prixAncien;
    if (categorie !== undefined) updateData.categorie = categorie;
    if (marque !== undefined) updateData.marque = marque;
    if (images !== undefined) updateData.images = imagesValidees;
    if (emoji !== undefined) updateData.emoji = emoji;
    if (stock !== undefined) updateData.stock = stock;
    if (tags !== undefined) updateData.tags = tags;
    if (actif !== undefined) updateData.actif = actif;

    const produit = await Produit.findByIdAndUpdate(
      req.params.id, updateData, { new: true, runValidators: true }
    );
    if (!produit) return res.status(404).json({ succes: false, message: 'Produit introuvable' });
    invalidateCache();
    res.json({ succes: true, produit });
  } catch (error) {
    res.status(400).json({ succes: false, message: error.message });
  }
});

// DELETE /api/produits/:id — Admin (désactiver seulement)
router.delete('/:id', proteger, admin, async (req, res) => {
  try {
    await Produit.findByIdAndUpdate(req.params.id, { actif: false });
    invalidateCache();
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

    // Après le Fix 10 (JWT optimisé), req.utilisateur ne contient que {id, role, actif}.
    // On récupère le nom/prénom depuis la DB pour ne pas stocker "undefined undefined" en base.
    const User = require('../models/User');
    const user = await User.findById(req.utilisateur._id).select('prenom nom');
    if (!user) return res.status(401).json({ succes: false, message: 'Utilisateur introuvable' });

    // Validation basique de l'avis
    const note = Number(req.body.note);
    if (!note || note < 1 || note > 5) {
      return res.status(400).json({ succes: false, message: 'Note invalide (1-5)' });
    }
    const commentaire = req.body.commentaire ? String(req.body.commentaire).substring(0, 500) : '';

    produit.avis.push({
      utilisateur: req.utilisateur._id,
      nom: `${user.prenom} ${user.nom}`,
      note,
      commentaire
    });

    produit.calculerNotemoyenne();
    await produit.save();
    invalidateCache();

    res.status(201).json({ succes: true, message: 'Avis ajouté', produit });
  } catch (error) {
    res.status(400).json({ succes: false, message: error.message });
  }
});

module.exports = router;
