const misBienesService = require('../services/mis-bienes.service');

const obtenerOpciones = async (req, res, next) => {
    try {
        const result = await misBienesService.obtenerOpciones();
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

const obtenerSubastas = async (req, res, next) => {
    try {
        const { tematica } = req.query;
        const result = await misBienesService.obtenerSubastasPorTematica({ tematica });
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

const listarMisBienes = async (req, res, next) => {
    try {
        const result = await misBienesService.listarMisBienes(req.user);
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

const crearProducto = async (req, res, next) => {
    try {
        const result = await misBienesService.crearProducto({
            authUser: req.user,
            payload: req.body,
            files: req.files
        });
        return res.status(201).json(result);
    } catch (error) {
        return next(error);
    }
};

const listarCatalogos = async (req, res, next) => {
    try {
        const { subasta } = req.query;
        const result = await misBienesService.listarCatalogosPorSubasta({ authUser: req.user, subastaId: subasta });
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

const retirarProducto = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await misBienesService.retirarProducto({
            authUser: req.user,
            productoId: id
        });
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

const confirmarProducto = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { accion } = req.body;
        const result = await misBienesService.confirmarProducto({
            authUser: req.user,
            productoId: id,
            accion
        });
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    obtenerOpciones,
    obtenerSubastas,
    listarCatalogos,
    listarMisBienes,
    crearProducto,
    retirarProducto,
    confirmarProducto
};
