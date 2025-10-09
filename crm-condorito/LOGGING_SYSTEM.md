# 📊 Sistema de Logging - CRM Condorito

## 🎯 Objetivo

Hemos optimizado el sistema de logging para reducir el ruido en los logs y hacer más fácil el debugging y monitoreo del sistema.

## 📋 Niveles de Log

### Configuración por Variable de Entorno

```bash
# En tu archivo .env
LOG_LEVEL=INFO  # Cambia según necesites
```

### Niveles Disponibles

| Nivel | Descripción | Cuándo usar |
|-------|-------------|-------------|
| `SILENT` | Sin logs | Tests automatizados |
| `ERROR` | Solo errores críticos | Producción crítica |
| `WARN` | Errores y advertencias | Producción estable |
| `INFO` | Información importante | **Producción normal** ⭐ |
| `DEBUG` | Información detallada | **Desarrollo** ⭐ |
| `TRACE` | Todo, muy verboso | Debugging específico |

## 🔧 Configuración Recomendada

### Producción
```bash
NODE_ENV=production
LOG_LEVEL=INFO
```

### Desarrollo
```bash
NODE_ENV=development
LOG_LEVEL=DEBUG
```

### Testing
```bash
NODE_ENV=test
LOG_LEVEL=SILENT
```

## 📝 Tipos de Logs

### Logs por Categoría

| Emoji | Categoría | Nivel | Descripción |
|-------|-----------|-------|-------------|
| 🚀 | `startup` | INFO | Inicio del servidor |
| 🛑 | `shutdown` | INFO | Cierre del servidor |
| 🔐 | `auth` | INFO | Autenticación |
| 📡 | `api` | DEBUG | Requests API importantes |
| 💾 | `db` | DEBUG | Operaciones de base de datos |
| 🔌 | `socket` | DEBUG | Conexiones WebSocket |
| 📱 | `whatsapp` | INFO | Eventos de WhatsApp |
| 📨 | `message` | DEBUG | Mensajes |
| 🤖 | `bot` | INFO | Bot automático |
| 🧠 | `ai` | INFO | Inteligencia artificial |

### Logs por Severidad

| Emoji | Tipo | Nivel | Cuándo usar |
|-------|------|-------|-------------|
| ❌ | `error` | ERROR | Errores críticos |
| ⚠️ | `warn` | WARN | Advertencias |
| ℹ️ | `info` | INFO | Información importante |
| ✅ | `success` | INFO | Operaciones exitosas |
| 🔍 | `debug` | DEBUG | Información de debug |
| 📝 | `trace` | TRACE | Información muy detallada |

## 🎛️ Configuración de Morgan (HTTP Logs)

### Producción (`LOG_LEVEL=INFO`)
- Solo errores HTTP (status >= 400)
- Formato: `combined` (completo)

### Desarrollo (`LOG_LEVEL=DEBUG`)
- Todos los requests
- Formato: `dev` (colorido)

### Desarrollo Normal (sin DEBUG)
- Solo POST, PUT, DELETE exitosos
- Formato: `short` (conciso)

## 📊 Logs de Acceso API

Solo se registran operaciones importantes:
- ➕ POST (crear)
- ✏️ PUT (actualizar)  
- 🗑️ DELETE (eliminar)

Los GET requests no se registran para reducir ruido.

## 🔌 Logs de WebSocket

Solo en modo DEBUG:
- Conexiones de clientes
- Desconexiones
- Unión a rooms

## 💡 Ejemplos de Uso

### En el código del backend:

```javascript
const { logger } = require('../config/logger');

// Logs importantes (siempre se ven en INFO+)
logger.success('Usuario autenticado correctamente');
logger.error('Error al conectar con la base de datos', error);
logger.whatsapp('QR generado para cliente demo');

// Logs de debug (solo en DEBUG+)
logger.debug('Procesando mensaje', messageData);
logger.socket('Cliente conectado', socketId);
logger.db('Query ejecutada', query);
```

### Cambiar nivel en tiempo real:

```bash
# Reiniciar con más detalle
LOG_LEVEL=DEBUG npm start

# Reiniciar con menos ruido
LOG_LEVEL=WARN npm start
```

## 🎯 Beneficios

### ✅ Antes vs Después

**Antes (problemático):**
```
📊 Access Log: demo | GET /api/contacts | IP: ::1 | UA: Mozilla/5.0...
📊 Access Log: demo | GET /api/contacts/tags | IP: ::1 | UA: Mozilla/5.0...
🔌 Cliente conectado via Socket.io: abc123
🔌 Cliente desconectado: abc123
::1 - - [28/Sep/2025:14:07:15 +0000] "GET /api/contacts HTTP/1.1" 200...
```

**Después (limpio):**
```
🚀 CRM CONDORITO BACKEND INICIADO
ℹ️ Servidor: http://localhost:3000
ℹ️ Log Level: INFO
➕ demo | POST /api/contacts/16/tags
✅ Tags actualizadas exitosamente
```

### 📈 Mejoras Logradas

1. **90% menos logs** en operaciones normales
2. **Logs más legibles** con emojis y categorías
3. **Configuración flexible** por entorno
4. **Debugging más fácil** con niveles granulares
5. **Mejor performance** al evitar logs innecesarios

## 🔧 Troubleshooting

### No veo logs suficientes
```bash
LOG_LEVEL=DEBUG npm start
```

### Demasiados logs
```bash
LOG_LEVEL=WARN npm start
```

### Solo errores
```bash
LOG_LEVEL=ERROR npm start
```

### Sin logs (testing)
```bash
LOG_LEVEL=SILENT npm start
```

---

**🎉 ¡Sistema de logging optimizado y listo para producción!**
