# Rematix Backend

Backend del proyecto **Rematix** (trabajo de facultad).  
Este README documenta el **Módulo 1: Autenticación y Registro**.

## Estado actual

- ✅ Registro en 4 pasos
- ✅ Login con JWT
- ✅ Logout
- ✅ Recuperación de clave
- ✅ Catálogos: países y bancos
- ✅ Funciona en **modo local** (memoria) para pruebas con Postman
- ⚠️ Modo Supabase disponible, pero recomendado validar primero flujo local completo

---

## Tecnologías

- Node.js
- Express
- bcryptjs
- jsonwebtoken
- multer (para subida de DNI)
- Supabase (opcional)

---

## Variables de entorno sugeridas

```env
JWT_SECRET=rematix-dev-secret-key-change-in-production
JWT_EXPIRES_IN=24h
SUPABASE_ENABLED=false
RECOVERY_COOLDOWN_MS=60000
```

---

## Flujo de registro (Módulo 1)

1. `POST /auth/registro/paso1`  
   Crea registro temporal con datos personales.

2. `POST /auth/registro/paso2`  
   Asocia contraseña (valida seguridad + hash bcrypt).

3. `POST /auth/registro/paso3`  
   Sube DNI frente/dorso para KYC.

4. `POST /auth/registro/paso4-pago`  
   Vincula medio de pago inicial y finaliza registro (retorna JWT).

---

## Endpoints implementados

- `POST /auth/registro/paso1`
- `POST /auth/registro/paso2`
- `POST /auth/registro/paso3`
- `POST /auth/registro/paso4-pago`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/recuperar-clave`
- `GET /paises`
- `GET /bancos`

---

## Reglas principales implementadas

- Contraseña:
  - mínimo 8 caracteres
  - al menos 1 mayúscula
  - al menos 1 número
- Email normalizado a minúsculas
- Validación de secuencia de pasos (no se puede saltear)
- Validación de tipo/detalle de medio de pago:
  - TARJETA
  - CUENTA_BANCARIA
  - CHEQUE
- Recuperación de clave con rate-limit básico por email (memoria)

---

## Prueba rápida en Postman (local)

1. Ejecutar backend con `SUPABASE_ENABLED=false`.
2. Probar en orden:
   - paso1 → guardar `registro_id`
   - paso2
   - paso3 (multipart con `dni_frente` y `dni_dorso`)
   - paso4
   - login
3. En endpoints protegidos, usar:
   - `Authorization: Bearer <token>`

---