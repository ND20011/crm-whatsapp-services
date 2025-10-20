const { executeQuery } = require('../config/database-simple');
const Joi = require('joi');

// ============================================================================
// TASK ENTITY - CRM CONDORITO
// ============================================================================

/**
 * Obtener fecha actual de Buenos Aires
 * @returns {Date} Fecha actual en zona horaria de Buenos Aires
 */
function getBuenosAiresTime() {
    const currentTime = new Date().toLocaleString("en-US", {timeZone: "America/Argentina/Buenos_Aires"});
    return new Date(currentTime);
}

class Task {
    constructor(data = {}) {
        this.id = data.id || null;
        this.client_id = data.client_id;
        
        // INFORMACIÓN BÁSICA
        this.title = data.title;
        this.description = data.description || null;
        this.priority = data.priority || 'medium';
        
        // CATEGORIZACIÓN
        this.category = data.category || 'task';
        this.tags = data.tags || null;
        
        // FECHAS Y TIEMPO
        this.due_date = data.due_date;
        this.reminder_datetime = data.reminder_datetime || null;
        this.estimated_duration = data.estimated_duration || null;
        
        // CONTACTO RELACIONADO
        this.related_contact_id = data.related_contact_id || null;
        this.related_phone = data.related_phone || null;
        
        // ESTADO Y PROGRESO
        this.status = data.status || 'pending';
        this.completion_percentage = data.completion_percentage || 0;
        this.completed_at = data.completed_at || null;
        
        // RECURRENCIA
        this.is_recurring = data.is_recurring || false;
        this.recurrence_pattern = data.recurrence_pattern || null;
        this.parent_task_id = data.parent_task_id || null;
        
        // EXPORTACIÓN GOOGLE
        this.last_exported_to_google = data.last_exported_to_google || null;
        this.google_export_count = data.google_export_count || 0;
        
        // METADATOS
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }

    /**
     * Crear nueva tarea
     */
    static async create(taskData) {
        try {
            // Validar datos
            const validation = Task.validate(taskData);
            if (!validation.isValid) {
                throw new Error(`Datos inválidos: ${validation.errors.join(', ')}`);
            }

            const query = `
                INSERT INTO tasks (
                    client_id, title, description, priority, category, tags,
                    due_date, reminder_datetime, estimated_duration,
                    related_contact_id, related_phone, status, completion_percentage,
                    is_recurring, recurrence_pattern, parent_task_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const params = [
                taskData.client_id,
                taskData.title,
                taskData.description || null,
                taskData.priority || 'medium',
                taskData.category || 'task',
                taskData.tags ? JSON.stringify(taskData.tags) : null,
                taskData.due_date,
                taskData.reminder_datetime || null,
                taskData.estimated_duration || null,
                taskData.related_contact_id || null,
                taskData.related_phone || null,
                taskData.status || 'pending',
                taskData.completion_percentage || 0,
                taskData.is_recurring || false,
                taskData.recurrence_pattern ? JSON.stringify(taskData.recurrence_pattern) : null,
                taskData.parent_task_id || null
            ];

            const result = await executeQuery(query, params);
            
            // Obtener la tarea creada
            const createdTask = await Task.findById(result.insertId);
            
            console.log(`✅ Tarea creada: ${createdTask.title} (ID: ${createdTask.id})`);
            return createdTask;

        } catch (error) {
            console.error('❌ Error creating task:', error.message);
            throw error;
        }
    }

    /**
     * Buscar tarea por ID
     */
    static async findById(id, clientId = null) {
        try {
            let query = `
                SELECT t.*
                FROM tasks t
                WHERE t.id = ?
            `;
            
            const params = [id];
            
            if (clientId) {
                query += ' AND t.client_id = ?';
                params.push(clientId);
            }

            const results = await executeQuery(query, params);
            
            if (results.length === 0) {
                return null;
            }

            const taskData = results[0];
            
            // Parsear JSON fields
            if (taskData.tags && typeof taskData.tags === 'string') {
                taskData.tags = JSON.parse(taskData.tags);
            }
            if (taskData.recurrence_pattern && typeof taskData.recurrence_pattern === 'string') {
                taskData.recurrence_pattern = JSON.parse(taskData.recurrence_pattern);
            }

            return new Task(taskData);

        } catch (error) {
            console.error('❌ Error finding task by ID:', error.message);
            throw error;
        }
    }

    /**
     * Obtener todas las tareas de un cliente con filtros
     */
    static async findByClient(clientId, filters = {}) {
        try {
            let query = `
                SELECT t.*
                FROM tasks t
                WHERE t.client_id = ?
            `;
            
            const params = [clientId];

            // Aplicar filtros
            if (filters.status) {
                query += ' AND t.status = ?';
                params.push(filters.status);
            }

            if (filters.priority) {
                query += ' AND t.priority = ?';
                params.push(filters.priority);
            }

            if (filters.category) {
                query += ' AND t.category = ?';
                params.push(filters.category);
            }

            if (filters.due_date_from) {
                query += ' AND t.due_date >= ?';
                params.push(filters.due_date_from);
            }

            if (filters.due_date_to) {
                query += ' AND t.due_date <= ?';
                params.push(filters.due_date_to);
            }

            if (filters.search) {
                query += ' AND (t.title LIKE ? OR t.description LIKE ?)';
                const searchTerm = `%${filters.search}%`;
                params.push(searchTerm, searchTerm);
            }

            if (filters.related_contact_id) {
                query += ' AND t.related_contact_id = ?';
                params.push(filters.related_contact_id);
            }

            // Ordenamiento
            const orderBy = filters.order_by || 'due_date';
            const orderDir = filters.order_dir || 'ASC';
            query += ` ORDER BY t.${orderBy} ${orderDir}`;

            // Paginación
            if (filters.limit) {
                const limit = parseInt(filters.limit);
                query += ` LIMIT ${limit}`;
                
                if (filters.offset) {
                    const offset = parseInt(filters.offset);
                    query += ` OFFSET ${offset}`;
                }
            }

            const results = await executeQuery(query, params);
            
            return results.map(taskData => {
                // Parsear JSON fields
                if (taskData.tags && typeof taskData.tags === 'string') {
                    taskData.tags = JSON.parse(taskData.tags);
                }
                if (taskData.recurrence_pattern && typeof taskData.recurrence_pattern === 'string') {
                    taskData.recurrence_pattern = JSON.parse(taskData.recurrence_pattern);
                }
                
                return new Task(taskData);
            });

        } catch (error) {
            console.error('❌ Error finding tasks by client:', error.message);
            throw error;
        }
    }

    /**
     * Actualizar tarea
     */
    static async update(id, updates, clientId) {
        try {
            // Verificar que la tarea existe y pertenece al cliente
            const existingTask = await Task.findById(id, clientId);
            if (!existingTask) {
                throw new Error('Tarea no encontrada');
            }

            // Construir query dinámicamente
            const allowedFields = [
                'title', 'description', 'priority', 'category', 'tags',
                'due_date', 'reminder_datetime', 'estimated_duration',
                'related_contact_id', 'related_phone', 'status', 
                'completion_percentage', 'completed_at', 'is_recurring', 
                'recurrence_pattern', 'last_exported_to_google', 'google_export_count'
            ];

            const updateFields = [];
            const params = [];

            Object.keys(updates).forEach(field => {
                if (allowedFields.includes(field) && updates[field] !== undefined) {
                    updateFields.push(`${field} = ?`);
                    
                    // Serializar JSON fields
                    if ((field === 'tags' || field === 'recurrence_pattern') && updates[field] !== null) {
                        params.push(JSON.stringify(updates[field]));
                    } else {
                        params.push(updates[field]);
                    }
                }
            });

            if (updateFields.length === 0) {
                throw new Error('No hay campos válidos para actualizar');
            }

            const query = `
                UPDATE tasks 
                SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND client_id = ?
            `;

            params.push(id, clientId);

            await executeQuery(query, params);
            
            // Retornar tarea actualizada
            const updatedTask = await Task.findById(id, clientId);
            console.log(`✅ Tarea actualizada: ${updatedTask.title} (ID: ${id})`);
            
            return updatedTask;

        } catch (error) {
            console.error('❌ Error updating task:', error.message);
            throw error;
        }
    }

    /**
     * Eliminar tarea
     */
    static async delete(id, clientId) {
        try {
            // Verificar que la tarea existe
            const task = await Task.findById(id, clientId);
            if (!task) {
                throw new Error('Tarea no encontrada');
            }

            const query = 'DELETE FROM tasks WHERE id = ? AND client_id = ?';
            const result = await executeQuery(query, [id, clientId]);

            if (result.affectedRows === 0) {
                throw new Error('No se pudo eliminar la tarea');
            }

            console.log(`✅ Tarea eliminada: ${task.title} (ID: ${id})`);
            return true;

        } catch (error) {
            console.error('❌ Error deleting task:', error.message);
            throw error;
        }
    }

    /**
     * Marcar tarea como completada
     */
    static async markAsCompleted(id, clientId) {
        try {
            const updates = {
                status: 'completed',
                completed_at: getBuenosAiresTime(),
                completion_percentage: 100
            };

            return await Task.update(id, updates, clientId);

        } catch (error) {
            console.error('❌ Error marking task as completed:', error.message);
            throw error;
        }
    }

    /**
     * Marcar tareas como vencidas (para cron job)
     */
    static async markOverdueTasks() {
        try {
            const query = `
                UPDATE tasks 
                SET status = 'overdue', updated_at = CURRENT_TIMESTAMP
                WHERE status = 'pending' 
                  AND due_date < NOW()
            `;

            const result = await executeQuery(query);
            
            if (result.affectedRows > 0) {
                console.log(`✅ ${result.affectedRows} tareas marcadas como vencidas`);
            }

            return result.affectedRows;

        } catch (error) {
            console.error('❌ Error marking overdue tasks:', error.message);
            throw error;
        }
    }

    /**
     * Obtener tareas próximas a vencer (para recordatorios)
     */
    static async getTasksWithReminders() {
        try {
            const query = `
                SELECT t.*, 
                       c.name as contact_name,
                       c.custom_name as contact_custom_name
                FROM tasks t
                LEFT JOIN contacts c ON t.related_contact_id = c.id
                WHERE t.reminder_datetime IS NOT NULL
                  AND t.reminder_datetime <= NOW()
                  AND t.status IN ('pending', 'in_progress')
                ORDER BY t.reminder_datetime ASC
            `;

            const results = await executeQuery(query);
            
            return results.map(taskData => {
                // Parsear JSON fields
                if (taskData.tags && typeof taskData.tags === 'string') {
                    taskData.tags = JSON.parse(taskData.tags);
                }
                if (taskData.recurrence_pattern && typeof taskData.recurrence_pattern === 'string') {
                    taskData.recurrence_pattern = JSON.parse(taskData.recurrence_pattern);
                }
                
                return new Task(taskData);
            });

        } catch (error) {
            console.error('❌ Error getting tasks with reminders:', error.message);
            throw error;
        }
    }

    /**
     * Obtener estadísticas de tareas por cliente
     */
    static async getStatsByClient(clientId) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_tasks,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
                    SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
                    SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_tasks,
                    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_tasks,
                    SUM(CASE WHEN due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as upcoming_tasks,
                    AVG(completion_percentage) as avg_completion_percentage
                FROM tasks 
                WHERE client_id = ?
            `;

            const results = await executeQuery(query, [clientId]);
            return results[0];

        } catch (error) {
            console.error('❌ Error getting task stats:', error.message);
            throw error;
        }
    }

    /**
     * Validar datos de tarea
     */
    static validate(data) {
        const schema = Joi.object({
            client_id: Joi.number().integer().positive().required(),
            title: Joi.string().min(1).max(255).required(),
            description: Joi.string().max(2000).allow(null, ''),
            priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
            category: Joi.string().valid('meeting', 'call', 'follow_up', 'reminder', 'task', 'other'),
            tags: Joi.array().items(Joi.string()),
            due_date: Joi.date().required(),
            reminder_datetime: Joi.date().allow(null),
            estimated_duration: Joi.number().integer().min(1).max(1440).allow(null), // Max 24 horas
            related_contact_id: Joi.number().integer().positive().allow(null),
            related_phone: Joi.string().max(50).allow(null, ''),
            status: Joi.string().valid('pending', 'in_progress', 'completed', 'cancelled', 'overdue'),
            completion_percentage: Joi.number().integer().min(0).max(100),
            is_recurring: Joi.boolean(),
            recurrence_pattern: Joi.object().allow(null),
            parent_task_id: Joi.number().integer().positive().allow(null)
        });

        const { error } = schema.validate(data);
        
        if (error) {
            return {
                isValid: false,
                errors: error.details.map(detail => detail.message)
            };
        }

        return { isValid: true, errors: [] };
    }

    /**
     * Convertir a JSON para API responses
     */
    toJSON() {
        return {
            id: this.id,
            client_id: this.client_id,
            title: this.title,
            description: this.description,
            priority: this.priority,
            category: this.category,
            tags: this.tags,
            due_date: this.due_date,
            reminder_datetime: this.reminder_datetime,
            estimated_duration: this.estimated_duration,
            related_contact_id: this.related_contact_id,
            related_phone: this.related_phone,
            status: this.status,
            completion_percentage: this.completion_percentage,
            completed_at: this.completed_at,
            is_recurring: this.is_recurring,
            recurrence_pattern: this.recurrence_pattern,
            parent_task_id: this.parent_task_id,
            last_exported_to_google: this.last_exported_to_google,
            google_export_count: this.google_export_count,
            created_at: this.created_at,
            updated_at: this.updated_at,
            // Campos adicionales de joins
            contact_name: this.contact_name,
            contact_custom_name: this.contact_custom_name
        };
    }
}

module.exports = Task;

