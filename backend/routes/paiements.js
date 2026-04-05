const express = require('express');
const router = express.Router();
const axios = require('axios');
const Commande = require('../models/Commande');
const Produit = require('../models/Produit');
const { proteger } = require('../middleware/auth');

const CINETPAY_BASE_URL = 'https://api-checkout.cinetpay.com/v2';

// ─── Initier un paiement Orange Money via CinetPay ───────────────────────────
// POST /api/paiements/initier
router.post('/initier', proteger, async (req, res) => {
  try {
    const { lignes, adresseLivraison } = req.body;

    if (!lignes || lignes.length === 0) {
      return res.status(400).json({ succes: false, message: 'Panier vide' });
    }

    // Vérifier les produits et calculer le total
    let prixTotal = 0;
    const lignesValidees = [];

    for (const ligne of lignes) {
      const produit = await Produit.findById(ligne.produitId);
      if (!produit || !produit.actif) {
        return res.status(400).json({ succes: false, message: `Produit introuvable: ${ligne.produitId}` });
      }
      if (produit.stock < ligne.quantite) {
        return res.status(400).json({ succes: false, message: `Stock insuffisant pour: ${produit.nom}` });
      }

      lignesValidees.push({
        produit: produit._id,
        nom: produit.nom,
        emoji: produit.emoji,
        quantite: ligne.quantite,
        prix: produit.prix
      });
      prixTotal += produit.prix * ligne.quantite;
    }

    // Frais de livraison (gratuit > 150 000 FCFA)
    const fraisLivraison = prixTotal >= 150000 ? 0 : 2000;
    const totalFinal = prixTotal + fraisLivraison;

    // Créer la commande en base (statut: en_attente)
    const commande = await Commande.create({
      utilisateur: req.utilisateur._id,
      lignes: lignesValidees,
      adresseLivraison,
      prixTotal: totalFinal,
      fraisLivraison,
      statut: 'en_attente',
      paiement: { methode: 'orange_money', statut: 'en_attente' }
    });

    // Appel à l'API CinetPay (intégration Orange Money Mali)
    const transactionId = `ML-${commande._id}-${Date.now()}`;
    
    const cinetpayPayload = {
      apikey: process.env.CINETPAY_API_KEY,
      site_id: process.env.CINETPAY_SITE_ID,
      transaction_id: transactionId,
      amount: totalFinal,
      currency: 'XOF',              // Franc CFA (monnaie Mali)
      alternative_currency: '',
      description: `Commande Maison Luxe #${commande.numeroCommande}`,
      customer_id: req.utilisateur._id.toString(),
      customer_name: req.utilisateur.nom,
      customer_surname: req.utilisateur.prenom,
      customer_email: req.utilisateur.email,
      customer_phone_number: req.utilisateur.telephone || '',
      customer_address: adresseLivraison?.rue || '',
      customer_city: adresseLivraison?.ville || 'Bamako',
      customer_country: 'ML',        // Code pays Mali
      customer_state: 'ML',
      customer_zip_code: '',
      notify_url: process.env.CINETPAY_NOTIFY_URL,
      return_url: process.env.CINETPAY_RETURN_URL,
      channels: 'MOBILE_MONEY',      // Orange Money + autres opérateurs
      metadata: commande._id.toString(),
      lang: 'fr'
    };

    const cinetpayResponse = await axios.post(
      `${CINETPAY_BASE_URL}/payment`,
      cinetpayPayload
    );

    if (cinetpayResponse.data.code !== '201') {
      throw new Error(`CinetPay erreur: ${cinetpayResponse.data.message}`);
    }

    // Sauvegarder l'ID de transaction
    commande.paiement.transactionId = transactionId;
    await commande.save();

    res.json({
      succes: true,
      commandeId: commande._id,
      numeroCommande: commande.numeroCommande,
      urlPaiement: cinetpayResponse.data.data.payment_url,
      transactionId
    });

  } catch (error) {
    console.error('Erreur paiement:', error.message);
    res.status(500).json({ succes: false, message: 'Erreur lors du paiement', erreur: error.message });
  }
});


// ─── Notification webhook (appelé par CinetPay après paiement) ───────────────
// POST /api/paiements/notify
router.post('/notify', async (req, res) => {
  try {
    const { cpm_trans_id, cpm_site_id, cpm_amount, cpm_currency, cpm_payment_date,
            cpm_payment_time, cpm_error_message, cpm_result, cel_phone_num,
            signature, cpm_custom } = req.body;

    // Vérifier la signature (sécurité)
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', process.env.CINETPAY_SECRET_KEY)
      .update(`${process.env.CINETPAY_SITE_ID}${cpm_trans_id}${cpm_amount}${cpm_currency}`)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('Signature CinetPay invalide');
      return res.status(400).send('Signature invalide');
    }

    // Trouver la commande
    const commande = await Commande.findById(cpm_custom);
    if (!commande) return res.status(404).send('Commande introuvable');

    if (cpm_result === '00') {
      // Paiement réussi
      commande.statut = 'payee';
      commande.paiement.statut = 'succes';
      commande.paiement.cpmTransId = cpm_trans_id;
      commande.paiement.datePaiement = new Date();

      // Décrémenter le stock
      for (const ligne of commande.lignes) {
        await Produit.findByIdAndUpdate(ligne.produit, {
          $inc: { stock: -ligne.quantite }
        });
      }
    } else {
      // Paiement échoué
      commande.statut = 'annulee';
      commande.paiement.statut = 'echec';
    }

    await commande.save();
    res.status(200).send('OK');

  } catch (error) {
    console.error('Erreur notification paiement:', error);
    res.status(500).send('Erreur serveur');
  }
});


// ─── Vérifier le statut d'un paiement ────────────────────────────────────────
// GET /api/paiements/statut/:commandeId
router.get('/statut/:commandeId', proteger, async (req, res) => {
  try {
    const commande = await Commande.findOne({
      _id: req.params.commandeId,
      utilisateur: req.utilisateur._id
    }).populate('lignes.produit', 'nom emoji');

    if (!commande) return res.status(404).json({ succes: false, message: 'Commande introuvable' });

    res.json({ succes: true, commande });
  } catch (error) {
    res.status(500).json({ succes: false, message: 'Erreur serveur' });
  }
});

module.exports = router;


// ─── Payer à la livraison ─────────────────────────────────────────────────────
// POST /api/paiements/livraison
router.post('/livraison', proteger, async (req, res) => {
  try {
    const { lignes, adresseLivraison } = req.body;

    if (!lignes || lignes.length === 0) {
      return res.status(400).json({ succes: false, message: 'Panier vide' });
    }

    let prixTotal = 0;
    const lignesValidees = [];

    for (const ligne of lignes) {
      const produit = await Produit.findById(ligne.produitId);
      if (!produit || !produit.actif) {
        return res.status(400).json({ succes: false, message: `Produit introuvable: ${ligne.produitId}` });
      }
      if (produit.stock < ligne.quantite) {
        return res.status(400).json({ succes: false, message: `Stock insuffisant pour: ${produit.nom}` });
      }

      lignesValidees.push({
        produit: produit._id,
        nom: produit.nom,
        emoji: produit.emoji,
        quantite: ligne.quantite,
        prix: produit.prix
      });
      prixTotal += produit.prix * ligne.quantite;
    }

    const fraisLivraison = prixTotal >= 150000 ? 0 : 2000;
    const totalFinal = prixTotal + fraisLivraison;

    // Créer la commande — statut "confirmee", paiement à la livraison
    const commande = await Commande.create({
      utilisateur: req.utilisateur._id,
      lignes: lignesValidees,
      adresseLivraison,
      prixTotal: totalFinal,
      fraisLivraison,
      statut: 'confirmee',
      paiement: {
        methode: 'cash_on_delivery',
        statut: 'a_la_livraison'
      }
    });

    // Décrémenter le stock immédiatement
    for (const ligne of lignesValidees) {
      await Produit.findByIdAndUpdate(ligne.produit, {
        $inc: { stock: -ligne.quantite }
      });
    }

    res.json({
      succes: true,
      commandeId: commande._id,
      numeroCommande: commande.numeroCommande,
      message: 'Commande confirmée — paiement à la livraison',
      totalFinal
    });

  } catch (error) {
    console.error('Erreur commande livraison:', error.message);
    res.status(500).json({ succes: false, message: 'Erreur lors de la commande', erreur: error.message });
  }
});
