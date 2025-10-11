# 📁 Sistema de Archivos Multimedia - CRM Condorito

## 🎯 **Resumen**

Se implementó exitosamente un sistema completo de almacenamiento de archivos multimedia para el CRM Condorito, reemplazando el almacenamiento temporal en base64 por un sistema robusto de archivos físicos con URLs públicas.

## 🏗️ **Arquitectura del Sistema**

### **1. Estructura de Directorios**
```
backend/uploads/
├── images/          # Imágenes (JPEG, PNG, GIF, WebP)
├── documents/       # Documentos (PDF, Word, TXT)
├── audio/           # Audio (MP3, OGG, WAV)
├── video/           # Video (MP4, MPEG, QuickTime)
└── temp/            # Archivos temporales
```

### **2. Componentes Principales**

#### **📋 FileStorageConfig** (`src/config/file-storage.js`)
- **Configuración centralizada** del sistema
- **Límites de archivos**: 50MB máximo
- **Tipos permitidos** por categoría
- **Limpieza automática**: 30 días, cada 24 horas
- **URLs públicas**: `http://localhost:3000/uploads/...`

#### **🗂️ FileStorageService** (`src/services/FileStorageService.js`)
- **Guardado desde base64** a archivos físicos
- **Nombres únicos** con timestamp + random
- **Validación** de tipos y tamaños
- **Limpieza automática** periódica
- **Estadísticas** de almacenamiento
- **Manejo de errores** robusto

#### **🎛️ FileController** (`src/controllers/FileController.js`)
- **GET /api/files/config**: Configuración del sistema
- **GET /api/files/stats**: Estadísticas de almacenamiento
- **POST /api/files/cleanup**: Limpieza manual
- **POST /api/files/test-upload**: Pruebas (solo desarrollo)

#### **🔄 MessageService** (Actualizado)
- **processMediaMessage()** mejorado
- **Guardado automático** de archivos multimedia
- **URLs públicas** en base de datos
- **Fallback** en caso de errores

## 🚀 **Flujo de Funcionamiento**

### **1. Recepción de Imagen por WhatsApp**
```javascript
// 1. WhatsApp envía imagen
whatsappMessage.hasMedia = true

// 2. MessageService.processMediaMessage()
const media = await whatsappMessage.downloadMedia()
// media.data = "base64_string..."

// 3. FileStorageService.saveFileFromBase64()
const fileInfo = await fileStorageService.saveFileFromBase64(
    media.data,           // Base64 data
    media.filename,       // Original name
    'image',             // Message type
    media.mimetype       // MIME type
)

// 4. Resultado
{
    originalName: "photo.jpg",
    fileName: "1759097279_abc123.jpg",
    publicUrl: "http://localhost:3000/uploads/images/1759097279_abc123.jpg",
    size: 1401199,
    mimetype: "image/jpeg"
}

// 5. Guardado en BD
await Message.create({
    // ... otros campos ...
    media_url: fileInfo.publicUrl,  // ← URL pública
    file_name: fileInfo.originalName,
    media_size: fileInfo.size,
    media_mimetype: fileInfo.mimetype
})
```

### **2. Visualización en Frontend**
```html
<!-- El frontend simplemente usa la URL -->
<img [src]="message.media_url" [alt]="message.file_name" />

<!-- URL real: http://localhost:3000/uploads/images/1759097279_abc123.jpg -->
```

## 📊 **Configuración Actual**

### **Límites y Tipos**
```javascript
{
    maxFileSize: 52428800,  // 50MB
    allowedImageTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    allowedDocumentTypes: ["application/pdf", "application/msword", "text/plain"],
    allowedAudioTypes: ["audio/mpeg", "audio/ogg", "audio/wav"],
    allowedVideoTypes: ["video/mp4", "video/mpeg", "video/quicktime"],
    
    // Limpieza automática
    cleanupEnabled: true,
    maxFileAge: 2592000000,      // 30 días en ms
    cleanupInterval: 86400000    // 24 horas en ms
}
```

### **Servidor Estático**
```javascript
// En app.js
app.use('/uploads', express.static(uploadsPath, {
    maxAge: '1d',           // Cache 1 día
    etag: true,
    lastModified: true,
    // Headers de seguridad
    // CORS habilitado para frontend
}))
```

## 🛠️ **API Endpoints**

### **GET /api/files/config**
```bash
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/files/config
```
```json
{
    "success": true,
    "data": {
        "maxFileSize": 52428800,
        "formattedMaxFileSize": "50 MB",
        "allowedImageTypes": ["image/jpeg", "image/png"],
        "cleanupEnabled": true,
        "maxFileAgeDays": 30,
        "baseUrl": "http://localhost:3000"
    }
}
```

### **GET /api/files/stats**
```bash
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/files/stats
```
```json
{
    "success": true,
    "data": {
        "total": { "files": 2, "size": 2802398 },
        "formattedTotal": { "files": 2, "size": "2.67 MB" },
        "directories": {
            "images": { "files": 2, "size": 2802398, "formattedSize": "2.67 MB" },
            "documents": { "files": 0, "size": 0, "formattedSize": "0 Bytes" }
        }
    }
}
```

### **POST /api/files/cleanup**
```bash
curl -X POST -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"maxAge": 86400000}' \
     http://localhost:3000/api/files/cleanup
```
```json
{
    "success": true,
    "message": "Limpieza completada exitosamente",
    "data": {
        "deletedFiles": 5,
        "freedSpace": 10485760,
        "formattedFreedSpace": "10 MB"
    }
}
```

## 🔧 **Características Avanzadas**

### **1. Limpieza Automática**
- ⏰ **Programada**: Cada 24 horas
- 📅 **Criterio**: Archivos > 30 días
- 🗑️ **Proceso**: Elimina archivos físicos automáticamente
- 📊 **Logging**: Reporta archivos eliminados y espacio liberado

### **2. Validación Robusta**
```javascript
// Validaciones aplicadas:
✅ Tipo MIME permitido
✅ Tamaño < 50MB
✅ Nombre único generado
✅ Directorio correcto según tipo
✅ Manejo de errores completo
```

### **3. Seguridad**
```javascript
// Headers de seguridad en archivos estáticos:
'X-Content-Type-Options': 'nosniff'
'X-Frame-Options': 'DENY'
'Access-Control-Allow-Origin': frontend_url
```

### **4. Performance**
```javascript
// Optimizaciones:
✅ Cache del navegador (1 día)
✅ ETags para validación
✅ Nombres únicos (evita colisiones)
✅ Directorios organizados por tipo
✅ Limpieza automática (evita acumulación)
```

## 📈 **Estado Actual del Sistema**

### **✅ Implementado y Funcionando**
- [x] Sistema de directorios creado
- [x] FileStorageService operativo
- [x] MessageService actualizado
- [x] Servidor estático configurado
- [x] API endpoints funcionando
- [x] Limpieza automática activa
- [x] Validaciones implementadas
- [x] Manejo de errores robusto

### **📊 Estadísticas Actuales**
```
Total de archivos: 2
Espacio usado: 2.67 MB
Directorios: 5 (images, documents, audio, video, temp)
Limpieza automática: Activa (cada 24h)
```

## 🎯 **Beneficios Obtenidos**

### **vs Base64 en BD**
| Aspecto | Base64 | Archivos Físicos |
|---------|--------|------------------|
| **Tamaño BD** | +33% inflado | Mínimo (solo URLs) |
| **Performance** | Lenta | Rápida |
| **Cache** | No | Sí (navegador + CDN) |
| **Escalabilidad** | Limitada | Ilimitada |
| **Backup** | Pesado | Ligero |
| **Mantenimiento** | Complejo | Simple |

### **vs localStorage Frontend**
| Aspecto | localStorage | Archivos Físicos |
|---------|-------------|------------------|
| **Límite** | 5-10MB | 50MB+ por archivo |
| **Persistencia** | Temporal | Permanente |
| **Multi-dispositivo** | No | Sí |
| **Performance** | Terrible | Excelente |
| **Confiabilidad** | Baja | Alta |

## 🚀 **Próximos Pasos Opcionales**

### **1. CDN Integration**
```javascript
// Futuro: Usar CDN para mejor performance global
baseUrl: process.env.CDN_URL || "http://localhost:3000"
```

### **2. Compresión Automática**
```javascript
// Futuro: Comprimir imágenes automáticamente
const sharp = require('sharp');
await sharp(buffer).resize(800).jpeg({ quality: 80 }).toFile(path);
```

### **3. Cloud Storage**
```javascript
// Futuro: AWS S3, Google Cloud Storage
const cloudStorage = new CloudStorage();
await cloudStorage.upload(fileBuffer, fileName);
```

## 🎉 **Conclusión**

El sistema de archivos multimedia está **100% implementado y funcionando**. Las imágenes de WhatsApp ahora se guardan como archivos físicos con URLs públicas, proporcionando:

- ✅ **Performance excelente**
- ✅ **Escalabilidad ilimitada**
- ✅ **Mantenimiento automático**
- ✅ **Experiencia de usuario fluida**
- ✅ **Arquitectura profesional**

**¡El problema de "Imagen no disponible" está completamente resuelto!** 🎊
