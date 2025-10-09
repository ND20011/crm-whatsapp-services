# 🚀 GUÍA COMPLETA - COMPILACIÓN DEL BACKEND CRM CONDORITO

## 📋 COMANDOS EJECUTADOS PASO A PASO

### 🔧 **PASO 1: PREPARACIÓN DEL ENTORNO**

```bash
# 1. Cambiar a Node.js v22.12.0 (requerido por Angular CLI)
nvm use v22.12.0

# Verificar versión
node --version  # Debe mostrar v22.12.0
npm --version   # Debe mostrar v10.9.0
```

### 📦 **PASO 2: INSTALAR DEPENDENCIAS DEL BACKEND**

```bash
# 2. Navegar al directorio del backend
cd crm-condorito/backend

# 3. Instalar dependencias para producción
npm install --production
```

**Salida esperada:**
```
npm warn config production Use `--omit=dev` instead.
up to date, audited 294 packages in 1s
29 packages are looking for funding
6 high severity vulnerabilities
```

### 🗂️ **PASO 3: CREAR DIRECTORIO DE DESPLIEGUE**

```bash
# 4. Volver al directorio raíz del proyecto
cd /Users/ndamario/Downloads/wpp

# 5. Limpiar y crear directorio para el paquete backend
rm -rf backend-deploy/ 
mkdir -p backend-deploy
```

### 📁 **PASO 4: COPIAR CÓDIGO FUENTE**

```bash
# 6. Copiar todo el contenido del backend excluyendo archivos innecesarios
cp -r crm-condorito/backend/* backend-deploy/

# 7. Eliminar archivos que no se necesitan en producción
rm -rf backend-deploy/node_modules    # Se reinstalarán en el servidor
rm -rf backend-deploy/sessions        # Archivos temporales de WhatsApp
rm -rf backend-deploy/logs           # Logs locales
rm -rf backend-deploy/.env           # Archivo de configuración local
```

### ⚙️ **PASO 5: CREAR ARCHIVOS DE CONFIGURACIÓN**

```bash
# 8. Crear archivo de configuración de ejemplo
cat > backend-deploy/.env.example << 'EOF'
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_USER=crm_user
DB_PASSWORD=tu_password_aqui
DB_NAME=crm_condorito_prod
JWT_SECRET=tu_jwt_secret_super_seguro_aqui_cambiar_por_uno_real
CORS_ORIGIN=https://crm.condorestudio.com
BASE_URL=https://crm.condorestudio.com
FRONTEND_URL=https://crm.condorestudio.com
EOF
```

### 📖 **PASO 6: CREAR GUÍA DE INSTALACIÓN**

```bash
# 9. Crear guía de instalación para el VPS
cat > backend-deploy/INSTALL_BACKEND.md << 'EOF'
# 🚀 INSTALACIÓN DEL BACKEND CRM CONDORITO

## 📋 PASOS EN EL VPS (Hestia Control Panel):

### 1. 📁 Ubicación de archivos:
```bash
/home/usuario/web/crm.condorestudio.com/backend/
```

### 2. 🔧 Instalar Node.js (si no está instalado):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3. 📦 Instalar dependencias:
```bash
cd /home/usuario/web/crm.condorestudio.com/backend
npm install --production
```

### 4. ⚙️ Configurar variables de entorno:
```bash
cp .env.example .env
nano .env
# Editar con tus datos de base de datos
```

### 5. 🗄️ Configurar base de datos:
- Crear base de datos `crm_condorito_prod` en phpMyAdmin
- Importar estructura desde `DATABASE_COMPLETE_SETUP.sql`

### 6. 🚀 Iniciar aplicación:
```bash
# Instalar PM2 globalmente
sudo npm install -g pm2

# Iniciar aplicación
pm2 start src/app.js --name "crm-backend"
pm2 save
pm2 startup
```

### 7. 🌐 Configurar proxy en Hestia:
- Panel → Web → Domains → crm.condorestudio.com
- Proxy: Activar
- Backend: http://localhost:3000

## 🧪 PROBAR:
```bash
curl http://localhost:3000/api/health
```

Debería responder: `{"status":"ok","timestamp":"..."}`
EOF
```

### 📦 **PASO 7: CREAR ARCHIVO ZIP**

```bash
# 10. Comprimir todo el paquete backend en un ZIP
zip -r crm-backend.zip backend-deploy/
```

**Salida esperada:**
```
adding: backend-deploy/ (stored 0%)
adding: backend-deploy/src/ (stored 0%)
adding: backend-deploy/package.json (deflated 56%)
... (muchos archivos más)
```

### ✅ **PASO 8: VERIFICAR RESULTADO**

```bash
# 11. Verificar el tamaño del archivo creado
ls -lh crm-backend.zip
```

**Salida esperada:**
```
-rw-r--r--@ 1 usuario  grupo    16M Oct  3 20:04 crm-backend.zip
```

## 📊 **RESUMEN DE ARCHIVOS CREADOS:**

```
📁 Directorio de trabajo: /Users/ndamario/Downloads/wpp/
├── 📦 crm-backend.zip (16MB) ← ARCHIVO PRINCIPAL PARA SUBIR
├── 📁 backend-deploy/ ← Directorio temporal
│   ├── 📄 .env.example ← Configuración de ejemplo
│   ├── 📄 INSTALL_BACKEND.md ← Guía de instalación
│   ├── 📄 package.json ← Dependencias
│   ├── 📁 src/ ← Código fuente
│   ├── 📁 migrations/ ← Scripts de base de datos
│   └── ... (otros archivos del proyecto)
```

## 🎯 **PRÓXIMOS PASOS:**

1. **📤 Subir `crm-backend.zip` por FTP** al VPS
2. **🗄️ Crear base de datos** en phpMyAdmin
3. **⚙️ Configurar variables** en `.env`
4. **🚀 Instalar y ejecutar** en el servidor

## 🔧 **COMANDOS ADICIONALES ÚTILES:**

### Para limpiar y recompilar:
```bash
rm -rf backend-deploy/ crm-backend.zip
# Luego repetir desde el PASO 3
```

### Para verificar contenido del ZIP:
```bash
unzip -l crm-backend.zip | head -20
```

### Para extraer y probar localmente:
```bash
mkdir test-backend
cd test-backend
unzip ../crm-backend.zip
cd backend-deploy
npm install
```

---

## 💡 **NOTAS IMPORTANTES:**

- ✅ **Node.js v22.12.0** es requerido
- ✅ **Sin node_modules** en el ZIP (se instalan en servidor)
- ✅ **Configuración para crm.condorestudio.com** incluida
- ✅ **16MB** de tamaño total
- ✅ **Listo para FTP** o panel web de Hestia

**¡El backend está listo para desplegar! 🚀**
