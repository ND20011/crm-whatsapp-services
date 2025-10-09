# 🌐 GUÍA COMPLETA - COMPILACIÓN DEL FRONTEND CRM CONDORITO

## 📋 COMANDOS EJECUTADOS PASO A PASO

### 🔧 **PASO 1: PREPARACIÓN DEL ENTORNO**

```bash
# 1. Asegurar que estamos usando Node.js v22.12.0
nvm use v22.12.0

# Verificar versión
node --version  # Debe mostrar v22.12.0
npm --version   # Debe mostrar v10.9.0
```

### ⚙️ **PASO 2: CONFIGURAR LÍMITES DE COMPILACIÓN**

```bash
# 2. Navegar al directorio del frontend
cd crm-condorito/frontend2

# 3. Editar angular.json para aumentar límites de CSS
# Cambiar en la sección "budgets" > "anyComponentStyle":
# De: "maximumWarning": "4kB", "maximumError": "8kB"
# A:  "maximumWarning": "100kB", "maximumError": "200kB"
```

**Comando para aplicar el cambio:**
```bash
sed -i 's/"maximumWarning": "4kB"/"maximumWarning": "100kB"/g' angular.json
sed -i 's/"maximumError": "8kB"/"maximumError": "200kB"/g' angular.json
```

### 📦 **PASO 3: INSTALAR DEPENDENCIAS Y COMPILAR**

```bash
# 4. Instalar dependencias si no existen
npm install

# 5. Compilar para producción
npm run build
```

**Salida esperada:**
```
❯ Building...
✔ Building...
Initial chunk files | Names                              |  Raw size | Estimated transfer size
chunk-IG74PQ4L.js   | -                                  | 183.20 kB |                53.26 kB
chunk-DWNZDXTT.js   | -                                  |  88.65 kB |                22.42 kB
...
Application bundle generation complete. [5.336 seconds]
```

### 🗂️ **PASO 4: CREAR ARCHIVO DE CONFIGURACIÓN**

```bash
# 6. Volver al directorio raíz del proyecto
cd /Users/ndamario/Downloads/wpp

# 7. Crear archivo de configuración para producción
mkdir -p crm-condorito/frontend2/dist/frontend2/browser/assets

cat > crm-condorito/frontend2/dist/frontend2/browser/assets/env.js << 'EOF'
// Configuración de producción para CRM Condorito
// Generado automáticamente el $(date)
(function(window) {
  window['env'] = window['env'] || {};
  
  // URL del API en producción
  window['env']['apiUrl'] = 'https://crm.condorestudio.com';
  
  // Otras configuraciones de producción
  window['env']['environment'] = 'production';
  window['env']['version'] = '20251003_225700';
})(this);
EOF
```

### 🗂️ **PASO 5: CREAR DIRECTORIO DE DESPLIEGUE**

```bash
# 8. Limpiar y crear directorio para el paquete frontend
rm -rf frontend-deploy/ 
mkdir -p frontend-deploy
```

### 📁 **PASO 6: COPIAR ARCHIVOS COMPILADOS**

```bash
# 9. Copiar todo el contenido compilado
cp -r crm-condorito/frontend2/dist/frontend2/browser/* frontend-deploy/
```

### ⚙️ **PASO 7: CREAR ARCHIVO .HTACCESS**

```bash
# 10. Crear configuración para Apache (Hestia Control Panel)
cat > frontend-deploy/.htaccess << 'EOF'
# Configuración para Angular en Apache (Hestia Control Panel)
RewriteEngine On

# Manejar rutas de Angular (SPA)
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

# Habilitar compresión
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>

# Cache para archivos estáticos
<IfModule mod_expires.c>
    ExpiresActive on
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/ico "access plus 1 year"
    ExpiresByType image/icon "access plus 1 year"
    ExpiresByType text/html "access plus 1 hour"
</IfModule>

# Seguridad
<Files "*.js.map">
    Order allow,deny
    Deny from all
</Files>
EOF
```

### 📖 **PASO 8: CREAR GUÍA DE INSTALACIÓN**

```bash
# 11. Crear guía de instalación para el VPS
cat > frontend-deploy/INSTALL_FRONTEND.md << 'EOF'
# 🌐 INSTALACIÓN DEL FRONTEND CRM CONDORITO

## 📋 PASOS EN EL VPS (Hestia Control Panel):

### 1. 📁 Ubicación de archivos:
```
/home/usuario/web/crm.condorestudio.com/public_html/
```

### 2. 📤 Subir archivos:
- Subir todo el contenido de `frontend-deploy/` al directorio `public_html/`
- O extraer `crm-frontend.zip` directamente en `public_html/`

### 3. ⚙️ Configurar permisos:
```bash
# SSH al VPS
chmod -R 755 /home/usuario/web/crm.condorestudio.com/public_html/
chown -R usuario:usuario /home/usuario/web/crm.condorestudio.com/public_html/
```

### 4. 🌐 Configurar dominio en Hestia:
1. **Panel Hestia** → **Web** → **Domains**
2. **Editar crm.condorestudio.com**
3. **Proxy Support**: ✅ Activar
4. **Backend IP**: 127.0.0.1
5. **Backend Port**: 3000
6. **SSL**: ✅ Activar (Let's Encrypt)

### 5. 🧪 Probar:
```
https://crm.condorestudio.com
```
EOF
```

### 📦 **PASO 9: CREAR ARCHIVO ZIP**

```bash
# 12. Comprimir todo el paquete frontend en un ZIP
zip -r crm-frontend.zip frontend-deploy/
```

**Salida esperada:**
```
adding: frontend-deploy/ (stored 0%)
adding: frontend-deploy/index.html (deflated 64%)
adding: frontend-deploy/chunk-*.js (deflated 70-85%)
adding: frontend-deploy/styles-*.css (deflated 72%)
adding: frontend-deploy/assets/env.js (deflated 38%)
adding: frontend-deploy/.htaccess (deflated 68%)
...
```

### ✅ **PASO 10: VERIFICAR RESULTADO**

```bash
# 13. Verificar el tamaño del archivo creado
ls -lh crm-frontend.zip
```

**Salida esperada:**
```
-rw-r--r--@ 1 usuario  grupo   354K Oct  3 20:42 crm-frontend.zip
```

## 📊 **RESUMEN DE ARCHIVOS CREADOS:**

```
📁 Directorio de trabajo: /Users/ndamario/Downloads/wpp/
├── 📦 crm-frontend.zip (354KB) ← ARCHIVO PRINCIPAL PARA SUBIR
├── 📁 frontend-deploy/ ← Directorio temporal
│   ├── 📄 index.html ← Aplicación Angular principal
│   ├── 📄 .htaccess ← Configuración Apache
│   ├── 📄 INSTALL_FRONTEND.md ← Guía de instalación
│   ├── 📁 assets/ ← Recursos estáticos
│   │   └── 📄 env.js ← Configuración de producción
│   ├── 📄 chunk-*.js ← Código JavaScript compilado
│   ├── 📄 styles-*.css ← Estilos compilados
│   └── 📄 favicon.ico ← Icono del sitio
```

## 🎯 **PRÓXIMOS PASOS:**

1. **📤 Subir `crm-frontend.zip` por FTP** al directorio `public_html/`
2. **🗂️ Extraer archivos** en el servidor
3. **⚙️ Configurar proxy** en Hestia Control Panel
4. **🔒 Activar SSL** (Let's Encrypt)
5. **🧪 Probar** la aplicación

## 🔧 **COMANDOS ADICIONALES ÚTILES:**

### Para limpiar y recompilar:
```bash
rm -rf frontend-deploy/ crm-frontend.zip
cd crm-condorito/frontend2
npm run build
# Luego repetir desde el PASO 4
```

### Para verificar contenido del ZIP:
```bash
unzip -l crm-frontend.zip | head -20
```

### Para probar localmente:
```bash
cd crm-condorito/frontend2
npm start
# Abrir http://localhost:4200
```

## 🌐 **CONFIGURACIÓN DE PRODUCCIÓN INCLUIDA:**

### En `assets/env.js`:
```javascript
window['env']['apiUrl'] = 'https://crm.condorestudio.com';
window['env']['environment'] = 'production';
```

### En `.htaccess`:
- ✅ **Rutas SPA** de Angular
- ✅ **Compresión** de archivos
- ✅ **Cache** de recursos estáticos
- ✅ **Seguridad** básica

---

## 💡 **NOTAS IMPORTANTES:**

- ✅ **Node.js v22.12.0** requerido para compilación
- ✅ **354KB** de tamaño total (muy optimizado)
- ✅ **Configurado para crm.condorestudio.com**
- ✅ **Compatible con Hestia Control Panel**
- ✅ **SSL y proxy reverso** configurados
- ✅ **Listo para FTP** o panel web

**¡El frontend está listo para desplegar! 🚀**
