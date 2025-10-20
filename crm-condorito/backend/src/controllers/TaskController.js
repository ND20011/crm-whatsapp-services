const Task = require('../entities/Task');
const TaskReminder = require('../entities/TaskReminder');
const TaskService = require('../services/TaskService');
const TaskReminderService = require('../services/TaskReminderService');
const TaskProcessor = require('../services/TaskProcessor');
const { executeQuery } = require('../config/database-simple');
const Joi = require('joi');

// ============================================================================
// TASK CONTROLLER - CRM CONDORITO
// ============================================================================

class TaskController {

    /**
     * GET /api/tasks
     * Obtener lista de tareas con filtros
     */
    static async getTasks(req, res, next) {
        try {
            const clientId = req.user.id;
            const {
                page = 1,
                limit = 20,
                status = null,
                priority = null,
                category = null,
                search = '',
                due_date_from = null,
                due_date_to = null,
                upcoming_days = null,
                overdue = null,
                related_contact_id = null,
                sortBy = 'due_date',
                sortOrder = 'ASC'
            } = req.query;

            // Preparar filtros
            const filters = {
                limit: Math.min(parseInt(limit), 100),
                offset: (parseInt(page) - 1) * Math.min(parseInt(limit), 100),
                order_by: sortBy,
                order_dir: sortOrder.toUpperCase()
            };

            // Aplicar filtros opcionales
            if (status) filters.status = status;
            if (priority) filters.priority = priority;
            if (category) filters.category = category;
            if (search.trim()) filters.search = search.trim();
            if (due_date_from) filters.due_date_from = new Date(due_date_from);
            if (due_date_to) filters.due_date_to = new Date(due_date_to);
            if (upcoming_days) filters.upcoming_days = parseInt(upcoming_days);
            if (overdue === 'true') filters.overdue = true;
            if (related_contact_id) filters.related_contact_id = parseInt(related_contact_id);

            const tasks = await TaskService.getTasks(clientId, filters);

            // Obtener total para paginación
            const totalQuery = `SELECT COUNT(*) as total FROM tasks WHERE client_id = ?`;
            const totalResult = await executeQuery(totalQuery, [clientId]);
            const total = totalResult[0].total;

            const pagination = {
                page: parseInt(page),
                limit: Math.min(parseInt(limit), 100),
                total: total,
                totalPages: Math.ceil(total / Math.min(parseInt(limit), 100)),
                hasNext: parseInt(page) < Math.ceil(total / Math.min(parseInt(limit), 100)),
                hasPrev: parseInt(page) > 1
            };

            res.json({
                success: true,
                data: tasks.map(task => task.toJSON()),
                pagination,
                filters: {
                    status,
                    priority,
                    category,
                    search,
                    upcoming_days,
                    overdue
                }
            });

        } catch (error) {
            console.error('❌ Error in getTasks:', error.message);
            res.status(500).json({
                success: false,
                message: 'Error obteniendo tareas',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * GET /api/tasks/:id
     * Obtener una tarea específica
     */
    static async getTask(req, res, next) {
        try {
            const clientId = req.user.id;
            const taskId = parseInt(req.params.id);

            if (!taskId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de tarea inválido'
                });
            }

            const task = await Task.findById(taskId, clientId);

            if (!task) {
                return res.status(404).json({
                    success: false,
                    message: 'Tarea no encontrada'
                });
            }

            // Obtener recordatorios asociados
            const reminders = await TaskReminder.findByTask(taskId);

            res.json({
                success: true,
                data: {
                    ...task.toJSON(),
                    reminders: reminders.map(r => r.toJSON())
                }
            });

        } catch (error) {
            console.error('❌ Error in getTask:', error.message);
            res.status(500).json({
                success: false,
                message: 'Error obteniendo tarea',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * POST /api/tasks
     * Crear nueva tarea
     */
    static async createTask(req, res, next) {
        try {
            const clientId = req.user.id;

            // Validación de entrada
            const schema = Joi.object({
                title: Joi.string().min(1).max(255).required(),
                description: Joi.string().max(2000).allow(null, ''),
                priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
                category: Joi.string().valid('meeting', 'call', 'follow_up', 'reminder', 'task', 'other').default('task'),
                tags: Joi.array().items(Joi.string()),
                due_date: Joi.date().required(),
                reminder_datetime: Joi.date().allow(null),
                estimated_duration: Joi.number().integer().min(1).max(1440).allow(null),
                related_contact_id: Joi.number().integer().positive().allow(null),
                related_phone: Joi.string().max(50).allow(null, ''),
                is_recurring: Joi.boolean().default(false),
                recurrence_pattern: Joi.object().allow(null),
                // Campos específicos del servicio
                create_reminder: Joi.boolean().default(false), // Campo que faltaba
                auto_reminder_minutes_before: Joi.number().integer().min(1).max(10080).allow(null), // Max 1 semana
                reminder_type: Joi.string().valid('whatsapp', 'email', 'notification').default('whatsapp'),
                reminder_phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).allow(null, ''), // Formato internacional
                reminder_message: Joi.string().max(1000).allow(null, '')
            });

            const { error, value } = schema.validate(req.body);

            if (error) {
                return res.status(400).json({
                    success: false,
                    message: 'Datos de entrada inválidos',
                    errors: error.details.map(detail => detail.message)
                });
            }

            const createdTask = await TaskService.createTask(value, clientId);

            res.status(201).json({
                success: true,
                message: 'Tarea creada exitosamente',
                data: createdTask.toJSON()
            });

        } catch (error) {
            console.error('❌ Error in createTask:', error.message);
            res.status(500).json({
                success: false,
                message: 'Error creando tarea',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * PUT /api/tasks/:id
     * Actualizar tarea existente
     */
    static async updateTask(req, res, next) {
        try {
            const clientId = req.user.id;
            const taskId = parseInt(req.params.id);

            if (!taskId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de tarea inválido'
                });
            }

            // Validación de entrada (campos opcionales para actualización)
            const schema = Joi.object({
                id: Joi.number().integer().positive(), // Permitir id pero ignorarlo
                title: Joi.string().min(1).max(255),
                description: Joi.string().max(2000).allow(null, ''),
                priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
                category: Joi.string().valid('meeting', 'call', 'follow_up', 'reminder', 'task', 'other'),
                tags: Joi.array().items(Joi.string()),
                due_date: Joi.date(),
                reminder_datetime: Joi.date().allow(null),
                estimated_duration: Joi.number().integer().min(1).max(1440).allow(null),
                related_contact_id: Joi.number().integer().positive().allow(null),
                related_phone: Joi.string().max(50).allow(null, ''),
                status: Joi.string().valid('pending', 'in_progress', 'completed', 'cancelled', 'overdue'),
                completion_percentage: Joi.number().integer().min(0).max(100),
                is_recurring: Joi.boolean(),
                recurrence_pattern: Joi.object().allow(null),
                // Campos específicos del servicio para actualización
                create_reminder: Joi.boolean(),
                auto_reminder_minutes_before: Joi.number().integer().min(1).max(10080).allow(null),
                reminder_type: Joi.string().valid('whatsapp', 'email', 'notification'),
                reminder_phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).allow(null, ''), // Formato internacional
                reminder_message: Joi.string().max(1000).allow(null, '')
            });

            const { error, value } = schema.validate(req.body);

            if (error) {
                return res.status(400).json({
                    success: false,
                    message: 'Datos de entrada inválidos',
                    errors: error.details.map(detail => detail.message)
                });
            }

            const updatedTask = await TaskService.updateTask(taskId, value, clientId);

            res.json({
                success: true,
                message: 'Tarea actualizada exitosamente',
                data: updatedTask.toJSON()
            });

        } catch (error) {
            console.error('❌ Error in updateTask:', error.message);
            
            if (error.message === 'Tarea no encontrada') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error actualizando tarea',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * DELETE /api/tasks/:id
     * Eliminar tarea
     */
    static async deleteTask(req, res, next) {
        try {
            const clientId = req.user.id;
            const taskId = parseInt(req.params.id);

            if (!taskId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de tarea inválido'
                });
            }

            await TaskService.deleteTask(taskId, clientId);

            res.json({
                success: true,
                message: 'Tarea eliminada exitosamente'
            });

        } catch (error) {
            console.error('❌ Error in deleteTask:', error.message);
            
            if (error.message === 'Tarea no encontrada') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error eliminando tarea',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * POST /api/tasks/:id/complete
     * Marcar tarea como completada
     */
    static async completeTask(req, res, next) {
        try {
            const clientId = req.user.id;
            const taskId = parseInt(req.params.id);

            if (!taskId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de tarea inválido'
                });
            }

            const completedTask = await TaskService.markTaskAsCompleted(taskId, clientId);

            res.json({
                success: true,
                message: 'Tarea marcada como completada',
                data: completedTask.toJSON()
            });

        } catch (error) {
            console.error('❌ Error in completeTask:', error.message);
            
            if (error.message === 'Tarea no encontrada') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error completando tarea',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * POST /api/tasks/:id/cancel
     * Cancelar tarea
     */
    static async cancelTask(req, res, next) {
        try {
            const clientId = req.user.id;
            const taskId = parseInt(req.params.id);
            const { reason } = req.body;

            if (!taskId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de tarea inválido'
                });
            }

            const cancelledTask = await TaskService.markTaskAsCancelled(taskId, clientId, reason);

            res.json({
                success: true,
                message: 'Tarea cancelada exitosamente',
                data: cancelledTask.toJSON()
            });

        } catch (error) {
            console.error('❌ Error in cancelTask:', error.message);
            
            if (error.message === 'Tarea no encontrada') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error cancelando tarea',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * GET /api/tasks/dashboard
     * Obtener dashboard de tareas
     */
    static async getDashboard(req, res, next) {
        try {
            const clientId = req.user.id;

            const dashboard = await TaskService.getTasksDashboard(clientId);

            res.json({
                success: true,
                data: dashboard
            });

        } catch (error) {
            console.error('❌ Error in getDashboard:', error.message);
            res.status(500).json({
                success: false,
                message: 'Error obteniendo dashboard',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * GET /api/tasks/calendar/:year/:month
     * Obtener vista calendario de tareas
     */
    static async getCalendar(req, res, next) {
        try {
            const clientId = req.user.id;
            const year = parseInt(req.params.year);
            const month = parseInt(req.params.month);

            if (!year || !month || month < 1 || month > 12) {
                return res.status(400).json({
                    success: false,
                    message: 'Año o mes inválido'
                });
            }

            const calendar = await TaskService.getTasksForCalendar(clientId, year, month);

            res.json({
                success: true,
                data: calendar
            });

        } catch (error) {
            console.error('❌ Error in getCalendar:', error.message);
            res.status(500).json({
                success: false,
                message: 'Error obteniendo calendario',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * GET /api/tasks/search
     * Buscar tareas
     */
    static async searchTasks(req, res, next) {
        try {
            const clientId = req.user.id;
            const { q: searchTerm, limit = 20, ...filters } = req.query;

            if (!searchTerm || searchTerm.trim().length < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'Término de búsqueda debe tener al menos 2 caracteres'
                });
            }

            const searchFilters = {
                ...filters,
                limit: Math.min(parseInt(limit), 50)
            };

            const tasks = await TaskService.searchTasks(clientId, searchTerm.trim(), searchFilters);

            res.json({
                success: true,
                data: tasks.map(task => task.toJSON()),
                search_term: searchTerm.trim(),
                total_results: tasks.length
            });

        } catch (error) {
            console.error('❌ Error in searchTasks:', error.message);
            res.status(500).json({
                success: false,
                message: 'Error buscando tareas',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * POST /api/tasks/:id/reminders
     * Crear recordatorio para una tarea
     */
    static async createReminder(req, res, next) {
        try {
            const clientId = req.user.id;
            const taskId = parseInt(req.params.id);

            if (!taskId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de tarea inválido'
                });
            }

            // Verificar que la tarea pertenece al cliente
            const task = await Task.findById(taskId, clientId);
            if (!task) {
                return res.status(404).json({
                    success: false,
                    message: 'Tarea no encontrada'
                });
            }

            // Validación de entrada
            const schema = Joi.object({
                reminder_type: Joi.string().valid('whatsapp', 'email', 'notification').required(),
                reminder_phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).allow(null, ''), // Formato internacional
                reminder_datetime: Joi.date().required(),
                message_content: Joi.string().max(1000).allow(null, '')
            });

            const { error, value } = schema.validate(req.body);

            if (error) {
                return res.status(400).json({
                    success: false,
                    message: 'Datos de entrada inválidos',
                    errors: error.details.map(detail => detail.message)
                });
            }

            const reminder = await TaskReminderService.createReminderForTask(taskId, value);

            res.status(201).json({
                success: true,
                message: 'Recordatorio creado exitosamente',
                data: reminder.toJSON()
            });

        } catch (error) {
            console.error('❌ Error in createReminder:', error.message);
            res.status(500).json({
                success: false,
                message: 'Error creando recordatorio',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * GET /api/tasks/stats
     * Obtener estadísticas de tareas
     */
    static async getStats(req, res, next) {
        try {
            const clientId = req.user.id;

            const taskStats = await Task.getStatsByClient(clientId);
            const reminderStats = await TaskReminderService.getReminderStats(clientId);

            res.json({
                success: true,
                data: {
                    tasks: taskStats,
                    reminders: reminderStats,
                    generated_at: new Date()
                }
            });

        } catch (error) {
            console.error('❌ Error in getStats:', error.message);
            res.status(500).json({
                success: false,
                message: 'Error obteniendo estadísticas',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * GET /api/tasks/processor/status
     * Obtener estado del procesador (solo para desarrollo/admin)
     */
    static async getProcessorStatus(req, res, next) {
        try {
            const healthStatus = TaskProcessor.getHealthStatus();
            const stats = TaskProcessor.getStats();

            res.json({
                success: true,
                data: {
                    health: healthStatus,
                    stats: stats
                }
            });

        } catch (error) {
            console.error('❌ Error in getProcessorStatus:', error.message);
            res.status(500).json({
                success: false,
                message: 'Error obteniendo estado del procesador',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

module.exports = TaskController;
