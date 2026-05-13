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
 * CONTROLADOR: restablecerClave
 * 
 * - Extrae body (email, token, newPassword)
 * - Llama al service para validar token y actualizar contraseña
 * - Devuelve status 200
 */
const restablecerClave = async (req, res, next) => {
    try {
        const result = await authService.restablecerClave(req.body);
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

/**
 * CONTROLADOR: resetPasswordPage
 *
 * Sirve una página HTML para que el usuario restablezca su contraseña
 * tras hacer clic en el enlace de Supabase Auth.
 *
 * La URL llega con hash fragment: #access_token=xxx&refresh_token=yyy&type=recovery
 * La página extrae el token del hash y muestra un formulario.
 */
const resetPasswordPage = async (req, res, next) => {
    try {
        const supabaseUrl = process.env.SUPABASE_URL || '';
        const anonKey = process.env.SUPABASE_ANON_KEY || '';
        const appScheme = 'frontendsubastas';

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Restablecer Contraseña - Rematix</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
  .card { background: white; border-radius: 12px; padding: 40px; width: 100%; max-width: 420px; margin: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  .logo { font-size: 28px; font-weight: 900; letter-spacing: -1px; margin-bottom: 30px; }
  h1 { font-size: 22px; margin-bottom: 10px; }
  p { color: #666; font-size: 14px; line-height: 1.5; margin-bottom: 24px; }
  label { font-size: 10px; font-weight: bold; color: #333; letter-spacing: 1px; display: block; margin-bottom: 4px; }
  input { width: 100%; font-size: 16px; padding: 10px 0; border: none; border-bottom: 1px solid #d0d0d0; outline: none; margin-bottom: 20px; }
  input:focus { border-bottom-color: #000; }
  button { width: 100%; padding: 14px; background: #000; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: bold; letter-spacing: 1px; cursor: pointer; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .error { color: #d32f2f; font-size: 13px; margin-bottom: 12px; }
  .success { color: #2e7d32; font-size: 14px; text-align: center; margin-bottom: 12px; }
  .hidden { display: none; }
  .app-link { display: block; text-align: center; margin-top: 20px; color: #000; font-size: 14px; }
</style>
</head>
<body>
<div class="card">
  <div class="logo">REMATIX</div>
  <div id="loading">
    <h1>Verificando enlace...</h1>
    <p>Por favor espera un momento.</p>
  </div>
  <div id="form" class="hidden">
    <h1>Nueva Contraseña</h1>
    <p>Ingresa tu nueva contraseña para restablecer el acceso a tu cuenta.</p>
    <div id="errorMsg" class="error hidden"></div>
    <label>NUEVA CONTRASEÑA</label>
    <input type="password" id="password" placeholder="••••••••" />
    <label>CONFIRMAR CONTRASEÑA</label>
    <input type="password" id="confirm" placeholder="••••••••" />
    <p style="font-size:11px;color:#888;margin-bottom:20px;">Mínimo 8 caracteres, una mayúscula y un número.</p>
    <button id="submitBtn">RESTABLECER CONTRASEÑA</button>
  </div>
  <div id="success" class="hidden">
    <h1>Contraseña Actualizada</h1>
    <p class="success">Tu contraseña se ha restablecido correctamente.</p>
    <a class="app-link" href="${appScheme}://login">Volver a la App</a>
  </div>
  <div id="expired" class="hidden">
    <h1>Enlace Expirado</h1>
    <p>Este enlace de recuperación ha expirado o es inválido. Solicita uno nuevo desde la aplicación.</p>
    <a class="app-link" href="${appScheme}://login">Ir a la App</a>
  </div>
</div>
<script>
(async function() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const type = params.get('type');
  const error = params.get('error');
  const errorDescription = params.get('error_description');

  const loading = document.getElementById('loading');
  const formDiv = document.getElementById('form');
  const successDiv = document.getElementById('success');
  const expiredDiv = document.getElementById('expired');
  const errorMsg = document.getElementById('errorMsg');

  if (error) {
    loading.classList.add('hidden');
    expiredDiv.classList.remove('hidden');
    return;
  }

  if (!accessToken || type !== 'recovery') {
    loading.classList.add('hidden');
    expiredDiv.classList.remove('hidden');
    return;
  }

  loading.classList.add('hidden');
  formDiv.classList.remove('hidden');

  document.getElementById('submitBtn').addEventListener('click', async function() {
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirm').value;

    if (!password || !confirm) {
      errorMsg.textContent = 'Por favor completa ambos campos.';
      errorMsg.classList.remove('hidden');
      return;
    }
    if (password !== confirm) {
      errorMsg.textContent = 'Las contraseñas no coinciden.';
      errorMsg.classList.remove('hidden');
      return;
    }
    if (password.length < 8) {
      errorMsg.textContent = 'La contraseña debe tener al menos 8 caracteres.';
      errorMsg.classList.remove('hidden');
      return;
    }

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = 'PROCESANDO...';
    errorMsg.classList.add('hidden');

    try {
      const response = await fetch('${supabaseUrl}/auth/v1/user', {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'apikey': '${anonKey}',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });

      if (response.ok) {
        formDiv.classList.add('hidden');
        successDiv.classList.remove('hidden');
      } else {
        const data = await response.json();
        errorMsg.textContent = data.msg || data.error_description || 'Error al restablecer la contraseña. Intenta de nuevo.';
        errorMsg.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'RESTABLECER CONTRASEÑA';
      }
    } catch (err) {
      errorMsg.textContent = 'Error de conexión. Intenta de nuevo.';
      errorMsg.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'RESTABLECER CONTRASEÑA';
    }
  });
})();
</script>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html');
        return res.send(html);
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
    restablecerClave,
    resetPasswordPage,
    obtenerPaises,
    obtenerBancos,
    obtenerUsuarios
};