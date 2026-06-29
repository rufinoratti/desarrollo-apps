# Rematix Frontend

App mobile de **Rematix**, plataforma de subastas de lujo. Construida con **Expo** + **Expo Router**.

## 🚀 Tecnologías

- **Framework:** React Native 0.81 + Expo SDK 54
- **Routing:** Expo Router (file-based)
- **Navegación:** React Navigation
- **Estado:** Context API (AuthContext, RegistrationContext)
- **Testing:** Jest + React Native Testing Library
- **Linting:** ESLint (expo config)

## 📦 Requisitos

- Node.js >= 18
- npm o pnpm
- Expo CLI (`npx expo`)
- Expo Go (en dispositivo físico) o emulador (iOS/Android)

## 🔧 Puesta en marcha local

1. Clonar el repositorio y entrar al directorio:

```bash
git clone https://github.com/rufinoratti/desarrollo-apps.git
cd desarrollo-apps/frontend-subastas
```

2. Instalar dependencias:

```bash
npm install
```

3. Configurar la URL de la API:

Editar el archivo `.env` en la raíz del proyecto:

```env
EXPO_PUBLIC_API_URL=https://desarrollo-apps-zq82.onrender.com
```

> Para desarrollo local con el backend corriendo en tu máquina, usar la IP local:
> ```env
> EXPO_PUBLIC_API_URL=http://xx.xx.xx.xx:3000
> ```

4. Iniciar la app:

```bash
npm run start
```

Escanea el QR con Expo Go o presiona `a` (Android) / `i` (iOS) para abrir en el emulador.

## 📋 Scripts

| Comando | Descripción |
|---|---|
| `npm run start` | Inicia Expo dev server |
| `npm run android` | Abre en Android emulator |
| `npm run ios` | Abre en iOS simulator |
| `npm run web` | Abre en navegador web |
| `npm run lint` | Ejecuta ESLint |
| `npm run test` | Ejecuta Jest |

## 🌐 Hosting

El frontend se sirve a través de **Expo** y se conecta al backend hosteado en Render:

- **Backend:** [https://desarrollo-apps-zq82.onrender.com](https://desarrollo-apps-zq82.onrender.com)

## 📁 Estructura

```
frontend-subastas/
├── app/                  # Rutas (Expo Router)
│   ├── _layout.tsx       # Layout global con providers
│   ├── index.tsx         # Splash / redirección
│   ├── (auth)/           # Onboarding, login, registro
│   └── (tabs)/           # Tabs principales
├── src/
│   ├── components/       # UI reutilizable (Button, Input, Select)
│   ├── context/          # AuthContext, RegistrationContext
│   └── config/           # Configuración (env.ts)
├── assets/               # Imágenes, fuentes
├── __tests__/            # Tests
├── .env
└── package.json
```

## 🔐 Credenciales de prueba (mock local)

- Email: `usuario@mail.com`
- Password: `MiClave123!`
- Token mock: `mock-jwt-token`
