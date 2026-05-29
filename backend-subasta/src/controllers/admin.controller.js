const adminService = require('../services/admin.service');

const evaluarCliente = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await adminService.evaluarCliente({ id, payload: req.body });
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

const evaluarProducto = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await adminService.evaluarProducto({ id, payload: req.body });
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

const crearSubasta = async (req, res, next) => {
    try {
        const result = await adminService.crearSubasta({ payload: req.body });
        return res.status(201).json(result);
    } catch (error) {
        return next(error);
    }
};

const subirPortadaSubasta = async (req, res, next) => {
    try {
        const result = await adminService.subirPortadaSubasta({
            authUser: req.user,
            file: req.file,
            baseUrl: `${req.protocol}://${req.get('host')}`
        });
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

const listarClientesPendientes = async (req, res, next) => {
    try {
        const result = await adminService.listarClientesPendientes();
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

const listarProductosPendientes = async (req, res, next) => {
    try {
        const result = await adminService.listarProductosPendientes();
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

const listarClientesRechazados = async (req, res, next) => {
    try {
        const result = await adminService.listarClientesRechazados();
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

const obtenerOpciones = async (req, res, next) => {
    try {
        const result = await adminService.obtenerOpcionesAdmin();
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    evaluarCliente,
    evaluarProducto,
    crearSubasta,
    subirPortadaSubasta,
    listarClientesPendientes,
    listarProductosPendientes,
    listarClientesRechazados,
    obtenerOpciones
};
