import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'i101' }),
  router: { back: jest.fn(), push: jest.fn() },
}));

jest.mock('@/src/context/AuthContext', () => ({
  useAuth: () => ({ token: 'fake-token', removeToken: jest.fn() }),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => <>{children}</>,
}));

const mockItemDetail = {
  id: 'i101',
  numero_pieza: '101',
  descripcion: 'Cuadro abstracto original',
  descripcion_detallada: 'Impresionante obra de arte abstracto contemporáneo.',
  precio_base: 10000,
  ultima_oferta: 15000,
  estado: 'DISPONIBLE',
  imagenes: ['https://picsum.photos/seed/arte1/400/600', 'https://picsum.photos/seed/arte2/400/600'],
  ficha_tecnica: {
    'Técnica': 'Óleo y acrílico sobre lienzo',
    'Dimensiones': '120 × 80 cm',
    'Año': '2023',
  },
  duenio_nombre: 'Galería de Arte Moderno',
  subasta: {
    id: 's1',
    titulo: 'Subasta de Arte Contemporáneo',
    estado: 'EN_VIVO',
    fecha_fin: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
  },
  tiempo_restante_segundos: 72 * 60 * 60,
};

const mockPujasState = {
  item_id: 'i101',
  oferta_actual: 15500,
  estado_subasta: 'ABIERTA',
  tiempo_restante_segundos: 71 * 60 * 60,
  total_participantes: 3,
  historial_pujas: [
    { monto: 15500, fecha_hora: null, postor: 'Postor #3' },
    { monto: 15200, fecha_hora: null, postor: 'Postor #2' },
    { monto: 15000, fecha_hora: null, postor: 'Postor #1' },
  ],
};

let ProductoScreen: any;

describe('ProductoScreen', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    ProductoScreen = require('../app/producto/[id]').default;
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn((url: string) => {
      if (url.includes('/pujas')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockPujasState),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockItemDetail),
      });
    }) as jest.Mock;
  });

  it('renderiza el header con logo REMATIX', async () => {
    render(<ProductoScreen />);

    const rematixText = await screen.findByText('REMATIX', {}, { timeout: 3000 });
    expect(rematixText).toBeTruthy();
  });

  it('muestra el título del producto después de cargar', async () => {
    render(<ProductoScreen />);

    const titulo = await screen.findByText('Cuadro abstracto original', {}, { timeout: 3000 });
    expect(titulo).toBeTruthy();
  });

  it('muestra el número de lote', async () => {
    render(<ProductoScreen />);

    const lote = await screen.findByText('LOTE #101', {}, { timeout: 3000 });
    expect(lote).toBeTruthy();
  });

  it('muestra el nombre del dueño', async () => {
    render(<ProductoScreen />);

    const duenio = await screen.findByText('Galería de Arte Moderno', {}, { timeout: 3000 });
    expect(duenio).toBeTruthy();
  });

  it('muestra la oferta actual', async () => {
    render(<ProductoScreen />);

    const ofertas = await screen.findAllByText('$ 15.500', {}, { timeout: 3000 });
    expect(ofertas.length).toBeGreaterThanOrEqual(1);
  });

  it('muestra la ficha técnica', async () => {
    render(<ProductoScreen />);

    const fichaTitulo = await screen.findByText('FICHA TÉCNICA', {}, { timeout: 3000 });
    expect(fichaTitulo).toBeTruthy();

    const tecnica = await screen.findByText('Óleo y acrílico sobre lienzo', {}, { timeout: 3000 });
    expect(tecnica).toBeTruthy();
  });

  it('muestra el historial de pujas', async () => {
    render(<ProductoScreen />);

    const historialTitulo = await screen.findByText('HISTORIAL DE PUJAS', {}, { timeout: 3000 });
    expect(historialTitulo).toBeTruthy();
  });

  it('llama a /api/items/:id al cargar', async () => {
    render(<ProductoScreen />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/items/i101'),
        expect.any(Object)
      );
    });
  });

  it('llama a /api/items/:id/pujas al cargar (polling)', async () => {
    render(<ProductoScreen />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/items/i101/pujas'),
        expect.any(Object)
      );
    });
  });
});
