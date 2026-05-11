const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_ENABLED = 'false';

const authService = require('../src/services/auth.service');
const { store } = require('../src/services/data.store');

test.beforeEach(() => {
    store.recoveryAttempts = {};
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

test('recuperarClave acepta email que existe (mayúsculas)', async () => {
    const result = await authService.recuperarClave({ email: 'ADA@rematix.com' });

    assert.equal(result.mensaje, 'Si el email existe, recibirás instrucciones para restablecer tu contraseña');
});

test('recuperarClave acepta email con espacios', async () => {
    const result = await authService.recuperarClave({ email: '  ada@rematix.com  ' });

    assert.equal(result.mensaje, 'Si el email existe, recibirás instrucciones para restablecer tu contraseña');
});