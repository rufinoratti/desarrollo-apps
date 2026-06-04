const checkoutService = require('../services/checkout.service');

const obtenerLiquidacionAdjudicacion = async (req, res, next) => {
    try {
        const { itemId } = req.params;
        const result = await checkoutService.obtenerLiquidacionAdjudicacion({
            itemId,
            authUser: req.user
        });
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    obtenerLiquidacionAdjudicacion
};
