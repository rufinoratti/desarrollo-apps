let sharpInstance = null;
try {
    sharpInstance = require('sharp');
} catch (e) {
    console.warn('[image] sharp no disponible, las imágenes se subirán sin redimensionar:', e.message);
}

const DEFAULT_MAX_DIMENSION = 1200;

async function resizeImage(buffer, maxDimension = DEFAULT_MAX_DIMENSION) {
    if (!sharpInstance) return buffer;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) return buffer;

    try {
        const metadata = await sharpInstance(buffer).metadata();
        if (!metadata || !metadata.width) return buffer;
        if (metadata.width <= maxDimension && metadata.height <= maxDimension) return buffer;

        return await sharpInstance(buffer)
            .resize(maxDimension, maxDimension, { fit: 'inside', withoutEnlargement: true })
            .toBuffer();
    } catch (err) {
        console.error('[image.resizeImage] Error al redimensionar:', err.message);
        return buffer;
    }
}

module.exports = { resizeImage };
