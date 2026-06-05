const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const authMiddleware = require('../middlewares/auth');
const perfilController = require('../controllers/perfil.controller');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'perfil-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
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

router.get('/perfil', authMiddleware, perfilController.obtenerPerfil);
router.put('/perfil', authMiddleware, perfilController.actualizarPerfil);
router.post('/perfil/foto', authMiddleware, upload.single('foto'), perfilController.subirFotoPerfil);
router.delete('/perfil/foto', authMiddleware, perfilController.eliminarFotoPerfil);
router.get('/perfil/estadisticas', authMiddleware, perfilController.obtenerEstadisticas);
router.get('/perfil/restricciones', authMiddleware, perfilController.obtenerRestricciones);
router.get('/perfil/estado-cuenta', authMiddleware, perfilController.obtenerEstadoCuenta);
router.post('/perfil/duenio', authMiddleware, perfilController.registrarComoDuenio);

module.exports = router;
