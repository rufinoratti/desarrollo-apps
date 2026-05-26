import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import { router, usePathname } from 'expo-router';

const TOKEN_KEY = 'auth_token';
const NOMBRE_KEY = 'auth_nombre';
const NIVEL_KEY = 'auth_nivel';
const EMAIL_KEY = 'auth_email';
const PENDING_KEY = 'auth_pending';

interface AuthContextData {
  token: string | null;
  nombre: string | null;
  nivel: string | null;
  email: string | null;
  pending: boolean;
  isLoading: boolean;
  saveToken: (
    token: string | null,
    nombre: string,
    nivel?: string,
    options?: { pending?: boolean; email?: string | null }
  ) => Promise<void>;
  removeToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

// Public routes must be matched carefully: '/' is only the splash route.
const publicRoutes = [
  '/', '/(auth)/onboarding', '/(auth)/login',
  '/(auth)/recuperar-clave', '/(auth)/restablecer-clave',
  '/(auth)/registro/paso1', '/(auth)/registro/paso2',
  '/(auth)/registro/paso3', '/(auth)/registro/paso4-pago',
];

function useAuthRedirect(token: string | null, pending: boolean, isLoading: boolean) {
  const pathname = usePathname();
  const didRedirect = useRef(false);

  useEffect(() => {
    if (token) didRedirect.current = false;
  }, [token]);

  useEffect(() => {
    if (isLoading) return;
    if (didRedirect.current) return;

    if (pending && !token) {
      if (!pathname.startsWith('/(tabs)/perfil')) {
        didRedirect.current = true;
        router.replace('/(tabs)/perfil');
      }
      return;
    }

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
  const [email, setEmail] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadToken = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        const storedNombre = await SecureStore.getItemAsync(NOMBRE_KEY);
        const storedNivel = await SecureStore.getItemAsync(NIVEL_KEY);
        const storedEmail = await SecureStore.getItemAsync(EMAIL_KEY);
        const storedPending = await SecureStore.getItemAsync(PENDING_KEY);
        if (storedToken) {
          setToken(storedToken);
          setNombre(storedNombre);
          setNivel(storedNivel);
          setEmail(storedEmail);
          setPending(false);
        } else if (storedPending === 'true') {
          setPending(true);
          setNombre(storedNombre);
          setEmail(storedEmail);
        }
      } catch {
        // Ignorar errores de lectura
      } finally {
        setIsLoading(false);
      }
    };
    loadToken();
  }, []);

  const saveToken = useCallback(async (
    newToken: string | null,
    newNombre: string,
    newNivel?: string,
    options?: { pending?: boolean; email?: string | null }
  ) => {
    const isPending = Boolean(options?.pending);

    if (newToken) {
      setToken(newToken);
      setPending(false);
      await SecureStore.setItemAsync(TOKEN_KEY, newToken);
      await SecureStore.deleteItemAsync(PENDING_KEY);
    } else if (isPending) {
      setToken(null);
      setPending(true);
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.setItemAsync(PENDING_KEY, 'true');
    }

    setNombre(newNombre);
    if (newNivel) setNivel(newNivel);

    if (options?.email !== undefined) {
      setEmail(options.email || null);
      if (options.email) {
        await SecureStore.setItemAsync(EMAIL_KEY, options.email);
      } else {
        await SecureStore.deleteItemAsync(EMAIL_KEY);
      }
    }

    await SecureStore.setItemAsync(NOMBRE_KEY, newNombre);
    if (newNivel) {
      await SecureStore.setItemAsync(NIVEL_KEY, newNivel);
    } else {
      await SecureStore.deleteItemAsync(NIVEL_KEY);
    }
  }, []);

  const removeToken = useCallback(async () => {
    setToken(null);
    setNombre(null);
    setNivel(null);
    setEmail(null);
    setPending(false);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(NOMBRE_KEY);
    await SecureStore.deleteItemAsync(NIVEL_KEY);
    await SecureStore.deleteItemAsync(EMAIL_KEY);
    await SecureStore.deleteItemAsync(PENDING_KEY);
  }, []);

  return (
  <AuthContext.Provider value={{ token, nombre, nivel, email, pending, isLoading, saveToken, removeToken }}>
      <AuthGuard token={token} pending={pending} isLoading={isLoading}>
        {children}
      </AuthGuard>
    </AuthContext.Provider>
  );
};

function AuthGuard({
  token,
  pending,
  isLoading,
  children,
}: {
  token: string | null;
  pending: boolean;
  isLoading: boolean;
  children: ReactNode;
}) {
  useAuthRedirect(token, pending, isLoading);
  return <>{children}</>;
}

export const useAuth = () => useContext(AuthContext);
