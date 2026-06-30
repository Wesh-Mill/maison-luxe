const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // useNewUrlParser et useUnifiedTopology sont dépréciées depuis Mongoose 6
    // et ignorées silencieusement — on les supprime pour garder le code propre.
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB connecté: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Erreur MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
