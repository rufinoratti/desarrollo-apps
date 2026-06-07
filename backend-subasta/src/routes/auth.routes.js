/**
 * ============================================================
 * RUTAS DE AUTENTICACIÓN
 * ============================================================
 * 
 * Define todos los endpoints de la API de autenticación.
 * El flujo es:
 * 
 *   Cliente HTTP → Ruta (auth.routes.js) 
 *                → Controlador (auth.controller.js)
 *                → Servicio (auth.service.js)
 *                → Lógica de negocio / Base de datos
 *
 * Cada ruta es un punto de entrada que:
 *   1. Valida que el middleware multer cargue archivos (si aplica)
 *   2. Llama al controlador correspondiente
 *   3. El controlador extrae datos de req.body/req.files
 *   4. El controlador delega lógica al service
 *   5. El service procesa y devuelve resultado
 *   6. El controlador serializa respuesta JSON
 */

const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth');
const { createUploader, multerErrorHandler } = require('../middlewares/upload');

/**
 * ============================================================
 * CONFIGURACIÓN DE CARGA DE ARCHIVOS (MULTER MEMORYSTORAGE)
 * ============================================================
 *
 * Los archivos del paso 3 (DNI frente/dorso y foto de perfil) se
 * reciben en memoria (Buffer en req.files[i].buffer) y se suben a
 * Supabase Storage desde el servicio auth.service.paso3Registro.
 * NO se persisten en disco local.
 *
 * - mimeTypes: solo JPEG/JPG/PNG (KYC estricto)
 * - maxSize:   5MB por archivo
 */
const upload = createUploader({
    maxSize: 5 * 1024 * 1024,
    mimeTypes: ['jpeg', 'jpg', 'png']
});

/**
 * PASO 1 DEL REGISTRO: Datos Personales
 * POST /api/auth/registro/paso1
 * 
 * El cliente envía: nombre, documento, dirección, país, email
 * El service crea un registro temporal y devuelve un registro_id
 * Este ID se necesita para continuar con los pasos siguientes
 */
router.post('/registro/paso1', authController.paso1Registro);

/**
 * PASO 2 DEL REGISTRO: Crear Contraseña
 * POST /api/auth/registro/paso2
 * 
 * El cliente envía: registro_id, password
 * El service valida la contraseña y la hashea con bcrypt
 * La contraseña jamás se almacena en texto plano
 */
router.post('/registro/paso2', authController.paso2Registro);

/**
 * PASO 3 DEL REGISTRO: Cargar DNI
 * POST /api/auth/registro/paso3
 *
 * Middleware chain:
 *   1. upload.fields([...])   : Multer procesa archivos en memoria
 *   2. multerErrorHandler      : Captura errores de carga
 *   3. authController          : Lógica del negocio (sube a Supabase Storage)
 *
 * El cliente envía: registro_id + 2 archivos (dni_frente, dni_dorso) + foto_perfil opcional
 */
router.post('/registro/paso3', upload.fields([
    { name: 'dni_frente', maxCount: 1 },
    { name: 'dni_dorso', maxCount: 1 },
    { name: 'foto_perfil', maxCount: 1 }
]), multerErrorHandler, authController.paso3Registro);

/**
 * PASO 4 DEL REGISTRO: Pago
 * POST /api/auth/registro/paso4-pago
 * 
 * El cliente envía: registro_id, tipo_pago, detalles_pago
 * El service valida los datos bancarios/tarjeta
 * Si todo es válido, se crea el usuario final
 */
router.post('/registro/paso4-pago', authController.paso4Registro);

/**
 * ============================================================
 * ENDPOINTS DE SESIÓN
 * ============================================================
 */

/**
 * LOGIN
 * POST /api/auth/login
 * 
 * El cliente envía: email + password
 * El service busca usuario por email y compara contraseña (bcrypt)
 * Si es correcto, genera un JWT con expiración de 24h
 * Respuesta: { token, usuario_id, email, ... }
 */
router.post('/login', authController.login);

/**
 * LOGOUT
 * POST /api/auth/logout
 * 
 * Middleware authMiddleware: valida que el cliente envíe un JWT válido
 * El service marca la sesión como cerrada (si aplica)
 * El cliente debe descartar el token del lado cliente
 */
router.post('/logout', authMiddleware, authController.logout);

/**
 * RECUPERAR CONTRASEÑA
 * POST /api/auth/recuperar-clave
 * 
 * El cliente envía: email
 * El service busca el usuario y envía email con código/link
 * (En este caso: respuesta JSON con instrucciones)
 */
router.post('/recuperar-clave', authController.recuperarClave);

/**
 * RESTABLECER CONTRASEÑA (con token)
 * POST /api/auth/restablecer-clave
 * 
 * El cliente envía: email, token, newPassword
 * El service valida el token y actualiza la contraseña
 * (requiere el token recibido por email)
 */
router.post('/restablecer-clave', authController.restablecerClave);

/**
 * PÁGINA DE RESTABLECER CONTRASEÑA (para redirect de Supabase)
 * GET /api/auth/reset-password
 * 
 * Sirve una página HTML que captura el hash #access_token del
 * redirect de Supabase Auth y permite al usuario ingresar una
 * nueva contraseña.
 * 
 * IMPORTANTE: Esta URL debe estar agregada en Supabase Dashboard >
 * Authentication > URL Configuration > Redirect URLs
 */
router.get('/reset-password', authController.resetPasswordPage);

/**
 * ============================================================
 * ENDPOINTS DE CATÁLOGOS (sin autenticación)
 * ============================================================
 */

/**
 * OBTENER PAÍSES
 * GET /api/auth/paises
 * 
 * Devuelve lista de países disponibles para registro
 * Respuesta: Array de {id, nombre, nombrecorto, capital, ...}
 */
router.get('/paises', authController.obtenerPaises);

/**
 * OBTENER BANCOS
 * GET /api/auth/bancos
 * 
 * Devuelve lista de bancos para vinculación de cuenta
 * Respuesta: Array de {id, nombre, codigo}
 */
router.get('/bancos', authController.obtenerBancos);

/**
 * OBTENER USUARIOS
 * GET /api/auth/usuarios
 *
 * Devuelve la lista de usuarios registrados en la aplicación.
 * Este endpoint está protegido por token JWT.
 */
router.get('/usuarios', authMiddleware, authController.obtenerUsuarios);

module.exports = router;