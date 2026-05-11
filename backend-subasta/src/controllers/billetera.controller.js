const billeteraService = require('../services/billetera.service');

const listarMediosPago = async (req, res, next) => {
    try {
        const result = await billeteraService.listarMediosPago(req.user);
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

const agregarMedioPago = async (req, res, next) => {
    try {
        const result = await billeteraService.agregarMedioPago(req.user, req.body);
        return res.status(201).json(result);
    } catch (error) {
        return next(error);
    }
};

const eliminarMedioPago = async (req, res, next) => {
    try {
        const result = await billeteraService.eliminarMedioPago(req.user, req.params.id);
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    listarMediosPago,
    agregarMedioPago,
    eliminarMedioPago
};
