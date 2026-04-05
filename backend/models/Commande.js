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
    enum: ['en_attente', 'confirmee', 'payee', 'en_preparation', 'expediee', 'livree', 'annulee'],
    default: 'en_attente'
  },
  paiement: {
    methode: { type: String, enum: ['orange_money', 'cash_on_delivery'], default: 'orange_money' },
    transactionId: String,       // ID retourné par CinetPay/Orange Money
    cpmTransId: String,          // Transaction ID CinetPay
    statut: {
      type: String,
      enum: ['en_attente', 'succes', 'echec', 'a_la_livraison'],
      default: 'en_attente'
    },
    datePaiement: Date
  }
}, {
  timestamps: true
});

// Générer un numéro de commande unique avant sauvegarde
commandeSchema.pre('save', async function(next) {
  if (!this.numeroCommande) {
    const date = new Date();
    const prefix = `ML${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}`;
    const count = await mongoose.model('Commande').countDocuments();
    this.numeroCommande = `${prefix}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Commande', commandeSchema);
