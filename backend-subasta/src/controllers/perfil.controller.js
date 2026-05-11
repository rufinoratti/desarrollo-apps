const perfilService = require('../services/perfil.service');

const obtenerPerfil = async (req, res, next) => {
    try {
        const result = await perfilService.obtenerPerfil(req.user);
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

const actualizarPerfil = async (req, res, next) => {
    try {
        const result = await perfilService.actualizarPerfil(req.user, req.body);
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

const obtenerEstadisticas = async (req, res, next) => {
    try {
        const result = await perfilService.obtenerEstadisticas(req.user);
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

const obtenerRestricciones = async (req, res, next) => {
    try {
        const result = await perfilService.obtenerRestricciones(req.user);
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    obtenerPerfil,
    actualizarPerfil,
    obtenerEstadisticas,
    obtenerRestricciones
};
