const express = require('express');
const router = express.Router();
const FileController = require('../controllers/FileController');
const { authenticateToken } = require('../middleware/auth');

// Aplicar autenticación a todas las rutas
router.use(authenticateToken);

/**
 * GET /api/files/stats
 * Obtener estadísticas de almacenamiento de archivos
 */
router.get('/stats', FileController.getStorageStats);

/**
 * GET /api/files/config
 * Obtener configuración del sistema de archivos
 */
router.get('/config', FileController.getFileConfig);

/**
 * POST /api/files/cleanup
 * Ejecutar limpieza manual de archivos antiguos
 * Body: { maxAge?: number } (opcional, en millisegundos)
 */
router.post('/cleanup', FileController.cleanupFiles);

/**
 * POST /api/files/test-upload
 * Endpoint de prueba para subir archivos (solo desarrollo)
 * Body: { base64Data: string, fileName: string, messageType: string, mimetype: string }
 */
router.post('/test-upload', FileController.testUpload);

module.exports = router;
