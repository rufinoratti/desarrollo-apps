const sharp = require('sharp');

const DEFAULT_MAX_DIMENSION = 1200;

async function resizeImage(buffer, maxDimension = DEFAULT_MAX_DIMENSION) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        return buffer;
    }

    try {
        const image = sharp(buffer);
        const metadata = await image.metadata();

        if (!metadata || !metadata.width) {
            return buffer;
        }

        if (metadata.width <= maxDimension && metadata.height <= maxDimension) {
            return buffer;
        }

        return image
            .resize(maxDimension, maxDimension, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .toBuffer();
    } catch {
        return buffer;
    }
}

module.exports = { resizeImage };
