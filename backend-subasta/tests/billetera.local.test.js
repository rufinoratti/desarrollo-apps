const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_ENABLED = 'false';

const billeteraService = require('../src/services/billetera.service');
const { store } = require('../src/services/data.store');

const authUser = { id: 'u1', email: 'ada@rematix.com' };

test('listarMediosPago devuelve medios del usuario autenticado', async () => {
    const result = await billeteraService.listarMediosPago(authUser);
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 1);
    assert.ok(result[0].id);
    assert.ok(result[0].tipo_pago);
});

test('agregarMedioPago CUENTA_BANCARIA agrega medio y devuelve 201 payload', async () => {
    const before = (store.users.find((u) => u.id === authUser.id)?.medios_pago || []).length;

    const result = await billeteraService.agregarMedioPago(authUser, {
        tipo_pago: 'CUENTA_BANCARIA',
        moneda: 'ARS',
        detalles: {
            cbu_alias: '0170001234567890123456',
            banco: 'Banco Galicia',
            titular: 'Ada Lovelace'
        }
    });

    const after = (store.users.find((u) => u.id === authUser.id)?.medios_pago || []).length;
    assert.equal(after, before + 1);
    assert.ok(result.id);
    assert.equal(result.estado, 'VERIFICADA');
});

test('eliminarMedioPago no permite eliminar único medio de pago', async () => {
    const user = {
        id: 'u_test_unico',
        email: 'u_test_unico@rematix.com',
        medios_pago: [
            {
                id: 'mp-unico',
                tipo: 'cuenta_bancaria',
                verificado: 'si',
                es_principal: 'si',
                detalles_enmascarados: 'Banco X - CBU/Alias **** 1234',
                moneda: 'ARS',
                limite_garantia: 0
            }
        ]
    };

    store.users.push(user);

    await assert.rejects(
        () => billeteraService.eliminarMedioPago({ id: 'u_test_unico', email: user.email }, 'mp-unico'),
        (err) => err.statusCode === 400 && err.codigo === 'UNICO_MEDIO_PAGO'
    );
});

test('verificarLimiteCheque bloquea oferta cuando supera garantía', () => {
    assert.throws(
        () => billeteraService.verificarLimiteCheque({
            medioPago: { tipo: 'cheque', limite_garantia: 1000 },
            ofertaActual: 950,
            comision: 100
        }),
        (err) => err.statusCode === 400 && err.codigo === 'LIMITE_GARANTIA_EXCEDIDO'
    );
});

test('tieneMedioCompatibleMoneda retorna false en USD si no tiene medio USD/AMBAS', async () => {
    const user = {
        id: 'u_test_moneda',
        email: 'u_test_moneda@rematix.com',
        medios_pago: [
            {
                id: 'mp-ars',
                tipo: 'cuenta_bancaria',
                verificado: 'si',
                es_principal: 'si',
                detalles_enmascarados: 'Banco AR - CBU/Alias **** 4321',
                moneda: 'ARS',
                limite_garantia: 0
            }
        ]
    };

    store.users.push(user);

    const ok = await billeteraService.tieneMedioCompatibleMoneda({
        authUser: { id: 'u_test_moneda', email: user.email },
        monedaSubasta: 'USD'
    });

    assert.equal(ok, false);
});
