/**
 * ============================================================
 * CONTROLADOR DE AUTENTICACIÓN
 * ============================================================
 * 
 * La responsabilidad de un controlador es:
 *   1. Extraer datos del request (req.body, req.files, req.headers, etc)
 *   2. Llamar al servicio que contiene la lógica de negocio
 *   3. Capturar cualquier error y pasarlo al middleware global de errores
 *   4. Serializar respuesta con status HTTP y formato JSON
 * 
 * El controlador NO debe contener lógica de negocio compleja,
 * eso es trabajo del SERVICE.
 * 
 * La estructura es siempre:
 *   try {
 *     result = await authService.metodo(params)
 *     return res.status(XXX).json(result)
 *   } catch(error) {
 *     return next(error)  // Pasa al middleware de errores global
 *   }
 */

const authService = require('../services/auth.service');

/**
 * CONTROLADOR: paso1Registro
 * 
 * - Extrae body del cliente (nombre, email, documento, etc)
 * - Llama al service que valida y crea registro temporal
 * - Devuelve status 201 (creado) con el registro_id
 * - Si error, lo pasa al middleware global
 */
const paso1Registro = async (req, res, next) => {
    try {
        const result = await authService.paso1Registro(req.body);
        return res.status(201).json(result);
    } catch (error) {
        return next(error);
    }
};

/**
 * CONTROLADOR: paso2Registro
 * 
 * - Extrae body (registro_id + password)
 * - Llama al service que hashea la contraseña
 * - Devuelve status 200 (ok)
 */
const paso2Registro = async (req, res, next) => {
    try {
        const result = await authService.paso2Registro(req.body);
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};


/**
 * CONTROLADOR: paso3Registro
 * 
 * - Extrae archivos de Multer: req.files = { dni_frente: [...], dni_dorso: [...] }
 * - Extrae body (registro_id)
 * - Valida que no haya errores de carga
 * - Llama al service pasando archivos
 * - Devuelve status 200
 */
const paso3Registro = async (req, res, next) => {
    try {
        if (req.fileValidationError) {
            return next(req.fileValidationError);
        }
        const result = await authService.paso3Registro(req.body, req.files);
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

/**
 * CONTROLADOR: paso4Registro
 * 
 * - Extrae body (registro_id, tipo_pago, detalles bancarios/tarjeta)
 * - Llama al service para validar y crear usuario final
 * - Devuelve status 201 (usuario creado)
 */
const paso4Registro = async (req, res, next) => {
    try {
        const result = await authService.paso4Registro(req.body);
        return res.status(201).json(result);
    } catch (error) {
        return next(error);
    }
};

/**
 * CONTROLADOR: login
 * 
 * - Extrae body (email + password)
 * - Llama al service que busca usuario y valida contraseña
 * - Si correcto, devuelve JWT
 * - Devuelve status 200
 */
const login = async (req, res, next) => {
    try {
        const result = await authService.login(req.body);
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

/**
 * CONTROLADOR: logout
 * 
 * - El middleware authMiddleware ya validó el token (está en req.user)
 * - Extrae body (token a revocar, si aplica)
 * - Llama al service para marcar sesión como cerrada
 * - Devuelve status 200
 */
const logout = async (req, res, next) => {
    try {
        // BUG-01 fix: usar el token validado por authMiddleware (req.user.token),
        // no req.body que llega vacío en este endpoint.
        const result = await authService.logout(req.user.token);
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

/**
 * CONTROLADOR: recuperarClave
 * 
 * - Extrae body (email)
 * - Llama al service para enviar email de recuperación
 * - Devuelve status 200
 */
const recuperarClave = async (req, res, next) => {
    try {
        const result = await authService.recuperarClave(req.body);
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

/**
 * CONTROLADOR: obtenerPaises
 * 
 * - NO toma body (endpoint GET)
 * - Llama al service que devuelve array de países
 * - Devuelve status 200
 */
const obtenerPaises = async (req, res, next) => {
    try {
        const result = await authService.obtenerPaises();
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

/**
 * CONTROLADOR: obtenerBancos
 * 
 * - NO toma body (endpoint GET)
 * - Llama al service que devuelve array de bancos
 * - Devuelve status 200
 */
const obtenerBancos = async (req, res, next) => {
    try {
        const result = await authService.obtenerBancos();
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

/**
 * CONTROLADOR: obtenerUsuarios
 *
 * - Endpoint GET protegido por JWT
 * - Llama al service para obtener usuarios
 * - Devuelve status 200
 */
const obtenerUsuarios = async (req, res, next) => {
    try {
        const result = await authService.obtenerUsuarios();
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    paso1Registro,
    paso2Registro,
    paso3Registro,
    paso4Registro,
    login,
    logout,
    recuperarClave,
    obtenerPaises,
    obtenerBancos,
    obtenerUsuarios
};