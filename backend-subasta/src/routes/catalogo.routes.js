const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth');
const catalogoController = require('../controllers/catalogo.controller');

// GET /api/subastas/:id/catalogo?q=texto&orden=lote_numero
router.get('/subastas/:id/catalogo', authMiddleware, catalogoController.obtenerCatalogoPorSubasta);

// GET /api/items/:id
router.get('/items/:id', authMiddleware, catalogoController.obtenerDetalleItem);

module.exports = router;
