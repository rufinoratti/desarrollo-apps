/**
 * ============================================================
 * RUTAS REMATIX INTERNO (BACKOFFICE)
 * ============================================================
 *
 * Endpoints administrativos para evaluar clientes, productos y
 * crear nuevas subastas.
 *
 * Se monta en /api/admin en app.js, por lo que las rutas finales son:
 *   PUT  /api/admin/clientes/:id/evaluacion
 *   PUT  /api/admin/productos/:id/evaluacion
 *   POST /api/admin/subastas
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middlewares/auth');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'subasta-portada-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Solo se permiten imágenes JPEG, JPG, PNG, GIF o WebP'));
    }
});

// Evaluar y categorizar cliente
router.put('/admin/clientes/:id/evaluacion', authMiddleware, adminController.evaluarCliente);

// Listar clientes pendientes de validación
router.get('/admin/clientes/pendientes', authMiddleware, adminController.listarClientesPendientes);

// Listar clientes rechazados
router.get('/admin/clientes/rechazados', authMiddleware, adminController.listarClientesRechazados);

// Evaluar producto publicado
router.put('/admin/productos/:id/evaluacion', authMiddleware, adminController.evaluarProducto);

// Listar productos pendientes de revisión
router.get('/admin/productos/pendientes', authMiddleware, adminController.listarProductosPendientes);

// Crear nueva subasta
router.post('/admin/subastas', authMiddleware, adminController.crearSubasta);

// Subir imagen de portada para subasta
router.post('/admin/subastas/portada', authMiddleware, upload.single('imagen'), adminController.subirPortadaSubasta);

// Obtener opciones admin (revisores, etc.)
router.get('/admin/opciones', authMiddleware, adminController.obtenerOpciones);

// Listar todas las subastas
router.get('/admin/subastas', authMiddleware, adminController.listarSubastas);

// Listar catálogos de una subasta
router.get('/admin/subastas/:id/catalogos', authMiddleware, adminController.listarCatalogosPorSubasta);

// Crear catálogo
router.post('/admin/catalogos', authMiddleware, adminController.crearCatalogo);

module.exports = router;
