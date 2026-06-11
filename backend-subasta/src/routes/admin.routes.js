/**
 * ============================================================
 * RUTAS REMATIX INTERNO (BACKOFFICE)
 * ============================================================
 *
 * Endpoints administrativos para evaluar clientes, productos y
 * crear nuevas subastas.
 */

const express = require('express');
const router = express.Router();

const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middlewares/auth');
const { createUploader, multerErrorHandler } = require('../middlewares/upload');

/**
 * Multer con memoryStorage: la imagen de portada de subasta se recibe
 * como Buffer y se sube a Supabase Storage desde el servicio
 * (carpeta 'portadas/').
 */
const upload = createUploader({
    maxSize: 10 * 1024 * 1024,
    mimeTypes: ['jpeg', 'jpg', 'png', 'gif', 'webp']
});

router.put('/admin/clientes/:id/evaluacion', authMiddleware, adminController.evaluarCliente);
router.put('/admin/medios-pago/:id/evaluacion', authMiddleware, adminController.evaluarMedioPago);
router.get('/admin/clientes/pendientes', authMiddleware, adminController.listarClientesPendientes);
router.get('/admin/clientes/rechazados', authMiddleware, adminController.listarClientesRechazados);
router.get('/admin/medios-pago/pendientes', authMiddleware, adminController.listarMediosPagoPendientes);
router.put('/admin/productos/:id/evaluacion', authMiddleware, adminController.evaluarProducto);
router.get('/admin/productos/pendientes', authMiddleware, adminController.listarProductosPendientes);
router.post('/admin/subastas', authMiddleware, adminController.crearSubasta);
router.post('/admin/subastas/portada', authMiddleware, upload.single('imagen'), multerErrorHandler, adminController.subirPortadaSubasta);
router.get('/admin/opciones', authMiddleware, adminController.obtenerOpciones);
router.get('/admin/subastas', authMiddleware, adminController.listarSubastas);
router.get('/admin/subastas/:id/catalogos', authMiddleware, adminController.listarCatalogosPorSubasta);
router.post('/admin/catalogos', authMiddleware, adminController.crearCatalogo);
router.post('/admin/subastas/:id/cerrar', authMiddleware, adminController.cerrarSubasta);

module.exports = router;
