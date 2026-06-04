const pujasService = require('../services/pujas.service');

const obtenerEstadoPujasItem = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await pujasService.obtenerEstadoPujasItem({ itemId: id, authUser: req.user });
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

const realizarPuja = async (req, res, next) => {
    try {
        const result = await pujasService.realizarPuja({
            authUser: req.user,
            payload: req.body
        });
        return res.status(201).json(result);
    } catch (error) {
        return next(error);
    }
};

const obtenerPujasActuales = async (req, res, next) => {
    try {
        const result = await pujasService.obtenerPujasActuales({ authUser: req.user });
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

const obtenerPujasGanadas = async (req, res, next) => {
    try {
        const result = await pujasService.obtenerPujasGanadas({ authUser: req.user });
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    obtenerEstadoPujasItem,
    realizarPuja,
    obtenerPujasActuales,
    obtenerPujasGanadas
};
