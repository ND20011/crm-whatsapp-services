# 📋 MANUAL DE USUARIO - CRM CONDORITO

## 📖 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Acceso al Sistema](#acceso-al-sistema)
3. [Dashboard Principal](#dashboard-principal)
4. [Gestión de Chat](#gestión-de-chat)
5. [Mensajes Masivos](#mensajes-masivos)
6. [Mensajes Programados](#mensajes-programados)
7. [Gestión de Contactos](#gestión-de-contactos)
8. [Gestión de Etiquetas](#gestión-de-etiquetas)
9. [Templates de Mensajes](#templates-de-mensajes)
10. [Configuración de IA](#configuración-de-ia)
11. [Configuración de WhatsApp](#configuración-de-whatsapp)
12. [Administración (Backoffice)](#administración-backoffice)

---

## 🎯 Introducción

**CRM Condorito** es un sistema integral de gestión de relaciones con clientes diseñado específicamente para empresas que utilizan WhatsApp como canal principal de comunicación. El sistema combina funcionalidades avanzadas de CRM con automatización inteligente mediante IA, permitiendo gestionar conversaciones, contactos, mensajes masivos y programados de manera eficiente.

### ✨ Características Principales

- **💬 Chat Integrado**: Gestión completa de conversaciones de WhatsApp
- **🤖 Bot Inteligente**: Respuestas automáticas con IA personalizable
- **📊 Dashboard Analítico**: Métricas en tiempo real de rendimiento
- **📱 Mensajes Masivos**: Envío de campañas a múltiples contactos
- **⏰ Mensajes Programados**: Automatización de comunicaciones
- **🏷️ Sistema de Etiquetas**: Organización avanzada de contactos
- **📝 Templates**: Plantillas reutilizables con variables dinámicas
- **📈 Reportes y Estadísticas**: Análisis detallado de interacciones

---

## 🔐 Acceso al Sistema

### Pantalla de Login

El sistema utiliza un sistema de autenticación seguro basado en JWT (JSON Web Tokens).

**Campos requeridos:**
- **Email**: Dirección de correo electrónico registrada
- **Contraseña**: Contraseña de acceso

**Funcionalidades:**
- ✅ Validación en tiempo real de credenciales
- 🔒 Encriptación segura de contraseñas
- 🔄 Renovación automática de tokens
- 📱 Sesiones persistentes

*[Espacio para captura de pantalla del login]*

### Recuperación de Contraseña

En caso de olvido de contraseña, el sistema proporciona un mecanismo de recuperación seguro.

*[Espacio para captura de pantalla de recuperación]*

---

## 📊 Dashboard Principal

El Dashboard es el centro de control del sistema, proporcionando una vista general del estado de WhatsApp, métricas de mensajes y control del bot.

### Secciones del Dashboard

#### 1. **Estado de WhatsApp**
- 🟢 **Conectado**: WhatsApp está operativo
- 🔴 **Desconectado**: Requiere reconexión
- ⚡ **Información de Sesión**: Número conectado, tiempo de conexión
- 📊 **Estadísticas**: Total de mensajes y conversaciones

*[Espacio para captura de pantalla del estado de WhatsApp]*

#### 2. **Métricas de Mensajes**
- 📈 **Mensajes Totales**: Contador general de mensajes
- 💬 **Conversaciones Activas**: Chats con actividad reciente
- 📬 **Mensajes Sin Leer**: Pendientes de respuesta
- 🤖 **Respuestas del Bot**: Mensajes automatizados enviados

*[Espacio para captura de pantalla de métricas]*

#### 3. **Control del Bot**
- 🔄 **Estado Global**: Activar/desactivar bot para todos los chats
- ⚙️ **Configuración**: Acceso a ajustes de IA
- 📊 **Quota del Bot**: Límite mensual de respuestas automáticas
- 🎯 **Conversaciones con Bot Desactivado**: Lista de chats excluidos

*[Espacio para captura de pantalla del control del bot]*

#### 4. **Acciones Rápidas**
- 🔌 **Conectar WhatsApp**: Iniciar nueva sesión
- 🔧 **Configurar IA**: Personalizar respuestas automáticas
- 📱 **Ver Conversaciones**: Acceso directo al chat
- 📊 **Reportes**: Estadísticas detalladas

### Funcionalidades Interactivas

#### Conexión de WhatsApp
1. Hacer clic en "Conectar WhatsApp"
2. Escanear código QR con WhatsApp Web
3. Confirmar conexión en el dispositivo móvil
4. Verificar estado "Conectado" en el dashboard

#### Control del Bot
- **Activar Globalmente**: Habilita respuestas automáticas en todos los chats
- **Desactivar Globalmente**: Suspende el bot manteniendo la conexión
- **Gestión por Conversación**: Control individual desde el chat

---

## 💬 Gestión de Chat

El módulo de Chat es el corazón del sistema, permitiendo gestionar todas las conversaciones de WhatsApp de manera centralizada.

### Interfaz Principal

#### Panel de Conversaciones (Izquierda)
- 📋 **Lista de Conversaciones**: Todos los chats ordenados por actividad
- 🔍 **Búsqueda**: Filtrar por nombre, teléfono o contenido
- 🏷️ **Filtros por Etiquetas**: Organización por categorías
- 🤖 **Estado del Bot**: Indicador por conversación
- 📬 **Mensajes Sin Leer**: Destacados visualmente

*[Espacio para captura de pantalla del panel de conversaciones]*

#### Panel de Chat (Centro)
- 💬 **Historial de Mensajes**: Conversación completa
- ⏰ **Timestamps**: Fecha y hora de cada mensaje
- 📎 **Archivos Multimedia**: Imágenes, documentos, audios
- 🤖 **Indicadores de Bot**: Mensajes automáticos marcados
- ✅ **Estados de Entrega**: Enviado, entregado, leído

*[Espacio para captura de pantalla del chat]*

#### Panel de Información (Derecha)
- 👤 **Datos del Contacto**: Nombre, teléfono, foto de perfil
- 🏷️ **Etiquetas Asignadas**: Tags organizacionales
- 📊 **Estadísticas**: Número de mensajes, última actividad
- 🤖 **Control de Bot**: Activar/desactivar para este chat

*[Espacio para captura de pantalla del panel de información]*

### Funcionalidades de Envío

#### Mensajes de Texto
1. Escribir mensaje en el campo de texto
2. Usar **Enter** para envío rápido o botón "Enviar"
3. Soporte para **emojis** y **texto largo**
4. **Templates rápidos** mediante botón de plantillas

#### Archivos Multimedia
- 📷 **Imágenes**: JPG, PNG, GIF (máx. 16MB)
- 📄 **Documentos**: PDF, DOC, XLS, TXT (máx. 100MB)
- 🎵 **Audio**: MP3, WAV, OGG
- 🎥 **Videos**: MP4, AVI, MOV

**Proceso de envío:**
1. Clic en botón de adjuntar (📎)
2. Seleccionar tipo de archivo
3. Arrastrar archivos o usar selector
4. Previsualizar contenido
5. Agregar mensaje opcional
6. Enviar

*[Espacio para captura de pantalla de envío de archivos]*

### Gestión de Etiquetas en Chat

#### Asignar Etiquetas
1. Clic en el contacto en el panel derecho
2. Botón "Gestionar Etiquetas"
3. Modal con etiquetas disponibles
4. Seleccionar/deseleccionar etiquetas
5. Guardar cambios

#### Información Mostrada
- 🏷️ **Etiquetas Actuales**: Lista con colores distintivos
- 📊 **Estadísticas**: Conteo de mensajes y última actividad
- 🔄 **Historial**: Cambios recientes en etiquetas

*[Espacio para captura de pantalla del modal de etiquetas]*

### Filtros y Búsqueda

#### Filtros Disponibles
- 🏷️ **Por Etiquetas**: Múltiple selección
- 🤖 **Estado del Bot**: Activo/Inactivo/Todos
- 📬 **Mensajes Sin Leer**: Solo conversaciones pendientes
- ⏰ **Actividad Reciente**: Últimas 24h, 7 días, 30 días

#### Búsqueda Avanzada
- 📝 **Por Contenido**: Buscar en el texto de mensajes
- 👤 **Por Contacto**: Nombre o número de teléfono
- 📅 **Por Fecha**: Rango de fechas específico
- 🏷️ **Combinación**: Múltiples criterios simultáneos

### Control del Bot por Conversación

#### Activar/Desactivar Bot
- **Botón Toggle**: En el panel de información del contacto
- **Estado Visual**: Indicador claro del estado actual
- **Efecto Inmediato**: Cambio aplicado instantáneamente
- **Persistencia**: Configuración guardada automáticamente

#### Comportamiento del Bot
- ✅ **Activo**: Responde automáticamente según configuración de IA
- ❌ **Inactivo**: Solo mensajes manuales del operador
- 🔄 **Transición**: Cambio suave sin interrumpir la conversación

---

## 📢 Mensajes Masivos

El módulo de Mensajes Masivos permite enviar comunicaciones a múltiples contactos simultáneamente, ideal para campañas de marketing, notificaciones importantes o comunicados generales.

### Selección de Destinatarios

#### Métodos de Selección
1. **Por Conversaciones**: Seleccionar chats activos
2. **Por Contactos**: Elegir desde la base de datos completa
3. **Por Etiquetas**: Filtrar por categorías específicas
4. **Combinado**: Usar múltiples criterios

*[Espacio para captura de pantalla de selección de destinatarios]*

#### Filtros Avanzados
- 🏷️ **Etiquetas**: Múltiple selección con operadores AND/OR
- 🤖 **Estado del Bot**: Incluir/excluir según configuración
- 📬 **Mensajes Sin Leer**: Priorizar conversaciones pendientes
- ⏰ **Última Actividad**: Filtrar por tiempo de inactividad

### Tipos de Mensajes

#### 1. **Mensaje de Texto Simple**
- ✍️ **Texto Libre**: Hasta 4096 caracteres
- 😀 **Emojis**: Soporte completo
- 🔗 **Enlaces**: URLs automáticamente detectadas
- **Vista Previa**: Renderizado en tiempo real

#### 2. **Templates con Variables**
- 📝 **Selección de Template**: Desde biblioteca existente
- 🔄 **Variables Dinámicas**: Personalización automática
- 👤 **Datos del Contacto**: Nombre, teléfono, etiquetas
- 📊 **Vista Previa**: Ejemplo con datos reales

*[Espacio para captura de pantalla de templates]*

#### 3. **Archivos Multimedia**
- 📷 **Imágenes**: Con mensaje opcional
- 📄 **Documentos**: PDF, Office, texto
- 🎵 **Audio**: Mensajes de voz o música
- 📹 **Videos**: Contenido promocional

### Proceso de Envío

#### Configuración de Campaña
1. **Seleccionar Destinatarios**: Usar filtros y criterios
2. **Elegir Tipo de Mensaje**: Texto, template o multimedia
3. **Configurar Contenido**: Escribir o seleccionar template
4. **Vista Previa**: Verificar antes del envío
5. **Programar Envío**: Inmediato o diferido

#### Opciones Avanzadas
- ⏱️ **Retraso Entre Mensajes**: Evitar spam (1-10 segundos)
- 📊 **Lotes de Envío**: Grupos de 5-50 mensajes
- 🔄 **Reintentos**: Automáticos en caso de fallo
- 📈 **Seguimiento**: Estadísticas en tiempo real

*[Espacio para captura de pantalla del proceso de envío]*

### Monitoreo y Estadísticas

#### Panel de Progreso
- 📊 **Barra de Progreso**: Visual del avance
- 📈 **Contadores**: Enviados/Pendientes/Fallidos
- ⏰ **Tiempo Estimado**: Duración restante
- 🔄 **Estado Actual**: Contacto siendo procesado

#### Resultados Detallados
- ✅ **Enviados Exitosamente**: Lista con timestamps
- ❌ **Fallos**: Motivos y contactos afectados
- ⏸️ **Pausados**: Mensajes en cola
- 📊 **Resumen Final**: Estadísticas completas

### Gestión de Campañas

#### Historial de Envíos
- 📅 **Fecha y Hora**: Timestamp de cada campaña
- 👥 **Destinatarios**: Cantidad y criterios usados
- 📝 **Contenido**: Preview del mensaje enviado
- 📊 **Resultados**: Tasa de éxito y fallos

#### Acciones Disponibles
- 🔄 **Reenviar**: Repetir campaña a los mismos destinatarios
- 📋 **Duplicar**: Crear nueva campaña basada en anterior
- 📊 **Analizar**: Estadísticas detalladas
- 🗑️ **Eliminar**: Limpiar historial

---

## ⏰ Mensajes Programados

El sistema de Mensajes Programados permite automatizar el envío de comunicaciones en fechas y horarios específicos, ideal para recordatorios, seguimientos y campañas planificadas.

### Creación de Mensajes Programados

#### Información Básica
- 📝 **Nombre**: Identificador de la programación
- 📄 **Descripción**: Propósito del mensaje programado
- 🎯 **Tipo de Envío**: Individual, masivo o por etiquetas
- ⏰ **Programación**: Fecha, hora y recurrencia

*[Espacio para captura de pantalla del formulario básico]*

#### Tipos de Destinatarios

##### 1. **Mensaje Individual**
- 👤 **Contacto Específico**: Selección desde lista
- 📱 **Número Directo**: Ingreso manual de teléfono
- 🔍 **Búsqueda**: Por nombre o número
- ✅ **Validación**: Verificación de formato

##### 2. **Mensaje Masivo**
- 👥 **Múltiples Contactos**: Selección masiva
- 🏷️ **Por Etiquetas**: Filtrado automático
- 📊 **Vista Previa**: Cantidad de destinatarios
- 🔄 **Actualización Dinámica**: Contactos al momento del envío

##### 3. **Por Etiquetas**
- 🏷️ **Selección Múltiple**: Varias etiquetas simultáneamente
- 🔄 **Contenido Dinámico**: Lista actualizada automáticamente
- 📊 **Contador en Vivo**: Destinatarios actuales
- ⚡ **Procesamiento Eficiente**: Optimizado para grandes volúmenes

*[Espacio para captura de pantalla de selección de destinatarios]*

### Configuración de Contenido

#### Tipos de Mensaje

##### 1. **Texto Personalizado**
- ✍️ **Editor Rico**: Formato y emojis
- 🔤 **Variables Dinámicas**: {NOMBRE_CONTACTO}, {TELEFONO}
- 📏 **Límite de Caracteres**: Hasta 4096 caracteres
- 👀 **Vista Previa**: Renderizado en tiempo real

##### 2. **Template Existente**
- 📚 **Biblioteca**: Selección desde templates guardados
- 🔄 **Variables Automáticas**: Sustitución dinámica
- ⚙️ **Configuración**: Personalización de variables
- 📊 **Estadísticas**: Uso y efectividad del template

##### 3. **Contenido Multimedia**
- 📷 **Imágenes**: Con texto opcional
- 📄 **Documentos**: PDF, Office, etc.
- 🎵 **Audio**: Mensajes de voz
- 📹 **Videos**: Contenido promocional

*[Espacio para captura de pantalla del editor de contenido]*

### Programación Temporal

#### Opciones de Programación

##### 1. **Envío Único**
- 📅 **Fecha Específica**: Selector de calendario
- ⏰ **Hora Exacta**: Precisión por minutos
- 🌍 **Zona Horaria**: Configuración regional
- ✅ **Validación**: No permitir fechas pasadas

##### 2. **Envío Recurrente**
- 🔄 **Frecuencia**: Diaria, semanal, mensual, anual
- 📅 **Días Específicos**: Lunes a domingo
- 🗓️ **Fechas Especiales**: Días del mes específicos
- ⏰ **Horarios Múltiples**: Varios envíos por día

##### 3. **Programación Avanzada**
- 📊 **Condiciones**: Basadas en datos del contacto
- 🎯 **Triggers**: Eventos que activan el envío
- ⏱️ **Retrasos**: Tiempo entre condición y envío
- 🔄 **Repeticiones**: Límites y excepciones

*[Espacio para captura de pantalla de programación]*

### Gestión de Mensajes Programados

#### Vista de Lista

##### Modos de Visualización
- 📋 **Vista de Grilla**: Cards con información resumida
- 📊 **Vista de Tabla**: Datos tabulares detallados
- 🔄 **Alternancia**: Botón toggle para cambiar vista
- 💾 **Persistencia**: Preferencia guardada en localStorage

##### Información Mostrada
- 📝 **Nombre y Descripción**: Identificación clara
- 🎯 **Tipo de Destinatario**: Individual/Masivo/Etiquetas
- ⏰ **Próxima Ejecución**: Fecha y hora del siguiente envío
- 📊 **Estado**: Activo, pausado, completado, error
- 📈 **Estadísticas**: Enviados, pendientes, fallos

*[Espacio para captura de pantalla de la lista]*

#### Filtros y Búsqueda
- 🔍 **Búsqueda por Texto**: Nombre o descripción
- 📊 **Filtro por Estado**: Activo, pausado, completado
- 🎯 **Tipo de Envío**: Individual, masivo, etiquetas
- 📅 **Rango de Fechas**: Programación específica

#### Acciones Disponibles
- ▶️ **Activar/Pausar**: Control de ejecución
- ✏️ **Editar**: Modificar configuración
- 📋 **Duplicar**: Crear copia para reutilizar
- 🗑️ **Eliminar**: Remover programación
- 📊 **Ver Detalles**: Estadísticas y historial

### Monitoreo y Estadísticas

#### Panel de Ejecución
- ⏰ **Próximas Ejecuciones**: Lista cronológica
- 📊 **Estado del Procesador**: Sistema automático
- 🔄 **Frecuencia de Verificación**: Cada minuto
- 📈 **Rendimiento**: Mensajes procesados por hora

#### Historial Detallado
- 📅 **Registro de Ejecuciones**: Fecha y hora de cada envío
- 👥 **Destinatarios**: Lista de contactos procesados
- ✅ **Resultados**: Exitosos, fallidos, omitidos
- 📊 **Estadísticas**: Tasas de éxito y análisis

*[Espacio para captura de pantalla de estadísticas]*

#### Gestión de Errores
- ❌ **Detección Automática**: Fallos en envío
- 🔄 **Reintentos**: Configurables automáticamente
- 📧 **Notificaciones**: Alertas de problemas
- 🛠️ **Resolución**: Herramientas de diagnóstico

---

## 👥 Gestión de Contactos

El módulo de Contactos centraliza toda la información de clientes y prospectos, proporcionando herramientas avanzadas para organización, segmentación y análisis.

### Lista de Contactos

#### Modos de Visualización

##### Vista de Grilla (Cards)
- 👤 **Tarjetas Individuales**: Información resumida por contacto
- 📷 **Foto de Perfil**: Avatar de WhatsApp si está disponible
- 📱 **Datos Principales**: Nombre, teléfono, etiquetas
- 🏷️ **Etiquetas Visuales**: Colores distintivos
- 📊 **Estadísticas Rápidas**: Mensajes, última actividad

##### Vista de Tabla
- 📊 **Datos Tabulares**: Información organizada en columnas
- 🔄 **Ordenamiento**: Por cualquier columna (clic en encabezado)
- 📱 **Teléfonos en Negrita**: Fácil identificación
- 🎨 **Colores Mejorados**: Mejor contraste y legibilidad
- 📏 **Responsive**: Adaptable a diferentes pantallas

*[Espacio para captura de pantalla de ambas vistas]*

#### Información Mostrada
- 👤 **Nombre**: Personalizado o desde WhatsApp
- 📱 **Teléfono**: Número completo con formato
- 🏷️ **Etiquetas**: Tags asignados con colores
- 📅 **Última Actividad**: Fecha del último mensaje
- 💬 **Total Mensajes**: Contador de interacciones
- 🚫 **Estado**: Bloqueado/Activo

### Funcionalidades de Gestión

#### Creación de Contactos
1. **Botón "Nuevo Contacto"**: Acceso desde la barra superior
2. **Formulario Completo**: Todos los campos disponibles
3. **Validación en Tiempo Real**: Formato de teléfono, email
4. **Asignación de Etiquetas**: Durante la creación
5. **Integración Automática**: Con conversaciones existentes

*[Espacio para captura de pantalla del formulario de creación]*

#### Edición de Contactos
- ✏️ **Edición In-Line**: Clic directo en campos editables
- 📝 **Modal Completo**: Para cambios extensos
- 🏷️ **Gestión de Etiquetas**: Agregar/quitar fácilmente
- 📷 **Actualización de Avatar**: Sincronización con WhatsApp
- 💾 **Guardado Automático**: Sin pérdida de datos

#### Importación y Exportación

##### Importación desde CSV
1. **Plantilla Descargable**: Formato estándar predefinido
2. **Validación de Datos**: Verificación antes de importar
3. **Mapeo de Campos**: Asignación flexible de columnas
4. **Procesamiento por Lotes**: Manejo de grandes volúmenes
5. **Reporte de Resultados**: Éxitos, errores y duplicados

##### Exportación de Datos
- 📊 **Formato CSV**: Compatible con Excel y otros sistemas
- 🎯 **Filtros Aplicados**: Solo contactos seleccionados
- 📅 **Timestamp**: Fecha de exportación incluida
- 🔐 **Datos Completos**: Toda la información disponible

*[Espacio para captura de pantalla de importación/exportación]*

### Filtros y Búsqueda Avanzada

#### Filtros Disponibles
- 🔍 **Búsqueda por Texto**: Nombre, teléfono, comentarios
- 🏷️ **Filtro por Etiquetas**: Múltiple selección
- 📅 **Rango de Fechas**: Creación o última actividad
- 🚫 **Estado**: Activos, bloqueados, todos
- 💬 **Actividad**: Con/sin mensajes recientes

#### Búsqueda Inteligente
- 🔤 **Búsqueda Parcial**: Coincidencias aproximadas
- 📱 **Formato Flexible**: Números con/sin códigos de país
- 🏷️ **Por Etiquetas**: Nombres de tags incluidos
- 💬 **Contenido de Mensajes**: Búsqueda en historial

### Gestión Masiva

#### Selección Múltiple
- ☑️ **Checkboxes**: Selección individual
- 📋 **Seleccionar Todo**: Todos los contactos visibles
- 🎯 **Selección por Filtro**: Basada en criterios
- 📊 **Contador**: Cantidad seleccionada visible

#### Acciones Masivas
- 🏷️ **Asignar Etiquetas**: A múltiples contactos
- 🗑️ **Eliminar**: Borrado masivo con confirmación
- 📤 **Exportar Selección**: Solo contactos elegidos
- 🚫 **Bloquear/Desbloquear**: Cambio de estado masivo

*[Espacio para captura de pantalla de acciones masivas]*

### Integración con Otras Funcionalidades

#### Conexión con Chat
- 💬 **Acceso Directo**: Botón para abrir conversación
- 📊 **Estado de Chat**: Indicador de mensajes sin leer
- 🤖 **Estado del Bot**: Configuración por contacto
- ⏰ **Última Actividad**: Sincronizada con chat

#### Mensajes Programados
- ⏰ **Crear Programación**: Directamente desde contacto
- 📋 **Historial**: Mensajes programados para este contacto
- 🎯 **Templates**: Sugerencias basadas en etiquetas
- 📊 **Estadísticas**: Efectividad de comunicaciones

---

## 🏷️ Gestión de Etiquetas

El sistema de etiquetas permite organizar y categorizar contactos de manera eficiente, facilitando la segmentación y personalización de comunicaciones.

### Creación y Gestión de Etiquetas

#### Formulario de Creación
- 📝 **Nombre**: Identificador único y descriptivo
- 🎨 **Color**: Selector visual con paleta predefinida
- 📄 **Descripción**: Propósito y uso de la etiqueta
- ✅ **Estado**: Activa/Inactiva para control de uso

*[Espacio para captura de pantalla del formulario de etiquetas]*

#### Configuración de Mensajes Automáticos
Las etiquetas pueden configurarse para enviar mensajes automáticos cuando se asignan a un contacto.

##### Configuración Básica
- ✅ **Habilitar Auto-Mensaje**: Checkbox de activación
- ⏰ **Retraso**: Tiempo antes del envío (en horas decimales)
- 📝 **Contenido**: Mensaje personalizado o template
- 🔄 **Estado**: Activo/Inactivo para control temporal

##### Opciones Avanzadas
- 📚 **Template Predefinido**: Selección desde biblioteca
- 🔤 **Variables Dinámicas**: {NOMBRE_CONTACTO}, {TELEFONO}, etc.
- ⏱️ **Retraso Flexible**: Desde 0.1 horas (6 minutos) hasta 168 horas (7 días)
- 📊 **Vista Previa**: Renderizado del mensaje final

*[Espacio para captura de pantalla de configuración de auto-mensajes]*

##### Variables Disponibles
El sistema proporciona variables dinámicas para personalizar mensajes:
- **{NOMBRE_CONTACTO}**: Nombre del contacto (personalizado o del teléfono)
- **{TELEFONO}**: Número de teléfono del contacto
- **{FECHA}**: Fecha actual del sistema
- **{HORA}**: Hora actual del sistema
- **{FECHA_HORA}**: Fecha y hora actual del sistema

### Visualización de Etiquetas

#### Modos de Vista

##### Vista de Grilla (Cards)
- 🎨 **Tarjetas Coloridas**: Color distintivo por etiqueta
- 📊 **Estadísticas**: Número de contactos asignados
- 🤖 **Indicador de Auto-Mensaje**: Ícono de robot si está habilitado
- ⚙️ **Acciones Rápidas**: Editar, eliminar, duplicar

##### Vista de Tabla
- 📋 **Información Tabular**: Datos organizados en columnas
- 🎨 **Celda de Color**: Muestra visual del color asignado
- 📊 **Contadores**: Contactos y mensajes automáticos
- 🔧 **Acciones Compactas**: Botones de gestión integrados

*[Espacio para captura de pantalla de ambas vistas de etiquetas]*

#### Información Mostrada
- 🏷️ **Nombre**: Identificador de la etiqueta
- 🎨 **Color**: Representación visual
- 📄 **Descripción**: Propósito de la etiqueta
- 👥 **Contactos**: Cantidad de asignaciones
- 🤖 **Auto-Mensaje**: Estado y configuración
- 📅 **Fechas**: Creación y última modificación

### Funcionalidades Avanzadas

#### Mensajes Automáticos por Etiqueta
Cuando se asigna una etiqueta configurada a un contacto:

1. **Verificación**: Sistema verifica si tiene auto-mensaje habilitado
2. **Programación**: Crea mensaje programado con el retraso configurado
3. **Personalización**: Reemplaza variables con datos del contacto
4. **Envío**: Ejecuta automáticamente en el tiempo programado
5. **Cancelación**: Si se desasigna la etiqueta, cancela el mensaje pendiente

#### Gestión de Conflictos
- 🔄 **Duplicados**: Prevención de mensajes múltiples
- ❌ **Cancelación**: Automática al desasignar etiqueta
- ⏰ **Reprogramación**: Si se reasigna antes del envío
- 📊 **Auditoría**: Registro de todas las acciones

*[Espacio para captura de pantalla del flujo de auto-mensajes]*

### Filtros y Organización

#### Filtros Disponibles
- 🔍 **Búsqueda por Nombre**: Filtrado en tiempo real
- 🎨 **Por Color**: Agrupación visual
- 🤖 **Con Auto-Mensaje**: Solo etiquetas automatizadas
- 📊 **Por Uso**: Más/menos utilizadas
- ✅ **Estado**: Activas/Inactivas

#### Ordenamiento
- 📝 **Alfabético**: Por nombre A-Z o Z-A
- 📅 **Cronológico**: Por fecha de creación
- 📊 **Por Popularidad**: Número de contactos asignados
- 🎨 **Por Color**: Agrupación cromática

### Integración con el Sistema

#### Asignación en Chat
- 🏷️ **Modal de Etiquetas**: Desde panel de contacto en chat
- ✅ **Selección Múltiple**: Varias etiquetas simultáneamente
- 🔄 **Actualización en Vivo**: Cambios reflejados inmediatamente
- 🤖 **Trigger Automático**: Activación de mensajes automáticos

#### Uso en Mensajes Programados
- 🎯 **Filtrado por Etiquetas**: Selección de destinatarios
- 📊 **Conteo Dinámico**: Actualización automática de contactos
- 🔄 **Sincronización**: Con cambios en asignaciones
- 📈 **Estadísticas**: Efectividad por etiqueta

---

## 📝 Templates de Mensajes

El sistema de templates permite crear, gestionar y reutilizar plantillas de mensajes con variables dinámicas, optimizando la comunicación y manteniendo consistencia en los mensajes.

### Creación de Templates

#### Información Básica
- 📝 **Nombre del Template**: Identificador descriptivo único
- 📁 **Categoría**: Clasificación para organización
- ✅ **Estado**: Activo/Inactivo para control de uso
- 📄 **Descripción**: Propósito y contexto de uso

*[Espacio para captura de pantalla del formulario básico]*

#### Categorías Disponibles
El sistema incluye categorías predefinidas para mejor organización:
- **General**: Templates de uso común
- **Saludo**: Mensajes de bienvenida y presentación
- **Despedida**: Mensajes de cierre y agradecimiento
- **Promoción**: Ofertas, descuentos y campañas comerciales
- **Seguimiento**: Mensajes post-venta y seguimiento
- **Soporte**: Respuestas de atención al cliente

### Editor de Contenido

#### Funcionalidades del Editor
- ✍️ **Editor de Texto Rico**: Formato completo con emojis
- 📏 **Contador de Caracteres**: Límite de 1000 caracteres
- 🔤 **Variables Sugeridas**: Botones de inserción rápida
- 👀 **Vista Previa en Vivo**: Renderizado en tiempo real

#### Variables del Sistema
El sistema proporciona variables predefinidas para personalización:
- **{{nombre}}**: Nombre genérico del contacto
- **{{cliente}}**: Referencia formal al cliente
- **{{empresa}}**: Nombre de la empresa
- **{{producto}}**: Producto o servicio específico
- **{{fecha}}**: Fecha actual del sistema
- **{{hora}}**: Hora actual del sistema
- **{{precio}}**: Valor monetario
- **{{descuento}}**: Porcentaje o monto de descuento
- **{{telefono}}**: Número de contacto
- **{{email}}**: Dirección de correo electrónico

*[Espacio para captura de pantalla del editor con variables]*

#### Inserción de Variables
1. **Botones Sugeridos**: Clic directo para insertar
2. **Posición del Cursor**: Inserción en ubicación actual
3. **Formato Automático**: Variables con sintaxis {{variable}}
4. **Vista Previa**: Muestra el resultado final

### Gestión de Variables Dinámicas

#### Detección Automática
- 🔍 **Análisis del Contenido**: Extracción automática de variables
- 📊 **Lista Dinámica**: Actualización en tiempo real
- ⚙️ **Configuración Individual**: Propiedades por variable
- 🗑️ **Eliminación**: Remover variables del contenido

#### Configuración de Variables
Para cada variable detectada:
- 📝 **Descripción**: Propósito de la variable
- 🔤 **Tipo**: Texto, número, fecha, email, teléfono
- 💡 **Valor por Defecto**: Fallback si no se proporciona valor
- ✅ **Requerida**: Obligatoria para usar el template

*[Espacio para captura de pantalla de configuración de variables]*

### Vista Previa y Validación

#### Panel de Vista Previa
- 👁️ **Renderizado en Vivo**: Actualización automática
- 📱 **Formato de Mensaje**: Simulación de WhatsApp
- 🔤 **Sustitución de Variables**: Con valores de ejemplo
- 📊 **Información de Variables**: Lista de variables utilizadas

#### Validación del Template
- ✅ **Sintaxis Correcta**: Verificación de formato de variables
- ⚖️ **Llaves Balanceadas**: Validación de {{}}
- 📏 **Límite de Caracteres**: Control de longitud
- 🚫 **Variables Vacías**: Detección de errores

### Gestión de Templates

#### Lista de Templates

##### Modos de Visualización
- 📋 **Vista de Grilla**: Cards con información resumida
- 📊 **Vista de Tabla**: Datos tabulares detallados
- 🔄 **Alternancia**: Toggle para cambiar vista
- 💾 **Persistencia**: Preferencia guardada

##### Información Mostrada
- 📝 **Nombre y Categoría**: Identificación clara
- 📊 **Estado**: Activo/Inactivo con indicadores visuales
- 📈 **Uso**: Contador de veces utilizado
- 🔤 **Variables**: Cantidad de variables dinámicas
- 📅 **Fechas**: Creación y última modificación

*[Espacio para captura de pantalla de la lista de templates]*

#### Filtros y Búsqueda
- 🔍 **Búsqueda por Texto**: Nombre o contenido
- 📁 **Filtro por Categoría**: Organización temática
- ✅ **Por Estado**: Activos/Inactivos/Todos
- 📊 **Por Uso**: Más/menos utilizados
- 🔤 **Con Variables**: Solo templates con variables dinámicas

#### Acciones Disponibles
- ✏️ **Editar**: Modificar contenido y configuración
- 📋 **Duplicar**: Crear copia para variaciones
- 📊 **Ver Estadísticas**: Uso y efectividad
- 🗑️ **Eliminar**: Remover template (con confirmación)
- ▶️ **Usar**: Aplicar en mensaje o campaña

### Uso de Templates

#### En Chat Individual
1. **Botón de Templates**: En el editor de mensajes
2. **Selección**: Elegir template de la lista
3. **Configuración**: Completar variables si es necesario
4. **Vista Previa**: Verificar mensaje final
5. **Envío**: Confirmar y enviar

#### En Mensajes Masivos
- 📢 **Selección de Template**: Durante configuración de campaña
- 🔤 **Variables Automáticas**: Datos del contacto
- 📊 **Vista Previa Masiva**: Ejemplo con múltiples contactos
- 📈 **Estadísticas**: Seguimiento de uso en campañas

#### En Mensajes Programados
- ⏰ **Programación con Template**: Selección durante configuración
- 🔄 **Variables Dinámicas**: Evaluadas al momento del envío
- 📊 **Seguimiento**: Estadísticas de templates programados
- 🎯 **Personalización**: Adaptación por destinatario

*[Espacio para captura de pantalla de uso de templates]*

### Estadísticas y Análisis

#### Métricas por Template
- 📊 **Veces Utilizado**: Contador total de usos
- 📅 **Último Uso**: Fecha de última utilización
- 📈 **Tendencia**: Uso en el tiempo
- 🎯 **Efectividad**: Tasa de respuesta (si disponible)

#### Análisis Comparativo
- 🏆 **Templates Más Usados**: Ranking de popularidad
- 📊 **Por Categoría**: Distribución de uso
- 📈 **Evolución Temporal**: Cambios en el tiempo
- 🎯 **Recomendaciones**: Sugerencias de optimización

---

## 🧠 Configuración de IA

El sistema incluye un potente motor de IA personalizable que permite automatizar respuestas de WhatsApp de manera inteligente y contextual.

### Configuración Básica de IA

#### Estado del Sistema
- ✅ **Habilitar IA**: Activar/desactivar respuestas automáticas
- 🎯 **Modo de Operación**: Selección del comportamiento de la IA
- 📊 **Estado Actual**: Indicadores visuales del funcionamiento
- 🔄 **Aplicación**: Cambios en tiempo real

*[Espacio para captura de pantalla de configuración básica]*

#### Modos de IA Disponibles

##### 1. **Solo Prompt (prompt_only)**
- 📝 **Basado en Instrucciones**: Respuestas según prompt de negocio
- 🎯 **Contextual**: Considera historial de conversación
- ⚡ **Rápido**: Respuesta inmediata sin búsquedas
- 🎨 **Creativo**: Mayor flexibilidad en respuestas

##### 2. **Búsqueda en Base de Datos (database_search)**
- 🔍 **Búsqueda Inteligente**: Consulta información específica
- 📊 **Datos Estructurados**: Acceso a base de conocimientos
- 🎯 **Precisión**: Respuestas basadas en datos reales
- 📚 **Conocimiento Amplio**: Información empresarial específica

### Configuración del Prompt de Negocio

#### Editor de Prompt
- 📝 **Editor Rico**: Texto largo con formato
- 💡 **Sugerencias**: Ejemplos y mejores prácticas
- 📏 **Límite de Caracteres**: Hasta 8000 caracteres
- 🔍 **Validación**: Verificación de formato y contenido

#### Elementos del Prompt
Un prompt efectivo debe incluir:
- 🏢 **Información de la Empresa**: Nombre, servicios, valores
- 🎯 **Tono de Comunicación**: Formal, casual, amigable
- 📋 **Instrucciones Específicas**: Cómo responder consultas
- 🚫 **Limitaciones**: Qué no debe hacer la IA
- 📞 **Escalación**: Cuándo derivar a humano

*[Espacio para captura de pantalla del editor de prompt]*

#### Ejemplo de Prompt
```
Eres un asistente virtual de [Nombre de la Empresa], especializada en [servicios/productos].

PERSONALIDAD:
- Amable y profesional
- Proactivo en ayudar
- Claro y conciso en las respuestas

INFORMACIÓN DE LA EMPRESA:
- Servicios: [Lista de servicios]
- Horarios: [Horarios de atención]
- Contacto: [Información de contacto]

INSTRUCCIONES:
1. Saluda cordialmente a nuevos contactos
2. Responde consultas sobre productos/servicios
3. Proporciona información de contacto cuando sea relevante
4. Si no sabes algo, deriva a un representante humano
5. Mantén un tono profesional pero cercano

NO DEBES:
- Inventar información que no tienes
- Hacer promesas sobre precios sin confirmación
- Procesar pagos o transacciones
```

### Configuración Avanzada

#### Parámetros Técnicos

##### Control de Respuesta
- 🎛️ **Max Tokens**: Longitud máxima de respuesta (50-2000)
- 🌡️ **Temperature**: Creatividad de respuestas (0.0-1.0)
- 📚 **Historial**: Mensajes previos considerados (1-50)
- ⏱️ **Timeout**: Tiempo límite de respuesta (5-60 segundos)

##### Configuración de Tokens
- **50-200**: Respuestas cortas y directas
- **200-500**: Respuestas balanceadas (recomendado)
- **500-1000**: Respuestas detalladas
- **1000-2000**: Respuestas muy extensas

##### Configuración de Temperature
- **0.0-0.3**: Respuestas consistentes y predecibles
- **0.4-0.7**: Balance entre consistencia y creatividad (recomendado)
- **0.8-1.0**: Respuestas más creativas y variadas

*[Espacio para captura de pantalla de configuración avanzada]*

#### Horarios de Trabajo
- ✅ **Habilitar Horarios**: Restricción temporal de IA
- ⏰ **Hora de Inicio**: Cuando comienza la atención automática
- ⏰ **Hora de Fin**: Cuando termina la atención automática
- 📅 **Días Activos**: Selección de días de la semana
- 🌙 **Mensaje Fuera de Horario**: Respuesta automática personalizada

#### Mensaje de Fallback
- 📝 **Mensaje por Defecto**: Cuando la IA no puede responder
- 🔄 **Personalizable**: Adaptable al tono de la empresa
- 📞 **Derivación**: Incluir información de contacto humano
- ⏰ **Contextual**: Diferente según horario

### Pruebas y Validación

#### Sistema de Pruebas
- 🧪 **Test en Vivo**: Probar configuración actual
- 💬 **Mensaje de Prueba**: Simular consulta de cliente
- 📊 **Análisis de Respuesta**: Evaluación de calidad
- 🔄 **Iteración Rápida**: Ajustes y nuevas pruebas

#### Métricas de Evaluación
- ⏱️ **Tiempo de Respuesta**: Velocidad de procesamiento
- 🎯 **Relevancia**: Pertinencia de la respuesta
- 📏 **Longitud**: Adecuación del tamaño de respuesta
- 💡 **Creatividad**: Variedad en las respuestas

*[Espacio para captura de pantalla de pruebas]*

### Monitoreo y Optimización

#### Estadísticas de Uso
- 📊 **Mensajes Procesados**: Total de respuestas automáticas
- ⏱️ **Tiempo Promedio**: Velocidad de respuesta
- 🎯 **Tasa de Éxito**: Respuestas exitosas vs errores
- 📈 **Tendencias**: Uso en el tiempo

#### Optimización Continua
- 📝 **Registro de Interacciones**: Log de conversaciones
- 🔍 **Análisis de Patrones**: Consultas más frecuentes
- 💡 **Sugerencias**: Mejoras automáticas del sistema
- 🔄 **Ajustes Iterativos**: Refinamiento continuo

### Integración con el Sistema

#### Control por Conversación
- 🎛️ **Activar/Desactivar**: Por chat individual
- 📊 **Estado Visual**: Indicadores en interfaz de chat
- 🔄 **Cambio Inmediato**: Efecto instantáneo
- 💾 **Persistencia**: Configuración guardada

#### Quota y Límites
- 📊 **Límite Mensual**: Control de uso de IA
- 📈 **Contador Actual**: Uso del mes en curso
- 🔄 **Reset Automático**: Reinicio mensual
- ⚠️ **Alertas**: Notificaciones de límites

---

## 📱 Configuración de WhatsApp

La integración con WhatsApp es el núcleo del sistema, permitiendo una conexión estable y segura para gestionar todas las comunicaciones.

### Conexión Inicial

#### Proceso de Conexión
1. **Acceso al Dashboard**: Desde el menú principal
2. **Estado de Conexión**: Verificar estado actual
3. **Botón "Conectar WhatsApp"**: Iniciar proceso
4. **Código QR**: Generación automática
5. **Escaneo**: Usar WhatsApp en el móvil
6. **Confirmación**: Verificar conexión exitosa

*[Espacio para captura de pantalla del proceso de conexión]*

#### Requisitos Previos
- 📱 **WhatsApp Instalado**: En dispositivo móvil
- 🌐 **Conexión a Internet**: Estable en ambos dispositivos
- 📷 **Cámara Funcional**: Para escanear código QR
- ✅ **Permisos**: Autorización en WhatsApp

#### Código QR
- ⏰ **Tiempo Limitado**: Válido por 60 segundos
- 🔄 **Regeneración**: Automática si expira
- 📱 **Escaneo**: Desde WhatsApp > Dispositivos Vinculados
- ✅ **Confirmación**: Mensaje de éxito en pantalla

### Gestión de Sesión

#### Estado de la Conexión
- 🟢 **Conectado**: WhatsApp operativo y listo
- 🟡 **Conectando**: Proceso de establecimiento
- 🔴 **Desconectado**: Requiere nueva conexión
- ⚠️ **Error**: Problema en la comunicación

#### Información de Sesión
- 📱 **Número Conectado**: Teléfono asociado
- ⏰ **Conectado Desde**: Timestamp de inicio
- 📊 **Estadísticas**: Mensajes enviados/recibidos
- 🔄 **Última Actividad**: Sincronización reciente

*[Espacio para captura de pantalla de información de sesión]*

#### Mantenimiento de Conexión
- 🔄 **Ping Automático**: Verificación periódica
- 📡 **Reconexión**: Automática en caso de desconexión
- 💾 **Persistencia**: Sesión guardada localmente
- 🔐 **Seguridad**: Tokens encriptados

### Configuración Avanzada

#### Parámetros de Conexión
- ⏱️ **Timeout**: Tiempo límite para operaciones
- 🔄 **Reintentos**: Número de intentos automáticos
- 📊 **Buffer**: Tamaño de cola de mensajes
- 🔐 **Encriptación**: Nivel de seguridad

#### Gestión de Errores
- 📝 **Log de Errores**: Registro detallado
- 🔄 **Recuperación**: Estrategias automáticas
- 📧 **Notificaciones**: Alertas de problemas
- 🛠️ **Diagnóstico**: Herramientas de análisis

### Monitoreo y Estadísticas

#### Métricas de Rendimiento
- 📊 **Mensajes por Minuto**: Throughput del sistema
- ⏱️ **Latencia**: Tiempo de respuesta promedio
- 📈 **Disponibilidad**: Porcentaje de tiempo activo
- 🔄 **Reconexiones**: Frecuencia de interrupciones

#### Estadísticas de Uso
- 💬 **Total Mensajes**: Enviados y recibidos
- 👥 **Conversaciones**: Chats activos y totales
- 📅 **Actividad Diaria**: Distribución temporal
- 📊 **Tendencias**: Patrones de uso

*[Espacio para captura de pantalla de estadísticas]*

### Solución de Problemas

#### Problemas Comunes

##### Desconexión Frecuente
- **Causa**: Inestabilidad de red o dispositivo móvil
- **Solución**: Verificar conexión, reiniciar WhatsApp
- **Prevención**: Mantener dispositivo conectado

##### Mensajes No Enviados
- **Causa**: Límites de WhatsApp o problemas de red
- **Solución**: Verificar estado, reenviar manualmente
- **Prevención**: Respetar límites de velocidad

##### Código QR No Funciona
- **Causa**: Expiración o problema de cámara
- **Solución**: Regenerar código, verificar permisos
- **Prevención**: Escanear inmediatamente

#### Herramientas de Diagnóstico
- 🔍 **Test de Conexión**: Verificación manual
- 📊 **Estado del Sistema**: Dashboard de salud
- 📝 **Logs Detallados**: Información técnica
- 🛠️ **Reinicio Seguro**: Reset sin pérdida de datos

### Seguridad y Privacidad

#### Medidas de Seguridad
- 🔐 **Encriptación E2E**: Mantenida por WhatsApp
- 🔒 **Tokens Seguros**: Almacenamiento encriptado
- 🛡️ **Validación**: Verificación de integridad
- 📝 **Auditoría**: Registro de accesos

#### Privacidad de Datos
- 🚫 **No Almacenamiento**: Mensajes no guardados en servidores externos
- 🔒 **Acceso Restringido**: Solo personal autorizado
- 📋 **Cumplimiento**: Regulaciones de privacidad
- 🗑️ **Eliminación**: Datos removidos al desconectar

---

## 👨‍💼 Administración (Backoffice)

El módulo de Backoffice proporciona herramientas administrativas avanzadas para la gestión de clientes, configuración del sistema y monitoreo general.

### Panel de Administración

#### Acceso Restringido
- 🔐 **Permisos Especiales**: Solo usuarios administradores
- 🎫 **Roles Definidos**: Diferentes niveles de acceso
- 📝 **Auditoría**: Registro de acciones administrativas
- 🔒 **Sesiones Seguras**: Autenticación reforzada

*[Espacio para captura de pantalla del panel de administración]*

#### Dashboard Administrativo
- 📊 **Métricas Globales**: Estadísticas de todo el sistema
- 👥 **Clientes Activos**: Lista de organizaciones registradas
- 📈 **Uso del Sistema**: Recursos y rendimiento
- ⚠️ **Alertas**: Notificaciones importantes

### Gestión de Clientes

#### Lista de Clientes
- 🏢 **Información Empresarial**: Nombre, contacto, plan
- 📅 **Fechas**: Registro, último acceso, vencimiento
- 📊 **Estadísticas**: Usuarios, mensajes, almacenamiento
- ✅ **Estado**: Activo, suspendido, vencido

#### Creación de Nuevos Clientes
- 📝 **Formulario Completo**: Todos los datos necesarios
- 🏢 **Información Empresarial**: Razón social, CUIT, dirección
- 👤 **Usuario Administrador**: Credenciales iniciales
- 📋 **Configuración**: Límites y permisos iniciales

*[Espacio para captura de pantalla de creación de cliente]*

#### Configuración por Cliente
- 📊 **Límites de Uso**: Mensajes, usuarios, almacenamiento
- 🎛️ **Funcionalidades**: Módulos habilitados/deshabilitados
- 💰 **Facturación**: Plan, precios, vencimientos
- 🔧 **Configuraciones**: Personalizaciones específicas

### Monitoreo del Sistema

#### Métricas de Rendimiento
- 🖥️ **Servidor**: CPU, memoria, disco
- 🌐 **Red**: Ancho de banda, latencia
- 💾 **Base de Datos**: Consultas, conexiones, tamaño
- 📱 **WhatsApp**: Conexiones activas, mensajes/minuto

#### Logs del Sistema
- 📝 **Registro Completo**: Todas las operaciones
- 🔍 **Filtros Avanzados**: Por fecha, usuario, acción
- ⚠️ **Errores**: Identificación y seguimiento
- 📊 **Análisis**: Patrones y tendencias

*[Espacio para captura de pantalla de monitoreo]*

### Configuración Global

#### Parámetros del Sistema
- ⚙️ **Configuración General**: Timeouts, límites, URLs
- 📧 **Notificaciones**: Email, SMS, webhooks
- 🔐 **Seguridad**: Políticas de contraseñas, sesiones
- 🌐 **Integración**: APIs externas, servicios

#### Mantenimiento
- 🔄 **Backups**: Programación y verificación
- 🧹 **Limpieza**: Archivos temporales, logs antiguos
- 📊 **Optimización**: Base de datos, índices
- 🔧 **Actualizaciones**: Versiones, parches

### Reportes y Análisis

#### Reportes Predefinidos
- 📊 **Uso por Cliente**: Mensajes, usuarios, funcionalidades
- 📈 **Tendencias**: Crecimiento, patrones de uso
- 💰 **Facturación**: Resúmenes, vencimientos
- ⚠️ **Problemas**: Errores, incidencias

#### Exportación de Datos
- 📄 **Formatos**: PDF, Excel, CSV
- 📅 **Períodos**: Diario, semanal, mensual, personalizado
- 🎯 **Filtros**: Por cliente, fecha, tipo de dato
- 📧 **Envío**: Email automático, descarga directa

*[Espacio para captura de pantalla de reportes]*

### Herramientas de Soporte

#### Diagnóstico de Problemas
- 🔍 **Análisis de Conexiones**: WhatsApp por cliente
- 📊 **Métricas Específicas**: Rendimiento individual
- 📝 **Logs Detallados**: Información técnica
- 🛠️ **Acciones Correctivas**: Herramientas de solución

#### Soporte a Clientes
- 💬 **Chat Directo**: Comunicación con clientes
- 📧 **Tickets**: Sistema de soporte estructurado
- 📋 **Base de Conocimientos**: Documentación y FAQs
- 🎓 **Capacitación**: Materiales de entrenamiento

---

## 🔧 Configuración y Personalización

### Configuración de Usuario

#### Perfil Personal
- 👤 **Información Personal**: Nombre, email, teléfono
- 🔐 **Cambio de Contraseña**: Seguridad de acceso
- 🌐 **Preferencias**: Idioma, zona horaria
- 📧 **Notificaciones**: Email, push, en aplicación

#### Configuración de Interfaz
- 🎨 **Tema**: Claro, oscuro, automático
- 📱 **Responsive**: Adaptación a dispositivos
- 🔧 **Personalización**: Layout, widgets
- 💾 **Persistencia**: Configuraciones guardadas

### Configuración de Empresa

#### Información Corporativa
- 🏢 **Datos de la Empresa**: Nombre, logo, información de contacto
- 📄 **Documentos**: Términos, políticas, plantillas
- 🎨 **Branding**: Colores, tipografías, estilos
- 📧 **Comunicaciones**: Firmas, encabezados

#### Configuraciones Operativas
- ⏰ **Horarios de Trabajo**: Días y horas de operación
- 🌍 **Zona Horaria**: Configuración regional
- 💰 **Moneda**: Formato de precios y facturación
- 📊 **Métricas**: KPIs y objetivos

---

## 📚 Mejores Prácticas

### Organización de Contactos
1. **Usar Etiquetas Consistentes**: Crear un sistema de categorización claro
2. **Mantener Datos Actualizados**: Revisar y limpiar regularmente
3. **Segmentación Efectiva**: Agrupar por criterios relevantes
4. **Backup Regular**: Exportar datos periódicamente

### Gestión de Mensajes
1. **Templates Reutilizables**: Crear plantillas para mensajes frecuentes
2. **Personalización**: Usar variables para mensajes más efectivos
3. **Timing Adecuado**: Respetar horarios de los contactos
4. **Seguimiento**: Monitorear respuestas y engagement

### Configuración de IA
1. **Prompt Específico**: Definir claramente el rol y limitaciones
2. **Pruebas Regulares**: Validar respuestas periódicamente
3. **Ajustes Graduales**: Modificar configuración paso a paso
4. **Monitoreo Continuo**: Revisar estadísticas de uso

### Seguridad
1. **Contraseñas Fuertes**: Usar combinaciones seguras
2. **Accesos Limitados**: Dar permisos mínimos necesarios
3. **Sesiones Seguras**: Cerrar sesión al terminar
4. **Actualizaciones**: Mantener sistema actualizado

---

## 🆘 Soporte y Ayuda

### Recursos de Ayuda
- 📖 **Documentación**: Manual completo y actualizado
- 🎥 **Videos Tutoriales**: Guías paso a paso
- ❓ **FAQ**: Preguntas frecuentes y respuestas
- 💬 **Chat de Soporte**: Asistencia en tiempo real

### Contacto de Soporte
- 📧 **Email**: soporte@crmcondorito.com
- 📱 **WhatsApp**: +54 9 11 xxxx-xxxx
- 🌐 **Portal Web**: www.crmcondorito.com/soporte
- ⏰ **Horarios**: Lunes a Viernes, 9:00 - 18:00 ART

### Actualizaciones del Sistema
- 🔄 **Actualizaciones Automáticas**: Mejoras y correcciones
- 📢 **Notificaciones**: Información sobre nuevas funcionalidades
- 📋 **Changelog**: Registro detallado de cambios
- 🎯 **Roadmap**: Funcionalidades planificadas

---

## 📝 Notas Finales

Este manual cubre todas las funcionalidades principales del CRM Condorito. Para obtener la mejor experiencia:

1. **Explore Gradualmente**: Comience con funcionalidades básicas
2. **Practique Regularmente**: Use el sistema diariamente
3. **Personalice Según Necesidades**: Adapte configuraciones
4. **Manténgase Actualizado**: Revise nuevas funcionalidades
5. **Solicite Soporte**: No dude en contactar ayuda cuando sea necesario

**¡Esperamos que CRM Condorito transforme positivamente su gestión de comunicaciones con WhatsApp!**

---

*Documento generado automáticamente - Versión 1.0*
*Fecha: Octubre 2025*
*© CRM Condorito - Todos los derechos reservados*
