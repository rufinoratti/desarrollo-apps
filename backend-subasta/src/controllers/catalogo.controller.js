const catalogoService = require('../services/catalogo.service');

const obtenerCatalogoPorSubasta = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { q, orden } = req.query;
        const result = await catalogoService.obtenerCatalogoPorSubasta({
            subastaId: id, q, orden, usuario: req.user
        });
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

const obtenerDetalleItem = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await catalogoService.obtenerDetalleItem({ itemId: id, usuario: req.user });
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    obtenerCatalogoPorSubasta,
    obtenerDetalleItem
};
