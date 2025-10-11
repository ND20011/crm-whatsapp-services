const express = require('express');
const ScheduledMessageController = require('../controllers/ScheduledMessageController');
const { authenticateToken, logAccess } = require('../middleware/auth');

const router = express.Router();

// ============================================================================
// SCHEDULED MESSAGES ROUTES - CRM CONDORITO
// ============================================================================

// Aplicar autenticación a todas las rutas
router.use(authenticateToken);
router.use(logAccess);

// ============================================================================
// CRUD ROUTES
// ============================================================================

/**
 * GET /api/scheduled-messages
 * Obtener lista de mensajes programados con filtros y paginación
 */
router.get('/', ScheduledMessageController.getScheduledMessages);

/**
 * POST /api/scheduled-messages
 * Crear nuevo mensaje programado
 */
router.post('/', ScheduledMessageController.createScheduledMessage);

/**
 * GET /api/scheduled-messages/statistics
 * Obtener estadísticas de mensajes programados
 */
router.get('/statistics', ScheduledMessageController.getStatistics);

/**
 * POST /api/scheduled-messages/process
 * Procesar mensajes programados manualmente (para testing)
 */
router.post('/process', ScheduledMessageController.processScheduledMessages);

/**
 * GET /api/scheduled-messages/processor/status
 * Obtener estado del procesador de mensajes programados
 */
router.get('/processor/status', (req, res) => {
    const scheduledMessageProcessor = require('../services/ScheduledMessageProcessor');
    const stats = scheduledMessageProcessor.getProcessorStats();
    const health = scheduledMessageProcessor.healthCheck();

    res.json({
        success: true,
        data: {
            ...stats,
            health
        }
    });
});

/**
 * POST /api/scheduled-messages/processor/restart
 * Reiniciar procesador de mensajes programados
 */
router.post('/processor/restart', (req, res) => {
    const scheduledMessageProcessor = require('../services/ScheduledMessageProcessor');
    scheduledMessageProcessor.restart();

    // Limpiar caché de módulos
    delete require.cache[require.resolve('../controllers/ScheduledMessageController')];
    delete require.cache[require.resolve('../entities/ScheduledMessage')];
    
    res.json({
        success: true,
        message: 'Procesador y controladores reiniciados exitosamente'
    });
});

/**
 * POST /api/scheduled-messages/reload-modules
 * Recargar módulos del sistema (para desarrollo)
 */
router.post('/reload-modules', (req, res) => {
    try {
        // Limpiar caché de módulos relacionados
        const modulesToReload = [
            '../controllers/ScheduledMessageController',
            '../entities/ScheduledMessage',
            '../services/ScheduledMessageService'
        ];
        
        modulesToReload.forEach(modulePath => {
            const fullPath = require.resolve(modulePath);
            delete require.cache[fullPath];
            console.log(`🔄 Módulo recargado: ${modulePath}`);
        });
        
        res.json({
            success: true,
            message: 'Módulos recargados exitosamente'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error recargando módulos',
            error: error.message
        });
    }
});

/**
 * GET /api/scheduled-messages/:id
 * Obtener mensaje programado específico
 */
router.get('/:id', ScheduledMessageController.getScheduledMessage);

/**
 * PUT /api/scheduled-messages/:id
 * Actualizar mensaje programado
 */
router.put('/:id', ScheduledMessageController.updateScheduledMessage);

/**
 * DELETE /api/scheduled-messages/:id
 * Eliminar mensaje programado
 */
router.delete('/:id', ScheduledMessageController.deleteScheduledMessage);

// ============================================================================
// CONTROL ROUTES
// ============================================================================

/**
 * POST /api/scheduled-messages/:id/pause
 * Pausar mensaje programado
 */
router.post('/:id/pause', ScheduledMessageController.pauseScheduledMessage);

/**
 * POST /api/scheduled-messages/:id/resume
 * Reanudar mensaje programado
 */
router.post('/:id/resume', ScheduledMessageController.resumeScheduledMessage);

/**
 * POST /api/scheduled-messages/:id/duplicate
 * Duplicar mensaje programado
 */
router.post('/:id/duplicate', ScheduledMessageController.duplicateScheduledMessage);

// ============================================================================
// HISTORY ROUTES
// ============================================================================

/**
 * GET /api/scheduled-messages/:id/executions
 * Obtener historial de ejecuciones de un mensaje programado
 */
router.get('/:id/executions', ScheduledMessageController.getExecutionHistory);

/**
 * GET /api/scheduled-messages/:id/recipients/:executionId
 * Obtener detalles de destinatarios de una ejecución específica
 */
router.get('/:id/recipients/:executionId', ScheduledMessageController.getExecutionRecipients);

module.exports = router;
