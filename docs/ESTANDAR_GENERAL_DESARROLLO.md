# 📘 Estándar General de Desarrollo de Software
## Guía de Programación y Colaboración

**Versión:** 1.0
**Propósito:** Definir un conjunto de reglas y buenas prácticas para mantener proyectos organizados, escalables y fáciles de mantener, independientemente de la tecnología utilizada.

---

# 1. Principios Generales

## 1.1 Calidad antes que velocidad

Siempre se priorizará:

1. Código correcto.
2. Código legible.
3. Código mantenible.
4. Optimización.

Nunca optimizar código que todavía no funciona correctamente.

---

## 1.2 Una sola fuente de verdad

No duplicar lógica.

No duplicar datos.

No duplicar componentes.

Si una funcionalidad ya existe, debe reutilizarse.

---

## 1.3 Arquitectura estable

Una vez aprobada la arquitectura del proyecto:

- No cambiar tecnologías.
- No cambiar patrones.
- No cambiar estructura de carpetas.

Excepto cuando exista una justificación técnica real.

---

# 2. Gestión del Proyecto

## 2.1 Trabajo por fases

Todo proyecto deberá dividirse en:

- Fases
- Sprints
- Tareas

Ejemplo:

Fase 1
- Autenticación

Fase 2
- Usuarios

Fase 3
- Productos

Fase 4
- Reportes

---

## 2.2 No mezclar fases

Nunca comenzar una fase nueva hasta finalizar completamente la fase actual.

Ejemplo incorrecto:

❌ Crear Reportes mientras Productos está incompleto.

Ejemplo correcto:

✔ Finalizar Productos.
✔ Revisar Productos.
✔ Documentar Productos.
✔ Pasar a Reportes.

---

## 2.3 Cierre de Sprint

Un sprint únicamente puede considerarse terminado cuando:

- Todo compila.
- No existen errores.
- No existen TODO críticos.
- La funcionalidad fue probada.
- La documentación fue actualizada.

---

# 3. Organización del Código

## 3.1 Responsabilidad única

Cada archivo debe tener una única responsabilidad.

Ejemplo:

UserTable

Solo muestra la tabla.

No consulta la API.

No modifica datos.

No abre modales.

---

## 3.2 Componentes reutilizables

Antes de crear un componente nuevo verificar si ya existe uno similar.

Si puede reutilizarse:

✔ Reutilizar.

No duplicar.

---

## 3.3 Evitar archivos gigantes

Si un archivo supera aproximadamente:

- 300–500 líneas

Evaluar dividirlo.

No dividir únicamente por cantidad de líneas.

Debe existir una razón lógica.

---

# 4. Comunicación durante el Desarrollo

## 4.1 Archivos completos

Cuando una modificación afecte gran parte de un archivo:

Entregar el archivo completo.

Evitar instrucciones del tipo:

"Cambia la línea 215."

Porque generan errores de integración.

---

## 4.2 Trabajar siempre sobre la última versión

Antes de modificar un archivo:

Trabajar sobre la versión más reciente proporcionada.

Nunca asumir contenido antiguo.

---

## 4.3 No inventar código

Si falta información:

Preguntar.

Nunca asumir estructuras inexistentes.

---

# 5. Calidad del Código

## 5.1 Código limpio

Preferir:

Nombres descriptivos.

Funciones pequeñas.

Variables claras.

Eliminar código muerto.

Eliminar comentarios innecesarios.

---

## 5.2 Evitar duplicación

Si el mismo bloque aparece varias veces:

Extraerlo.

---

## 5.3 Tipado fuerte

Siempre que el lenguaje lo permita:

Utilizar tipos.

Interfaces.

Modelos.

Evitar tipos ambiguos.

---

# 6. Manejo de Datos

## 6.1 Modelos consistentes

La información debe tener un único formato.

Ejemplo:

Factura:

FAC-0001

No mezclar:

FAC-001

FAC0001

Factura-1

---

## 6.2 Una sola fuente de datos

Durante desarrollo:

Centralizar mocks.

Evitar inconsistencias.

---

## 6.3 Preparar para Backend

Aunque se utilicen datos simulados:

Pensar en cómo serán reemplazados por datos reales.

No crear estructuras imposibles de mapear posteriormente.

---

# 7. Refactorización

## 7.1 Cuándo refactorizar

Refactorizar únicamente cuando:

Mejora mantenimiento.

Reduce complejidad.

Reduce duplicación.

No rompe funcionalidades.

---

## 7.2 No refactorizar durante un Sprint crítico

Primero terminar funcionalidades.

Luego mejorar código.

---

# 8. Manejo de Errores

Siempre:

Validar entradas.

Mostrar errores útiles.

Registrar errores cuando corresponda.

Evitar fallos silenciosos.

---

# 9. Documentación

Cada fase debe terminar con:

- Cambios realizados.
- Componentes creados.
- Componentes modificados.
- Decisiones tomadas.
- Pendientes.

---

# 10. Git

Preferir commits pequeños.

Mensajes claros.

Ejemplos:

feat(users): agregar edición de usuarios

fix(auth): corregir expiración del token

refactor(payments): dividir tabla de pagos

docs(readme): actualizar instalación

---

# 11. Seguridad

Nunca confiar en el frontend.

Validar siempre en backend.

Nunca exponer:

Contraseñas.

Tokens.

Claves.

Variables privadas.

---

# 12. Rendimiento

Optimizar únicamente cuando exista una necesidad real.

Evitar optimizaciones prematuras.

Primero:

Que funcione.

Luego:

Que sea rápido.

---

# 13. Antes de dar una tarea por terminada

Verificar:

☐ Compila.

☐ No rompe funcionalidades existentes.

☐ Código limpio.

☐ Sin duplicación.

☐ Documentación actualizada.

☐ Sin errores conocidos.

☐ Cumple la arquitectura definida.

☐ Preparado para crecimiento.

---

# 14. Reglas para colaboración con IA

Cuando una IA participe en el desarrollo:

- Respetar la arquitectura existente.
- No cambiar tecnologías sin autorización.
- No modificar fases ya cerradas.
- No generar código duplicado.
- Entregar archivos completos cuando el cambio sea significativo.
- Explicar las decisiones técnicas importantes.
- Indicar posibles mejoras, pero no implementarlas sin aprobación cuando afecten la arquitectura.
- Si identifica una deuda técnica, documentarla para un sprint de refactorización en lugar de mezclarla con el sprint funcional actual.

---

# 15. Filosofía del Proyecto

La prioridad siempre será:

1. Correctitud.
2. Claridad.
3. Consistencia.
4. Mantenibilidad.
5. Escalabilidad.
6. Rendimiento.

El objetivo no es terminar rápido.

El objetivo es construir software que pueda mantenerse y crecer durante años.