# Página Informática Administrativa
## Roadmap Oficial del Proyecto

**Versión:** 1.0
**Estado:** Activo

---

# Filosofía del proyecto

Este proyecto se desarrolla mediante Sprints.

Cada Sprint tiene un único objetivo.

No se mezclan funcionalidades ni se realizan refactorizaciones innecesarias durante un Sprint.

Las mejoras detectadas se documentan y se evalúan al finalizar el Sprint.

---

# FASE 1
# Hardening del Sistema de Autenticación

Objetivo general:

Eliminar cualquier posibilidad de acceder al panel administrativo sin una sesión válida validada por el backend.

---

# Sprint 1
## Validación REAL de sesión

Estado:
🟡 En desarrollo

Objetivo:

Eliminar la confianza en localStorage como mecanismo para autorizar el acceso a páginas administrativas.

Flujo esperado:

Usuario

↓

Abre dashboard.html

↓

Frontend verifica existencia de sesión local

↓

Consulta al backend (/auth/me)

↓

Backend valida JWT

↓

Si JWT válido:

Permite mostrar la página.

Si JWT inválido:

Redirige al Login.

Archivos esperados:

- admin-core.js
- dashboard.js
- dashboard.html

No modificar:

- avisos.js
- recursos.js
- tutoriales.js
- docentes.js
- demás módulos

---

# Sprint 2
## Endpoint /auth/me

Estado:
🟢 Completado (Integrado durante Sprint 1)

Objetivo:

Crear un endpoint que permita validar la sesión actual.

GET /auth/me

Debe responder:

- usuario
- rol
- centro asignado

Si el JWT no es válido:

HTTP 401

---

# Sprint 3
## Centralizar validación en AdminCore

Estado:
Pendiente

Objetivo:

AdminCore deberá consultar:

GET /auth/me

antes de permitir mostrar cualquier página administrativa.

---

# Sprint 4
## Bloquear acceso directo

Estado:
Pendiente

Objetivo:

Impedir abrir directamente:

dashboard.html

avisos.html

recursos.html

etc.

sin una sesión válida.

Toda página administrativa debe redirigir automáticamente al Login.

---

# Sprint 5
## Expiración automática de sesión

Estado:
Pendiente

Objetivo:

Si el JWT expira mientras el usuario utiliza el sistema:

- detectar HTTP 401
- cerrar sesión
- redirigir al Login

Debe aplicar a TODOS los módulos.

---

# Sprint 6
## Protección del Backend

Estado:
Pendiente

Objetivo:

Todos los endpoints deben validar:

- JWT
- Usuario activo
- Usuario existente
- Rol
- Centro permitido

Nunca confiar en el frontend.

---

# Sprint 7
## Protección contra sesiones robadas

Estado:
Pendiente

Objetivo:

Agregar:

- revocación de sesiones
- expiración avanzada
- auditoría
- cierre completo de sesión

---

# FASE 2
## Seguridad Avanzada

No iniciar hasta terminar completamente la FASE 1.

Incluye:

- Rate Limiting
- Helmet
- CSP
- Cookies HttpOnly
- Eliminar dependencia de localStorage
- Refresh Token
- Auditoría completa
- Protección XSS
- Protección CSRF
- Protección contra fuerza bruta

---

# Cierre de Sprint

Cada Sprint finalizará con:

- Pruebas funcionales
- Corrección de errores
- Deploy GitHub
- Deploy VPS
- Validación en producción
- Documentación
- Cambio de estado a "Completado"

---

# Mejoras Detectadas

Las mejoras detectadas durante un Sprint NO se implementan automáticamente.

Se clasifican como:

- Alta prioridad
- Media prioridad
- Baja prioridad

Al finalizar el Sprint se decide:

- Implementar inmediatamente
- Mover al siguiente Sprint
- Dejar para el final del proyecto