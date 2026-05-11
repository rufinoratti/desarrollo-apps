/**
 * ============================================================
 * REMATIX - Middleware Manejador de Errores Global
 * ============================================================
 *
 * Captura todos los errores que ocurran en los controladores y
 * servicios, normaliza la respuesta y la envía al cliente con
 * el código HTTP apropiado.
 *
 * Soporta:
 *   • AppError         : Errores controlados de negocio
 *   • Errores con código personalizado (ej: EMAIL_DUPLICADO)
 *   • Errores genéricos : 500 Internal Server Error
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */

const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Error interno del servidor';

    // Construir respuesta base
    const response = {
        error: message
    };

    // Incluir código de error personalizado si existe (ej: EMAIL_DUPLICADO, PASSWORD_DEBIL)
    if (err.codigo) {
        response.codigo = err.codigo;
    }

    // En desarrollo podríamos incluir el stack trace, pero por seguridad
    // en producción solo enviamos el mensaje y el código.
    res.status(statusCode).json(response);
};

module.exports = errorHandler;
