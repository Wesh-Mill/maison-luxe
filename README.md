# 🛍️ Maison Luxe

E-commerce luxe — Frontend sur GitHub Pages, Backend sur Render.

## Structure
```
maison-luxe/
├── index.html        ← Frontend (GitHub Pages)
├── admin.html        ← Dashboard admin
├── render.yaml       ← Config Render (auto-deploy)
└── backend/          ← API Node.js (Render)
```

## URLs de production
- **Frontend** : https://wesh-mill.github.io/maison-luxe/
- **Backend API** : https://maison-luxe-api.onrender.com/api

## Variables d'environnement Render (à configurer manuellement)
| Variable | Description |
|---|---|
| `MONGODB_URI` | Connexion MongoDB Atlas |
| `JWT_SECRET` | Clé secrète JWT (chaîne aléatoire) |
| `CINETPAY_API_KEY` | Clé API CinetPay |
| `CINETPAY_SITE_ID` | Site ID CinetPay |
| `CINETPAY_SECRET_KEY` | Clé secrète CinetPay |
