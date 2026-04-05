const mongoose = require('mongoose');

const avisSchema = new mongoose.Schema({
  utilisateur: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  nom: { type: String, required: true },
  note: { type: Number, min: 1, max: 5, required: true },
  commentaire: { type: String, maxlength: 500 }
}, { timestamps: true });

const produitSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: [true, 'Le nom du produit est requis'],
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  prix: {
    type: Number,
    required: true,
    min: 0
  },
  prixAncien: {
    type: Number,
    min: 0
  },
  categorie: {
    type: String,
    required: true,
    enum: ['mode', 'accessoires', 'chaussures', 'beaute']
  },
  marque: {
    type: String,
    required: true
  },
  images: [{ type: String }],
  emoji: { type: String, default: '🛍️' }, // Pour la démo
  stock: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  tags: [{ type: String, enum: ['new', 'sale', 'bestseller'] }],
  avis: [avisSchema],
  notemoyenne: {
    type: Number,
    default: 0
  },
  nombreAvis: {
    type: Number,
    default: 0
  },
  actif: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Calculer la note moyenne après chaque avis
produitSchema.methods.calculerNotemoyenne = function() {
  if (this.avis.length === 0) {
    this.notemoyenne = 0;
    this.nombreAvis = 0;
  } else {
    const total = this.avis.reduce((acc, avis) => acc + avis.note, 0);
    this.notemoyenne = Math.round((total / this.avis.length) * 10) / 10;
    this.nombreAvis = this.avis.length;
  }
};

module.exports = mongoose.model('Produit', produitSchema);
