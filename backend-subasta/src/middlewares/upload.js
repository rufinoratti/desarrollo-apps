const multer = require('multer');
const path = require('path');

// ============================================================
// FACTORY DE MIDDLEWARE MULTER CON MEMORY STORAGE
// ============================================================
// A diferencia del antiguo diskStorage, memoryStorage mantiene el
// archivo en req.file.buffer (sin tocar disco). Esto desacopla la
// recepción HTTP del upload a Supabase Storage: el servicio es
// quien decide qué hacer con el buffer (subir a Storage, transformar,
// descartar, etc.).
//
// Cada endpoint configura su propio uploader vía createUploader()
// con sus límites y mime types permitidos. Se mantiene fileFilter
// para rechazar archivos no permitidos ANTES de consumir memoria.
// ============================================================

const DEFAULT_MIME_TYPES = ['jpeg', 'jpg', 'png', 'gif', 'webp'];

/**
 * Crea un middleware multer con memoryStorage + validación de tipo.
 *
 * @param {Object} opts
 * @param {number} [opts.maxSize]         Tamaño máximo en bytes (default 10MB)
 * @param {string[]} [opts.mimeTypes]     Extensiones/mime types permitidos
 * @returns multer instance listo para usar como middleware
 */
function createUploader({ maxSize = 10 * 1024 * 1024, mimeTypes = DEFAULT_MIME_TYPES } = {}) {
    const allowedPattern = new RegExp(mimeTypes.join('|'), 'i');
    const allowedHuman = mimeTypes.map(m => m.toUpperCase()).join(', ');

    return multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: maxSize },
        fileFilter: (req, file, cb) => {
            const extname = allowedPattern.test(path.extname(file.originalname).toLowerCase());
            const mimetype = allowedPattern.test(file.mimetype);
            if (extname && mimetype) {
                return cb(null, true);
            }
            cb(new Error(`Solo se permiten archivos de tipo: ${allowedHuman}`));
        }
    });
}

/**
 * Error handler para errores de multer. Pensado para montarse DESPUÉS
 * del uploader en la chain de middlewares. Devuelve 413 si el archivo
 * excede el tamaño, 400 para otros errores de multer.
 */
function multerErrorHandler(err, req, res, next) {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'Archivo demasiado grande', codigo: 'ARCHIVO_GRANDE' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: 'Demasiados archivos', codigo: 'DEMASIADOS_ARCHIVOS' });
        }
        return res.status(400).json({ error: err.message, codigo: 'UPLOAD_ERROR' });
    }
    if (err) {
        return res.status(400).json({ error: err.message, codigo: 'UPLOAD_ERROR' });
    }
    next();
}

module.exports = {
    createUploader,
    multerErrorHandler
};
