# 🔨 Rematix - Plataforma de Subastas de Lujo

Este repositorio contiene la arquitectura técnica y el diseño de experiencia de usuario para **Rematix**, una aplicación móvil de subastas desarrollada para la materia Desarrollo de Aplicaciones 1. 

---

## 🎨 Diseño y Prototipado (Figma)
El diseño visual se centra en una estética **minimalista, profesional y elegante**, optimizada para dispositivos móviles.

* **Diseño de Pantallas:** [Link al Figma de las pantallas](https://www.figma.com/design/BkLusutksNjV9ZZEEBSBtN/Desarrollo-de-App?node-id=0-1&t=S8pRBRXF7auLkP4c-1)
* **Prototipo Interactivo:** [Link al Prototipo en Figma](https://www.figma.com/proto/BkLusutksNjV9ZZEEBSBtN/Desarrollo-de-App?node-id=0-1&t=S8pRBRXF7auLkP4c-1)

---

## ⚙️ Documentación de la API (Swagger)
La comunicación entre el frontend y el backend está definida mediante el estándar **OpenAPI 3.0**. Se dividió la lógica en 9 módulos funcionales para garantizar la escalabilidad.

### 🚀 Acceso Rápido
Para explorar los endpoints, parámetros y modelos de datos de forma interactiva, hacé clic abajo:

👉 [**ABRIR SWAGGER INTERACTIVO**](https://petstore.swagger.io/?url=https://raw.githubusercontent.com/rufinoratti/desarrollo-apps/refs/heads/main/rematix-api.yaml)


---

## 🛠️ Tecnologías Definidas
* **Diseño:** Figma
* **Especificación:** OpenAPI 3.0 (Swagger)

---
App
Rematix cubre todo el ciclo de vida de una subasta, organizada en 9 módulos:

Registro en 4 pasos: datos personales → contraseña → validación de identidad con DNI → medio de pago inicial.
Exploración: home con subastas destacadas, búsqueda y filtros por categoría.
Catálogo e ítems: navegación por lotes dentro de cada subasta, con detalles, imágenes y precio base.
Motor de pujas: sistema de ofertas en tiempo real, historial de pujas y seguimiento del lote.
Billetera y pagos: gestión de tarjetas, cuentas bancarias y cheques.
Checkout y liquidación: proceso de pago de lotes ganados, con comisiones y fecha límite.
Perfil y métricas: datos del usuario, historial, nivel (Base/Oro/Platino) y restricciones por falta de pago.
Notificaciones: alertas de adjudicación, pujas superadas, pagos pendientes, etc.
Vendedor: los usuarios también pueden poner artículos a la venta y hacer seguimiento de sus bienes.

