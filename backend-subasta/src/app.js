/**
 * ============================================================
 * APP.JS - Configuración Principal de Express
 * ============================================================
 * 
 * Este archivo es el "corazón" del servidor backend.
 * 
 * FLUJO DE REQUEST:
 * 
 *   Cliente HTTP → Express.listen() → app.js monta rutas
 *              → routes (auth.routes.js) → controller → service
 * 
 * Lo que hace app.js:
 * 1. Cargar variables de entorno (.env)
 * 2. Inicializar Express
 * 3. Configurar middlewares globales (CORS, JSON parser)
 * 4. Montar todas las rutas
 * 5. Configurar 404 handler
 * 6. Configurar error handler global
 * 
 * MIDDLEWARES GLOBALES:
 * - cors(): Permite requests desde otros dominios (http://localhost:3000)
 * - express.json(): Parsea body JSON automáticamente → req.body
 * - express.urlencoded(): Parsea formularios
 * 
 * RUTAS MONTADAS:
 * - /api/auth → Todo lo relacionado con autenticación
 * 
 * MANEJO DE ERRORES:
 * - 404: Si no coincide ninguna ruta, devuelve "Ruta no encontrada"
 * - errorHandler: Middleware global que captura todos los errores de rutas
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth.routes');
const homeRoutes = require('./routes/home.routes');
const catalogoRoutes = require('./routes/catalogo.routes');
const billeteraRoutes = require('./routes/billetera.routes');
const pujasRoutes = require('./routes/pujas.routes');
const perfilRoutes = require('./routes/perfil.routes');
const adminRoutes = require('./routes/admin.routes');
const misBienesRoutes = require('./routes/mis-bienes.routes');
const authController = require('./controllers/auth.controller');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (fotos de perfil, DNI, etc.)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

/**
 * ENDPOINT DE SALUD
 * GET /api/health
 * 
 * Usado por herramientas de monitoreo para verificar que el servidor está arriba.
 * No requiere autenticación.
 */
app.get('/api/health', (req, res) => {
    return res.status(200).json({
        ok: true,
        service: 'backend-subasta',
        timestamp: new Date().toISOString()
    });
});

/**
 * ============================================================
 * MONTAJE DE RUTAS
 * ============================================================
 *
 * Módulo 1 — Autenticación y Registro:
 *   POST /api/auth/registro/paso1-4
 *   POST /api/auth/login
 *   POST /api/auth/logout
 *   POST /api/auth/recuperar-clave
 *   GET  /api/auth/paises
 *   GET  /api/auth/bancos
 *
 * Módulo 2 — Home y Exploración:
 *   GET  /api/categorias    (con JWT)
 *   GET  /api/subastas      (con JWT, filtros y paginación)
 */
app.use('/api/auth', authRoutes);
app.use('/api', homeRoutes);
app.use('/api', catalogoRoutes);
app.use('/api', billeteraRoutes);
app.use('/api', pujasRoutes);
app.use('/api', perfilRoutes);
app.use('/api', adminRoutes);
app.use('/api', misBienesRoutes);

// Sirve la página HTML de restablecer contraseña en la raíz
// (Supabase redirige aquí desde el email de recuperación)
app.get('/', authController.resetPasswordPage);

/**
 * ============================================================
 * 404 HANDLER
 * ============================================================
 * 
 * Si llegamos acá es porque NINGUNA ruta coincidió.
 * Por ejemplo:
 *   - GET /api/usuarios (no existe, lo eliminamos)
 *   - POST /inexistente
 *   - GET /random
 */
app.use((req, res) => {
    return res.status(404).json({ error: 'Ruta no encontrada' });
});

/**
 * ============================================================
 * ERROR HANDLER GLOBAL
 * ============================================================
 * 
 * Cualquier error lanzado en routes/controllers/services
 * es capturado aquí con: next(error) o next(new AppError(...))
 * 
 * Este middleware SIEMPRE va al final.
 * 
 * Ejemplo de errores que captura:
 *   - Email duplicado en registro
 *   - Contraseña incorrecta
 *   - Token expirado
 *   - Campos faltantes
 *   - Errores de BD
 */
app.use(errorHandler);

module.exports = app;
