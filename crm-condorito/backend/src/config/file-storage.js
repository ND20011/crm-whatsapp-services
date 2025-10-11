const fs = require('fs').promises;
const path = require('path');

/**
 * Configuración del sistema de almacenamiento de archivos
 */
class FileStorageConfig {
    constructor() {
        // Directorio base para archivos
        this.baseDir = path.resolve(__dirname, '../../uploads');
        
        // Subdirectorios por tipo de archivo
        this.directories = {
            images: path.join(this.baseDir, 'images'),
            documents: path.join(this.baseDir, 'documents'),
            audio: path.join(this.baseDir, 'audio'),
            video: path.join(this.baseDir, 'video'),
            temp: path.join(this.baseDir, 'temp')
        };
        
        // URL base para servir archivos
        this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        
        // Configuración de archivos
        this.config = {
            maxFileSize: 50 * 1024 * 1024, // 50MB
            allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            allowedDocumentTypes: [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // Excel
                'application/vnd.ms-excel',
                'text/plain',
                'text/csv',
                'application/zip',
                'application/x-zip-compressed',
                'application/json',
                'image/jpeg',          // Documentos pueden ser imágenes
                'image/png',
                'image/gif'
            ],
            allowedAudioTypes: [
                'audio/mpeg', 
                'audio/ogg', 
                'audio/wav', 
                'audio/mp4',           // WhatsApp puede usar AAC en MP4
                'audio/aac',           // AAC directo
                'audio/webm',          // WebM audio
                'audio/opus',          // Opus codec
                'audio/ogg; codecs=opus', // OGG con Opus (WhatsApp común)
                'application/ogg'      // Algunos navegadores usan este MIME
            ],
            allowedVideoTypes: [
                'video/mp4', 
                'video/mpeg', 
                'video/quicktime',
                'video/webm',          // WebM video
                'video/ogg',           // OGG video
                'video/avi',           // AVI
                'video/x-msvideo',     // AVI alternativo
                'video/3gpp',          // 3GP (común en móviles)
                'video/x-ms-wmv'       // WMV
            ],
            
            // Configuración de limpieza automática
            cleanupEnabled: true,
            maxFileAge: 30 * 24 * 60 * 60 * 1000, // 30 días en millisegundos
            cleanupInterval: 24 * 60 * 60 * 1000   // Cada 24 horas
        };
    }

    /**
     * Inicializar directorios necesarios
     */
    async initializeDirectories() {
        try {
            console.log('📁 Inicializando directorios de archivos...');
            
            // Crear directorio base
            await fs.mkdir(this.baseDir, { recursive: true });
            
            // Crear subdirectorios
            for (const [type, dir] of Object.entries(this.directories)) {
                await fs.mkdir(dir, { recursive: true });
                console.log(`✅ Directorio creado: ${type} -> ${dir}`);
            }
            
            console.log('🎉 Directorios inicializados correctamente');
            return true;
        } catch (error) {
            console.error('❌ Error inicializando directorios:', error.message);
            throw error;
        }
    }

    /**
     * Obtener directorio según tipo de archivo
     */
    getDirectoryForType(messageType) {
        const typeMap = {
            'image': 'images',
            'document': 'documents',
            'audio': 'audio',
            'video': 'video'
        };
        
        const dirType = typeMap[messageType] || 'temp';
        return this.directories[dirType];
    }

    /**
     * Generar nombre único para archivo
     */
    generateUniqueFileName(originalName, messageType) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const extension = path.extname(originalName) || this.getDefaultExtension(messageType);
        
        return `${timestamp}_${random}${extension}`;
    }

    /**
     * Obtener extensión por defecto según tipo
     */
    getDefaultExtension(messageType) {
        const extensions = {
            'image': '.jpg',
            'document': '.pdf',
            'audio': '.mp3',
            'video': '.mp4'
        };
        
        return extensions[messageType] || '.bin';
    }

    /**
     * Generar URL pública para archivo
     */
    generatePublicUrl(relativePath) {
        return `${this.baseUrl}/uploads/${relativePath}`;
    }

    /**
     * Validar tipo de archivo
     */
    isValidFileType(mimetype, messageType) {
        const allowedTypes = {
            'image': this.config.allowedImageTypes,
            'document': this.config.allowedDocumentTypes,
            'audio': this.config.allowedAudioTypes,
            'video': this.config.allowedVideoTypes
        };
        
        const validTypes = allowedTypes[messageType] || [];
        return validTypes.includes(mimetype);
    }

    /**
     * Validar tamaño de archivo
     */
    isValidFileSize(size) {
        return size <= this.config.maxFileSize;
    }
}

// Instancia singleton
const fileStorageConfig = new FileStorageConfig();

module.exports = fileStorageConfig;
