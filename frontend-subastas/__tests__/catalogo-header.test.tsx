import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '123', titulo: 'Subasta Test' }),
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

let CatalogoScreen: any;

describe('CatalogoScreen header', () => {
  beforeAll(() => {
    CatalogoScreen = require('../app/catalogo/[id]').default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            subasta_info: { id: '123', titulo: 'Subasta Test', estado: 'ACTIVA' },
            articulos: [],
          }),
      })
    ) as jest.Mock;
  });

  it('renderiza el header con logo REMATIX despues de cargar', async () => {
    render(<CatalogoScreen />);

    const rematixText = await screen.findByText('REMATIX', {}, { timeout: 3000 });
    expect(rematixText).toBeTruthy();
  });

  it('muestra la lista vacía despues de cargar', async () => {
    render(<CatalogoScreen />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/subastas/123/catalogo'),
        expect.any(Object)
      );
    });
  });
});
