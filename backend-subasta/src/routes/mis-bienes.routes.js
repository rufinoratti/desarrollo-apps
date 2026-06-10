const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth');
const misBienesController = require('../controllers/mis-bienes.controller');
const { createUploader, multerErrorHandler } = require('../middlewares/upload');

/**
 * Multer con memoryStorage: las fotos de producto se reciben como
 * Buffer en req.files[i].buffer y se suben a Supabase Storage desde
 * el servicio (carpeta 'productos/').
 */
const upload = createUploader({
    maxSize: 10 * 1024 * 1024,
    mimeTypes: ['jpeg', 'jpg', 'png', 'gif', 'webp']
});

router.get('/mis-bienes/opciones', authMiddleware, misBienesController.obtenerOpciones);
router.get('/mis-bienes/subastas', authMiddleware, misBienesController.obtenerSubastas);
router.get('/mis-bienes/catalogos', authMiddleware, misBienesController.listarCatalogos);
router.get('/mis-bienes', authMiddleware, misBienesController.listarMisBienes);
router.post('/mis-bienes/productos', authMiddleware, upload.array('fotos', 6), multerErrorHandler, misBienesController.crearProducto);
router.post('/mis-bienes/productos/:id/confirmar', authMiddleware, misBienesController.confirmarProducto);
router.delete('/mis-bienes/productos/:id', authMiddleware, misBienesController.retirarProducto);

module.exports = router;
