/**
 * ============================================================
 * CONTROLADOR HOME Y EXPLORACIÓN (Módulo 2)
 * ============================================================
 *
 * Extrae los parámetros del request y delega al service.
 * No contiene lógica de negocio.
 *
 * @module controllers/home.controller
 */

const homeService = require('../services/home.service');

/**
 * CONTROLADOR: obtenerCategoriasTematicas
 *
 * GET /api/categorias
 *
 * - No recibe parámetros
 * - Devuelve array de temáticas (Arte, Vehículos, etc.)
 * - Requiere JWT (aplicado en la ruta)
 */
const obtenerCategorias = async (req, res, next) => {
    try {
        const result = await homeService.obtenerCategorias();
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

/**
 * CONTROLADOR: obtenerSubastas
 *
 * GET /api/subastas
 *
 * Query params opcionales:
 * - tematica : integer — ID de la temática (Arte, Relojes, etc.)
 * - estado   : string  — EN_VIVO | PROXIMAMENTE | FINALIZADA
 * - limite   : integer — elementos por página (default 20, máx 100)
 * - pagina   : integer — número de página (default 1)
 *
 * - Requiere JWT (aplicado en la ruta)
 */
const obtenerSubastas = async (req, res, next) => {
    try {
        // CAMBIO PRINCIPAL: Se extrae 'tematica' del request
        const { tematica, estado, limite, pagina } = req.query;

        const result = await homeService.obtenerSubastas({
            tematica, // Pasamos 'tematica' al service
            estado,
            limite,
            pagina
        });

        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    obtenerCategorias,
    obtenerSubastas
};