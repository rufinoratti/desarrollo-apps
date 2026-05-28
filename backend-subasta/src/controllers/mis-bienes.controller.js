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
            files: req.files,
            baseUrl: `${req.protocol}://${req.get('host')}`
        });
        return res.status(201).json(result);
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    obtenerOpciones,
    obtenerSubastas,
    listarMisBienes,
    crearProducto
};
