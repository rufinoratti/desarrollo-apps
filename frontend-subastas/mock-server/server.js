const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: path.join(__dirname, 'uploads') });
const DELAY = 1000;

// ========================
// MODULO 1
// ========================

app.get('/paises', (req, res) => {
    setTimeout(() => {
        res.json([
            { id: 1, nombre: 'Argentina' },
            { id: 2, nombre: 'Brasil' },
            { id: 3, nombre: 'Chile' }
        ]);
    }, DELAY);
});

app.get('/bancos', (req, res) => {
    setTimeout(() => res.json([{ id: 1, nombre: 'Banco Galicia', codigo: '007' }]), DELAY);
});

app.post('/auth/registro/paso1', (req, res) => {
    const { email } = req.body;
    setTimeout(() => {
        if (email === 'duplicado@mail.com') return res.status(400).json({ error: 'Email ya registrado', codigo: 'EMAIL_DUPLICADO' });
        res.status(201).json({ registro_id: 105, mensaje: 'OK' });
    }, DELAY);
});

app.post('/auth/registro/paso2', (req, res) => {
    setTimeout(() => res.status(200).json({ mensaje: 'OK' }), DELAY);
});

app.post('/auth/registro/paso3', upload.any(), (req, res) => {
    setTimeout(() => res.status(200).json({ mensaje: 'OK', estado_validacion: 'EN_REVISION' }), DELAY);
});

app.post('/auth/registro/paso4-pago', (req, res) => {
    setTimeout(() => res.status(201).json({ mensaje: 'OK', token: 'mock-jwt-token', nivel: 'BASE' }), DELAY);
});

app.post('/auth/login', (req, res) => {
    const { email, password } = req.body;
    setTimeout(() => {
        if (email === 'usuario@mail.com' && password === 'MiClave123!') {
            res.status(200).json({ token: 'mock-jwt-token', usuario_id: 'uuid', nombre: 'Milagros Peledrotti', nivel: 'PLATINO' });
        } else {
            res.status(401).json({ error: 'Email o contraseña incorrectos' });
        }
    }, DELAY);
});

// ========================
// MODULO 2
// ========================

const checkAuth = (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer mock-jwt-token')) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    next();
};

app.get('/categorias', checkAuth, (req, res) => {
    setTimeout(() => {
        res.status(200).json([
            { id: 1, nombre: 'ARTE' },
            { id: 2, nombre: 'JOYERÍA' },
            { id: 3, nombre: 'RELOJES' },
            { id: 4, nombre: 'VEHÍCULOS' },
            { id: 5, nombre: 'INMUEBLES' }
        ]);
    }, DELAY);
});

// ========================
// MODULO 3 - PERFIL
// ========================

app.get('/perfil', checkAuth, (req, res) => {
    setTimeout(() => {
        res.status(200).json({
            usuario: {
                id: 'uuid-user-001',
                nombre_completo: 'Milagros Peledrotti',
                email: 'usuario@mail.com',
                nivel: 'PLATINO',
                foto_url: null
            },
            datos_personales: {
                documento: '35111222',
                telefono: '+5491112345678',
                direccion: 'Av. Alvear 1820',
                pais_residencia: 'Argentina'
            },
            cuenta_cobro: {
                cbu_alias: '0170001234567890123456',
                banco: 'Banco Galicia'
            }
        });
    }, DELAY);
});

app.get('/perfil/restricciones', checkAuth, (req, res) => {
    setTimeout(() => {
        res.status(200).json({
            restriccion_activa: false,
            restriccion: null
        });
    }, DELAY);
});

app.put('/perfil', checkAuth, (req, res) => {
    const { nombre_completo, telefono, direccion } = req.body;
    setTimeout(() => {
        res.status(200).json({
            mensaje: 'Perfil actualizado',
            usuario: {
                id: 'uuid-user-001',
                nombre_completo: nombre_completo || 'Milagros Peledrotti',
                email: 'usuario@mail.com',
                nivel: 'PLATINO',
                foto_url: null
            },
            datos_personales: {
                documento: '35111222',
                telefono: telefono || '+5491112345678',
                direccion: direccion || 'Av. Alvear 1820',
                pais_residencia: 'Argentina'
            }
        });
    }, DELAY);
});

const SUB_IMAGES = [
  'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=800',
  'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?q=80&w=800',
  'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=800',
  'https://images.unsplash.com/photo-1541961017774-22349e4a1262?q=80&w=800',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=800',
  'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?q=80&w=800',
  'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?q=80&w=800',
  'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=800',
  'https://images.unsplash.com/photo-1583121274602-3e2820c69888?q=80&w=800',
  'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?q=80&w=800',
];

const todasLasSubastas = [];
for (let i = 0; i < 12; i++) {
  const catId = (i % 5) + 1;
  const catNombres = ['ARTE', 'JOYERÍA', 'RELOJES', 'VEHÍCULOS', 'INMUEBLES'];
  const niveles = ['BASE', 'BASE', 'ORO', 'ORO', 'PLATINO'];
  const estados = i % 3 === 2 ? 'PROXIMAMENTE' : 'EN_VIVO';
  todasLasSubastas.push({
    subasta_id: `uuid-sub-${String(i + 1).padStart(3, '0')}`,
    titulo: `${catNombres[catId - 1]} — Subasta Exclusiva #${i + 1}`,
    imagen_portada: SUB_IMAGES[i % SUB_IMAGES.length],
    cantidad_articulos: (i % 4) + 1,
    ubicacion: ['Buenos Aires, Argentina', 'Montevideo, Uruguay', 'Santiago, Chile', 'Bogotá, Colombia'][i % 4],
    estado: estados,
    nivel_requerido: niveles[i % 5],
    fecha_inicio: new Date(Date.now() + i * 86400000).toISOString(),
    fecha_fin: new Date(Date.now() + (i + 7) * 86400000).toISOString(),
    categoria_id: catId,
  });
}

app.get('/subastas', checkAuth, (req, res) => {
    const { categoria_id, pagina = 1, limite = 10 } = req.query;

    let filtradas = todasLasSubastas;
    if (categoria_id) {
        filtradas = filtradas.filter(s => s.categoria_id == categoria_id);
    }

    const total = filtradas.length;
    const totalPaginas = Math.ceil(total / limite);
    const start = ((pagina - 1) * limite);
    const paginadas = filtradas.slice(start, start + limite);

    setTimeout(() => {
        res.status(200).json({
            subastas: paginadas,
            total,
            pagina_actual: parseInt(pagina),
            total_paginas: totalPaginas
        });
    }, DELAY);
});

const articulosCatalogo = [];
const LOTES = [
  { titulo: 'Ferrari 488 GTB', img: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?q=80&w=600' },
  { titulo: 'Rolex Submariner', img: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?q=80&w=600' },
  { titulo: 'Diamante Rosa 5ct', img: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=600' },
  { titulo: 'Picasso Original', img: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?q=80&w=600' },
  { titulo: 'Lamborghini Huracán', img: 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?q=80&w=600' },
  { titulo: 'Patek Philippe Nautilus', img: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?q=80&w=600' },
  { titulo: 'Collar de Esmeraldas', img: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=600' },
  { titulo: 'Van Gogh Original', img: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?q=80&w=600' },
];
for (let i = 0; i < LOTES.length; i++) {
  articulosCatalogo.push({
    item_id: `uuid-item-${String(i + 1).padStart(3, '0')}`,
    numero_lote: `LOTE ${String(i + 1).padStart(3, '0')}`,
    titulo: LOTES[i].titulo,
    imagen_principal: LOTES[i].img,
    estado: i % 3 === 0 ? 'ACTIVA' : 'EN VIVO',
    tiempo_restante: `${(i + 1) * 2}h ${i * 15}m`,
    oferta_actual: 50000000 + (i * 2500000),
    es_favorito: i % 3 === 0,
  });
}

app.get('/subastas/:id/catalogo', checkAuth, (req, res) => {
    const { id } = req.params;
     const { q, orden } = req.query;

     let items = [...articulosCatalogo];
     if (q) {
       const lower = q.toLowerCase();
       items = items.filter(a => a.titulo.toLowerCase().includes(lower) || a.numero_lote.toLowerCase().includes(lower));
     }

     // Basic ordering support used by the client.
     if (orden === 'precio_asc') items.sort((a, b) => a.oferta_actual - b.oferta_actual);
     if (orden === 'precio_desc') items.sort((a, b) => b.oferta_actual - a.oferta_actual);

     setTimeout(() => {
         res.status(200).json({
             subasta_info: {
                 id: id,
                 titulo: 'Colección de Artículos de Lujo',
                 estado: 'EN_VIVO',
             },
             articulos: items,
             total_articulos: items.length,
         });
     }, DELAY);
});

// ========================
// MODULO 4 - PUJAS
// ========================

app.get('/pujas/actuales', checkAuth, (req, res) => {
  setTimeout(() => {
    res.status(200).json({
      pujas: [
        {
          puja_id: 'uuid-puja-001',
          item_id: 'uuid-item-001',
          subasta_id: 'uuid-sub-001',
          numero_lote: 'LOTE 001',
          titulo: 'Ferrari 488 GTB',
          imagen: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?q=80&w=600',
          monto_ofertado: 50500000,
          monto_actual: 50600000,
          es_ganadora: false,
          tiempo_restante: '01:31:50',
          estado_subasta: 'EN_VIVO',
        },
        {
          puja_id: 'uuid-puja-002',
          item_id: 'uuid-item-002',
          subasta_id: 'uuid-sub-002',
          numero_lote: 'LOTE 002',
          titulo: 'Rolex Submariner',
          imagen: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?q=80&w=600',
          monto_ofertado: 180000,
          monto_actual: 180000,
          es_ganadora: true,
          tiempo_restante: '02:12:25',
          estado_subasta: 'EN_VIVO',
        },
      ],
    });
  }, DELAY);
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Mock server corriendo en http://0.0.0.0:${PORT}`);
});
