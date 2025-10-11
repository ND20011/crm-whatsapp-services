const fileStorageService = require('../services/FileStorageService');

/**
 * Controlador para manejo de archivos y estadísticas de almacenamiento
 */
class FileController {

    /**
     * GET /api/files/stats
     * Obtener estadísticas de almacenamiento
     */
    static async getStorageStats(req, res, next) {
        try {
            const stats = await fileStorageService.getStorageStats();
            
            res.json({
                success: true,
                data: {
                    ...stats,
                    formattedTotal: {
                        files: stats.total.files,
                        size: fileStorageService.formatFileSize(stats.total.size)
                    },
                    formattedDirectories: Object.keys(stats.directories).reduce((acc, key) => {
                        acc[key] = {
                            ...stats.directories[key],
                            formattedSize: fileStorageService.formatFileSize(stats.directories[key].size)
                        };
                        return acc;
                    }, {})
                },
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Error in FileController.getStorageStats:', error.message);
            next(error);
        }
    }

    /**
     * POST /api/files/cleanup
     * Ejecutar limpieza manual de archivos antiguos
     */
    static async cleanupFiles(req, res, next) {
        try {
            const { maxAge } = req.body;
            
            // Validar maxAge si se proporciona
            let ageLimit = null;
            if (maxAge) {
                if (typeof maxAge !== 'number' || maxAge <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'maxAge debe ser un número positivo (en millisegundos)'
                    });
                }
                ageLimit = maxAge;
            }
            
            console.log(`🧹 Manual cleanup requested by user ${req.user.id}`);
            
            const result = await fileStorageService.cleanupOldFiles(ageLimit);
            
            res.json({
                success: true,
                message: 'Limpieza completada exitosamente',
                data: {
                    deletedFiles: result.deletedFiles,
                    freedSpace: result.freedSpace,
                    formattedFreedSpace: fileStorageService.formatFileSize(result.freedSpace),
                    maxAge: ageLimit || fileStorageService.config.config.maxFileAge,
                    maxAgeDays: Math.round((ageLimit || fileStorageService.config.config.maxFileAge) / (24 * 60 * 60 * 1000))
                },
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Error in FileController.cleanupFiles:', error.message);
            next(error);
        }
    }

    /**
     * GET /api/files/config
     * Obtener configuración del sistema de archivos
     */
    static async getFileConfig(req, res, next) {
        try {
            const config = fileStorageService.config.config;
            
            res.json({
                success: true,
                data: {
                    maxFileSize: config.maxFileSize,
                    formattedMaxFileSize: fileStorageService.formatFileSize(config.maxFileSize),
                    allowedImageTypes: config.allowedImageTypes,
                    allowedDocumentTypes: config.allowedDocumentTypes,
                    allowedAudioTypes: config.allowedAudioTypes,
                    allowedVideoTypes: config.allowedVideoTypes,
                    cleanupEnabled: config.cleanupEnabled,
                    maxFileAge: config.maxFileAge,
                    maxFileAgeDays: Math.round(config.maxFileAge / (24 * 60 * 60 * 1000)),
                    cleanupInterval: config.cleanupInterval,
                    cleanupIntervalHours: Math.round(config.cleanupInterval / (1000 * 60 * 60)),
                    baseUrl: fileStorageService.config.baseUrl,
                    directories: fileStorageService.config.directories
                },
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Error in FileController.getFileConfig:', error.message);
            next(error);
        }
    }

    /**
     * POST /api/files/test-upload
     * Endpoint de prueba para subir archivos (solo desarrollo)
     */
    static async testUpload(req, res, next) {
        try {
            // Solo permitir en desarrollo
            if (process.env.NODE_ENV === 'production') {
                return res.status(403).json({
                    success: false,
                    message: 'Endpoint de prueba no disponible en producción'
                });
            }

            const { base64Data, fileName, messageType, mimetype } = req.body;
            
            if (!base64Data || !fileName || !messageType || !mimetype) {
                return res.status(400).json({
                    success: false,
                    message: 'Se requieren: base64Data, fileName, messageType, mimetype'
                });
            }
            
            const fileInfo = await fileStorageService.saveFileFromBase64(
                base64Data,
                fileName,
                messageType,
                mimetype
            );
            
            res.json({
                success: true,
                message: 'Archivo de prueba guardado exitosamente',
                data: fileInfo,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Error in FileController.testUpload:', error.message);
            next(error);
        }
    }
}

module.exports = FileController;
