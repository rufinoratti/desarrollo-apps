const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_ENABLED = 'false';

const authService = require('../src/services/auth.service');
const { store } = require('../src/services/data.store');

test.beforeEach(() => {
    store.recoveryAttempts = {};
    store.resetTokens = {};
});

test('recuperarClave rechaza email que no existe', async () => {
    await assert.rejects(
        () => authService.recuperarClave({ email: 'noexiste@test.com' }),
        (err) => err.statusCode === 404 && err.codigo === 'EMAIL_NO_EXISTE'
    );
});

test('recuperarClave acepta email que existe', async () => {
    const result = await authService.recuperarClave({ email: 'ada@rematix.com' });

    assert.equal(result.mensaje, 'Si el email existe, recibirás instrucciones para restablecer tu contraseña');
});

test('recuperarClave retorna resetToken en modo local', async () => {
    const result = await authService.recuperarClave({ email: 'ada@rematix.com' });

    assert.ok(result.resetToken);
    assert.ok(result.email, 'ada@rematix.com');
});

test('recuperarClave guarda resetToken en store', async () => {
    await authService.recuperarClave({ email: 'ada@rematix.com' });

    assert.ok(store.resetTokens['ada@rematix.com']);
    assert.ok(store.resetTokens['ada@rematix.com'].token);
    assert.ok(store.resetTokens['ada@rematix.com'].expires > Date.now());
});

test('recuperarClave acepta email que existe (mayúsculas)', async () => {
    const result = await authService.recuperarClave({ email: 'ADA@rematix.com' });

    assert.equal(result.mensaje, 'Si el email existe, recibirás instrucciones para restablecer tu contraseña');
});

test('recuperarClave acepta email con espacios', async () => {
    const result = await authService.recuperarClave({ email: '  ada@rematix.com  ' });

    assert.equal(result.mensaje, 'Si el email existe, recibirás instrucciones para restablecer tu contraseña');
});

// ============================================================
// RESTABLECER CLAVE (con token)
// ============================================================

test('restablecerClave rechaza datos incompletos', async () => {
    await assert.rejects(
        () => authService.restablecerClave({}),
        (err) => err.statusCode === 400
    );
    await assert.rejects(
        () => authService.restablecerClave({ email: 'test@test.com' }),
        (err) => err.statusCode === 400
    );
    await assert.rejects(
        () => authService.restablecerClave({ email: 'test@test.com', token: 'x' }),
        (err) => err.statusCode === 400
    );
});

test('restablecerClave rechaza token inválido', async () => {
    await assert.rejects(
        () => authService.restablecerClave({
            email: 'ada@rematix.com',
            token: 'token-invalido',
            newPassword: 'NuevaPass1'
        }),
        (err) => err.statusCode === 401 && err.codigo === 'TOKEN_INVALIDO'
    );
});

test('restablecerClave actualiza contraseña con token válido', async () => {
    const recovery = await authService.recuperarClave({ email: 'ada@rematix.com' });

    const result = await authService.restablecerClave({
        email: recovery.email,
        token: recovery.resetToken,
        newPassword: 'NuevaClave1'
    });

    assert.equal(result.mensaje, 'Contraseña restablecida correctamente');
});

test('restablecerClave verifica que el nuevo password funciona', async () => {
    const recovery = await authService.recuperarClave({ email: 'ada@rematix.com' });

    await authService.restablecerClave({
        email: recovery.email,
        token: recovery.resetToken,
        newPassword: 'NuevaClave1'
    });

    const login = await authService.login({ email: 'ada@rematix.com', password: 'NuevaClave1' });
    assert.ok(login.token);
});

test('restablecerClave rechaza token expirado', async () => {
    const recovery = await authService.recuperarClave({ email: 'ada@rematix.com' });

    store.resetTokens['ada@rematix.com'].expires = Date.now() - 1;

    await assert.rejects(
        () => authService.restablecerClave({
            email: recovery.email,
            token: recovery.resetToken,
            newPassword: 'NuevaClave1'
        }),
        (err) => err.statusCode === 401 && err.codigo === 'TOKEN_INVALIDO'
    );
});

test('restablecerClave rechaza contraseña débil', async () => {
    const recovery = await authService.recuperarClave({ email: 'ada@rematix.com' });

    await assert.rejects(
        () => authService.restablecerClave({
            email: recovery.email,
            token: recovery.resetToken,
            newPassword: 'corta'
        }),
        (err) => err.statusCode === 400
    );
});