# 🗄️ INSTALACIÓN DE BASE DE DATOS - CRM CONDORITO

## 📋 ARCHIVOS DE BASE DE DATOS

### 📁 Archivos disponibles:
- **`crm_condorito_db_COMPLETO.sql`** (267KB) - Dump completo con datos
- **`DATABASE_COMPLETE_SETUP.sql`** - Solo estructura (sin datos)

## 🚀 OPCIÓN 1: IMPORTAR DUMP COMPLETO (RECOMENDADO)

### En phpMyAdmin (Hestia Control Panel):

1. **🌐 Acceder a phpMyAdmin:**
   - Panel Hestia → Database → phpMyAdmin
   - O directamente: `https://tu-ip:8083/phpmyadmin`

2. **🗄️ Crear base de datos:**
   ```sql
   CREATE DATABASE crm_condorito_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

3. **👤 Crear usuario:**
   ```sql
   CREATE USER 'crm_user'@'localhost' IDENTIFIED BY 'tu_password_seguro';
   GRANT ALL PRIVILEGES ON crm_condorito_prod.* TO 'crm_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

4. **📤 Importar datos:**
   - Seleccionar base de datos `crm_condorito_prod`
   - Ir a pestaña **"Importar"**
   - Seleccionar archivo `crm_condorito_db_COMPLETO.sql`
   - Hacer clic en **"Continuar"**

## 🚀 OPCIÓN 2: VÍA SSH (MÁS RÁPIDO)

### Si tienes acceso SSH:

```bash
# 1. Subir el archivo SQL al servidor
scp crm_condorito_db_COMPLETO.sql usuario@tu-ip:/tmp/

# 2. Conectar por SSH
ssh usuario@tu-ip

# 3. Crear base de datos y usuario
mysql -u root -p << EOF
CREATE DATABASE crm_condorito_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'crm_user'@'localhost' IDENTIFIED BY 'tu_password_seguro';
GRANT ALL PRIVILEGES ON crm_condorito_prod.* TO 'crm_user'@'localhost';
FLUSH PRIVILEGES;
EOF

# 4. Importar datos
mysql -u crm_user -p crm_condorito_prod < /tmp/crm_condorito_db_COMPLETO.sql

# 5. Limpiar archivo temporal
rm /tmp/crm_condorito_db_COMPLETO.sql
```

## 📊 CONTENIDO DE LA BASE DE DATOS

### 📋 Tablas incluidas (17 tablas):
- ✅ **ai_configurations** - Configuración de IA
- ✅ **ai_suggestions** - Sugerencias de IA
- ✅ **bot_configurations** - Configuración del bot
- ✅ **bulk_messages** - Mensajes masivos
- ✅ **clients** - Clientes del sistema
- ✅ **contact_tag_relations** - Relaciones contacto-etiqueta
- ✅ **contact_tags** - Etiquetas de contactos
- ✅ **contacts** - Contactos
- ✅ **conversation_group_relations** - Grupos de conversaciones
- ✅ **conversation_groups** - Grupos de conversaciones
- ✅ **conversations** - Conversaciones
- ✅ **message_templates** - Plantillas de mensajes
- ✅ **messages** - Mensajes
- ✅ **scheduled_message_executions** - Ejecuciones de mensajes programados
- ✅ **scheduled_message_recipients** - Destinatarios de mensajes programados
- ✅ **scheduled_messages** - Mensajes programados
- ✅ **whatsapp_sessions** - Sesiones de WhatsApp

### 📈 Datos incluidos:
- ✅ **13 tablas con datos** reales
- ✅ **Configuraciones** del sistema
- ✅ **Contactos** y conversaciones
- ✅ **Mensajes** y plantillas
- ✅ **Usuarios** y configuraciones

## ⚙️ CONFIGURACIÓN DEL BACKEND

### Después de importar, configurar `.env`:
```bash
# En el servidor, editar el archivo .env del backend:
nano /home/usuario/web/crm.condorestudio.com/backend/.env

# Configurar:
DB_HOST=localhost
DB_USER=crm_user
DB_PASSWORD=tu_password_seguro
DB_NAME=crm_condorito_prod
```

## 🧪 VERIFICAR IMPORTACIÓN

### Comandos para verificar:
```bash
# Conectar a la base de datos
mysql -u crm_user -p crm_condorito_prod

# Verificar tablas
SHOW TABLES;

# Verificar datos (ejemplo)
SELECT COUNT(*) FROM clients;
SELECT COUNT(*) FROM contacts;
SELECT COUNT(*) FROM messages;

# Salir
EXIT;
```

## 🔧 SOLUCIÓN DE PROBLEMAS

### Si hay error de charset:
```sql
ALTER DATABASE crm_condorito_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Si hay error de permisos:
```sql
GRANT ALL PRIVILEGES ON crm_condorito_prod.* TO 'crm_user'@'localhost';
FLUSH PRIVILEGES;
```

### Si el archivo es muy grande para phpMyAdmin:
- Usar SSH (Opción 2)
- O dividir el archivo en partes más pequeñas

## 📝 NOTAS IMPORTANTES

- ✅ **Charset:** utf8mb4 (soporta emojis)
- ✅ **Timezone:** Configurado para Argentina (-03:00)
- ✅ **Datos reales:** Incluye configuraciones y datos de prueba
- ✅ **Compatible:** MySQL 5.7+ / MariaDB 10.2+
- ✅ **Tamaño:** 267KB (optimizado)

**¡La base de datos está lista para importar! 🗄️**
