const notificacionesService = require('../services/notificaciones.service');

const listarNotificaciones = async (req, res, next) => {
    try {
        const result = await notificacionesService.listarNotificaciones({
            userId: req.user.id
        });
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

const marcarComoLeida = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await notificacionesService.marcarComoLeida({
            userId: req.user.id,
            notificacionId: id
        });
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    listarNotificaciones,
    marcarComoLeida
};
