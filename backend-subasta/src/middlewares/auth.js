/**
 * ============================================================
 * MIDDLEWARE DE AUTENTICACIÓN JWT
 * ============================================================
 * 
 * ¿QUÉ HACE?
 * 
 * Es un "guardián" que protege rutas para que solo usuarios autenticados
 * puedan acceder. Se coloca ANTES del controlador en la chain:
 * 
 *   Cliente request → authMiddleware (valida token) → controlador → respuesta
 * 
 * FLUJO PASO A PASO:
 * 
 *   1. Cliente envía request con header: Authorization: Bearer eyJhbGc...
 *   2. Middleware extrae el token de ese header
 *   3. Llama a authService.verificarToken(token)
 *   4. Si token válido:
 *      - Decodifica el JWT
 *      - Inyecta req.user = { id, email, token } para que el controlador lo use
 *      - Llama next() para continuar al controlador
 *   5. Si token inválido/expirado:
 *      - Responde 401 (unauthorized) SIN llamar a next()
 *      - El controlador nunca se ejecuta
 * 
 * PROTECCIÓN:
 * 
 *   Úsalo en rutas que requieren login:
 *   - router.post('/logout', authMiddleware, authController.logout)
 *   - router.post('/perfil', authMiddleware, perfilController.obtener)
 * 
 *   Rutas públicas (no protegidas):
 *   - GET /api/auth/paises (no necesita token)
 *   - POST /api/auth/login (genera el token)
 *   - POST /api/auth/registro/paso1 (es parte del flujo de registro)
 */

const authService = require('../services/auth.service');

/**
 * authMiddleware(req, res, next)
 * 
 * Middleware que valida JWT.
 * 
 * @param {import('express').Request} req - Request HTTP
 * @param {import('express').Response} res - Response HTTP
 * @param {import('express').NextFunction} next - Callback para continuar la chain
 * 
 * POSIBLES RESPUESTAS:
 * 
 *   ✅ Token válido:
 *      - Inyecta req.user
 *      - Llama next() y sigue con el controlador
 * 
 *   ❌ No hay header Authorization:
 *      - res.status(401).json({ error: '...' })
 *      - Termina. El controlador NO se ejecuta.
 * 
 *   ❌ Header inválido (no es "Bearer ..."):
 *      - res.status(401).json({ error: '...' })
 *      - Termina. El controlador NO se ejecuta.
 * 
 *   ❌ Token expirado o firmar mal:
 *      - try/catch lo captura
 *      - Llama next(error) que lo maneja el middleware global de errores
 */
const authMiddleware = (req, res, next) => {
    
    const authHeader = req.headers.authorization;

    // Paso 1: Validar que el header Authorization exista
    // Formato esperado: "Authorization: Bearer <token>"
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'No autorizado. Se requiere un token Bearer válido.'
        });
    }

    // Paso 2: Extraer el token (todo después de "Bearer ")
    // Ejemplo: "Bearer eyJhbGc..." → token = "eyJhbGc..."
    const token = authHeader.split(' ')[1];

    try {
        // Paso 3: Verificar y decodificar el JWT
        // Esto valida:
        //   - La firma (¿coincide con JWT_SECRET?)
        //   - La expiración (¿exp > Date.now()?)
        const decoded = authService.verificarToken(token);

        // Paso 4: Inyectar datos del usuario en req.user
        // Ahora el controlador puede acceder a: req.user.id, req.user.email, etc.
        req.user = {
            id: decoded.usuario_id,
            email: decoded.email,
            categoria: decoded.categoria,
            token
        };

        // Paso 5: Llamar next() para que continúe con el siguiente middleware/controlador
        // Si no llamamos next(), la request queda "colgada" y no se ejecuta nada más
        next();
    } catch (error) {
        // Paso 6: Si hay error, respondemos con status 401 (unauthorized)
        // El error ya tiene statusCode desde auth.service.verificarToken()
        return res.status(error.statusCode || 401).json({
            error: error.message
        });
    }
};

module.exports = authMiddleware;
