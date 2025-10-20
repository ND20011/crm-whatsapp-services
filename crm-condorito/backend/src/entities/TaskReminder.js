const { executeQuery } = require('../config/database-simple');
const Joi = require('joi');

// ============================================================================
// TASK REMINDER ENTITY - CRM CONDORITO
// ============================================================================

/**
 * Obtener fecha actual de Buenos Aires
 * @returns {Date} Fecha actual en zona horaria de Buenos Aires
 */
function getBuenosAiresTime() {
    const currentTime = new Date().toLocaleString("en-US", {timeZone: "America/Argentina/Buenos_Aires"});
    return new Date(currentTime);
}

class TaskReminder {
    constructor(data = {}) {
        this.id = data.id || null;
        this.task_id = data.task_id;
        
        // CONFIGURACIÓN DEL RECORDATORIO
        this.reminder_type = data.reminder_type;
        this.reminder_phone = data.reminder_phone || null;
        this.reminder_datetime = data.reminder_datetime;
        this.message_content = data.message_content || null;
        
        // ESTADO DEL RECORDATORIO
        this.status = data.status || 'pending';
        this.sent_at = data.sent_at || null;
        this.error_message = data.error_message || null;
        
        // METADATOS
        this.created_at = data.created_at;
    }

    /**
     * Crear nuevo recordatorio
     */
    static async create(reminderData) {
        try {
            // Validar datos
            const validation = TaskReminder.validate(reminderData);
            if (!validation.isValid) {
                throw new Error(`Datos inválidos: ${validation.errors.join(', ')}`);
            }

            const query = `
                INSERT INTO task_reminders (
                    task_id, reminder_type, reminder_phone, reminder_datetime, message_content, status
                ) VALUES (?, ?, ?, ?, ?, ?)
            `;

            const params = [
                reminderData.task_id,
                reminderData.reminder_type,
                reminderData.reminder_phone || null,
                reminderData.reminder_datetime,
                reminderData.message_content,
                reminderData.status || 'pending'
            ];

            const result = await executeQuery(query, params);
            
            // Obtener el recordatorio creado
            const createdReminder = await TaskReminder.findById(result.insertId);
            
            console.log(`✅ Recordatorio creado para tarea ${reminderData.task_id} (ID: ${createdReminder.id})`);
            return createdReminder;

        } catch (error) {
            console.error('❌ Error creating task reminder:', error.message);
            throw error;
        }
    }

    /**
     * Buscar recordatorio por ID
     */
    static async findById(id) {
        try {
            const query = `
                SELECT tr.*, 
                       t.title as task_title,
                       t.client_id,
                       t.due_date as task_due_date
                FROM task_reminders tr
                JOIN tasks t ON tr.task_id = t.id
                WHERE tr.id = ?
            `;

            const results = await executeQuery(query, [id]);
            
            if (results.length === 0) {
                return null;
            }

            return new TaskReminder(results[0]);

        } catch (error) {
            console.error('❌ Error finding task reminder by ID:', error.message);
            throw error;
        }
    }

    /**
     * Obtener recordatorios por tarea
     */
    static async findByTask(taskId) {
        try {
            const query = `
                SELECT tr.*, 
                       t.title as task_title,
                       t.client_id,
                       t.due_date as task_due_date
                FROM task_reminders tr
                JOIN tasks t ON tr.task_id = t.id
                WHERE tr.task_id = ?
                ORDER BY tr.reminder_datetime ASC
            `;

            const results = await executeQuery(query, [taskId]);
            
            return results.map(reminderData => new TaskReminder(reminderData));

        } catch (error) {
            console.error('❌ Error finding reminders by task:', error.message);
            throw error;
        }
    }

    /**
     * Obtener recordatorios pendientes listos para enviar
     */
    static async getPendingReminders() {
        try {
            const query = `
                SELECT tr.*, 
                       t.title as task_title,
                       t.description as task_description,
                       t.client_id,
                       t.due_date as task_due_date,
                       t.priority as task_priority,
                       t.category as task_category,
                       c.name as contact_name,
                       c.custom_name as contact_custom_name
                FROM task_reminders tr
                JOIN tasks t ON tr.task_id = t.id
                LEFT JOIN contacts c ON t.related_contact_id = c.id
                WHERE tr.status = 'pending'
                  AND tr.reminder_datetime <= NOW()
                  AND t.status IN ('pending', 'in_progress')
                ORDER BY tr.reminder_datetime ASC
            `;

            const results = await executeQuery(query);
            
            return results.map(reminderData => new TaskReminder(reminderData));

        } catch (error) {
            console.error('❌ Error getting pending reminders:', error.message);
            throw error;
        }
    }

    /**
     * Marcar recordatorio como enviado
     */
    static async markAsSent(id) {
        try {
            const query = `
                UPDATE task_reminders 
                SET status = 'sent', sent_at = NOW()
                WHERE id = ?
            `;

            const result = await executeQuery(query, [id]);

            if (result.affectedRows === 0) {
                throw new Error('Recordatorio no encontrado');
            }

            console.log(`✅ Recordatorio marcado como enviado (ID: ${id})`);
            return true;

        } catch (error) {
            console.error('❌ Error marking reminder as sent:', error.message);
            throw error;
        }
    }

    /**
     * Marcar recordatorio como fallido
     */
    static async markAsFailed(id, errorMessage) {
        try {
            const query = `
                UPDATE task_reminders 
                SET status = 'failed', error_message = ?
                WHERE id = ?
            `;

            const result = await executeQuery(query, [errorMessage, id]);

            if (result.affectedRows === 0) {
                throw new Error('Recordatorio no encontrado');
            }

            console.log(`❌ Recordatorio marcado como fallido (ID: ${id}): ${errorMessage}`);
            return true;

        } catch (error) {
            console.error('❌ Error marking reminder as failed:', error.message);
            throw error;
        }
    }

    /**
     * Eliminar recordatorio
     */
    static async delete(id) {
        try {
            const query = 'DELETE FROM task_reminders WHERE id = ?';
            const result = await executeQuery(query, [id]);

            if (result.affectedRows === 0) {
                throw new Error('Recordatorio no encontrado');
            }

            console.log(`✅ Recordatorio eliminado (ID: ${id})`);
            return true;

        } catch (error) {
            console.error('❌ Error deleting reminder:', error.message);
            throw error;
        }
    }

    /**
     * Eliminar recordatorios antiguos (limpieza)
     */
    static async cleanupOldReminders(daysOld = 30) {
        try {
            const query = `
                DELETE FROM task_reminders 
                WHERE status IN ('sent', 'failed')
                  AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
            `;

            const result = await executeQuery(query, [daysOld]);
            
            if (result.affectedRows > 0) {
                console.log(`🧹 ${result.affectedRows} recordatorios antiguos eliminados`);
            }

            return result.affectedRows;

        } catch (error) {
            console.error('❌ Error cleaning up old reminders:', error.message);
            throw error;
        }
    }

    /**
     * Crear recordatorio automático para una tarea
     */
    static async createAutoReminder(taskId, minutesBefore = 30, reminderType = 'whatsapp', reminderPhone = null) {
        try {
            // Obtener la tarea
            const Task = require('./Task');
            const task = await Task.findById(taskId);
            
            if (!task) {
                throw new Error('Tarea no encontrada');
            }

            // Calcular fecha del recordatorio
            const taskDueDate = new Date(task.due_date);
            const reminderDate = new Date(taskDueDate.getTime() - (minutesBefore * 60 * 1000));

            // No crear recordatorio si ya pasó la fecha
            if (reminderDate <= new Date()) {
                console.log(`⚠️ No se creó recordatorio para tarea ${taskId}: fecha ya pasó`);
                return null;
            }

            // Generar mensaje automático
            const messageContent = TaskReminder.generateAutoMessage(task, reminderType);

            const reminderData = {
                task_id: taskId,
                reminder_type: reminderType,
                reminder_phone: reminderPhone,
                reminder_datetime: reminderDate,
                message_content: messageContent
            };

            return await TaskReminder.create(reminderData);

        } catch (error) {
            console.error('❌ Error creating auto reminder:', error.message);
            throw error;
        }
    }

    /**
     * Generar mensaje automático para recordatorio
     */
    static generateAutoMessage(task, reminderType) {
        const templates = {
            whatsapp: {
                meeting: `🗓️ *Recordatorio de Reunión*\n\n📅 *${task.title}*\n⏰ Fecha: ${new Date(task.due_date).toLocaleString('es-AR')}\n${task.description ? `📝 Descripción: ${task.description}` : ''}\n\n¡No olvides tu reunión!`,
                call: `📞 *Recordatorio de Llamada*\n\n📋 *${task.title}*\n⏰ Programada para: ${new Date(task.due_date).toLocaleString('es-AR')}\n${task.description ? `📝 Notas: ${task.description}` : ''}\n\n¡Es hora de hacer la llamada!`,
                task: `✅ *Recordatorio de Tarea*\n\n📋 *${task.title}*\n⏰ Vence: ${new Date(task.due_date).toLocaleString('es-AR')}\n🔥 Prioridad: ${task.priority.toUpperCase()}\n${task.description ? `📝 Descripción: ${task.description}` : ''}\n\n¡No olvides completar esta tarea!`,
                follow_up: `🔄 *Recordatorio de Seguimiento*\n\n📋 *${task.title}*\n⏰ Programado para: ${new Date(task.due_date).toLocaleString('es-AR')}\n${task.description ? `📝 Detalles: ${task.description}` : ''}\n\n¡Es momento de hacer el seguimiento!`
            },
            email: {
                meeting: `Recordatorio: Reunión "${task.title}" programada para ${new Date(task.due_date).toLocaleString('es-AR')}`,
                call: `Recordatorio: Llamada "${task.title}" programada para ${new Date(task.due_date).toLocaleString('es-AR')}`,
                task: `Recordatorio: Tarea "${task.title}" vence ${new Date(task.due_date).toLocaleString('es-AR')}`,
                follow_up: `Recordatorio: Seguimiento "${task.title}" programado para ${new Date(task.due_date).toLocaleString('es-AR')}`
            },
            notification: {
                meeting: `Reunión: ${task.title}`,
                call: `Llamada: ${task.title}`,
                task: `Tarea: ${task.title}`,
                follow_up: `Seguimiento: ${task.title}`
            }
        };

        const categoryTemplates = templates[reminderType] || templates.notification;
        const template = categoryTemplates[task.category] || categoryTemplates.task;

        return template;
    }

    /**
     * Validar datos de recordatorio
     */
    static validate(data) {
        const schema = Joi.object({
            task_id: Joi.number().integer().positive().required(),
            reminder_type: Joi.string().valid('notification', 'whatsapp', 'email').required(),
            reminder_phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).allow(null, ''), // Formato internacional
            reminder_datetime: Joi.date().required(),
            message_content: Joi.string().max(1000).allow(null, ''),
            status: Joi.string().valid('pending', 'sent', 'failed')
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
            task_id: this.task_id,
            reminder_type: this.reminder_type,
            reminder_datetime: this.reminder_datetime,
            message_content: this.message_content,
            status: this.status,
            sent_at: this.sent_at,
            error_message: this.error_message,
            created_at: this.created_at,
            // Campos adicionales de joins
            task_title: this.task_title,
            task_description: this.task_description,
            client_id: this.client_id,
            task_due_date: this.task_due_date,
            task_priority: this.task_priority,
            task_category: this.task_category,
            contact_name: this.contact_name,
            contact_custom_name: this.contact_custom_name
        };
    }
}

module.exports = TaskReminder;

