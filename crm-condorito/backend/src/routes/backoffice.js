const express = require('express');
const router = express.Router();
const BackofficeController = require('../controllers/BackofficeController');
const { requireAdmin } = require('../middleware/admin');
const { authenticateToken } = require('../middleware/auth');

// ============================================================================
// MIDDLEWARE - Todas las rutas requieren autenticación y permisos de admin
// ============================================================================

router.use(authenticateToken);
router.use(requireAdmin);

// ============================================================================
// RUTAS DEL BACKOFFICE
// ============================================================================

/**
 * GET /api/backoffice/stats
 * Obtener estadísticas generales del sistema
 */
router.get('/stats', BackofficeController.getSystemStats);

/**
 * GET /api/backoffice/clients
 * Obtener lista de clientes con filtros y paginación
 * Query params: page, limit, search, status
 */
router.get('/clients', BackofficeController.getClients);

/**
 * POST /api/backoffice/clients
 * Crear nuevo cliente
 */
router.post('/clients', BackofficeController.createClient);

/**
 * PUT /api/backoffice/clients/:id
 * Actualizar cliente existente
 */
router.put('/clients/:id', BackofficeController.updateClient);

/**
 * POST /api/backoffice/clients/:id/reset-quota
 * Resetear cuotas de un cliente
 * Body: { type: 'bot' | 'token' | 'both' }
 */
router.post('/clients/:id/reset-quota', BackofficeController.resetClientQuota);

/**
 * DELETE /api/backoffice/clients/:id
 * Eliminar cliente
 */
router.delete('/clients/:id', BackofficeController.deleteClient);

/**
 * GET /api/backoffice/clients/:id
 * Obtener detalles de un cliente específico
 */
router.get('/clients/:id', BackofficeController.getClientDetails);

/**
 * GET /api/backoffice/reports
 * Obtener reportes del sistema
 * Query params: startDate, endDate, type
 */
router.get('/reports', BackofficeController.getSystemReports);

/**
 * GET /api/backoffice/clients/export
 * Exportar datos de clientes
 * Query params: format (csv|excel)
 */
router.get('/clients/export', BackofficeController.exportClients);

/**
 * GET /api/backoffice/logs
 * Obtener logs del sistema
 * Query params: page, limit, level, startDate, endDate
 */
router.get('/logs', BackofficeController.getSystemLogs);

/**
 * GET /api/backoffice/config
 * Obtener configuración del sistema
 */
router.get('/config', BackofficeController.getSystemConfig);

/**
 * PUT /api/backoffice/config
 * Actualizar configuración del sistema
 */
router.put('/config', BackofficeController.updateSystemConfig);

/**
 * GET /api/backoffice/metrics/realtime
 * Obtener métricas en tiempo real
 */
router.get('/metrics/realtime', BackofficeController.getRealTimeMetrics);

/**
 * POST /api/backoffice/maintenance
 * Ejecutar mantenimiento del sistema
 * Body: { type: 'cleanup' | 'optimize' | 'backup' }
 */
router.post('/maintenance', BackofficeController.runSystemMaintenance);

/**
 * POST /api/backoffice/reset-monthly-quotas
 * Resetear cuotas mensuales de todos los clientes
 * Simula el proceso automático del primer día del mes
 */
router.post('/reset-monthly-quotas', BackofficeController.resetMonthlyQuotas);

module.exports = router;
