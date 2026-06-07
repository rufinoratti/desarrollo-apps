const path = require('path');
const { supabaseAdmin, isAdminConfigured } = require('./supabase');

// ============================================================
// WRAPPER DE SUPABASE STORAGE
// ============================================================
// Centraliza todas las operaciones de archivos (uploads públicos de
// imágenes) contra el bucket configurado en SUPABASE_BUCKET_MEDIA.
//
// Convención de paths: <carpeta>/<fieldname>-<timestamp>-<random>.<ext>
//   - dni/        → fotos de DNI (verificación KYC)
//   - perfiles/   → fotos de perfil de usuarios
//   - productos/  → fotos de productos publicados por dueños
//   - portadas/   → imágenes de portada de subastas (admin)
//
// IMPORTANTE: Este módulo usa supabaseAdmin (service_role) porque
// las políticas RLS de Storage no contemplan usuarios autenticados
// escribiendo en nombre del backend. El service_role key BYPASEA RLS.
// NUNCA importes este módulo desde el frontend.
// ============================================================

const BUCKET = process.env.SUPABASE_BUCKET_MEDIA || 'rematix-media';

/**
 * Construye un object path único en Storage respetando la convención
 * del proyecto: <carpeta>/<fieldname>-<timestamp>-<random>.<ext>
 */
function buildObjectPath(folder, fieldname, originalname) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(originalname) || '';
    return `${folder}/${fieldname}-${uniqueSuffix}${ext}`;
}

/**
 * Sube un buffer a Supabase Storage y devuelve la URL pública resultante.
 *
 * @param {Object} params
 * @param {string} params.folder      Carpeta destino (ej: 'perfiles')
 * @param {string} params.fieldname    Nombre del campo del FormData (para naming)
 * @param {Buffer} params.buffer       Contenido del archivo
 * @param {string} params.mimetype     MIME type (ej: 'image/jpeg')
 * @param {string} params.originalname Nombre original (para extraer extensión)
 * @returns {Promise<string>} URL pública del archivo subido
 */
async function uploadBuffer({ folder, fieldname, buffer, mimetype, originalname }) {
    if (!isAdminConfigured) {
        throw new Error('[storage] Supabase admin no configurado. Revisá SUPABASE_SERVICE_ROLE_KEY y SUPABASE_ENABLED.');
    }
    if (!Buffer.isBuffer(buffer)) {
        throw new Error('[storage.uploadBuffer] `buffer` debe ser un Buffer');
    }
    if (!folder || !fieldname) {
        throw new Error('[storage.uploadBuffer] `folder` y `fieldname` son requeridos');
    }

    const objectPath = buildObjectPath(folder, fieldname, originalname);

    const { error } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(objectPath, buffer, {
            contentType: mimetype,
            cacheControl: '3600',
            upsert: false
        });

    if (error) {
        throw new Error(`[storage.uploadBuffer] ${error.message}`);
    }

    return getPublicUrl(objectPath);
}

/**
 * Construye la URL pública de un objeto del bucket. Como el bucket es
 * público, no requiere llamada de red — es derivable.
 */
function getPublicUrl(objectPath) {
    if (!isAdminConfigured) {
        throw new Error('[storage] Supabase admin no configurado.');
    }
    if (!objectPath) return null;
    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(objectPath);
    return data?.publicUrl || null;
}

/**
 * Extrae el object path de una URL pública completa.
 *   https://<project>.supabase.co/storage/v1/object/public/rematix-media/perfiles/foto-123.jpg
 *   → perfiles/foto-123.jpg
 *
 * Devuelve null si la URL no parece ser de nuestro bucket.
 */
function extractPathFromUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.substring(idx + marker.length);
}

/**
 * Elimina un objeto de Storage. Acepta tanto el object path como la
 * URL pública completa. Si la entrada es null/undefined o no es de
 * nuestro bucket, la operación es no-op (idempotente).
 */
async function remove(urlOrPath) {
    if (!isAdminConfigured) {
        throw new Error('[storage] Supabase admin no configurado.');
    }
    const objectPath = extractPathFromUrl(urlOrPath) || urlOrPath;
    if (!objectPath) return;

    const { error } = await supabaseAdmin.storage
        .from(BUCKET)
        .remove([objectPath]);

    if (error) {
        // Logueamos pero no rompemos: el caller decidió limpiar y no
        // queremos que un fallo de Storage bloquee el flujo principal
        // (ej: cambio de foto de perfil).
        console.error(`[storage.remove] No se pudo eliminar '${objectPath}':`, error.message);
    }
}

/**
 * Helper para derivar el campo de "tabla" del path: 'dni' | 'perfiles' | etc.
 * Útil para logging/debug. NO se usa en lógica crítica.
 */
function getFolderFromPath(objectPath) {
    if (!objectPath) return null;
    const idx = objectPath.indexOf('/');
    return idx === -1 ? objectPath : objectPath.substring(0, idx);
}

module.exports = {
    BUCKET,
    uploadBuffer,
    getPublicUrl,
    remove,
    extractPathFromUrl,
    getFolderFromPath,
    isStorageConfigured: () => isAdminConfigured
};
