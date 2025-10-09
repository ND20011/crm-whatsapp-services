const fs = require('fs').promises;
const path = require('path');
const fileStorageConfig = require('../config/file-storage');

/**
 * Servicio para manejo de archivos multimedia
 */
class FileStorageService {
    constructor() {
        this.config = fileStorageConfig;
        this.cleanupTimer = null;
        
        // Inicializar directorios al crear el servicio
        this.initialize();
    }

    /**
     * Inicializar el servicio
     */
    async initialize() {
        try {
            await this.config.initializeDirectories();
            
            // Iniciar limpieza automática si está habilitada
            if (this.config.config.cleanupEnabled) {
                this.startAutomaticCleanup();
            }
            
            console.log('🗂️ FileStorageService inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando FileStorageService:', error.message);
        }
    }

    /**
     * Guardar archivo desde base64
     * @param {string} base64Data - Datos en base64
     * @param {string} fileName - Nombre original del archivo
     * @param {string} messageType - Tipo de mensaje (image, document, etc.)
     * @param {string} mimetype - Tipo MIME del archivo
     * @returns {Promise<Object>} Información del archivo guardado
     */
    async saveFileFromBase64(base64Data, fileName, messageType, mimetype) {
        try {
            // Validar tipo de archivo (con fallback permisivo para multimedia)
            if (!this.config.isValidFileType(mimetype, messageType)) {
                console.warn(`⚠️ Tipo de archivo no reconocido: ${mimetype} para ${messageType}. Intentando guardar de todos modos...`);
                
                // Solo rechazar si es claramente peligroso
                const dangerousTypes = ['application/x-executable', 'application/x-msdownload', 'application/x-dosexec'];
                if (dangerousTypes.includes(mimetype)) {
                    throw new Error(`Tipo de archivo peligroso rechazado: ${mimetype}`);
                }
                
                // Para multimedia, permitir tipos desconocidos con advertencia
                if (!['image', 'audio', 'video', 'document'].includes(messageType)) {
                    throw new Error(`Tipo de mensaje no soportado: ${messageType}`);
                }
            }

            // Convertir base64 a buffer
            const buffer = Buffer.from(base64Data, 'base64');
            
            // Validar tamaño
            if (!this.config.isValidFileSize(buffer.length)) {
                throw new Error(`Archivo demasiado grande: ${buffer.length} bytes`);
            }

            // Generar nombre único
            const uniqueFileName = this.config.generateUniqueFileName(fileName, messageType);
            
            // Obtener directorio de destino
            const targetDir = this.config.getDirectoryForType(messageType);
            const filePath = path.join(targetDir, uniqueFileName);
            
            // Guardar archivo
            await fs.writeFile(filePath, buffer);
            
            // Generar ruta relativa para URL
            const relativePath = path.relative(this.config.baseDir, filePath);
            const publicUrl = this.config.generatePublicUrl(relativePath);
            
            const fileInfo = {
                originalName: fileName,
                fileName: uniqueFileName,
                filePath: filePath,
                relativePath: relativePath,
                publicUrl: publicUrl,
                size: buffer.length,
                mimetype: mimetype,
                messageType: messageType,
                createdAt: new Date()
            };
            
            console.log(`✅ Archivo guardado: ${uniqueFileName} (${this.formatFileSize(buffer.length)})`);
            
            return fileInfo;
            
        } catch (error) {
            console.error('❌ Error guardando archivo:', error.message);
            throw error;
        }
    }

    /**
     * Eliminar archivo
     * @param {string} filePath - Ruta del archivo a eliminar
     */
    async deleteFile(filePath) {
        try {
            await fs.unlink(filePath);
            console.log(`🗑️ Archivo eliminado: ${path.basename(filePath)}`);
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.warn(`⚠️ Archivo no encontrado para eliminar: ${filePath}`);
                return false;
            }
            console.error('❌ Error eliminando archivo:', error.message);
            throw error;
        }
    }

    /**
     * Verificar si un archivo existe
     * @param {string} filePath - Ruta del archivo
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Obtener información de un archivo
     * @param {string} filePath - Ruta del archivo
     */
    async getFileInfo(filePath) {
        try {
            const stats = await fs.stat(filePath);
            return {
                size: stats.size,
                createdAt: stats.birthtime,
                modifiedAt: stats.mtime,
                isFile: stats.isFile(),
                exists: true
            };
        } catch (error) {
            return {
                exists: false,
                error: error.message
            };
        }
    }

    /**
     * Limpiar archivos antiguos
     * @param {number} maxAge - Edad máxima en millisegundos
     */
    async cleanupOldFiles(maxAge = null) {
        const ageLimit = maxAge || this.config.config.maxFileAge;
        const now = Date.now();
        let deletedCount = 0;
        let totalSize = 0;

        try {
            console.log('🧹 Iniciando limpieza de archivos antiguos...');

            for (const [type, directory] of Object.entries(this.config.directories)) {
                if (type === 'temp') continue; // Skip temp directory
                
                try {
                    const files = await fs.readdir(directory);
                    
                    for (const file of files) {
                        const filePath = path.join(directory, file);
                        const fileInfo = await this.getFileInfo(filePath);
                        
                        if (fileInfo.exists && fileInfo.isFile) {
                            const fileAge = now - fileInfo.createdAt.getTime();
                            
                            if (fileAge > ageLimit) {
                                await this.deleteFile(filePath);
                                deletedCount++;
                                totalSize += fileInfo.size;
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`⚠️ Error limpiando directorio ${type}:`, error.message);
                }
            }

            console.log(`🎉 Limpieza completada: ${deletedCount} archivos eliminados (${this.formatFileSize(totalSize)} liberados)`);
            
            return {
                deletedFiles: deletedCount,
                freedSpace: totalSize
            };
            
        } catch (error) {
            console.error('❌ Error en limpieza automática:', error.message);
            throw error;
        }
    }

    /**
     * Iniciar limpieza automática periódica
     */
    startAutomaticCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }

        const interval = this.config.config.cleanupInterval;
        
        this.cleanupTimer = setInterval(async () => {
            try {
                await this.cleanupOldFiles();
            } catch (error) {
                console.error('❌ Error en limpieza automática periódica:', error.message);
            }
        }, interval);

        console.log(`⏰ Limpieza automática programada cada ${Math.round(interval / (1000 * 60 * 60))} horas`);
    }

    /**
     * Detener limpieza automática
     */
    stopAutomaticCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
            console.log('⏹️ Limpieza automática detenida');
        }
    }

    /**
     * Formatear tamaño de archivo para mostrar
     * @param {number} bytes - Tamaño en bytes
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Obtener estadísticas de almacenamiento
     */
    async getStorageStats() {
        const stats = {
            directories: {},
            total: {
                files: 0,
                size: 0
            }
        };

        try {
            for (const [type, directory] of Object.entries(this.config.directories)) {
                const dirStats = {
                    files: 0,
                    size: 0,
                    path: directory
                };

                try {
                    const files = await fs.readdir(directory);
                    
                    for (const file of files) {
                        const filePath = path.join(directory, file);
                        const fileInfo = await this.getFileInfo(filePath);
                        
                        if (fileInfo.exists && fileInfo.isFile) {
                            dirStats.files++;
                            dirStats.size += fileInfo.size;
                        }
                    }
                } catch (error) {
                    console.warn(`⚠️ Error obteniendo stats de ${type}:`, error.message);
                }

                stats.directories[type] = dirStats;
                stats.total.files += dirStats.files;
                stats.total.size += dirStats.size;
            }

            return stats;
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error.message);
            throw error;
        }
    }
}

// Instancia singleton
const fileStorageService = new FileStorageService();

module.exports = fileStorageService;
