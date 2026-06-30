const mongoose = require('mongoose');

const ligneCommandeSchema = new mongoose.Schema({
  produit: { type: mongoose.Schema.Types.ObjectId, ref: 'Produit', required: true },
  nom: { type: String, required: true },
  emoji: String,
  quantite: { type: Number, required: true, min: 1 },
  prix: { type: Number, required: true }
});

const commandeSchema = new mongoose.Schema({
  numeroCommande: {
    type: String,
    unique: true
  },
  utilisateur: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lignes: [ligneCommandeSchema],
  adresseLivraison: {
    nom: String,
    telephone: String,
    rue: String,
    ville: String,
    pays: { type: String, default: 'Mali' }
  },
  prixTotal: {
    type: Number,
    required: true
  },
  fraisLivraison: {
    type: Number,
    default: 0
  },
  statut: {
    type: String,
    enum: ['en_attente', 'payee', 'en_preparation', 'expediee', 'livree', 'annulee'],
    default: 'en_attente'
  },
  paiement: {
    methode: { type: String, default: 'orange_money' },
    transactionId: String,       // ID retourné par CinetPay/Orange Money
    cpmTransId: String,          // Transaction ID CinetPay
    statut: {
      type: String,
      enum: ['en_attente', 'succes', 'echec'],
      default: 'en_attente'
    },
    datePaiement: Date
  }
}, {
  timestamps: true
});

// Générer un numéro de commande unique avant sauvegarde
// ⚠️  Ancienne méthode (countDocuments) : race condition si deux commandes
//     sont créées en même temps → même numéro malgré unique:true → erreur en prod.
// ✅  Nouvelle méthode : timestamp ms + 4 caractères aléatoires = collision impossible.
commandeSchema.pre('save', function(next) {
  if (!this.numeroCommande) {
    const date = new Date();
    const prefix = `ML${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.numeroCommande = `${prefix}-${Date.now()}-${suffix}`;
  }
  next();
});

// ─── Index pour les requêtes fréquentes ──────────────────────────────────────
commandeSchema.index({ utilisateur: 1, createdAt: -1 }); // GET /mes-commandes
commandeSchema.index({ statut: 1, createdAt: -1 });       // filtrage admin par statut

module.exports = mongoose.model('Commande', commandeSchema);
