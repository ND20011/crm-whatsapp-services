# 📚 MANUAL DE USUARIO - CRM CONDORITO BACKEND

## 🚀 **INTRODUCCIÓN**

El **CRM Condorito Backend** es un sistema completo de gestión de relaciones con clientes integrado con WhatsApp. Permite a múltiples clientes gestionar sus conversaciones, automatizar respuestas con IA, y administrar contactos de forma eficiente.

### **🎯 CARACTERÍSTICAS PRINCIPALES:**
- ✅ **Multi-cliente**: Cada cliente maneja su propia sesión de WhatsApp
- ✅ **Autenticación JWT**: Sistema seguro de tokens
- ✅ **WhatsApp Integration**: Conexión real con WhatsApp Web
- ✅ **IA Automática**: Respuestas inteligentes configurables
- ✅ **Tiempo Real**: Socket.io para eventos en vivo
- ✅ **Base de Datos**: MySQL con estructura normalizada
- ✅ **API RESTful**: Endpoints organizados y documentados

---

## 🔧 **CONFIGURACIÓN INICIAL**

### **1. Requisitos del Sistema**
```bash
- Node.js >= 18.0.0
- MySQL >= 8.0
- Puerto 3002 disponible
- Conexión a internet estable
```

### **2. Variables de Entorno (.env)**
```env
# Base de datos
DB_HOST=localhost
DB_USER=crm_condorito
DB_PASSWORD=CRM2024$ecure!
DB_NAME=crm_condorito_db
DB_PORT=3306

# JWT
JWT_SECRET=crm-condorito-super-secret-key-2024
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Servidor
PORT=3002
NODE_ENV=development

# IA (Opcional)
AI_API_URL=https://sistema.condorestudio.com.ar/back/respuestaIaWpp.php
```

### **3. Iniciar el Servidor**
```bash
cd /path/to/crm-condorito/backend
npm install
PORT=3002 node src/app.js
```

**Salida esperada:**
```
🚀 ====================================
   CRM CONDORITO BACKEND INICIADO
🚀 ====================================
📡 Servidor: http://localhost:3002
🔌 Socket.io: Habilitado
🌍 Entorno: development
```

---

## 🔐 **SISTEMA DE AUTENTICACIÓN**

### **Base URL:** `http://localhost:3002/api/auth`

### **1. Login - POST /login**
Autentica un cliente y obtiene tokens de acceso.

**Request:**
```json
POST /api/auth/login
Content-Type: application/json

{
  "client_code": "CLI001",
  "password": "demo123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login exitoso",
  "client": {
    "id": 1,
    "client_code": "CLI001",
    "company_name": "Empresa Demo CRM",
    "email": "demo@crm-condorito.com",
    "phone": "+5491123456789",
    "status": "active"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": "24h"
  },
  "stats": {
    "totalContacts": 0,
    "totalConversations": 0,
    "totalMessages": 0
  }
}
```

### **2. Verificar Token - GET /verify**
Valida un token de acceso.

**Request:**
```bash
GET /api/auth/verify
Authorization: Bearer [ACCESS_TOKEN]
```

**Response (200):**
```json
{
  "success": true,
  "message": "Token válido",
  "client": { ... },
  "tokenInfo": {
    "issuedAt": "2025-09-06T01:00:00.000Z",
    "expiresAt": "2025-09-07T01:00:00.000Z"
  }
}
```

### **3. Perfil del Cliente - GET /profile**
Obtiene información completa del cliente autenticado.

**Request:**
```bash
GET /api/auth/profile
Authorization: Bearer [ACCESS_TOKEN]
```

**Response (200):**
```json
{
  "success": true,
  "client": { ... },
  "stats": { ... },
  "whatsappSession": {
    "id": 1,
    "phone_number": "+5491123456789",
    "status": "ready",
    "connected_at": "2025-09-06T01:00:00.000Z"
  },
  "botConfig": {
    "is_enabled": 1,
    "working_hours_start": "09:00:00",
    "working_hours_end": "18:00:00",
    "working_days": [1,2,3,4,5]
  }
}
```

### **4. Logout - POST /logout**
Invalida el token actual.

**Request:**
```bash
POST /api/auth/logout
Authorization: Bearer [ACCESS_TOKEN]
```

---

## 📱 **SISTEMA WHATSAPP**

### **Base URL:** `http://localhost:3002/api/whatsapp`

### **1. Conectar WhatsApp - POST /connect**
Inicia una nueva sesión de WhatsApp y genera QR code.

**Request:**
```bash
POST /api/whatsapp/connect
Authorization: Bearer [ACCESS_TOKEN]
Content-Type: application/json
```

**Response (200):**
```json
{
  "success": true,
  "message": "Cliente inicializado correctamente",
  "status": "initializing",
  "phoneNumber": null,
  "hasQR": false
}
```

### **2. Obtener QR Code (Imagen) - GET /qr/:clientCode**
Devuelve el QR code como imagen PNG para escanear.

**Request:**
```bash
GET /api/whatsapp/qr/CLI001
Authorization: Bearer [ACCESS_TOKEN]
```

**Response:** Imagen PNG directa (Content-Type: image/png)

**Uso práctico:**
```bash
# Descargar QR como imagen
curl -H "Authorization: Bearer [TOKEN]" \
     "http://localhost:3002/api/whatsapp/qr/CLI001" \
     -o qr-whatsapp.png

# Abrir imagen
open qr-whatsapp.png  # Mac
xdg-open qr-whatsapp.png  # Linux
```

### **3. Obtener QR Code (JSON) - GET /qr-json/:clientCode**
Devuelve el QR code como base64 en JSON.

**Request:**
```bash
GET /api/whatsapp/qr-json/CLI001
Authorization: Bearer [ACCESS_TOKEN]
```

**Response (200):**
```json
{
  "success": true,
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "timestamp": "2025-09-06T01:00:00.000Z",
  "expiresIn": 295000
}
```

### **4. Estado de WhatsApp - GET /status**
Obtiene el estado actual de la conexión WhatsApp.

**Request:**
```bash
GET /api/whatsapp/status
Authorization: Bearer [ACCESS_TOKEN]
```

**Response (200):**
```json
{
  "success": true,
  "status": "ready",
  "hasQR": false,
  "phoneNumber": "+5491123456789",
  "clientInfo": {
    "pushname": "Mi Empresa",
    "wid": "5491123456789@c.us"
  },
  "session": {
    "session_id": "CLI001",
    "phone_number": "+5491123456789",
    "status": "ready",
    "connected_at": "2025-09-06T01:00:00.000Z",
    "is_active": true
  }
}
```

**Estados posibles:**
- `not_initialized`: No conectado
- `initializing`: Iniciando conexión
- `waiting_qr`: Esperando escaneo de QR
- `authenticated`: Autenticado, finalizando
- `ready`: ✅ Conectado y listo
- `disconnected`: Desconectado

### **5. Enviar Mensaje - POST /send-message**
Envía un mensaje de texto a un contacto.

**Request:**
```json
POST /api/whatsapp/send-message
Authorization: Bearer [ACCESS_TOKEN]
Content-Type: application/json

{
  "to": "5491123456789",
  "message": "¡Hola! Este es un mensaje desde el CRM.",
  "isBot": false
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Mensaje enviado correctamente",
  "messageId": "msg_12345",
  "to": "5491123456789@c.us",
  "isBot": false
}
```

### **6. Enviar Imagen - POST /send-image**
Envía una imagen a un contacto.

**Request:**
```bash
POST /api/whatsapp/send-image
Authorization: Bearer [ACCESS_TOKEN]
Content-Type: multipart/form-data

# Form data:
to: 5491123456789
caption: "Descripción de la imagen"
image: [archivo de imagen]
```

### **7. Desconectar WhatsApp - POST /disconnect**
Desconecta la sesión actual de WhatsApp.

**Request:**
```bash
POST /api/whatsapp/disconnect
Authorization: Bearer [ACCESS_TOKEN]
```

**Response (200):**
```json
{
  "success": true,
  "message": "Cliente desconectado correctamente",
  "status": "disconnected"
}
```

### **8. Estadísticas WhatsApp - GET /stats**
Obtiene estadísticas generales del servicio WhatsApp.

**Request:**
```bash
GET /api/whatsapp/stats
Authorization: Bearer [ACCESS_TOKEN]
```

**Response (200):**
```json
{
  "success": true,
  "stats": {
    "totalClients": 1,
    "connectedClients": 1,
    "waitingQR": 0,
    "disconnectedClients": 0
  }
}
```

---

## 💬 **SISTEMA DE MENSAJES**

### **Base URL:** `http://localhost:3002/api/messages`

### **1. Obtener Conversaciones - GET /conversations**
Lista todas las conversaciones del cliente.

**Request:**
```bash
GET /api/messages/conversations?limit=50&offset=0&archived=false
Authorization: Bearer [ACCESS_TOKEN]
```

**Parámetros opcionales:**
- `limit`: Número de resultados (default: 50)
- `offset`: Desplazamiento para paginación (default: 0)
- `archived`: Mostrar archivadas (default: false)
- `search`: Buscar por nombre o teléfono

**Response (200):**
```json
{
  "success": true,
  "conversations": [
    {
      "id": 1,
      "contact_phone": "5491123456789",
      "contact_name": "Juan Pérez",
      "last_message": "Hola, ¿cómo estás?",
      "last_message_at": "2025-09-06T01:00:00.000Z",
      "unread_count": 2,
      "is_bot_disabled": false,
      "is_archived": false,
      "total_messages": 15,
      "unread_messages": 2
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 1
  }
}
```

### **2. Obtener Mensajes de Conversación - GET /conversation/:contactId**
Lista los mensajes de una conversación específica.

**Request:**
```bash
GET /api/messages/conversation/1?limit=50&offset=0
Authorization: Bearer [ACCESS_TOKEN]
```

**Response (200):**
```json
{
  "success": true,
  "messages": [
    {
      "id": 1,
      "message_id": "msg_12345",
      "sender_type": "contact",
      "from_me": false,
      "is_from_bot": false,
      "type": "text",
      "content": "Hola, ¿cómo estás?",
      "media_url": null,
      "is_read": true,
      "sent_at": "2025-09-06T01:00:00.000Z"
    }
  ],
  "conversation": {
    "contact_phone": "5491123456789",
    "contact_name": "Juan Pérez"
  },
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 1
  }
}
```

**Tipos de sender_type:**
- `contact`: Mensaje del contacto
- `client`: Mensaje manual del cliente
- `bot`: Mensaje automático del bot

### **3. Marcar Conversación como Leída - POST /conversation/:contactId/read**
Marca todos los mensajes de una conversación como leídos.

**Request:**
```bash
POST /api/messages/conversation/1/read
Authorization: Bearer [ACCESS_TOKEN]
```

**Response (200):**
```json
{
  "success": true,
  "message": "Conversación marcada como leída",
  "unread_count": 0
}
```

### **4. Buscar Mensajes - GET /search**
Busca mensajes por contenido.

**Request:**
```bash
GET /api/messages/search?q=hola&limit=20&offset=0
Authorization: Bearer [ACCESS_TOKEN]
```

**Parámetros:**
- `q`: Término de búsqueda (requerido)
- `limit`: Número de resultados (default: 50)
- `offset`: Desplazamiento (default: 0)
- `conversation_id`: Buscar solo en una conversación

**Response (200):**
```json
{
  "success": true,
  "messages": [
    {
      "id": 1,
      "content": "Hola, ¿cómo estás?",
      "contact_phone": "5491123456789",
      "contact_name": "Juan Pérez",
      "sent_at": "2025-09-06T01:00:00.000Z"
    }
  ],
  "search_term": "hola",
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 1
  }
}
```

### **5. Estadísticas de Mensajes - GET /stats**
Obtiene estadísticas de mensajes del cliente.

**Request:**
```bash
GET /api/messages/stats?period_hours=24
Authorization: Bearer [ACCESS_TOKEN]
```

**Response (200):**
```json
{
  "success": true,
  "stats": {
    "total_messages": 150,
    "manual_messages": 45,
    "bot_messages": 30,
    "received_messages": 75,
    "active_conversations": 12,
    "unread_messages": 5,
    "period_hours": 24
  }
}
```

---

## 🤖 **SISTEMA DE IA Y BOT**

### **Configuración del Bot**
El bot se configura automáticamente con:
- **Horarios**: 09:00 - 18:00
- **Días**: Lunes a Viernes (1-5)
- **IA Endpoint**: Configurable en `.env`

### **Funcionamiento Automático**
1. **Recepción de Mensaje**: El sistema captura automáticamente
2. **Clasificación**: Determina si es contact/client/bot
3. **Verificación de Horarios**: Comprueba si el bot debe responder
4. **Consulta IA**: Envía historial al endpoint externo
5. **Respuesta Automática**: Envía la respuesta generada
6. **Guardado**: Almacena todo en la base de datos

### **Desactivar Bot para Contacto**
```bash
# El bot se desactiva automáticamente cuando:
# 1. El cliente envía un mensaje manual al contacto
# 2. Se puede reactivar desde el frontend (futuro)
```

---

## 🔄 **EVENTOS EN TIEMPO REAL (Socket.io)**

### **Conexión**
```javascript
const socket = io('http://localhost:3002');

socket.on('connect', () => {
  console.log('Conectado al servidor');
});
```

### **Eventos Disponibles**

#### **1. whatsapp_qr**
Se emite cuando se genera un nuevo QR code.
```javascript
socket.on('whatsapp_qr', (data) => {
  console.log('Nuevo QR:', data.qrCode);
  // data: { clientCode, qrCode, timestamp }
});
```

#### **2. whatsapp_ready**
Se emite cuando WhatsApp se conecta exitosamente.
```javascript
socket.on('whatsapp_ready', (data) => {
  console.log('WhatsApp conectado:', data.phoneNumber);
  // data: { clientCode, phoneNumber, clientInfo }
});
```

#### **3. whatsapp_disconnected**
Se emite cuando WhatsApp se desconecta.
```javascript
socket.on('whatsapp_disconnected', (data) => {
  console.log('WhatsApp desconectado:', data.reason);
  // data: { clientCode, reason }
});
```

#### **4. new_message**
Se emite cuando llega un nuevo mensaje.
```javascript
socket.on('new_message', (data) => {
  console.log('Nuevo mensaje:', data.message);
  // data: { clientCode, message, conversation, contact }
});
```

#### **5. message_sent**
Se emite cuando se envía un mensaje.
```javascript
socket.on('message_sent', (data) => {
  console.log('Mensaje enviado:', data.messageId);
  // data: { clientCode, messageId, to, content, isBot }
});
```

---

## 📊 **HEALTH CHECKS Y MONITOREO**

### **1. Health Check General - GET /health**
```bash
GET /health

Response:
{
  "status": "OK",
  "timestamp": "2025-09-06T01:00:00.000Z",
  "uptime": 3600.5,
  "environment": "development"
}
```

### **2. Health Check Autenticación - GET /api/auth/health**
```bash
GET /api/auth/health

Response:
{
  "module": "auth",
  "status": "OK",
  "timestamp": "2025-09-06T01:00:00.000Z",
  "endpoints": {
    "public": ["POST /api/auth/login", ...],
    "protected": ["GET /api/auth/verify", ...]
  }
}
```

### **3. Health Check WhatsApp - GET /api/whatsapp/health**
```bash
GET /api/whatsapp/health
Authorization: Bearer [ACCESS_TOKEN]

Response:
{
  "success": true,
  "message": "WhatsApp service is running",
  "stats": {
    "totalClients": 1,
    "connectedClients": 1,
    "waitingQR": 0,
    "disconnectedClients": 0
  }
}
```

### **4. Health Check Mensajes - GET /api/messages/health**
```bash
GET /api/messages/health
Authorization: Bearer [ACCESS_TOKEN]

Response:
{
  "module": "messages",
  "status": "ACTIVE",
  "services": {
    "message_service": "active",
    "ai_service": "healthy"
  },
  "endpoints": {
    "active": ["GET /api/messages/conversations", ...],
    "development": ["POST /api/messages/send-bulk", ...]
  }
}
```

---

## 🚨 **MANEJO DE ERRORES**

### **Códigos de Estado HTTP**
- `200`: Éxito
- `400`: Error de solicitud (datos inválidos)
- `401`: No autorizado (token inválido/expirado)
- `403`: Prohibido (sin permisos)
- `404`: No encontrado
- `410`: Recurso expirado (QR code)
- `429`: Demasiadas solicitudes (rate limiting)
- `500`: Error interno del servidor

### **Formato de Errores**
```json
{
  "success": false,
  "message": "Descripción del error",
  "error": "CODIGO_ERROR",
  "details": { ... }
}
```

### **Errores Comunes**

#### **1. Token Expirado (401)**
```json
{
  "success": false,
  "message": "Token expirado",
  "error": "TOKEN_EXPIRED"
}
```
**Solución**: Hacer login nuevamente o usar refresh token.

#### **2. WhatsApp No Conectado (400)**
```json
{
  "success": false,
  "message": "Cliente de WhatsApp no está conectado"
}
```
**Solución**: Conectar WhatsApp y escanear QR.

#### **3. QR Code Expirado (410)**
```json
{
  "success": false,
  "message": "QR code expirado. Solicita uno nuevo.",
  "hasQR": false,
  "expired": true
}
```
**Solución**: Reconectar WhatsApp para generar nuevo QR.

#### **4. Rate Limiting (429)**
```json
{
  "success": false,
  "message": "Demasiadas solicitudes. Intenta más tarde.",
  "retryAfter": 60
}
```
**Solución**: Esperar el tiempo indicado antes de reintentar.

---

## 🔧 **FLUJO DE TRABAJO TÍPICO**

### **1. Configuración Inicial**
```bash
# 1. Iniciar servidor
PORT=3002 node src/app.js

# 2. Verificar salud
curl http://localhost:3002/health
```

### **2. Autenticación**
```bash
# 1. Login
curl -X POST "http://localhost:3002/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"client_code": "CLI001", "password": "demo123456"}'

# 2. Guardar token para siguientes requests
TOKEN="eyJhbGciOiJIUzI1NiIs..."
```

### **3. Conectar WhatsApp**
```bash
# 1. Iniciar conexión
curl -X POST "http://localhost:3002/api/whatsapp/connect" \
  -H "Authorization: Bearer $TOKEN"

# 2. Obtener QR (esperar 5 segundos)
curl -H "Authorization: Bearer $TOKEN" \
     "http://localhost:3002/api/whatsapp/qr/CLI001" \
     -o qr.png

# 3. Escanear QR con WhatsApp

# 4. Verificar conexión
curl -H "Authorization: Bearer $TOKEN" \
     "http://localhost:3002/api/whatsapp/status"
```

### **4. Usar el Sistema**
```bash
# 1. Ver conversaciones
curl -H "Authorization: Bearer $TOKEN" \
     "http://localhost:3002/api/messages/conversations"

# 2. Enviar mensaje
curl -X POST "http://localhost:3002/api/whatsapp/send-message" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to": "5491123456789", "message": "¡Hola desde el CRM!"}'

# 3. Ver estadísticas
curl -H "Authorization: Bearer $TOKEN" \
     "http://localhost:3002/api/messages/stats"
```

---

## 🛠️ **TROUBLESHOOTING**

### **Problema: Servidor no inicia**
```bash
# Verificar puerto ocupado
lsof -i :3002

# Matar proceso si es necesario
kill -9 [PID]

# Verificar variables de entorno
cat .env
```

### **Problema: No se conecta a MySQL**
```bash
# Verificar conexión
mysql -u crm_condorito -p'CRM2024$ecure!' crm_condorito_db -e "SELECT 1;"

# Verificar tablas
mysql -u crm_condorito -p'CRM2024$ecure!' crm_condorito_db -e "SHOW TABLES;"
```

### **Problema: WhatsApp no se conecta**
```bash
# 1. Verificar logs del servidor
# 2. Regenerar QR code
curl -X POST "http://localhost:3002/api/whatsapp/connect" -H "Authorization: Bearer $TOKEN"

# 3. Verificar que el QR no esté expirado (5 minutos)
# 4. Asegurar conexión a internet estable
```

### **Problema: Mensajes no se guardan**
```bash
# Verificar estructura de BD
mysql -u crm_condorito -p'CRM2024$ecure!' crm_condorito_db -e "DESCRIBE messages;"

# Verificar logs de MessageService en consola del servidor
```

---

## 📈 **MEJORES PRÁCTICAS**

### **1. Seguridad**
- ✅ Siempre usar HTTPS en producción
- ✅ Rotar tokens JWT regularmente
- ✅ Validar todos los inputs
- ✅ Implementar rate limiting
- ✅ Logs de auditoría

### **2. Performance**
- ✅ Usar paginación en listas largas
- ✅ Implementar caché para consultas frecuentes
- ✅ Optimizar queries de base de datos
- ✅ Comprimir respuestas HTTP

### **3. Monitoreo**
- ✅ Health checks regulares
- ✅ Logs estructurados
- ✅ Métricas de performance
- ✅ Alertas automáticas

### **4. Escalabilidad**
- ✅ Separar servicios por responsabilidad
- ✅ Usar conexiones de BD pooled
- ✅ Implementar load balancing
- ✅ Considerar microservicios

---

## 📞 **SOPORTE Y CONTACTO**

### **Información del Sistema**
- **Versión**: 1.0.0
- **Autor**: CRM Condorito Team
- **Licencia**: Propietaria
- **Documentación**: Este manual

### **Logs Importantes**
```bash
# Logs del servidor (consola)
# Logs de WhatsApp Service
# Logs de MessageService
# Logs de base de datos
```

### **Archivos de Configuración**
- `.env`: Variables de entorno
- `src/config/database.js`: Configuración de BD
- `src/config/seed.js`: Datos iniciales

---

## 🔄 **CHANGELOG Y VERSIONES**

### **v1.0.0 - Release Inicial**
- ✅ Sistema de autenticación JWT
- ✅ Integración WhatsApp completa
- ✅ Sistema de mensajes y conversaciones
- ✅ IA automática configurable
- ✅ Socket.io para tiempo real
- ✅ API RESTful completa
- ✅ Multi-cliente support
- ✅ Health checks y monitoreo

---

## 🎯 **PRÓXIMAS FUNCIONALIDADES**

### **Planificadas para v1.1.0**
- 📅 Templates de mensajes
- 📅 Envío masivo de mensajes
- 📅 Gestión de contactos avanzada
- 📅 Tags y etiquetas
- 📅 Comentarios en contactos
- 📅 Programación de mensajes
- 📅 Dashboard de métricas
- 📅 Exportación de datos

---

**🎉 ¡Gracias por usar CRM Condorito Backend!**

*Este manual se actualiza constantemente. Para la versión más reciente, consulta la documentación oficial.*
