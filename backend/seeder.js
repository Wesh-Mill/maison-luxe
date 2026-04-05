require('dotenv').config();
const mongoose = require('mongoose');
const Produit = require('./models/Produit');
const User = require('./models/User');
const connectDB = require('./config/database');

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

const adminUser = {
  nom: 'Admin',
  prenom: 'Maison Luxe',
  email: 'admin@maisonluxe.ml',
  motDePasse: 'Admin@2025!',
  role: 'admin'
};

async function seeder() {
  await connectDB();
  try {
    await Produit.deleteMany({});
    await User.deleteMany({ role: 'admin' });
    
    await Produit.insertMany(produits);
    await User.create(adminUser);

    console.log(`✅ ${produits.length} produits ajoutés`);
    console.log(`✅ Compte admin créé: ${adminUser.email} / ${adminUser.motDePasse}`);
    console.log('⚠️  Changez le mot de passe admin en production !');
  } catch (error) {
    console.error('Erreur seeder:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seeder();
