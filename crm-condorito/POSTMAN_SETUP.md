# 📮 POSTMAN COLLECTION - CRM CONDORITO BACKEND

## 🚀 **ARCHIVOS INCLUIDOS**

1. **`CRM_Condorito_Backend.postman_collection.json`** - Colección completa con todos los endpoints
2. **`CRM_Condorito_Environment.postman_environment.json`** - Variables de entorno preconfiguradas
3. **`POSTMAN_SETUP.md`** - Este archivo con instrucciones

---

## 📥 **CÓMO IMPORTAR EN POSTMAN**

### **PASO 1: Importar la Colección**
1. Abre **Postman**
2. Click en **"Import"** (botón superior izquierdo)
3. Arrastra el archivo `CRM_Condorito_Backend.postman_collection.json`
4. Click **"Import"**

### **PASO 2: Importar el Environment**
1. En Postman, ve a **"Environments"** (icono de engranaje)
2. Click **"Import"**
3. Arrastra el archivo `CRM_Condorito_Environment.postman_environment.json`
4. Click **"Import"**

### **PASO 3: Activar el Environment**
1. En la esquina superior derecha, selecciona **"CRM Condorito - Development"**
2. Verifica que las variables estén cargadas

---

## ⚙️ **CONFIGURACIÓN INICIAL**

### **Variables de Entorno Incluidas:**
```
base_url = http://localhost:3002
client_code = CLI001
password = demo123456
test_phone = 5491123456789
access_token = (se llena automáticamente)
refresh_token = (se llena automáticamente)
```

### **Si tu servidor está en otro puerto:**
1. Ve a **Environments** → **CRM Condorito - Development**
2. Cambia `base_url` por tu URL (ej: `http://localhost:3001`)
3. Guarda los cambios

---

## 🎯 **CÓMO USAR LA COLECCIÓN**

### **1. PRIMER USO - AUTENTICACIÓN**
```
📁 🔐 AUTENTICACIÓN
  └── 🔑 Login - Obtener Token
```
1. Ejecuta **"Login - Obtener Token"**
2. ✅ El token se guarda automáticamente
3. Ya puedes usar todos los demás endpoints

### **2. CONECTAR WHATSAPP**
```
📁 📱 WHATSAPP
  ├── 🔌 Conectar WhatsApp
  ├── 📱 QR Code (Imagen PNG) ← ¡NUEVO!
  ├── 📊 Estado de WhatsApp
  └── 📤 Enviar Mensaje de Texto
```

**Flujo completo:**
1. **Conectar WhatsApp** → Inicia la sesión
2. **QR Code (Imagen PNG)** → ¡Ve la imagen directamente!
3. Escanea con tu teléfono
4. **Estado de WhatsApp** → Verifica que esté "ready"
5. **Enviar Mensaje** → Prueba el envío

### **3. GESTIONAR MENSAJES**
```
📁 💬 MENSAJES Y CONVERSACIONES
  ├── 📋 Listar Conversaciones
  ├── 💬 Mensajes de Conversación
  ├── ✅ Marcar como Leída
  ├── 🔍 Buscar Mensajes
  └── 📊 Estadísticas de Mensajes
```

---

## 🧪 **TESTING AUTOMATIZADO**

### **Carpeta "🧪 TESTING Y DESARROLLO"**
- **Test Completo del Sistema**: Verifica que todo funcione
- **Flujo Completo WhatsApp**: Secuencia paso a paso

### **Scripts Automáticos Incluidos:**
- ✅ **Auto-save de tokens** después del login
- ✅ **Validación de respuestas** automática
- ✅ **Logs detallados** en consola
- ✅ **Manejo de errores** automático

---

## 📊 **ESTRUCTURA DE LA COLECCIÓN**

### **🔐 AUTENTICACIÓN (5 endpoints)**
- Login - Obtener Token
- Verificar Token
- Perfil del Cliente
- Logout
- Health Check - Auth

### **📱 WHATSAPP (10 endpoints)**
- Conectar WhatsApp
- QR Code (Imagen PNG) 🆕
- QR Code (JSON Base64)
- Estado de WhatsApp
- Enviar Mensaje de Texto
- Enviar Imagen
- Enviar Documento
- Desconectar WhatsApp
- Estadísticas WhatsApp
- Health Check - WhatsApp

### **💬 MENSAJES Y CONVERSACIONES (6 endpoints)**
- Listar Conversaciones
- Mensajes de Conversación
- Marcar como Leída
- Buscar Mensajes
- Estadísticas de Mensajes
- Health Check - Messages

### **📊 HEALTH CHECKS Y MONITOREO (2 endpoints)**
- Health Check General
- Test de Conectividad

### **🧪 TESTING Y DESARROLLO**
- Test Completo del Sistema
- Flujo Completo WhatsApp (4 pasos)

---

## 🎨 **CARACTERÍSTICAS ESPECIALES**

### **🖼️ QR Code como Imagen**
- **Endpoint especial**: `GET /api/whatsapp/qr/CLI001`
- **Respuesta**: Imagen PNG directa
- **En Postman**: ¡Ves la imagen directamente!
- **Para escanear**: Guarda la imagen o escanea desde Postman

### **🤖 Scripts Inteligentes**
```javascript
// Auto-save del token después del login
if (pm.response.code === 200) {
    const response = pm.response.json();
    pm.environment.set('access_token', response.tokens.accessToken);
}
```

### **📝 Documentación Integrada**
- Cada endpoint tiene descripción detallada
- Ejemplos de uso
- Parámetros explicados
- Códigos de respuesta

---

## 🚨 **TROUBLESHOOTING**

### **Error: "Could not get any response"**
```bash
# Verificar que el servidor esté corriendo
curl http://localhost:3002/health
```

### **Error: "Unauthorized" (401)**
1. Ejecuta **"Login - Obtener Token"** primero
2. Verifica que el environment esté seleccionado
3. Revisa que `access_token` tenga valor

### **Error: "WhatsApp no conectado"**
1. Ejecuta **"Conectar WhatsApp"**
2. Obtén el **QR Code**
3. Escanea con tu teléfono
4. Verifica el **Estado de WhatsApp**

### **QR Code no aparece**
- Espera 5 segundos después de conectar
- El QR expira en 5 minutos
- Reconecta si es necesario

---

## 📋 **CHECKLIST DE VERIFICACIÓN**

### **✅ Importación Correcta**
- [ ] Colección importada (25+ endpoints)
- [ ] Environment importado y seleccionado
- [ ] Variables configuradas correctamente

### **✅ Primer Test**
- [ ] Health Check General funciona
- [ ] Login exitoso (token guardado)
- [ ] Perfil del Cliente funciona

### **✅ WhatsApp Test**
- [ ] Conectar WhatsApp exitoso
- [ ] QR Code se muestra como imagen
- [ ] Estado cambia a "ready" después del escaneo
- [ ] Envío de mensaje funciona

---

## 🎯 **FLUJO DE TRABAJO RECOMENDADO**

### **Para Desarrollo:**
1. **Health Check General** → Verificar servidor
2. **Login** → Autenticarse
3. **Conectar WhatsApp** → Iniciar sesión WA
4. **QR Code** → Escanear
5. **Estado WhatsApp** → Confirmar conexión
6. **Enviar Mensaje** → Probar funcionalidad

### **Para Testing:**
1. Usar carpeta **"🧪 TESTING Y DESARROLLO"**
2. **Test Completo del Sistema** → Verificación rápida
3. **Flujo Completo WhatsApp** → Test paso a paso

### **Para Debugging:**
1. **Health Checks** → Verificar módulos
2. **Estadísticas** → Ver métricas
3. **Logs en Consola** → Revisar errores

---

## 🔥 **TIPS AVANZADOS**

### **Variables Dinámicas**
```javascript
// En Pre-request Script
pm.environment.set('timestamp', Date.now());
pm.environment.set('random_phone', '549' + Math.floor(Math.random() * 1000000000));
```

### **Tests Personalizados**
```javascript
// En Tests
pm.test("WhatsApp está conectado", function () {
    const response = pm.response.json();
    pm.expect(response.status).to.equal("ready");
});
```

### **Automatización**
- Usa **Collection Runner** para ejecutar toda la colección
- Configura **Monitors** para testing continuo
- Exporta **Newman** para CI/CD

---

## 📞 **SOPORTE**

### **Si tienes problemas:**
1. Verifica que el servidor esté corriendo en el puerto correcto
2. Revisa las variables de entorno
3. Consulta los logs en la consola de Postman
4. Usa los Health Checks para diagnosticar

### **Archivos de referencia:**
- `MANUAL_USUARIO_BACKEND.md` - Documentación completa
- Logs del servidor en consola
- Variables de entorno en `.env`

---

**🎉 ¡Listo para usar! La colección incluye todo lo necesario para trabajar con el CRM Condorito Backend.**
