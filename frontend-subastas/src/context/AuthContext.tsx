import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import { router, usePathname } from 'expo-router';

const TOKEN_KEY = 'auth_token';
const NOMBRE_KEY = 'auth_nombre';
const NIVEL_KEY = 'auth_nivel';

interface AuthContextData {
  token: string | null;
  nombre: string | null;
  nivel: string | null;
  isLoading: boolean;
  saveToken: (token: string, nombre: string, nivel?: string) => Promise<void>;
  removeToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

// Public routes must be matched carefully: '/' is only the splash route.
const publicRoutes = [
  '/',
  '/(auth)/onboarding',
  '/(auth)/login',
  '/(auth)/registro/paso1',
  '/(auth)/registro/paso2',
  '/(auth)/registro/paso3',
  '/(auth)/registro/paso4-pago',
];

function useAuthRedirect(token: string | null, isLoading: boolean) {
  const pathname = usePathname();
  const didRedirect = useRef(false);

  useEffect(() => {
    if (token) didRedirect.current = false;
  }, [token]);

  useEffect(() => {
    if (isLoading) return;
    if (didRedirect.current) return;

    if (!token) {
      const isPublic = publicRoutes.some((r) => (r === '/' ? pathname === '/' : pathname.startsWith(r)));
      if (!isPublic) {
        didRedirect.current = true;
        router.replace('/(auth)/login');
      }
    }
  }, [token, isLoading, pathname]);
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [nombre, setNombre] = useState<string | null>(null);
  const [nivel, setNivel] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadToken = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        const storedNombre = await SecureStore.getItemAsync(NOMBRE_KEY);
        const storedNivel = await SecureStore.getItemAsync(NIVEL_KEY);
        if (storedToken) {
          setToken(storedToken);
          setNombre(storedNombre);
          setNivel(storedNivel);
        }
      } catch {
        // Ignorar errores de lectura
      } finally {
        setIsLoading(false);
      }
    };
    loadToken();
  }, []);

  const saveToken = useCallback(async (newToken: string, newNombre: string, newNivel?: string) => {
    setToken(newToken);
    setNombre(newNombre);
    if (newNivel) setNivel(newNivel);
    await SecureStore.setItemAsync(TOKEN_KEY, newToken);
    await SecureStore.setItemAsync(NOMBRE_KEY, newNombre);
    if (newNivel) await SecureStore.setItemAsync(NIVEL_KEY, newNivel);
  }, []);

  const removeToken = useCallback(async () => {
    setToken(null);
    setNombre(null);
    setNivel(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(NOMBRE_KEY);
    await SecureStore.deleteItemAsync(NIVEL_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ token, nombre, nivel, isLoading, saveToken, removeToken }}>
      <AuthGuard token={token} isLoading={isLoading}>
        {children}
      </AuthGuard>
    </AuthContext.Provider>
  );
};

function AuthGuard({ token, isLoading, children }: { token: string | null; isLoading: boolean; children: ReactNode }) {
  useAuthRedirect(token, isLoading);
  return <>{children}</>;
}

export const useAuth = () => useContext(AuthContext);
