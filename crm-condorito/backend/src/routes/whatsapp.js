const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken, requireActiveClient, logAccess } = require('../middleware/auth');
const WhatsAppController = require('../controllers/WhatsAppController');

// ============================================================================
// MULTER CONFIGURATION FOR FILE UPLOADS
// ============================================================================

// Asegurar que el directorio de uploads existe
const uploadsDir = path.join(__dirname, '../../uploads/');
fs.mkdir(uploadsDir, { recursive: true }).catch(console.error);

// Configurar multer para subida de archivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB límite
    },
    fileFilter: (req, file, cb) => {
        // Permitir solo imágenes y documentos
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf', 'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido'), false);
        }
    }
});

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Aplicar autenticación a todas las rutas de WhatsApp
router.use(authenticateToken);
router.use(requireActiveClient);
router.use(logAccess);

// ============================================================================
// WHATSAPP SESSION MANAGEMENT
// ============================================================================

/**
 * GET /api/whatsapp/qr/:clientCode
 * Obtener código QR para conectar WhatsApp
 */
router.get('/qr/:clientCode', WhatsAppController.getQRCode);
router.get('/qr-json/:clientCode', WhatsAppController.getQRCodeJSON);

/**
 * POST /api/whatsapp/connect
 * Iniciar conexión de WhatsApp
 */
router.post('/connect', WhatsAppController.connect);

/**
 * POST /api/whatsapp/force-cleanup
 * Forzar limpieza completa de sesión (procesos, archivos, memoria)
 */
router.post('/force-cleanup', WhatsAppController.forceCleanup);

/**
 * POST /api/whatsapp/disconnect
 * Desconectar sesión de WhatsApp
 */
router.post('/disconnect', WhatsAppController.disconnect);

/**
 * GET /api/whatsapp/status
 * Obtener estado de la sesión de WhatsApp
 */
router.get('/status', WhatsAppController.getStatus);

// ============================================================================
// MESSAGE SENDING
// ============================================================================

/**
 * POST /api/whatsapp/send-message
 * Enviar mensaje de texto
 */
router.post('/send-message', WhatsAppController.sendMessage);

/**
 * POST /api/whatsapp/send-image
 * Enviar imagen con caption opcional
 */
router.post('/send-image', upload.single('image'), WhatsAppController.sendImage);

/**
 * POST /api/whatsapp/send-document
 * Enviar documento
 */
router.post('/send-document', upload.single('document'), WhatsAppController.sendDocument);

// ============================================================================
// STATISTICS AND MONITORING
// ============================================================================

/**
 * GET /api/whatsapp/stats
 * Obtener estadísticas generales de WhatsApp
 */
router.get('/stats', WhatsAppController.getStats);

/**
 * GET /api/whatsapp/health
 * Health check específico para el módulo de WhatsApp
 */
router.get('/health', WhatsAppController.health);

// ============================================================================
// DEVELOPMENT ENDPOINTS
// ============================================================================

if (process.env.NODE_ENV !== 'production') {
    /**
     * POST /api/whatsapp/dev/restart
     * Reiniciar servicio WhatsApp (solo desarrollo)
     */
    router.post('/dev/restart', WhatsAppController.devRestart);
}

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

// Manejo de errores de multer
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'Archivo demasiado grande. Máximo 10MB permitido.'
            });
        }
    }
    
    if (error.message === 'Tipo de archivo no permitido') {
        return res.status(400).json({
            success: false,
            message: 'Tipo de archivo no permitido. Solo se permiten imágenes y documentos.'
        });
    }
    
    next(error);
});

module.exports = router;