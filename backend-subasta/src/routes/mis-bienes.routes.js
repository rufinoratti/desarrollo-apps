const express = require('express');
const multer = require('multer');
const path = require('path');

const authMiddleware = require('../middlewares/auth');
const misBienesController = require('../controllers/mis-bienes.controller');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'producto-' + uniqueSuffix + path.extname(file.originalname));
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

const router = express.Router();

// Opciones para formulario (revisores, seguros, categorias)
router.get('/mis-bienes/opciones', authMiddleware, misBienesController.obtenerOpciones);

// Subastas disponibles según temática
router.get('/mis-bienes/subastas', authMiddleware, misBienesController.obtenerSubastas);

// Listado de productos del dueño
router.get('/mis-bienes', authMiddleware, misBienesController.listarMisBienes);

// Crear producto con fotos
router.post('/mis-bienes/productos', authMiddleware, upload.array('fotos', 6), misBienesController.crearProducto);

// Retirar producto (solo si no tiene pujas)
router.delete('/mis-bienes/productos/:id', authMiddleware, misBienesController.retirarProducto);

module.exports = router;
