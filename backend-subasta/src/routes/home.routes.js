/**
 * ============================================================
 * RUTAS HOME Y EXPLORACIÓN (Módulo 2)
 * ============================================================
 *
 * Define los dos endpoints GET del módulo de exploración.
 * Ambos requieren JWT válido (bearerAuth en el Swagger).
 *
 * Rutas (montadas en /api en app.js):
 *   GET /api/categorias  → lista completa de categorías
 *   GET /api/subastas    → explorador de subastas con filtros y paginación
 *
 * Flujo de request:
 *   Cliente → authMiddleware (valida JWT) → controller → service → respuesta
 */

const express = require('express');
const router = express.Router();

const homeController = require('../controllers/home.controller');
const authMiddleware = require('../middlewares/auth');

/**
 * GET /api/categorias
 *
 * Devuelve la lista de categorías de artículos disponibles
 * para el selector de la pantalla de Home/Exploración.
 *
 * Requiere: Authorization: Bearer <token>
 */
router.get('/categorias', authMiddleware, homeController.obtenerCategorias);

/**
 * GET /api/subastas
 *
 * Devuelve el feed de subastas paginado.
 * Sirve tanto al Home como a la pestaña de Exploración.
 *
 * Query params opcionales:
 *   ?categoria_id=1        → solo Arte
 *   ?estado=EN_VIVO        → solo en vivo
 *   ?limite=10&pagina=2    → paginación
 *
 * Requiere: Authorization: Bearer <token>
 */
router.get('/subastas', authMiddleware, homeController.obtenerSubastas);

module.exports = router;
