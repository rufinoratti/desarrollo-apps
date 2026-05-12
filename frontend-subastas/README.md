# Frontend Subastas (REMATIX)

App en Expo + Expo Router con flujo de autenticacion/registro y pantallas de subastas.

## Requisitos

- Node.js + npm
- Expo CLI (via `npx expo`)

## Como iniciar

1. Instalar dependencias del frontend

```bash
npm install
```

2. Iniciar el mock server (API local)

```bash
npm run mock
```

El mock server corre en `http://0.0.0.0:3000`.

3. Configurar URL de API para el frontend

La app usa `EXPO_PUBLIC_API_URL` (si no esta seteada, usa el default definido en `src/config/env.ts`).

Ejemplo (recomendado):

```bash
export EXPO_PUBLIC_API_URL="http://TU_IP_LOCAL:3000"
```

Notas:

- En dispositivo fisico, `TU_IP_LOCAL` debe ser la IP de tu computadora en la red.
- En iOS Simulator normalmente funciona `http://localhost:3000`.
- En Android emulator suele ser `http://10.0.2.2:3000`.

4. Iniciar la app

```bash
npm run start
```

## Scripts

- `npm run start`: arranca Expo
- `npm run android`: abre en Android
- `npm run ios`: abre en iOS
- `npm run web`: abre en web
- `npm run lint`: ESLint
- `npm run test`: Jest
- `npm run mock`: mock server (Express)

## Estructura del proyecto

- `app/`: rutas (Expo Router)
- `app/_layout.tsx`: providers globales + Stack
- `app/index.tsx`: splash que redirige a `(tabs)` o `(auth)` segun token
- `app/(auth)/`: onboarding, login, registro (pasos)
- `app/(tabs)/`: tabs principales (inicio, subastas, pujas, perfil, etc)
- `app/catalogo/[id].tsx`: catalogo de una subasta
- `src/components/`: UI reutilizable (`Button`, `Input`, `Select`)
- `src/context/`: `AuthContext` (token, redirect) y `RegistrationContext`
- `src/config/env.ts`: configuracion centralizada (API_URL)
- `mock-server/`: servidor Express con endpoints mock

## Endpoints mock incluidos

- `POST /auth/login`
- `POST /auth/registro/paso1`
- `POST /auth/registro/paso2`
- `POST /auth/registro/paso3` (multipart)
- `POST /auth/registro/paso4-pago`
- `GET /paises`
- `GET /bancos`
- `GET /categorias` (requiere auth)
- `GET /subastas` (requiere auth)
- `GET /subastas/:id/catalogo` (requiere auth)
- `GET /perfil` y `PUT /perfil` (requiere auth)
- `GET /perfil/restricciones` (requiere auth)

## Credenciales mock

- Email: `usuario@mail.com`
- Password: `MiClave123!`

## Notas de desarrollo

- El token mock valido es `mock-jwt-token`.
- Si estas sin token y entras a una ruta privada, `AuthContext` redirige a `/(auth)/login`.
