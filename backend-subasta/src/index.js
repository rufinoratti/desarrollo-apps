require('dotenv').config();
const app = require('./app');
const cron = require('node-cron');
const { ejecutarCierre } = require('./services/cierre.service');
const PORT = process.env.PORT || 3000;

// Iniciar cron de cierre de subastas cada 2 minutos
cron.schedule('*/2 * * * *', async () => {
    const result = await ejecutarCierre();
    if (result.cerradas > 0) {
        console.log(`[CRON] Cierre automático: ${result.cerradas} subasta(s) cerrada(s)`);
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor de REMATIX corriendo en el puerto ${PORT}`);
});