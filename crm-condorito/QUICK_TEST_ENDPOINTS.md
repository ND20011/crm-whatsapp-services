# 🧪 **TESTING RÁPIDO - NUEVAS FUNCIONALIDADES**

## 🎯 **ENDPOINTS PARA PROBAR (Cliente: CLI001)**

### **🔐 1. LOGIN:**
```bash
curl -X POST 'http://localhost:3000/api/auth/login' \
-H 'Content-Type: application/json' \
-d '{"client_code": "CLI001", "password": "password123"}'
```

### **📝 2. TEMPLATES - Listar:**
```bash
curl -X GET 'http://localhost:3000/api/messages/templates' \
-H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### **📝 3. TEMPLATES - Crear uno nuevo:**
```bash
curl -X POST 'http://localhost:3000/api/messages/templates' \
-H 'Authorization: Bearer YOUR_JWT_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
    "name": "Bienvenida VIP",
    "content": "¡Hola {nombre}! 🌟 Bienvenido a {empresa}. Como cliente VIP tienes {descuento}% de descuento.",
    "variables": ["nombre", "empresa", "descuento"],
    "category": "vip",
    "is_active": true
}'
```

### **👥 4. CONTACTOS - Listar:**
```bash
curl -X GET 'http://localhost:3000/api/contacts' \
-H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### **👥 5. CONTACTOS - Crear uno nuevo:**
```bash
curl -X POST 'http://localhost:3000/api/contacts' \
-H 'Authorization: Bearer YOUR_JWT_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
    "phone_number": "5491155558888",
    "name": "Carlos Testing",
    "custom_name": "Carlitos",
    "comments": "Contacto de prueba creado via API"
}'
```

### **🏷️ 6. ETIQUETAS - Listar:**
```bash
curl -X GET 'http://localhost:3000/api/contacts/tags' \
-H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### **📤 7. CAMPAÑAS - Listar:**
```bash
curl -X GET 'http://localhost:3000/api/messages/campaigns' \
-H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### **📤 8. CAMPAÑAS - Preview de contactos:**
```bash
curl -X POST 'http://localhost:3000/api/messages/campaigns/preview' \
-H 'Authorization: Bearer YOUR_JWT_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
    "contact_filter": {
        "is_active": true,
        "limit": 10
    }
}'
```

### **🤖 9. BOT - Ver configuración:**
```bash
curl -X GET 'http://localhost:3000/api/messages/bot/config' \
-H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### **🤖 10. BOT - Ver estado de cuota:**
```bash
curl -X GET 'http://localhost:3000/api/messages/bot/quota' \
-H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

---

## 🎯 **RESULTADOS ESPERADOS:**

### **✅ Templates:**
- Debería mostrar los 2 templates creados en el SQL
- Crear un nuevo template VIP exitosamente

### **✅ Contactos:**
- Debería mostrar los 2 contactos creados en el SQL
- Crear un nuevo contacto exitosamente

### **✅ Etiquetas:**
- Debería mostrar: VIP (#FFD700) y Potencial (#28A745)

### **✅ Campañas:**
- Lista vacía inicialmente (normal)
- Preview debería mostrar los contactos disponibles

### **✅ Bot:**
- Configuración con product_search_enabled: false
- Cuota: 2500 mensajes disponibles, 0 usados

---

## 🚀 **SI TODO FUNCIONA:**

¡Significa que el sistema completo está operativo! 🎉

- ✅ Gestión de Contactos (ETAPA 3)
- ✅ Sistema de Templates (ETAPA 4) 
- ✅ Sistema de Mensajes Masivos (ETAPA 4)
- ✅ Bot con Control de Cuotas
- ✅ Todas las nuevas funcionalidades premium
