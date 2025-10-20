const express = require('express');
const TaskController = require('../controllers/TaskController');
const { authenticateToken, logAccess } = require('../middleware/auth');

const router = express.Router();

// ============================================================================
// TASKS ROUTES - CRM CONDORITO
// ============================================================================

// Aplicar autenticación a todas las rutas
router.use(authenticateToken);
router.use(logAccess);

// ============================================================================
// DASHBOARD & ANALYTICS ROUTES (DEBEN IR ANTES DE LAS RUTAS CON PARÁMETROS)
// ============================================================================

/**
 * GET /api/tasks/dashboard
 * Obtener dashboard con estadísticas y resumen
 */
router.get('/dashboard', TaskController.getDashboard);

/**
 * GET /api/tasks/stats
 * Obtener estadísticas detalladas de tareas y recordatorios
 */
router.get('/stats', TaskController.getStats);

/**
 * GET /api/tasks/calendar/:year/:month
 * Obtener vista calendario de tareas para un mes específico
 */
router.get('/calendar/:year/:month', TaskController.getCalendar);

/**
 * GET /api/tasks/search
 * Buscar tareas por término de búsqueda
 */
router.get('/search', TaskController.searchTasks);

/**
 * GET /api/tasks/processor/status
 * Obtener estado del procesador de tareas (desarrollo/admin)
 */
router.get('/processor/status', TaskController.getProcessorStatus);

// ============================================================================
// CRUD ROUTES
// ============================================================================

/**
 * GET /api/tasks
 * Obtener lista de tareas con filtros y paginación
 */
router.get('/', TaskController.getTasks);

/**
 * POST /api/tasks
 * Crear nueva tarea
 */
router.post('/', TaskController.createTask);

/**
 * GET /api/tasks/:id
 * Obtener una tarea específica por ID
 */
router.get('/:id', TaskController.getTask);

/**
 * PUT /api/tasks/:id
 * Actualizar tarea existente
 */
router.put('/:id', TaskController.updateTask);

/**
 * DELETE /api/tasks/:id
 * Eliminar tarea
 */
router.delete('/:id', TaskController.deleteTask);

// ============================================================================
// ACTION ROUTES
// ============================================================================

/**
 * POST /api/tasks/:id/complete
 * Marcar tarea como completada
 */
router.post('/:id/complete', TaskController.completeTask);

/**
 * POST /api/tasks/:id/cancel
 * Cancelar tarea con razón opcional
 */
router.post('/:id/cancel', TaskController.cancelTask);

/**
 * POST /api/tasks/:id/reminders
 * Crear recordatorio para una tarea
 */
router.post('/:id/reminders', TaskController.createReminder);

module.exports = router;
