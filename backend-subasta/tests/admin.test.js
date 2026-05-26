const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

process.env.SUPABASE_ENABLED = 'false';

const adminService = require('../src/services/admin.service');
const authService = require('../src/services/auth.service');
const { store } = require('../src/services/data.store');

const originalUsers = JSON.parse(JSON.stringify(store.users));

const crearUsuarioPendiente = async ({ id, email }) => {
    const passwordHash = await bcrypt.hash('Test1234!', 10);
    return {
        id,
        nombre_completo: 'Usuario Test',
        email,
        passwordHash,
        categoria: null,
        estado_registro: 'completo',
        estado_validacion: 'EN_REVISION',
        bloqueado: true,
        medios_pago: [],
        created_at: new Date().toISOString()
    };
};

test.beforeEach(() => {
    store.users = JSON.parse(JSON.stringify(originalUsers));
});

test('evaluarCliente admite usuario y permite login', async () => {
    const nuevo = await crearUsuarioPendiente({ id: 'u-admin-1', email: 'pendiente@rematix.com' });
    store.users.push(nuevo);

    const evaluacion = await adminService.evaluarCliente({
        id: 'u-admin-1',
        payload: { admitido: 'si', categoria: 'oro' }
    });

    assert.equal(evaluacion.admitido, 'si');
    assert.equal(evaluacion.categoria, 'oro');

    const login = await authService.login({ email: 'pendiente@rematix.com', password: 'Test1234!' });
    assert.ok(login.token);
    assert.equal(login.categoria, 'oro');
});

test('evaluarCliente rechaza usuario y bloquea login', async () => {
    const nuevo = await crearUsuarioPendiente({ id: 'u-admin-2', email: 'rechazado@rematix.com' });
    store.users.push(nuevo);

    const evaluacion = await adminService.evaluarCliente({
        id: 'u-admin-2',
        payload: { admitido: 'no' }
    });

    assert.equal(evaluacion.admitido, 'no');

    await assert.rejects(
        () => authService.login({ email: 'rechazado@rematix.com', password: 'Test1234!' }),
        (err) => err.statusCode === 403 && err.codigo === 'USUARIO_EN_REVISION'
    );
});
