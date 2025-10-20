const express = require('express');
const router = express.Router();

// Middlewares
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

// Controladores
const AdminController = require('../controllers/AdminController');

// ============================================================================
// RUTAS DE ADMINISTRACIÓN
// ============================================================================

/**
 * Todas las rutas requieren autenticación y privilegios de administrador
 */
router.use(authenticateToken);
router.use(requireAdmin);

// ============================================================================
// WHATSAPP MANAGEMENT
// ============================================================================

/**
 * POST /api/admin/reconnect-all-whatsapp
 * Reconectar todas las sesiones de WhatsApp de todos los clientes
 * 
 * Respuesta:
 * {
 *   "success": true,
 *   "message": "Proceso completado...",
 *   "summary": {
 *     "total_clients": 10,
 *     "processed": 10,
 *     "successful": 8,
 *     "failed": 1,
 *     "skipped": 1,
 *     "execution_time_ms": 45000
 *   },
 *   "details": [
 *     {
 *       "client_id": 1,
 *       "client_code": "CLIENTE001",
 *       "company_name": "Empresa Demo",
 *       "status": "success",
 *       "message": "Conectado exitosamente",
 *       "execution_time_ms": 3000,
 *       "error": null
 *     }
 *   ]
 * }
 */
router.post('/reconnect-all-whatsapp', AdminController.reconnectAllWhatsApp);

/**
 * GET /api/admin/whatsapp-status
 * Obtener estado de todas las conexiones de WhatsApp
 */
router.get('/whatsapp-status', AdminController.getAllWhatsAppStatus);

/**
 * POST /api/admin/disconnect-all-whatsapp
 * Desconectar todas las sesiones de WhatsApp
 */
router.post('/disconnect-all-whatsapp', AdminController.disconnectAllWhatsApp);

// ============================================================================
// SYSTEM STATISTICS
// ============================================================================

/**
 * GET /api/admin/system-stats
 * Obtener estadísticas generales del sistema
 */
router.get('/system-stats', AdminController.getSystemStats);

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Middleware de manejo de errores específico para rutas de admin
 */
router.use((error, req, res, next) => {
    console.error('❌ Admin route error:', error.message);
    
    // Log adicional para debugging
    console.error('Stack trace:', error.stack);
    
    res.status(500).json({
        success: false,
        message: 'Error interno en operación administrativa',
        code: 'ADMIN_OPERATION_ERROR',
        ...(process.env.NODE_ENV === 'development' && { 
            error: error.message,
            stack: error.stack 
        })
    });
});

module.exports = router;