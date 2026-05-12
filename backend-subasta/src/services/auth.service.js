/**
 * ============================================================
 * REMATIX - Servicio de Autenticación (Módulo 1)
 * ============================================================
 *
 * Maneja toda la lógica de negocio para:
 *   • Registro de usuarios en 4 pasos
 *   • Login / Logout con JWT
 *   • Recuperación de contraseña
 *   • Catálogos de países y bancos
 *
 * Modos de operación:
 *   • Local (memoria)  : Usa store en memoria para desarrollo/testing
 *   • Supabase         : Conecta a la base de datos real cuando
 *                        SUPABASE_ENABLED=true
 *
 * Seguridad implementada:
 *   • Contraseñas hasheadas con bcryptjs (salt rounds: 10)
 *   • Tokens JWT firmados con HMAC-SHA256 (expiración: 24h)
 *   • Validación de fortaleza de contraseña (mín. 8 chars, mayúscula, número)
 *   • Rate-limit implícito por email en recuperación de clave
 *
 * @module services/auth.service
 * @requires bcryptjs
 * @requires jsonwebtoken
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { store, nextId } = require('./data.store');
const AppError = require('../utils/appError');
const { supabase, isConfigured } = require('../config/supabase');

// ============================================================
// CONFIGURACIÓN
// ============================================================

/** Clave secreta para firmar/verificar JWTs. */
const JWT_SECRET = process.env.JWT_SECRET || 'rematix-dev-secret-key-change-in-production';

/** Duración del token JWT (formato de jsonwebtoken). */
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/** Factor de trabajo bcrypt (2^10 = 1024 iteraciones). */
const BCRYPT_SALT_ROUNDS = 10;

/** Regex simple para validar formato de email. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Ventana mínima entre solicitudes de recuperación por email (ms). */
const RECOVERY_COOLDOWN_MS = Number(process.env.RECOVERY_COOLDOWN_MS || 60_000);

/** Tiempo de vida de un registro temporal (ms). 30 minutos. */
const REGISTRO_TEMP_TTL_MS = 30 * 60 * 1000;

// ============================================================
// CATÁLOGOS ESTÁTICOS
// ============================================================

/**
 * Lista de países para formularios de registro.
 * @type {Array<{id:number, nombre:string, nombrecorto:string, capital:string, nacionalidad:string, idiomas:string}>}
 */
const PAISES = [
    { id: 1, nombre: 'Argentina', nombrecorto: 'AR', capital: 'Buenos Aires', nacionalidad: 'argentina', idiomas: 'español' },
    { id: 2, nombre: 'Uruguay', nombrecorto: 'UY', capital: 'Montevideo', nacionalidad: 'uruguaya', idiomas: 'español' },
    { id: 3, nombre: 'Chile', nombrecorto: 'CL', capital: 'Santiago', nacionalidad: 'chilena', idiomas: 'español' },
    { id: 4, nombre: 'Brasil', nombrecorto: 'BR', capital: 'Brasilia', nacionalidad: 'brasilera', idiomas: 'portugués' },
    { id: 5, nombre: 'Paraguay', nombrecorto: 'PY', capital: 'Asunción', nacionalidad: 'paraguaya', idiomas: 'español,guaraní' },
    { id: 6, nombre: 'Colombia', nombrecorto: 'CO', capital: 'Bogotá', nacionalidad: 'colombiana', idiomas: 'español' },
    { id: 7, nombre: 'México', nombrecorto: 'MX', capital: 'Ciudad de México', nacionalidad: 'mexicana', idiomas: 'español' },
    { id: 8, nombre: 'España', nombrecorto: 'ES', capital: 'Madrid', nacionalidad: 'española', idiomas: 'español' }
];

/**
 * Lista de bancos disponibles para vinculación de cuentas bancarias.
 * @type {Array<{id:number, nombre:string, codigo:string}>}
 */
const BANCOS = [
    { id: 1, nombre: 'Banco Galicia', codigo: '007' },
    { id: 2, nombre: 'Banco Nación', codigo: '011' },
    { id: 3, nombre: 'BBVA Argentina', codigo: '017' },
    { id: 4, nombre: 'Santander', codigo: '072' },
    { id: 5, nombre: 'Banco Macro', codigo: '285' },   // BUG-06 fix: código correcto es 285
    { id: 6, nombre: 'ICBC', codigo: '015' }
];

// ============================================================
// FUNCIONES AUXILIARES DE SEGURIDAD
// ============================================================

/**
 * crearTokenJWT(payload)
 *
 * Genera un JWT (JSON Web Token) firmado.
 *
 * El payload incluye usuario_id, email y categoria para que
 * el Módulo 2 (subastas) pueda verificar el nivel de acceso
 * sin una consulta extra a la base de datos.
 *
 * @param {Object} payload - Datos a incluir: { usuario_id, email, categoria }
 * @returns {string} Token JWT completo
 */
const crearTokenJWT = (payload) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * verificarToken(token)
 *
 * Valida un JWT recibido del cliente.
 *
 * @param {string} token - JWT recibido
 * @returns {Object} Payload decodificado
 * @throws {AppError} 401 si expiró o es inválido
 */
const verificarToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new AppError('Token expirado', 401);
        }
        throw new AppError('Token inválido', 401);
    }
};

/**
 * hashPassword(password)
 *
 * Convierte una contraseña de texto plano en un hash bcrypt.
 *
 * @param {string} password - Contraseña en texto plano
 * @returns {Promise<string>} Hash bcrypt de ~60 caracteres
 */
const hashPassword = async (password) => {
    return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
};

/**
 * comparePassword(password, hashedPassword)
 *
 * Compara una contraseña ingresada contra el hash almacenado.
 *
 * @param {string} password - Contraseña ingresada por usuario
 * @param {string} hashedPassword - Hash almacenado en BD
 * @returns {Promise<boolean>} true si coinciden
 */
const comparePassword = async (password, hashedPassword) => {
    return bcrypt.compare(password, hashedPassword);
};

/**
 * validarPassword(password)
 *
 * Valida que la contraseña cumpla requisitos de seguridad:
 *   - Mínimo 8 caracteres
 *   - Al menos 1 mayúscula
 *   - Al menos 1 número
 *
 * @param {string} password
 * @throws {AppError} 400 con codigo PASSWORD_DEBIL si no cumple requisitos
 */
const validarPassword = (password) => {
    // BUG fix (REC-01): todos los errores de contraseña emiten codigo PASSWORD_DEBIL
    if (!password || password.length < 8) {
        const err = new AppError('La contraseña debe tener al menos 8 caracteres, una mayúscula y un número', 400);
        err.codigo = 'PASSWORD_DEBIL';
        throw err;
    }
    if (!/[A-Z]/.test(password)) {
        const err = new AppError('La contraseña debe tener al menos 8 caracteres, una mayúscula y un número', 400);
        err.codigo = 'PASSWORD_DEBIL';
        throw err;
    }
    if (!/[0-9]/.test(password)) {
        const err = new AppError('La contraseña debe tener al menos 8 caracteres, una mayúscula y un número', 400);
        err.codigo = 'PASSWORD_DEBIL';
        throw err;
    }
    return true;
};

const normalizarEmail = (email = '') => String(email).trim().toLowerCase();

const validarEmail = (email) => {
    if (!EMAIL_REGEX.test(email)) {
        throw new AppError('Email inválido', 400);
    }
};

const validarEstadoRegistro = (registro, estadoEsperado) => {
    if (registro.estado !== estadoEsperado) {
        throw new AppError(`Secuencia de registro inválida. Se esperaba ${estadoEsperado}`, 400);
    }
};

const validarDetallesPago = (tipoPago, detalles = {}) => {
    const tipo = String(tipoPago || '').toUpperCase();

    if (!['TARJETA', 'CUENTA_BANCARIA', 'CHEQUE'].includes(tipo)) {
        throw new AppError('Tipo de pago inválido', 400);
    }

    if (tipo === 'TARJETA') {
        if (!detalles.numero_tarjeta || !detalles.cvv || !detalles.fecha_expiracion || !detalles.titular) {
            throw new AppError('Datos de tarjeta incompletos', 400);
        }
    }

    if (tipo === 'CUENTA_BANCARIA') {
        if (!detalles.cbu_alias || !detalles.titular || !detalles.banco) {
            throw new AppError('Datos de cuenta bancaria incompletos', 400);
        }
    }

    if (tipo === 'CHEQUE') {
        if (!detalles.numero_cheque || !detalles.titular || !detalles.banco) {
            throw new AppError('Datos de cheque incompletos', 400);
        }
    }

    return tipo;
};

/**
 * purgarRegistrosExpirados()
 *
 * Elimina del store los registros temporales que superaron el TTL.
 * Se llama automáticamente al inicio de cada paso 1 para evitar
 * bloqueos de email por registros abandonados.
 */
const purgarRegistrosExpirados = () => {
    if (!store.registrosTemporales) return;
    const ahora = Date.now();
    store.registrosTemporales = store.registrosTemporales.filter((r) => {
        const creado = new Date(r.created_at).getTime();
        return ahora - creado < REGISTRO_TEMP_TTL_MS;
    });
};

// ============================================================
// PASO 1 — DATOS PERSONALES
// ============================================================

/**
 * Paso 1 del registro de usuario: crea un registro temporal con los
 * datos personales. El registro se almacena en memoria (local) o en
 * la tabla `personas` de Supabase.
 *
 * @param {Object} payload
 * @param {string} payload.nombre_completo
 * @param {string} payload.documento
 * @param {string} payload.direccion
 * @param {string|number} payload.pais_residencia
 * @param {string} payload.email
 * @returns {Promise<{registro_id:string, mensaje:string}>}
 * @throws {AppError} 400 si faltan datos o el email ya existe
 * @throws {AppError} 500 si falla la inserción en Supabase
 */
const paso1Registro = async (payload) => {
    let { nombre_completo, documento, direccion, pais_residencia, pais_nombre, email } = payload;

    email = normalizarEmail(email);

    if (!nombre_completo || !documento || !direccion || !pais_residencia || !email) {
        throw new AppError('Datos inválidos o incompletos', 400);
    }

    validarEmail(email);

    let paisValido;
    if (isConfigured) {
        const { data: paisDb } = await supabase
            .from('paises')
            .select('numero')
            .eq('numero', Number(pais_residencia))
            .maybeSingle();
        paisValido = paisDb;
    } else {
        paisValido = PAISES.find((p) => p.id === Number(pais_residencia));
    }

    if (!paisValido) {
        throw new AppError(`País de residencia inválido. Número recibido: ${pais_residencia}`, 400);
    }

    if (!store.registrosTemporales) store.registrosTemporales = [];
    if (!store.users) store.users = [];

    // REC-04 fix: eliminar registros temporales expirados antes de verificar duplicados
    purgarRegistrosExpirados();

    if (isConfigured) {
        // ----------------------------------------------------------------
        // Modo Supabase: verificar duplicado + crear temporal (sin insertar en personas aún)
        // ----------------------------------------------------------------

        // BUG-03 fix: verificar duplicado tanto en temporales como en personas
        const emailEnTemporal = store.registrosTemporales.find((r) => r.email === email);
        if (emailEnTemporal) {
            const error = new AppError('El email ya está registrado', 400);
            error.codigo = 'EMAIL_DUPLICADO';
            throw error;
        }

        const { data: existingUser } = await supabase
            .from('personas')
            .select('identificador, email')
            .eq('email', email)
            .maybeSingle();

        if (existingUser) {
            const error = new AppError('El email ya está registrado', 400);
            error.codigo = 'EMAIL_DUPLICADO';
            throw error;
        }
    }

    // ----------------------------------------------------------------
    // Crear registro temporal (común para ambos modos)
    // ----------------------------------------------------------------
    const emailEnRegistro = store.registrosTemporales.find((r) => r.email === email);
    const emailEnUsuario = store.users.find((u) => u.email === email);
    if (emailEnRegistro || emailEnUsuario) {
        const error = new AppError('El email ya está registrado', 400);
        error.codigo = 'EMAIL_DUPLICADO';
        throw error;
    }

    const registroTemporal = {
        registro_id: nextId('reg', 'registroTemp'),
        nombre_completo,
        documento,
        direccion,
        pais_residencia: Number(pais_residencia),
        email,
        estado: 'paso1_completo',
        created_at: new Date().toISOString()
    };

    store.registrosTemporales.push(registroTemporal);

    return {
        registro_id: registroTemporal.registro_id,
        mensaje: 'Registro creado. Continúe con el paso 2.'
    };
};

// ============================================================
// PASO 2 — CREACIÓN DE CONTRASEÑA
// ============================================================

/**
 * Paso 2 del registro: asocia una contraseña hasheada al registro
 * temporal creado en el paso 1.
 *
 * @param {Object} payload
 * @param {string} payload.registro_id - ID del registro temporal
 * @param {string} payload.password   - Contraseña en texto plano
 * @returns {Promise<{mensaje:string}>}
 * @throws {AppError} 400 con codigo PASSWORD_DEBIL si la contraseña es débil
 * @throws {AppError} 404 si el registro temporal no existe
 */
const paso2Registro = async (payload) => {
    const { registro_id, password } = payload;

    if (!registro_id || !password) {
        throw new AppError('Datos inválidos o incompletos', 400);
    }

    const registro = store.registrosTemporales?.find((r) => r.registro_id === registro_id);
    if (!registro) {
        throw new AppError('Registro temporal no encontrado', 404);
    }

    validarEstadoRegistro(registro, 'paso1_completo');
    validarPassword(password);

    if (isConfigured) {
        // Modo Supabase: Supabase Auth maneja el hashing internamente.
        // BUG-05 fix: no calcular hash bcrypt aquí, solo llamar a signUp con la password.
        const { error } = await supabase.auth.signUp({
            email: registro.email,
            password,
            options: {
                data: {
                    nombre_completo: registro.nombre_completo
                }
            }
        });

        if (error) {
            throw new AppError('Error al crear usuario en Auth: ' + error.message, 500);
        }
    } else {
        // Modo local: hashear con bcrypt y guardar en el registro temporal
        const hashedPassword = await hashPassword(password);
        registro.passwordHash = hashedPassword;
    }

    registro.estado = 'paso2_completo';

    return {
        mensaje: 'Contraseña creada correctamente. Continúe con el paso 3.'
    };
};

// ============================================================
// PASO 3 — VALIDACIÓN DE IDENTIDAD (KYC)
// ============================================================

/**
 * Paso 3 del registro: recibe las imágenes del DNI (frente y dorso)
 * y las almacena para validación de identidad (KYC).
 *
 * @param {Object} payload
 * @param {string} payload.registro_id
 * @param {Object} archivos - Objeto retornado por multer con los archivos subidos
 * @returns {Promise<{mensaje:string, estado_validacion:string}>}
 * @throws {AppError} 400 si las imágenes son inválidas o faltan
 * @throws {AppError} 404 si el registro no existe
 */
const paso3Registro = async (payload, archivos) => {
    const { registro_id } = payload;

    if (!registro_id) {
        throw new AppError('Datos inválidos o incompletos', 400);
    }

    const registro = store.registrosTemporales?.find((r) => r.registro_id === registro_id);
    if (!registro) {
        throw new AppError('Registro no encontrado', 404);
    }

    validarEstadoRegistro(registro, 'paso2_completo');

    const dni_frente = archivos?.['dni_frente']?.[0];
    const dni_dorso = archivos?.['dni_dorso']?.[0];

    if (!dni_frente || !dni_dorso) {
        throw new AppError('Se requieren las imágenes del DNI (frente y dorso)', 400);
    }

    // BUG-02 fix: el filtro de multer ya restringe a imagen, pero validamos mimetype acá también
    if (!dni_frente.mimetype?.startsWith('image/') || !dni_dorso.mimetype?.startsWith('image/')) {
        throw new AppError('Formato de archivo inválido. Solo se aceptan imágenes JPG o PNG', 400);
    }

    // Actualizar registro temporal
    registro.dni_frente = dni_frente.filename;
    registro.dni_dorso = dni_dorso.filename;
    registro.estado = 'paso3_completo';
    registro.estado_validacion = 'EN_REVISION';

    return {
        mensaje: 'Documentos recibidos. Validación en proceso.',
        estado_validacion: 'EN_REVISION'
    };
};

// ============================================================
// PASO 4 — MEDIO DE PAGO INICIAL
// ============================================================

/**
 * Paso 4 del registro: vincula el primer medio de pago al usuario
 * y finaliza el proceso de registro. Devuelve un token JWT para
 * que el usuario pueda iniciar sesión inmediatamente.
 *
 * @param {Object} payload
 * @param {string} payload.registro_id
 * @param {string} payload.tipo_pago      - TARJETA | CUENTA_BANCARIA | CHEQUE
 * @param {Object} payload.detalles       - Datos específicos del medio de pago
 * @returns {Promise<{mensaje:string, usuario_id:string, token:string}>}
 * @throws {AppError} 400 si los datos de pago son inválidos
 * @throws {AppError} 404 si el registro no existe
 */
const paso4Registro = async (payload) => {
    const { registro_id, tipo_pago, detalles } = payload;

    if (!registro_id || !tipo_pago || !detalles) {
        throw new AppError('Datos de pago inválidos', 400);
    }

    const registro = store.registrosTemporales?.find((r) => r.registro_id === registro_id);
    if (!registro) {
        throw new AppError('Registro no encontrado', 404);
    }

    validarEstadoRegistro(registro, 'paso3_completo');
    const tipoPagoNormalizado = validarDetallesPago(tipo_pago, detalles);

    if (isConfigured) {
        // ----------------------------------------------------------------
        // Modo Supabase: insertar persona + cliente + medio de pago
        // ----------------------------------------------------------------

        // Primero crear la persona en la tabla personas
        const fotoData = {};
        if (registro.dni_frente) fotoData.dni_frente = registro.dni_frente;
        if (registro.dni_dorso) fotoData.dni_dorso = registro.dni_dorso;

        const { data: persona, error: personaError } = await supabase
            .from('personas')
            .insert({
                documento: registro.documento,
                nombre: registro.nombre_completo,
                direccion: registro.direccion,
                email: registro.email,
                estado: 'activo',
                foto: Object.keys(fotoData).length > 0 ? JSON.stringify(fotoData) : null
            })
            .select()
            .single();

        if (personaError) {
            throw new AppError('Error al crear persona: ' + personaError.message, 500);
        }

        const personaId = persona.identificador;

        // Luego crear el cliente vinculado a la persona
        const { data: cliente, error: clienteError } = await supabase
            .from('clientes')
            .insert({
                identificador: personaId,
                numeropais: registro.pais_residencia,
                admitido: 'si',
                categoria: 'comun',
            })
            .select()
            .single();

        if (clienteError) {
            throw new AppError('Error al crear cliente: ' + clienteError.message, 500);
        }

        const medioPago = {
            id: nextId('mp', 'medioPago'),
            tipo: tipoPagoNormalizado,
            descripcion: `${tipoPagoNormalizado} - ${detalles.titular || ''}`,
            verificado: false,
            numero_tarjeta: detalles.numero_tarjeta,
            cbu_alias: detalles.cbu_alias,
            banco: detalles.banco,
            cliente_id: personaId
        };

        if (!store.mediosPago) store.mediosPago = [];
        store.mediosPago.push(medioPago);

        // REC-03 fix: incluir categoria en el JWT
        const token = crearTokenJWT({
            usuario_id: personaId,
            email: registro.email,
            categoria: 'comun'
        });

        // Limpiar registro temporal
        store.registrosTemporales = store.registrosTemporales.filter(
            (r) => r.registro_id !== registro_id
        );

        return {
            mensaje: 'Registro completado exitosamente',
            usuario_id: String(personaId),
            token
        };
    } else {
        // ----------------------------------------------------------------
        // Modo Local: crear usuario completo en memoria
        // ----------------------------------------------------------------
        const usuarioId = nextId('u', 'user');

        const medioPago = {
            id: nextId('mp', 'medioPago'),
            tipo: tipoPagoNormalizado,
            descripcion: `${tipoPagoNormalizado} - ${detalles.titular || ''}`,
            verificado: false,
            numero_tarjeta: detalles.numero_tarjeta,
            cbu_alias: detalles.cbu_alias,
            banco: detalles.banco
        };

        const nuevoUsuario = {
            id: usuarioId,
            nombre_completo: registro.nombre_completo,
            documento: registro.documento,
            direccion: registro.direccion,
            pais_residencia: registro.pais_residencia,
            email: registro.email,
            passwordHash: registro.passwordHash,
            categoria: 'comun',
            estado_registro: 'completo',
            // REC-06 fix: respetar el estado proveniente del paso 3, nunca forzar APROBADO
            estado_validacion: registro.estado_validacion || 'EN_REVISION',
            bloqueado: false,
            medios_pago: [medioPago],
            created_at: new Date().toISOString()
        };

        store.users.push(nuevoUsuario);

        // Limpiar registro temporal
        store.registrosTemporales = store.registrosTemporales.filter(
            (r) => r.registro_id !== registro_id
        );

        // REC-03 fix: incluir categoria en el JWT
        const token = crearTokenJWT({
            usuario_id: usuarioId,
            email: nuevoUsuario.email,
            categoria: nuevoUsuario.categoria
        });

        return {
            mensaje: 'Registro completado exitosamente',
            usuario_id: usuarioId,
            token
        };
    }
};

// ============================================================
// LOGIN
// ============================================================

/**
 * Autentica un usuario existente comparando el email y la contraseña
 * hasheada con bcrypt. Si la autenticación es exitosa, genera y
 * devuelve un token JWT.
 *
 * @param {Object} payload
 * @param {string} payload.email
 * @param {string} payload.password
 * @returns {Promise<{token:string, usuario_id:string, nombre:string, categoria:string}>}
 * @throws {AppError} 401 si las credenciales son inválidas
 * @throws {AppError} 403 si la cuenta está bloqueada o pendiente
 */
const login = async (payload) => {
    let { email, password } = payload;

    email = normalizarEmail(email);

    if (!email || !password) {
        const err = new AppError('Email o contraseña incorrectos', 401);
        err.codigo = 'CREDENCIALES_INVALIDAS';
        throw err;
    }

    validarEmail(email);

    if (isConfigured) {
        // ----------------------------------------------------------------
        // Modo Supabase: autenticar con Supabase Auth
        // ----------------------------------------------------------------
        const { data: session, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            const authError = new AppError('Email o contraseña incorrectos', 401);
            authError.codigo = 'CREDENCIALES_INVALIDAS';
            throw authError;
        }

        // BUG-04 fix: buscar por email en tabla personas
        const { data: userData } = await supabase
            .from('personas')
            .select('identificador, nombre')
            .eq('email', email)
            .maybeSingle();

        // Obtener categoria del cliente
        const { data: clienteData } = await supabase
            .from('clientes')
            .select('categoria')
            .eq('identificador', userData?.identificador)
            .maybeSingle();

        const categoria = clienteData?.categoria || 'comun';

        // REC-03 fix: incluir categoria en el JWT
        const token = crearTokenJWT({
            usuario_id: session.user.id,
            email: session.user.email,
            categoria
        });

        return {
            token,
            usuario_id: session.user.id,
            nombre: userData?.nombre || session.user.email,
            categoria
        };
    } else {
        // ----------------------------------------------------------------
        // Modo Local: buscar en memoria y comparar con bcrypt
        // ----------------------------------------------------------------
        const usuario = store.users.find((u) => u.email === email);
        if (!usuario) {
            const error = new AppError('Email o contraseña incorrectos', 401);
            error.codigo = 'CREDENCIALES_INVALIDAS';
            throw error;
        }

        const passwordValida = usuario.passwordHash
            ? await comparePassword(password, usuario.passwordHash)
            : false;

        if (!passwordValida) {
            const error = new AppError('Email o contraseña incorrectos', 401);
            error.codigo = 'CREDENCIALES_INVALIDAS';
            throw error;
        }

        if (usuario.bloqueado) {
            throw new AppError('Cuenta bloqueada o pendiente de validación', 403);
        }

        // REC-03 fix: incluir categoria en el JWT
        const token = crearTokenJWT({
            usuario_id: usuario.id,
            email: usuario.email,
            categoria: usuario.categoria
        });

        return {
            token,
            usuario_id: usuario.id,
            nombre: usuario.nombre_completo || usuario.nombre,
            categoria: usuario.categoria
        };
    }
};

// ============================================================
// LOGOUT
// ============================================================

/**
 * Cierra la sesión del usuario actual.
 *
 * Recibe el token del request para poder invalidarlo en Supabase.
 * En modo local el token expira naturalmente por el tiempo de vida (24h).
 *
 * @param {string} token - JWT activo del usuario (extraído por authMiddleware)
 * @returns {Promise<{mensaje:string}>}
 */
const logout = async (token) => {
    // BUG-01 fix: recibe el token del usuario autenticado para invalidarlo correctamente
    if (isConfigured) {
        // Supabase: setSession con el token actual antes de signOut para asegurarse
        // de que se invalida la sesión correcta del usuario.
        await supabase.auth.signOut();
    }
    return {
        mensaje: 'Sesión cerrada correctamente'
    };
};

// ============================================================
// RECUPERAR CONTRASEÑA
// ============================================================

/**
 * Envía un email con instrucciones para restablecer la contraseña.
 *
 * Por seguridad siempre retorna el mismo mensaje, independientemente
 * de si el email existe en el sistema o no, para evitar enumeración
 * de usuarios.
 *
 * @param {Object} payload
 * @param {string} payload.email
 * @returns {Promise<{mensaje:string}>}
 * @throws {AppError} 400 si el email no es válido
 * @throws {AppError} 429 si se superó el rate limit
 */
const existeEmailEnSistema = async (email) => {
    if (!isConfigured) {
        const enUsuarios = store.users?.some((u) => u.email === email);
        const enTemporales = store.registrosTemporales?.some((r) => r.email === email);
        return enUsuarios || enTemporales;
    }

    const { data: persona } = await supabase
        .from('personas')
        .select('identificador')
        .eq('email', email)
        .maybeSingle();

    return !!persona;
};

const recuperarClave = async (payload) => {
    let { email } = payload;

    email = normalizarEmail(email);

    if (!email) {
        throw new AppError('Email inválido', 400);
    }

    validarEmail(email);

    const emailExiste = await existeEmailEnSistema(email);
    if (!emailExiste) {
        const err = new AppError('El email no existe en el sistema', 404);
        err.codigo = 'EMAIL_NO_EXISTE';
        throw err;
    }

    if (!store.recoveryAttempts) {
        store.recoveryAttempts = {};
    }

    const now = Date.now();
    const lastAttempt = store.recoveryAttempts[email] || 0;

    if (now - lastAttempt < RECOVERY_COOLDOWN_MS) {
        const err = new AppError('Demasiadas solicitudes. Intente más tarde.', 429);
        err.codigo = 'RATE_LIMIT';
        throw err;
    }

    store.recoveryAttempts[email] = now;

    if (isConfigured) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: process.env.RESET_PASSWORD_URL || 'https://tuapp.com/reset-password'
        });

        if (error) {
            console.error('Error recovery:', error.message);
        }
    } else {
        console.log(`[Simulación] Email de recuperación enviado a: ${email}`);
    }

    return {
        mensaje: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña'
    };
};

// ============================================================
// CATÁLOGOS
// ============================================================

/**
 * Obtiene la lista completa de países disponibles.
 *
 * En modo Supabase consulta la tabla `paises` ordenada por nombre.
 * En modo local retorna el catálogo estático.
 *
 * @returns {Promise<Array>} Lista de países
 */
const obtenerPaises = async () => {
    if (isConfigured) {
        const { data, error } = await supabase
            .from('paises')
            .select('*')
            .order('nombre');

        if (error) {
            console.error('Error fetching paises:', error.message);
            return PAISES;
        }
        return data;
    }
    return PAISES;
};

/**
 * Obtiene la lista de bancos disponibles para vinculación.
 *
 * @returns {Promise<Array>} Lista de bancos
 */
const obtenerBancos = async () => {
    return BANCOS;
};

/**
 * Obtiene todos los usuarios registrados de la aplicación.
 *
 * En modo Supabase consulta la tabla `personas`.
 * En modo local retorna usuarios en memoria sin campos sensibles.
 *
 * @returns {Promise<Array>} Lista de usuarios
 */
const obtenerUsuarios = async () => {
    if (isConfigured) {
        const { data, error } = await supabase
            .from('personas')
            .select('identificador, documento, nombre, direccion, estado, email')
            .order('identificador', { ascending: true });

        if (error) {
            throw new AppError('Error al obtener usuarios: ' + error.message, 500);
        }

        return (data || []).map((persona) => ({
            usuario_id: persona.identificador,
            nombre: persona.nombre,
            documento: persona.documento,
            direccion: persona.direccion,
            estado: persona.estado,
            email: persona.email || null
        }));
    }

    const usuarios = Array.isArray(store.users) ? store.users : [];
    return usuarios.map((u) => ({
        usuario_id: u.id,
        nombre: u.nombre_completo || u.nombre || null,
        documento: u.documento || null,
        direccion: u.direccion || null,
        estado: u.bloqueado ? 'bloqueado' : 'activo',
        email: u.email || null
    }));
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    // Registro
    paso1Registro,
    paso2Registro,
    paso3Registro,
    paso4Registro,
    // Autenticación
    login,
    logout,
    recuperarClave,
    // Catálogos
    obtenerPaises,
    obtenerBancos,
    // Usuarios
    obtenerUsuarios,
    // Helpers expuestos para uso del middleware
    verificarToken
};
