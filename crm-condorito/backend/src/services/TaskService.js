const Task = require('../entities/Task');
const TaskReminder = require('../entities/TaskReminder');
const Contact = require('../entities/Contact');
const WhatsAppService = require('./WhatsAppService');
const { executeQuery } = require('../config/database-simple');

// ============================================================================
// TASK SERVICE - CRM CONDORITO
// ============================================================================

/**
 * Obtener fecha actual de Buenos Aires
 * @returns {Date} Fecha actual en zona horaria de Buenos Aires
 */
function getBuenosAiresTime() {
    const currentTime = new Date().toLocaleString("en-US", {timeZone: "America/Argentina/Buenos_Aires"});
    return new Date(currentTime);
}

class TaskService {

    /**
     * Crear nueva tarea con recordatorio automático opcional
     */
    static async createTask(taskData, clientId) {
        try {
            console.log(`📝 Creando tarea para cliente ${clientId}: ${taskData.title}`);

            // Asegurar que el client_id esté en los datos
            taskData.client_id = clientId;

            // Extraer campos específicos del servicio antes de la validación
            const serviceFields = {
                create_reminder: taskData.create_reminder,
                reminder_message: taskData.reminder_message,
                auto_reminder_minutes_before: taskData.auto_reminder_minutes_before,
                reminder_type: taskData.reminder_type || 'whatsapp',
                reminder_phone: taskData.reminder_phone || null
            };

            // Remover campos del servicio de los datos de la tarea
            const cleanTaskData = { ...taskData };
            delete cleanTaskData.create_reminder;
            delete cleanTaskData.reminder_message;
            delete cleanTaskData.auto_reminder_minutes_before;
            delete cleanTaskData.reminder_type;
            delete cleanTaskData.reminder_phone;

            console.log('🔍 Datos originales:', Object.keys(taskData));
            console.log('🔍 Datos limpios para Task.create:', Object.keys(cleanTaskData));
            console.log('🔍 ServiceFields extraídos:', serviceFields);

            // Crear la tarea
            const createdTask = await Task.create(cleanTaskData);

            // Crear recordatorio automático si se especifica
            if (serviceFields.create_reminder && taskData.reminder_datetime) {
                try {
                    const reminderData = {
                        task_id: createdTask.id,
                        reminder_type: serviceFields.reminder_type,
                        reminder_phone: serviceFields.reminder_phone || null,
                        reminder_datetime: taskData.reminder_datetime,
                        message_content: serviceFields.reminder_message || null
                    };

                    const reminder = await TaskReminder.create(reminderData);
                    console.log(`🔔 Recordatorio creado automáticamente (ID: ${reminder.id})`);
                    
                    createdTask.reminder = reminder;
                } catch (reminderError) {
                    console.error('⚠️ Error creando recordatorio automático:', reminderError.message);
                    // No fallar la creación de tarea por error en recordatorio
                }
            }

            // Crear recordatorio automático basado en la fecha de vencimiento
            if (serviceFields.auto_reminder_minutes_before) {
                try {
                    await TaskReminder.createAutoReminder(
                        createdTask.id, 
                        serviceFields.auto_reminder_minutes_before,
                        serviceFields.reminder_type,
                        serviceFields.reminder_phone || null
                    );
                } catch (autoReminderError) {
                    console.error('⚠️ Error creando recordatorio automático:', autoReminderError.message);
                }
            }

            console.log(`✅ Tarea creada exitosamente: ${createdTask.title} (ID: ${createdTask.id})`);
            return createdTask;

        } catch (error) {
            console.error('❌ Error en TaskService.createTask:', error.message);
            throw error;
        }
    }

    /**
     * Actualizar tarea con lógica de negocio
     */
    static async updateTask(taskId, updates, clientId) {
        try {
            console.log(`📝 Actualizando tarea ${taskId} para cliente ${clientId}`);

            // Obtener tarea actual
            const currentTask = await Task.findById(taskId, clientId);
            if (!currentTask) {
                throw new Error('Tarea no encontrada');
            }

            // Lógica especial para cambio de estado a "completed"
            if (updates.status === 'completed' && currentTask.status !== 'completed') {
                updates.completed_at = getBuenosAiresTime();
                updates.completion_percentage = 100;
                console.log(`✅ Marcando tarea como completada: ${currentTask.title}`);
            }

            // Lógica especial para cambio de estado desde "completed"
            if (updates.status && updates.status !== 'completed' && currentTask.status === 'completed') {
                updates.completed_at = null;
                console.log(`🔄 Desmarcando tarea como completada: ${currentTask.title}`);
            }

            // Actualizar la tarea
            const updatedTask = await Task.update(taskId, updates, clientId);

            // Si se cambió la fecha de vencimiento y hay recordatorios, actualizarlos
            if (updates.due_date && updates.due_date !== currentTask.due_date) {
                await this.updateTaskReminders(taskId, updates.due_date);
            }

            console.log(`✅ Tarea actualizada exitosamente: ${updatedTask.title}`);
            return updatedTask;

        } catch (error) {
            console.error('❌ Error en TaskService.updateTask:', error.message);
            throw error;
        }
    }

    /**
     * Marcar tarea como completada (método de conveniencia)
     */
    static async markTaskAsCompleted(taskId, clientId) {
        try {
            return await this.updateTask(taskId, { status: 'completed' }, clientId);
        } catch (error) {
            console.error('❌ Error en TaskService.markTaskAsCompleted:', error.message);
            throw error;
        }
    }

    /**
     * Marcar tarea como cancelada
     */
    static async markTaskAsCancelled(taskId, clientId, reason = null) {
        try {
            const updates = { status: 'cancelled' };
            if (reason) {
                updates.description = `${updates.description || ''}\n\n[CANCELADA: ${reason}]`;
            }

            return await this.updateTask(taskId, updates, clientId);
        } catch (error) {
            console.error('❌ Error en TaskService.markTaskAsCancelled:', error.message);
            throw error;
        }
    }

    /**
     * Eliminar tarea con limpieza de recordatorios
     */
    static async deleteTask(taskId, clientId) {
        try {
            console.log(`🗑️ Eliminando tarea ${taskId} para cliente ${clientId}`);

            // Verificar que la tarea existe
            const task = await Task.findById(taskId, clientId);
            if (!task) {
                throw new Error('Tarea no encontrada');
            }

            // Eliminar recordatorios asociados
            const reminders = await TaskReminder.findByTask(taskId);
            for (const reminder of reminders) {
                await TaskReminder.delete(reminder.id);
            }

            // Eliminar la tarea
            await Task.delete(taskId, clientId);

            console.log(`✅ Tarea eliminada exitosamente: ${task.title}`);
            return true;

        } catch (error) {
            console.error('❌ Error en TaskService.deleteTask:', error.message);
            throw error;
        }
    }

    /**
     * Obtener tareas con filtros avanzados
     */
    static async getTasks(clientId, filters = {}) {
        try {
            console.log(`📋 Obteniendo tareas para cliente ${clientId}`);

            // Procesar filtros especiales
            const processedFilters = { ...filters };

            // Filtro de fecha próxima (próximos X días)
            if (filters.upcoming_days) {
                const days = parseInt(filters.upcoming_days);
                processedFilters.due_date_from = getBuenosAiresTime();
                processedFilters.due_date_to = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
                delete processedFilters.upcoming_days;
            }

            // Filtro de tareas vencidas
            if (filters.overdue === true || filters.overdue === 'true') {
                processedFilters.status = 'overdue';
                delete processedFilters.overdue;
            }

            // Obtener tareas
            const tasks = await Task.findByClient(clientId, processedFilters);

            console.log(`✅ Encontradas ${tasks.length} tareas`);
            return tasks;

        } catch (error) {
            console.error('❌ Error en TaskService.getTasks:', error.message);
            throw error;
        }
    }

    /**
     * Obtener dashboard de tareas (resumen)
     */
    static async getTasksDashboard(clientId) {
        try {
            console.log(`📊 Generando dashboard para cliente ${clientId}`);

            // Obtener estadísticas generales
            const stats = await Task.getStatsByClient(clientId);

            // Obtener tareas próximas (próximos 7 días)
            const upcomingTasks = await this.getTasks(clientId, {
                upcoming_days: 7,
                order_by: 'due_date',
                order_dir: 'ASC',
                limit: 10
            });

            // Obtener tareas vencidas
            const overdueTasks = await this.getTasks(clientId, {
                status: 'overdue',
                order_by: 'due_date',
                order_dir: 'ASC',
                limit: 10
            });

            // Obtener tareas completadas recientes (últimos 7 días)
            const recentlyCompleted = await this.getTasks(clientId, {
                status: 'completed',
                order_by: 'completed_at',
                order_dir: 'DESC',
                limit: 5
            });

            const dashboard = {
                stats,
                upcoming_tasks: upcomingTasks,
                overdue_tasks: overdueTasks,
                recently_completed: recentlyCompleted,
                summary: {
                    total_tasks: parseInt(stats.total_tasks) || 0,
                    completion_rate: stats.total_tasks > 0 
                        ? Math.round((stats.completed_tasks / stats.total_tasks) * 100) 
                        : 0,
                    urgent_tasks: upcomingTasks.filter(t => t.priority === 'urgent').length,
                    tasks_due_today: upcomingTasks.filter(t => {
                        const today = getBuenosAiresTime().toDateString();
                        return new Date(t.due_date).toDateString() === today;
                    }).length
                }
            };

            console.log(`✅ Dashboard generado: ${dashboard.summary.total_tasks} tareas totales`);
            return dashboard;

        } catch (error) {
            console.error('❌ Error en TaskService.getTasksDashboard:', error.message);
            throw error;
        }
    }

    /**
     * Generar tareas recurrentes
     */
    static async generateRecurringTasks() {
        try {
            console.log('🔄 Generando tareas recurrentes...');

            // Obtener tareas recurrentes que necesitan generar nuevas instancias
            const query = `
                SELECT * FROM tasks 
                WHERE is_recurring = true 
                  AND status = 'completed'
                  AND (
                      parent_task_id IS NULL OR 
                      id IN (
                          SELECT parent_task_id FROM tasks 
                          WHERE parent_task_id IS NOT NULL 
                          GROUP BY parent_task_id
                      )
                  )
            `;

            const recurringTasks = await executeQuery(query);
            let generatedCount = 0;

            for (const taskData of recurringTasks) {
                try {
                    const task = new Task(taskData);
                    
                    // Parsear patrón de recurrencia
                    const pattern = typeof task.recurrence_pattern === 'string' 
                        ? JSON.parse(task.recurrence_pattern) 
                        : task.recurrence_pattern;

                    if (!pattern || !pattern.type || !pattern.interval) {
                        continue;
                    }

                    // Calcular próxima fecha
                    const nextDate = this.calculateNextRecurrenceDate(task.due_date, pattern);
                    
                    if (!nextDate) {
                        continue;
                    }

                    // Crear nueva instancia de la tarea
                    const newTaskData = {
                        client_id: task.client_id,
                        title: task.title,
                        description: task.description,
                        priority: task.priority,
                        category: task.category,
                        tags: task.tags,
                        due_date: nextDate,
                        estimated_duration: task.estimated_duration,
                        related_contact_id: task.related_contact_id,
                        related_phone: task.related_phone,
                        is_recurring: true,
                        recurrence_pattern: task.recurrence_pattern,
                        parent_task_id: task.parent_task_id || task.id
                    };

                    await Task.create(newTaskData);
                    generatedCount++;

                    console.log(`✅ Tarea recurrente generada: ${task.title} para ${nextDate.toLocaleDateString()}`);

                } catch (taskError) {
                    console.error(`❌ Error generando tarea recurrente ${taskData.id}:`, taskError.message);
                }
            }

            console.log(`✅ Generadas ${generatedCount} tareas recurrentes`);
            return generatedCount;

        } catch (error) {
            console.error('❌ Error en TaskService.generateRecurringTasks:', error.message);
            throw error;
        }
    }

    /**
     * Marcar tareas vencidas automáticamente
     */
    static async markOverdueTasks() {
        try {
            console.log('⏰ Marcando tareas vencidas...');

            const overdueCount = await Task.markOverdueTasks();
            
            if (overdueCount > 0) {
                console.log(`✅ ${overdueCount} tareas marcadas como vencidas`);
            }

            return overdueCount;

        } catch (error) {
            console.error('❌ Error en TaskService.markOverdueTasks:', error.message);
            throw error;
        }
    }

    /**
     * Actualizar recordatorios cuando cambia la fecha de una tarea
     */
    static async updateTaskReminders(taskId, newDueDate) {
        try {
            const reminders = await TaskReminder.findByTask(taskId);
            
            for (const reminder of reminders) {
                // Solo actualizar recordatorios pendientes
                if (reminder.status === 'pending') {
                    // Calcular nueva fecha del recordatorio manteniendo la diferencia original
                    const originalTask = await Task.findById(taskId);
                    const originalDiff = new Date(originalTask.due_date) - new Date(reminder.reminder_datetime);
                    const newReminderDate = new Date(newDueDate.getTime() - originalDiff);

                    if (newReminderDate > getBuenosAiresTime()) {
                        await executeQuery(
                            'UPDATE task_reminders SET reminder_datetime = ? WHERE id = ?',
                            [newReminderDate, reminder.id]
                        );
                        
                        console.log(`🔔 Recordatorio ${reminder.id} actualizado a ${newReminderDate.toLocaleString()}`);
                    }
                }
            }

        } catch (error) {
            console.error('❌ Error actualizando recordatorios:', error.message);
        }
    }

    /**
     * Calcular próxima fecha de recurrencia
     */
    static calculateNextRecurrenceDate(currentDate, pattern) {
        try {
            const date = new Date(currentDate);
            
            switch (pattern.type) {
                case 'daily':
                    date.setDate(date.getDate() + (pattern.interval || 1));
                    break;
                    
                case 'weekly':
                    date.setDate(date.getDate() + (7 * (pattern.interval || 1)));
                    break;
                    
                case 'monthly':
                    date.setMonth(date.getMonth() + (pattern.interval || 1));
                    break;
                    
                case 'yearly':
                    date.setFullYear(date.getFullYear() + (pattern.interval || 1));
                    break;
                    
                default:
                    return null;
            }

            // Verificar fecha límite si existe
            if (pattern.end_date && date > new Date(pattern.end_date)) {
                return null;
            }

            return date;

        } catch (error) {
            console.error('❌ Error calculando próxima recurrencia:', error.message);
            return null;
        }
    }

    /**
     * Obtener tareas por calendario (vista mensual)
     */
    static async getTasksForCalendar(clientId, year, month) {
        try {
            console.log(`📅 Obteniendo tareas para calendario ${year}/${month} - cliente ${clientId}`);

            // Calcular rango de fechas del mes
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            
            console.log(`📊 Rango calculado: ${startDate.toISOString()} - ${endDate.toISOString()}`);

            // Convertir a formato de string que espera la base de datos
            const startDateStr = startDate.toISOString().slice(0, 19).replace('T', ' ');
            const endDateStr = endDate.toISOString().slice(0, 19).replace('T', ' ');
            
            console.log(`📊 Rango para DB: ${startDateStr} - ${endDateStr}`);

            const tasks = await Task.findByClient(clientId, {
                due_date_from: startDateStr,
                due_date_to: endDateStr,
                order_by: 'due_date',
                order_dir: 'ASC'
            });

            console.log(`📋 Tareas encontradas: ${tasks.length}`);
            tasks.forEach(task => {
                console.log(`  - ${task.title} (${task.due_date}) - ${task.status}`);
            });

            // Retornar las tareas directamente en lugar de objeto estructurado
            return tasks;

        } catch (error) {
            console.error('❌ Error en TaskService.getTasksForCalendar:', error.message);
            throw error;
        }
    }

    /**
     * Buscar tareas por texto
     */
    static async searchTasks(clientId, searchTerm, filters = {}) {
        try {
            console.log(`🔍 Buscando tareas para cliente ${clientId}: "${searchTerm}"`);

            const searchFilters = {
                ...filters,
                search: searchTerm,
                limit: filters.limit || 50
            };

            const tasks = await Task.findByClient(clientId, searchFilters);

            console.log(`✅ Búsqueda completada: ${tasks.length} resultados`);
            return tasks;

        } catch (error) {
            console.error('❌ Error en TaskService.searchTasks:', error.message);
            throw error;
        }
    }
}

module.exports = TaskService;
