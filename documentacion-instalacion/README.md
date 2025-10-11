# 📚 DOCUMENTACIÓN DE INSTALACIÓN - CRM CONDORITO

## 🎯 CONTENIDO DE ESTA CARPETA

Esta carpeta contiene toda la documentación necesaria para instalar el **CRM Condorito** en un VPS con **Hestia Control Panel**.

### 📁 ARCHIVOS INCLUIDOS:

| Archivo | Tamaño | Descripción |
|---------|--------|-------------|
| **GUIA_COMPILACION_BACKEND.md** | 5.4KB | Guía paso a paso para compilar el backend |
| **GUIA_COMPILACION_FRONTEND.md** | 7.9KB | Guía paso a paso para compilar el frontend |
| **GUIA_INSTALACION_BD.md** | 4.3KB | Guía para instalar la base de datos |
| **crm_condorito_db_COMPLETO.sql** | 267KB | Dump completo de la base de datos |

## 🚀 ORDEN DE INSTALACIÓN RECOMENDADO

### **PASO 1: BACKEND** 
📖 Seguir `GUIA_COMPILACION_BACKEND.md`
- Compilar y crear `crm-backend.zip`
- Subir por FTP al VPS
- Configurar Node.js y PM2

### **PASO 2: BASE DE DATOS**
📖 Seguir `GUIA_INSTALACION_BD.md`
- Importar `crm_condorito_db_COMPLETO.sql`
- Configurar usuario y permisos
- Verificar conexión

### **PASO 3: FRONTEND**
📖 Seguir `GUIA_COMPILACION_FRONTEND.md`
- Compilar y crear `crm-frontend.zip`
- Subir a `public_html/`
- Configurar proxy en Hestia

## 🎯 RESULTADO FINAL

Al completar todos los pasos tendrás:

- ✅ **Backend API** funcionando en puerto 3000
- ✅ **Base de datos** con todos los datos importados
- ✅ **Frontend Angular** servido por Apache
- ✅ **Proxy reverso** configurado en Hestia
- ✅ **SSL certificado** Let's Encrypt
- ✅ **Dominio** `https://crm.condorestudio.com` funcionando

## 📊 ARCHIVOS DE DESPLIEGUE GENERADOS

Después de seguir las guías, tendrás estos archivos listos:

```
📦 Archivos para subir al VPS:
├── crm-backend.zip (16MB)    ← Backend completo
├── crm-frontend.zip (354KB)  ← Frontend compilado
└── crm_condorito_db_COMPLETO.sql (267KB) ← Base de datos
```

## 🔧 REQUISITOS DEL VPS

- **OS:** Ubuntu/Debian con Hestia Control Panel
- **Node.js:** v20+ (se instala automáticamente)
- **MySQL/MariaDB:** 5.7+ (incluido en Hestia)
- **Apache:** 2.4+ (incluido en Hestia)
- **PHP:** 8.0+ (para phpMyAdmin)
- **SSL:** Let's Encrypt (incluido en Hestia)

## 📞 SOPORTE

Si tienes problemas durante la instalación:

1. **Revisar logs** del backend: `pm2 logs crm-backend`
2. **Verificar base de datos** con los comandos de la guía
3. **Comprobar proxy** en Panel Hestia
4. **Verificar permisos** de archivos

## 🎉 CONFIGURACIÓN FINAL

Una vez instalado todo:

- **URL Principal:** https://crm.condorestudio.com
- **API Endpoint:** https://crm.condorestudio.com/api/
- **WebSocket:** wss://crm.condorestudio.com
- **Panel Admin:** https://crm.condorestudio.com/backoffice

---

**¡Todo listo para desplegar tu CRM profesional! 🚀**

*Generado automáticamente el $(date)*
