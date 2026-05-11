require('dotenv').config();
const app = require('./app');
const PORT = process.env.PORT || 3000;

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor de REMATIX corriendo en el puerto ${PORT}`);
});