# 🧪 **TESTING COMPLETO - NUEVAS FUNCIONALIDADES**

## 🎯 **PLAN DE TESTING**

Vamos a probar en este orden todas las funcionalidades nuevas implementadas:

---

## 📋 **FASE 1: PREPARACIÓN**

### **1.1 Verificar el Servidor**
```bash
# Verificar si el servidor está corriendo
ps aux | grep node

# Si no está corriendo, iniciarlo
npm start

# O en modo desarrollo
npm run dev
```

### **1.2 Ejecutar Migración (REQUERIDO)**
```bash
# Crear la nueva tabla bulk_messages
node src/config/migrate.js up
```

### **1.3 Obtener JWT Token**
```bash
curl -X POST 'http://localhost:3000/api/auth/login' \
-H 'Content-Type: application/json' \
-d '{
    "clientCode": "CLI001",
    "password": "password123"
}'
```

**Guardar el `accessToken` de la respuesta para usarlo en todas las siguientes requests.**

---

## 📄 **FASE 2: TESTING SISTEMA DE TEMPLATES**

### **2.1 Ver Categorías Disponibles**
```bash
curl -X GET 'http://localhost:3000/api/messages/templates/categories' \
-H 'Authorization: Bearer TU_JWT_TOKEN'
```

### **2.2 Crear Template de Bienvenida**
```bash
curl -X POST 'http://localhost:3000/api/messages/templates' \
-H 'Authorization: Bearer TU_JWT_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
    "name": "Bienvenida Personalizada",
    "content": "¡Hola {nombre}! 👋 Bienvenido a {empresa}. Hoy es {fecha} y son las {hora}. ¿En qué podemos ayudarte?",
    "variables": ["nombre", "empresa", "fecha", "hora"],
    "category": "saludo",
    "is_active": true
}'
```

### **2.3 Crear Template de Promoción**
```bash
curl -X POST 'http://localhost:3000/api/messages/templates' \
-H 'Authorization: Bearer TU_JWT_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
    "name": "Promoción Especial",
    "content": "🎉 ¡Oferta especial para {nombre}! Aprovechá {descuento}% de descuento en {producto}. Válido hasta {fecha_vencimiento}.",
    "variables": ["nombre", "descuento", "producto", "fecha_vencimiento"],
    "category": "promocion",
    "is_active": true
}'
```

### **2.4 Listar Templates**
```bash
curl -X GET 'http://localhost:3000/api/messages/templates' \
-H 'Authorization: Bearer TU_JWT_TOKEN'
```

### **2.5 Preview de Template con Variables**
```bash
curl -X POST 'http://localhost:3000/api/messages/templates/1/preview' \
-H 'Authorization: Bearer TU_JWT_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
    "variables": {
        "nombre": "María González",
        "empresa": "TechStore Argentina"
    }
}'
```

### **2.6 Usar Template (Incrementar Contador)**
```bash
curl -X POST 'http://localhost:3000/api/messages/templates/1/use' \
-H 'Authorization: Bearer TU_JWT_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
    "variables": {
        "nombre": "Carlos Fernández",
        "empresa": "Mi Negocio Online"
    }
}'
```

### **2.7 Ver Estadísticas de Templates**
```bash
curl -X GET 'http://localhost:3000/api/messages/templates/stats' \
-H 'Authorization: Bearer TU_JWT_TOKEN'
```

---

## 👥 **FASE 3: TESTING GESTIÓN DE CONTACTOS**

### **3.1 Crear Contactos de Prueba**
```bash
# Contacto 1
curl -X POST 'http://localhost:3000/api/contacts' \
-H 'Authorization: Bearer TU_JWT_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
    "phone_number": "5491123456789",
    "name": "Juan Pérez",
    "custom_name": "Juancito",
    "comments": "Cliente VIP desde 2020"
}'

# Contacto 2
curl -X POST 'http://localhost:3000/api/contacts' \
-H 'Authorization: Bearer TU_JWT_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
    "phone_number": "5491987654321",
    "name": "María García",
    "custom_name": "Mari",
    "comments": "Interesada en productos orgánicos"
}'

# Contacto 3
curl -X POST 'http://localhost:3000/api/contacts' \
-H 'Authorization: Bearer TU_JWT_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
    "phone_number": "5491555111222",
    "name": "Pedro López",
    "comments": "Cliente frecuente"
}'
```

### **3.2 Crear Etiquetas**
```bash
# Etiqueta VIP
curl -X POST 'http://localhost:3000/api/contacts/tags' \
-H 'Authorization: Bearer TU_JWT_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
    "name": "VIP",
    "color": "#FFD700",
    "description": "Clientes VIP con descuentos especiales"
}'

# Etiqueta Potencial
curl -X POST 'http://localhost:3000/api/contacts/tags' \
-H 'Authorization: Bearer TU_JWT_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
    "name": "Potencial",
    "color": "#28A745",
    "description": "Clientes potenciales"
}'
```

### **3.3 Listar Contactos**
```bash
curl -X GET 'http://localhost:3000/api/contacts' \
-H 'Authorization: Bearer TU_JWT_TOKEN'
```

### **3.4 Agregar Tags a Contactos**
```bash
# Agregar tag VIP al contacto 1
curl -X POST 'http://localhost:3000/api/contacts/1/tags' \
-H 'Authorization: Bearer TU_JWT_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
    "tags": [1]
}'
```

---

## 📤 **FASE 4: TESTING MENSAJES MASIVOS**

### **4.1 Ver Estados de Campaña**
```bash
curl -X GET 'http://localhost:3000/api/messages/campaigns/statuses' \
-H 'Authorization: Bearer TU_JWT_TOKEN'
```

### **4.2 Preview de Selección de Contactos**
```bash
curl -X POST 'http://localhost:3000/api/messages/campaigns/preview' \
-H 'Authorization: Bearer TU_JWT_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
    "contact_filter": {
        "is_active": true,
        "limit": 10
    },
    "template_id": 1
}'
```

### **4.3 Crear Campaña de Prueba (Envío Inmediato)**
```bash
curl -X POST 'http://localhost:3000/api/messages/campaigns' \
-H 'Authorization: Bearer TU_JWT_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
    "campaign_name": "Test - Promoción Flash",
    "template_id": 2,
    "content": "🎉 ¡Hola {nombre}! Promoción especial solo para ti. ¡50% de descuento!",
    "selected_contact_ids": [1, 2]
}'
```

### **4.4 Crear Campaña Programada**
```bash
curl -X POST 'http://localhost:3000/api/messages/campaigns' \
-H 'Authorization: Bearer TU_JWT_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
    "campaign_name": "Newsletter Semanal",
    "content": "📰 Hola {nombre}, aquí las novedades de esta semana.",
    "scheduled_at": "2025-01-15T09:00:00.000Z",
    "selected_contact_ids": [1, 2, 3]
}'
```

### **4.5 Listar Campañas**
```bash
curl -X GET 'http://localhost:3000/api/messages/campaigns' \
-H 'Authorization: Bearer TU_JWT_TOKEN'
```

### **4.6 Ver Campaña Específica**
```bash
curl -X GET 'http://localhost:3000/api/messages/campaigns/1' \
-H 'Authorization: Bearer TU_JWT_TOKEN'
```

### **4.7 Enviar Campaña Programada Inmediatamente**
```bash
curl -X POST 'http://localhost:3000/api/messages/campaigns/2/send' \
-H 'Authorization: Bearer TU_JWT_TOKEN'
```

### **4.8 Ver Estadísticas de Campañas**
```bash
curl -X GET 'http://localhost:3000/api/messages/campaigns/stats' \
-H 'Authorization: Bearer TU_JWT_TOKEN'
```

---

## 📄 **FASE 5: TESTING ENVÍO DE DOCUMENTOS**

### **5.1 Enviar Documento PDF (Simular)**
```bash
# Crear un archivo de prueba
echo "Este es un documento de prueba" > /tmp/test_document.txt

# Enviar documento
curl -X POST 'http://localhost:3000/api/whatsapp/send-document' \
-H 'Authorization: Bearer TU_JWT_TOKEN' \
-F 'document=@/tmp/test_document.txt' \
-F 'to=5491123456789' \
-F 'caption=Documento de prueba enviado desde el CRM'
```

---

## 🔍 **FASE 6: TESTING FILTROS Y BÚSQUEDAS**

### **6.1 Filtrar Templates por Categoría**
```bash
curl -X GET 'http://localhost:3000/api/messages/templates?category=saludo' \
-H 'Authorization: Bearer TU_JWT_TOKEN'
```

### **6.2 Buscar Contactos**
```bash
curl -X GET 'http://localhost:3000/api/contacts?search=Juan' \
-H 'Authorization: Bearer TU_JWT_TOKEN'
```

### **6.3 Filtrar Campañas por Estado**
```bash
curl -X GET 'http://localhost:3000/api/messages/campaigns?status=completed' \
-H 'Authorization: Bearer TU_JWT_TOKEN'
```

---

## 🤖 **FASE 7: TESTING BOT Y CUOTAS**

### **7.1 Ver Estado de Cuota del Bot**
```bash
curl -X GET 'http://localhost:3000/api/messages/bot/quota' \
-H 'Authorization: Bearer TU_JWT_TOKEN'
```

### **7.2 Ver Configuración del Bot**
```bash
curl -X GET 'http://localhost:3000/api/messages/bot/config' \
-H 'Authorization: Bearer TU_JWT_TOKEN'
```

### **7.3 Habilitar Búsqueda de Productos**
```bash
curl -X POST 'http://localhost:3000/api/messages/bot/products/enable' \
-H 'Authorization: Bearer TU_JWT_TOKEN'
```

---

## ✅ **RESULTADOS ESPERADOS**

### **🎯 Templates:**
- ✅ Creación exitosa de templates con variables
- ✅ Preview en tiempo real con variables reemplazadas
- ✅ Contador de uso incrementándose
- ✅ Estadísticas mostrando uso por categoría

### **👥 Contactos:**
- ✅ CRUD completo funcionando
- ✅ Sistema de etiquetas operativo
- ✅ Búsquedas y filtros eficientes
- ✅ Relaciones entre contactos y tags

### **📤 Mensajes Masivos:**
- ✅ Preview de selección de contactos
- ✅ Creación de campañas exitosa
- ✅ Envío con rate limiting (lotes de 5, pausa 2 seg)
- ✅ Tracking de progreso en tiempo real
- ✅ Estados de campaña controlados

### **📄 Documentos:**
- ✅ Envío de archivos con validaciones
- ✅ Soporte para múltiples tipos de archivo
- ✅ Captions opcionales

### **🤖 Bot Avanzado:**
- ✅ Sistema de cuotas funcionando
- ✅ Configuración de productos operativa
- ✅ Límites por cliente aplicados

---

## 🚨 **POSIBLES ERRORES Y SOLUCIONES**

### **Error: "Tabla no existe"**
```bash
# Ejecutar migración
node src/config/migrate.js up
```

### **Error: "No se encontraron contactos"**
```bash
# Crear contactos primero en FASE 3
```

### **Error: "Template no encontrado"**
```bash
# Crear templates primero en FASE 2
```

### **Error: "Cliente no conectado"**
```bash
# Verificar conexión WhatsApp
curl -X GET 'http://localhost:3000/api/whatsapp/status' \
-H 'Authorization: Bearer TU_JWT_TOKEN'
```

---

## 🎉 **¡TESTING COMPLETO!**

Después de ejecutar todas estas pruebas, deberías tener:

- ✅ **2 templates** creados y funcionando
- ✅ **3 contactos** con etiquetas asignadas  
- ✅ **2 campañas** (una enviada, una programada)
- ✅ **Documento** enviado exitosamente
- ✅ **Estadísticas** mostrando toda la actividad

**¡El sistema estará completamente probado y funcionando!** 🚀
