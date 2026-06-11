# Rematix Backend

Backend de **Rematix**, plataforma de subastas de lujo. Desarrollado con Node.js + Express.

## 🚀 Tecnologías

- **Runtime:** Node.js
- **Framework:** Express
- **Autenticación:** JWT + bcryptjs
- **Base de datos:** Supabase (PostgreSQL)
- **Almacenamiento:** Supabase Storage (media)
- **Archivos:** Multer + Sharp

## 📦 Requisitos

- Node.js >= 18
- npm

## 🔧 Puesta en marcha local

1. Clonar el repositorio y entrar al directorio:

```bash
git clone https://github.com/rufinoratti/desarrollo-apps.git
cd desarrollo-apps/backend-subasta
```

2. Instalar dependencias:

```bash
npm install
```

3. Copiar el archivo de entorno y configurarlo:

```bash
cp .env.example .env
```

Editar `.env` con los valores correspondientes (ver sección de variables).

4. Iniciar el servidor:

```bash
npm run dev
```

El servidor corre en `http://localhost:3000`.

## 📄 Variables de entorno

| Variable | Descripción | Default |
|---|---|---|
| `PORT` | Puerto del servidor | `3000` |
| `JWT_SECRET` | Clave secreta para firmar tokens | — |
| `JWT_EXPIRES_IN` | Duración del token | `24h` |
| `SUPABASE_ENABLED` | Habilitar Supabase | `false` |
| `SUPABASE_URL` | URL del proyecto Supabase | — |
| `SUPABASE_ANON_KEY` | Anon key de Supabase | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key de Supabase | — |
| `SUPABASE_BUCKET_MEDIA` | Bucket para archivos | `rematix-media` |
| `RECOVERY_COOLDOWN_MS` | Cooldown entre recuperaciones | `60000` |

## 🌐 Hosting (Render)

El backend está deployado en Render:

- **URL:** [https://desarrollo-apps-zq82.onrender.com](https://desarrollo-apps-zq82.onrender.com)

### Deploy manual

1. Conectar el repositorio a Render.
2. Configurar como **Web Service**.
3. **Build Command:** `npm install`
4. **Start Command:** `npm start`
5. Configurar las variables de entorno en el dashboard de Render.

## 📖 Documentación de la API

La API está documentada con OpenAPI 3.0:

👉 [Swagger Interactive](https://petstore.swagger.io/?url=https://raw.githubusercontent.com/rufinoratti/desarrollo-apps/refs/heads/main/rematix-api.yaml)

## 🧪 Tests

```bash
npm test
```

## 📁 Estructura

```
backend-subasta/
├── src/
│   ├── index.js          # Entry point
│   ├── routes/           # Rutas Express
│   ├── controllers/      # Lógica de negocio
│   ├── middlewares/       # Middlewares (auth, multer)
│   └── config/           # Configuración (Supabase, etc.)
├── tests/                # Tests
├── .env.example
└── package.json
```
