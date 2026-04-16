# FlatPlayer - Documento de Funcionalidades para Samsung TV

## Información General

| Campo | Descripción |
|-------|-------------|
| **Nombre de la Aplicación** | FlatPlayer |
| **Versión** | 0.0.0 |
| **Plataforma** | Samsung Smart TV (Tizen) |
| **Framework** | Angular 21.2.0 |
| **Tipo de Aplicación** | Reproductor IPTV |

---

## 1. Autenticación y Sesión

### 1.1 Pantalla de Login
- **Campos de entrada:**
  - URL del servidor/host (con validación de formato http:// o https://)
  - Nombre de usuario
  - Contraseña
- **Navegación:** Navegación completa mediante control remoto (flechas arriba/abajo, botón OK)
- **Teclado virtual:** Integración con teclado virtual de Samsung TV para entrada de texto
- **Persistencia de credenciales:** Almacenamiento seguro de credenciales para auto-login
- **Validación:** Validación en tiempo real de campos requeridos

### 1.2 Auto-Login
- Recuperación automática de sesión previa al iniciar la aplicación
- Redirección automática al dashboard si existe sesión válida

### 1.3 Cierre de Sesión
- Opción de logout desde el menú de configuración
- Diálogo de confirmación antes de cerrar sesión
- Limpieza de credenciales almacenadas

---

## 2. Dashboard Principal

### 2.1 Experiencia Video-First
- Reproducción de video en segundo plano mientras se navega la interfaz
- Interfaz semi-transparente que permite ver el contenido en reproducción

### 2.2 Menú Principal
- **Opciones disponibles:**
  - **Inicio:** Pantalla principal con recomendaciones
  - **Guía:** Guía de programación electrónica (EPG)
  - **Buscar:** Funcionalidad de búsqueda de canales
  - **Ajustes:** Configuraciones de usuario

### 2.3 Navegación Optimizada para Control Remoto
- Navegación mediante flechas direccionales (arriba, abajo, izquierda, derecha)
- Botón OK para seleccionar
- Botón Back para retroceder
- Cierre automático de menús tras inactividad

---

## 3. Gestión de Canales

### 3.1 Catálogo de Canales
- **Organización por categorías:**
  - Canales agrupados por género/tipo (deportes, noticias, entretenimiento, etc.)
  - Lista dinámica obtenida desde el servidor IPTV
- **Visualización:**
  - Lista vertical de categorías
  - Lista vertical de canales por categoría
  - Ventana deslizante (paginación virtual) para grandes listas de canales

### 3.2 Cambio de Canal
- **Navegación rápida:**
  - Flechas arriba/abajo para cambiar canal dentro de una categoría
  - Flechas izquierda/derecha para cambiar entre categorías
  - Navegación circular (vuelve al inicio al llegar al final)
- **Resolución de stream:**
  - Resolución automática de URLs de streaming
  - Soporte para URLs primarias y de fallback
- **Canales favoritos:**
  - Funcionalidad para marcar/desmarcar canales como favoritos
  - Indicador visual de canales favoritos

### 3.3 Información del Canal Actual
- **Barra de información (Info Bar):**
  - Nombre del canal
  - Programa actual (desde EPG)
  - Siguiente programa
- **Visualización temporal:** Aparece automáticamente al cambiar de canal y se oculta tras inactividad

---

## 4. Guía de Programación Electrónica (EPG)

### 4.1 Visualización de Programación
- Lista de programas del canal seleccionado
- Información de programa actual y próximos programas
- **Datos mostrados:**
  - Título del programa
  - Hora de inicio y fin
  - Descripción (si está disponible)

### 4.2 Actualización en Tiempo Real
- Sincronización automática con el servidor
- Actualización de información de programación al cambiar de canal

---

## 5. Búsqueda de Canales

### 5.1 Funcionalidad de Búsqueda
- **Campo de búsqueda:** Entrada de texto con teclado virtual Samsung TV
- **Búsqueda en tiempo real:** Resultados filtrados mientras se escribe
- **Ámbito de búsqueda:** Busca en todos los canales del catálogo

### 5.2 Resultados de Búsqueda
- Lista filtrada de canales que coinciden con el término de búsqueda
- Navegación mediante flechas del control remoto
- Selección rápida para cambiar al canal

---

## 6. Reproducción de Video

### 6.1 Formatos Soportados
- **HLS (HTTP Live Streaming):**
  - Soporte nativo HLS para Samsung TV
  - Fallback a HLS.js para compatibilidad extendida
- **Streams TS:** Soporte directo para streams MPEG-TS

### 6.2 Gestión de Buffer y Latencia
- **Configuración de buffer:**
  - Buffer máximo: 40 segundos
  - Buffer objetivo: 30 segundos
  - Buffer de retroceso: 10 segundos
- **Sincronización de latencia en vivo:**
  - Sincronización automática a 30 segundos detrás del borde en vivo
  - Velocidad de catch-up máxima: 1.15x
- **Recuperación ante stalls:**
  - Detección automática de buffer vacío
  - Recuperación suave con reinicio de buffer

### 6.3 Fallback de Streams
- **Estrategia de fallback:**
  - Intenta URL primaria primero
  - Fallback automático a URL secundaria si la primaria falla
  - Notificación al usuario cuando se activa fallback

### 6.4 Telemetría de Reproducción
- **Monitoreo continuo:**
  - Tiempo de reproducción actual
  - Latencia respecto al borde en vivo
  - Buffer disponible adelante
- **Detección de errores:**
  - Registro de errores de reproducción
  - Telemetría de stalls y recuperaciones
- **Modo debug:** Pantalla de debug opcional con estadísticas de reproducción

---

## 7. Pantalla de Inicio y Recomendaciones

### 7.1 Recomendaciones Personalizadas
- Pantalla inicial con contenido recomendado
- Organización en filas horizontales de contenido
- Navegación en cuadrícula (filas y columnas)

### 7.2 Visualización de Filas
- Scroll horizontal por filas de contenido
- Scroll vertical entre diferentes filas
- Animaciones suaves de transición

---

## 8. Configuración y Ajustes

### 8.1 Información de Usuario
- Visualización de información de cuenta:
  - Nombre de usuario
  - Fecha de creación de cuenta
  - Fecha de expiración de suscripción

### 8.2 Selección de País
- Lista de países de Hispanoamérica disponibles
- Configuración de país para personalización de contenido

### 8.3 Opciones de Sesión
- Cierre de sesión seguro
- Confirmación antes de cerrar sesión

---

## 9. Integración con Samsung TV (Tizen)

### 9.1 Teclas del Control Remoto
- **Teclas soportadas:**
  - Flechas direccionales (Up, Down, Left, Right)
  - Botón OK/Enter
  - Botón Back/Return
  - Teclas especiales de Tizen (XF86Back)

### 9.2 Optimización para TV
- **Interfaz TV-First:**
  - Elementos de UI grandes para fácil lectura desde distancia
  - Contraste alto para pantallas TV
  - Fuentes optimizadas para resolución TV
- **Navegación sin cursor:** Todo controlable mediante flechas y OK

---

## 10. Arquitectura Técnica

### 10.1 Capas de la Aplicación
- **Presentación:** Componentes Angular, páginas, facades
- **Dominio:** Modelos de datos, casos de uso
- **Infraestructura:** Proveedores, interceptores HTTP, persistencia

### 10.2 Casos de Uso Principales
- Login, Auto-Login, Logout
- Obtención de catálogo de TV
- Cambio de canal, búsqueda de canales
- Resolución de URLs de stream
- Obtención de EPG
- Telemetría de errores de reproducción

### 10.3 Dependencias Principales
- Angular 21.2.0
- HLS.js 1.6.3 (para reproducción HLS)
- RxJS 7.8.0 (programación reactiva)

---

## 11. Requisitos del Sistema

| Requisito | Especificación |
|-----------|---------------|
| **Plataforma** | Samsung Smart TV con Tizen OS |
| **Conexión** | Internet requerida para streaming IPTV |
| **Resolución** | Adaptable (optimizado para Full HD) |
| **Entrada** | Control remoto Samsung TV |

---

## 12. Notas para Auditoría Samsung TV

- La aplicación es una **Single Page Application (SPA)** desarrollada en Angular
- Utiliza **hash-based routing** para compatibilidad con Tizen
- Implementa **lazy loading** de componentes para optimización de rendimiento
- Cumple con las **guidelines de navegación de Samsung TV** (control remoto)
- No requiere permisos especiales del sistema más allá de conexión de red
- Compatible con **teclado virtual nativo** de Samsung TV

---

**Documento generado para auditoría y publicación en Samsung TV App Store**
**Fecha:** 15 de Abril, 2026
