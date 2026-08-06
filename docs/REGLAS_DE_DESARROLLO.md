# Reglas Oficiales de Desarrollo

Estas reglas deben respetarse durante todo el proyecto.

---

# Regla 1

Un Sprint tiene un único objetivo.

No se cambia el objetivo a mitad del Sprint.

---

# Regla 2

Antes de comenzar un Sprint únicamente existen dos mensajes de análisis.

## Primer mensaje

Debe contener:

- Objetivo
- Alcance
- Archivos necesarios
- Archivos que NO se tocarán

---

## Segundo mensaje

Debe contener:

- Análisis de archivos
- Impacto
- Estrategia
- Mejoras detectadas

Después del segundo mensaje:

COMIENZA EL CÓDIGO.

No más planificación.

---

# Regla 3

Durante la implementación únicamente se responde con:

- Código
- Explicación técnica del cambio
- Siguiente archivo

No detener la implementación para proponer nuevas arquitecturas.

---

# Regla 4

Si durante un Sprint aparecen mejoras:

NO implementarlas inmediatamente.

Agregar al apartado:

Mejoras Detectadas.

Solo implementarlas si:

- corrigen un bug crítico
- corrigen una vulnerabilidad crítica
- son indispensables para completar el Sprint

En cualquier otro caso:

Posponerlas.

---

# Regla 5

No modificar archivos que no pertenezcan al Sprint actual.

---

# Regla 6

Antes de modificar un archivo:

Analizar dependencias.

Después:

Modificar únicamente lo necesario.

---

# Regla 7

Los archivos grandes se entregan completos.

No enviar parches parciales.

---

# Regla 8

No eliminar funcionalidades existentes.

Toda modificación debe ser compatible con el sistema actual.

---

# Regla 9

Al finalizar cada Sprint:

Realizar:

- pruebas
- correcciones
- GitHub
- VPS
- validación

Luego cerrar el Sprint.

---

# Regla 10

Todo cambio debe mantener la arquitectura original del proyecto.

No introducir cambios de arquitectura sin aprobación.

---

# Regla 11

Si un Sprint queda aprobado:

Se considera congelado.

Solo podrá modificarse por:

- Bugs críticos
- Vulnerabilidades críticas

No por mejoras de código.

---

# Regla 12

Toda mejora encontrada durante el desarrollo debe documentarse.

Nunca cambiar el objetivo del Sprint por una mejora secundaria.

---

# Regla 13

Mantener una única hoja de ruta.

Nunca crear una segunda arquitectura paralela.

Nunca cambiar el roadmap a mitad del proyecto.

---

# Regla 14

Cada implementación debe terminar con una explicación breve del cambio realizado y el siguiente paso del Sprint.

---

# Regla 15

El criterio principal será siempre:

Seguridad > Estabilidad > Compatibilidad > Optimización > Estética

# Regla 16

Antes de responder durante un Sprint, verificar siempre:

1. ¿Cuál es el objetivo del Sprint actual?
2. ¿El cambio propuesto ayuda directamente a cumplir ese objetivo?

Si la respuesta es NO:

No cambiar el rumbo.

Agregar la idea a "Mejoras Detectadas" y continuar con el Sprint actual.

El roadmap tiene prioridad sobre cualquier optimización o refactorización encontrada durante el desarrollo.

## Regla 17

Al comenzar un Sprint se establecerá un contexto de trabajo.

Ese contexto permanecerá activo hasta cerrar el Sprint.

Durante ese período no se cambiará:

- objetivo
- arquitectura
- estrategia

aunque se identifiquen nuevas mejoras.

Toda mejora encontrada deberá registrarse en "Mejoras Detectadas" y evaluarse únicamente durante el cierre del Sprint.

## Regla 18

La IA no deberá proponer cambios de arquitectura, refactorizaciones ni nuevas funcionalidades mientras se encuentre en fase de implementación.

Durante la implementación únicamente podrá:

- escribir código
- corregir errores
- responder dudas sobre el Sprint

Si identifica una mejora:

deberá documentarla para el cierre del Sprint.

## Regla 19

Todo cambio implementado debe poder responder estas cuatro preguntas:

1. ¿Qué problema resuelve?
2. ¿A qué Sprint pertenece?
3. ¿Qué archivos modifica?
4. ¿Cómo se valida que funciona?

Si una modificación no puede responder esas preguntas, no debe implementarse hasta aclarar su propósito.

## Checklist de cierre del Sprint

- [ ] Desarrollo completado en VS Code.
- [ ] Compila sin errores.
- [ ] Sin errores críticos conocidos.
- [ ] Pruebas locales realizadas (cuando apliquen).
- [ ] Cambios enviados a GitHub.
- [ ] VPS actualizado.
- [ ] Pruebas en producción completadas.
- [ ] Documentación actualizada.
- [ ] Sprint cerrado.