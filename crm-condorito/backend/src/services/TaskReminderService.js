const TaskReminder = require('../entities/TaskReminder');
const Task = require('../entities/Task');
const WhatsAppService = require('./WhatsAppService');
const { executeQuery } = require('../config/database-simple');

// ============================================================================
// TASK REMINDER SERVICE - CRM CONDORITO
// ============================================================================

/**
 * Obtener fecha actual de Buenos Aires
 * @returns {Date} Fecha actual en zona horaria de Buenos Aires
 */
function getBuenosAiresTime() {
    const currentTime = new Date().toLocaleString("en-US", {timeZone: "America/Argentina/Buenos_Aires"});
    return new Date(currentTime);
}

class TaskReminderService {

    /**
     * Procesar recordatorios pendientes listos para enviar
     */
    static async processTaskReminders() {
        try {
            console.log('🔔 Procesando recordatorios de tareas...');
            
            const pendingReminders = await TaskReminder.getPendingReminders();
            
            if (pendingReminders.length === 0) {
                console.log('ℹ️ No hay recordatorios pendientes para procesar');
                return { processed: 0, success: 0, errors: 0 };
            }

            console.log(`📋 Encontrados ${pendingReminders.length} recordatorios para procesar`);
            
            let totalProcessed = 0;
            let totalSuccess = 0;
            let totalErrors = 0;

            for (const reminder of pendingReminders) {
                try {
                    const result = await this.sendTaskReminder(reminder);
                    totalProcessed++;
                    
                    if (result.success) {
                        totalSuccess++;
                        await TaskReminder.markAsSent(reminder.id);
                    } else {
                        totalErrors++;
                        await TaskReminder.markAsFailed(reminder.id, result.error);
                    }
                } catch (error) {
                    console.error(`❌ Error procesando recordatorio ${reminder.id}:`, error.message);
                    totalProcessed++;
                    totalErrors++;
                    await TaskReminder.markAsFailed(reminder.id, error.message);
                }
            }

            console.log(`✅ Procesamiento completado: ${totalProcessed} procesados, ${totalSuccess} exitosos, ${totalErrors} errores`);
            
            return {
                processed: totalProcessed,
                success: totalSuccess,
                errors: totalErrors
            };
        } catch (error) {
            console.error('❌ Error en processTaskReminders:', error);
            throw error;
        }
    }

    /**
     * Enviar un recordatorio específico
     */
    static async sendTaskReminder(reminder) {
        try {
            console.log(`📤 Enviando recordatorio ${reminder.id} (${reminder.reminder_type})`);

            switch (reminder.reminder_type) {
                case 'whatsapp':
                    return await this.sendWhatsAppReminder(reminder);
                
                case 'email':
                    return await this.sendEmailReminder(reminder);
                
                case 'notification':
                    return await this.sendNotificationReminder(reminder);
                
                default:
                    throw new Error(`Tipo de recordatorio no soportado: ${reminder.reminder_type}`);
            }

        } catch (error) {
            console.error(`❌ Error enviando recordatorio ${reminder.id}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Enviar recordatorio por WhatsApp
     */
    static async sendWhatsAppReminder(reminder) {
        try {
            // Obtener información completa de la tarea
            const task = await Task.findById(reminder.task_id);
            if (!task) {
                throw new Error('Tarea no encontrada');
            }

            // Obtener código del cliente
            const clientQuery = 'SELECT client_code FROM clients WHERE id = ?';
            const clientResult = await executeQuery(clientQuery, [task.client_id]);
            
            if (clientResult.length === 0) {
                throw new Error(`Cliente ${task.client_id} no encontrado`);
            }

            const clientCode = clientResult[0].client_code;

            // Determinar el teléfono de destino con la nueva lógica
            let targetPhone = null;
            let isClientPhone = false;
            
            // 1. Prioridad: teléfono específico del recordatorio
            if (reminder.reminder_phone) {
                targetPhone = reminder.reminder_phone;
                console.log(`📱 Usando teléfono específico del recordatorio: ${targetPhone}`);
            }
            // 2. Segundo: teléfono relacionado en la tarea
            else if (task.related_phone) {
                targetPhone = task.related_phone;
                console.log(`📱 Usando teléfono relacionado de la tarea: ${targetPhone}`);
            }
            // 3. Tercero: teléfono del contacto relacionado
            else if (task.related_contact_id) {
                const contactQuery = 'SELECT phone_number FROM contacts WHERE id = ?';
                const contactResult = await executeQuery(contactQuery, [task.related_contact_id]);
                
                if (contactResult.length > 0) {
                    targetPhone = contactResult[0].phone_number;
                    console.log(`📱 Usando teléfono del contacto relacionado: ${targetPhone}`);
                }
            }

            // 4. Fallback: teléfono de la sesión del cliente (usuario del CRM)
            if (!targetPhone) {
                console.log(`⚠️ No se encontró teléfono de destino, buscando sesión activa del cliente ${task.client_id}`);
                
                const WhatsAppSession = require('../entities/WhatsAppSession');
                const clientSession = await WhatsAppSession.findByClientId(task.client_id);
                
                if (clientSession && clientSession.phone_number && clientSession.status === 'connected') {
                    targetPhone = clientSession.phone_number;
                    isClientPhone = true;
                    console.log(`📱 Usando teléfono de sesión del cliente (CRM): ${targetPhone}`);
                } else {
                    throw new Error('No se encontró teléfono de destino ni sesión activa del cliente');
                }
            }

            // Preparar mensaje
            let message = reminder.message_content || 
                         TaskReminder.generateAutoMessage(task, 'whatsapp');
            
            // Si estamos enviando al teléfono del cliente (usuario del CRM), personalizar el mensaje
            if (isClientPhone) {
                message = `🔔 *RECORDATORIO PERSONAL*\n\n${message}\n\n_Este recordatorio se envió a ti porque no se especificó un teléfono de contacto para la tarea._`;
            }

            // Enviar mensaje usando WhatsAppService
            const sendResult = await WhatsAppService.sendMessage(
                clientCode,
                targetPhone,
                message,
                false // no es bot, es recordatorio
            );

            if (sendResult && sendResult.messageId) {
                console.log(`✅ Recordatorio WhatsApp enviado a ${targetPhone} ${isClientPhone ? '(usuario CRM)' : '(destinatario)'}`);
                return { 
                    success: true, 
                    message_id: sendResult.messageId,
                    targetPhone: targetPhone,
                    isClientPhone: isClientPhone
                };
            } else {
                throw new Error('Error enviando mensaje WhatsApp - no se obtuvo messageId');
            }

        } catch (error) {
            console.error(`❌ Error enviando recordatorio WhatsApp:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Enviar recordatorio por email (placeholder)
     */
    static async sendEmailReminder(reminder) {
        try {
            // TODO: Implementar envío de email cuando esté disponible el servicio
            console.log(`📧 Recordatorio por email (placeholder): ${reminder.id}`);
            
            // Por ahora retornamos éxito simulado
            return { 
                success: true, 
                note: 'Email reminder - placeholder implementation' 
            };

        } catch (error) {
            console.error(`❌ Error enviando recordatorio por email:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Enviar notificación del sistema (placeholder)
     */
    static async sendNotificationReminder(reminder) {
        try {
            // TODO: Implementar notificaciones push o del sistema
            console.log(`🔔 Notificación del sistema (placeholder): ${reminder.id}`);
            
            // Por ahora retornamos éxito simulado
            return { 
                success: true, 
                note: 'System notification - placeholder implementation' 
            };

        } catch (error) {
            console.error(`❌ Error enviando notificación:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Crear recordatorio para una tarea
     */
    static async createReminderForTask(taskId, reminderData) {
        try {
            console.log(`🔔 Creando recordatorio para tarea ${taskId}`);

            // Verificar que la tarea existe
            const task = await Task.findById(taskId);
            if (!task) {
                throw new Error('Tarea no encontrada');
            }

            // Validar que la fecha del recordatorio sea antes del vencimiento
            if (reminderData.reminder_datetime >= task.due_date) {
                throw new Error('La fecha del recordatorio debe ser anterior al vencimiento de la tarea');
            }

            // Validar que la fecha del recordatorio sea futura
            if (reminderData.reminder_datetime <= getBuenosAiresTime()) {
                throw new Error('La fecha del recordatorio debe ser futura');
            }

            // Crear el recordatorio
            reminderData.task_id = taskId;
            const reminder = await TaskReminder.create(reminderData);

            console.log(`✅ Recordatorio creado: ${reminder.id}`);
            return reminder;

        } catch (error) {
            console.error('❌ Error en createReminderForTask:', error.message);
            throw error;
        }
    }

    /**
     * Crear múltiples recordatorios para una tarea
     */
    static async createMultipleReminders(taskId, reminderConfigs) {
        try {
            console.log(`🔔 Creando múltiples recordatorios para tarea ${taskId}`);

            const createdReminders = [];
            const errors = [];

            for (const config of reminderConfigs) {
                try {
                    const reminder = await this.createReminderForTask(taskId, config);
                    createdReminders.push(reminder);
                } catch (error) {
                    errors.push({
                        config,
                        error: error.message
                    });
                }
            }

            console.log(`✅ Creados ${createdReminders.length} recordatorios, ${errors.length} errores`);
            
            return {
                success: createdReminders,
                errors: errors,
                total_created: createdReminders.length,
                total_errors: errors.length
            };

        } catch (error) {
            console.error('❌ Error en createMultipleReminders:', error.message);
            throw error;
        }
    }

    /**
     * Actualizar recordatorio
     */
    static async updateReminder(reminderId, updates) {
        try {
            console.log(`📝 Actualizando recordatorio ${reminderId}`);

            // Verificar que el recordatorio existe
            const reminder = await TaskReminder.findById(reminderId);
            if (!reminder) {
                throw new Error('Recordatorio no encontrado');
            }

            // Solo permitir actualizar recordatorios pendientes
            if (reminder.status !== 'pending') {
                throw new Error('Solo se pueden actualizar recordatorios pendientes');
            }

            // Construir query de actualización
            const allowedFields = ['reminder_datetime', 'message_content', 'reminder_type'];
            const updateFields = [];
            const params = [];

            Object.keys(updates).forEach(field => {
                if (allowedFields.includes(field) && updates[field] !== undefined) {
                    updateFields.push(`${field} = ?`);
                    params.push(updates[field]);
                }
            });

            if (updateFields.length === 0) {
                throw new Error('No hay campos válidos para actualizar');
            }

            const query = `
                UPDATE task_reminders 
                SET ${updateFields.join(', ')}
                WHERE id = ?
            `;
            params.push(reminderId);

            await executeQuery(query, params);

            // Obtener recordatorio actualizado
            const updatedReminder = await TaskReminder.findById(reminderId);
            console.log(`✅ Recordatorio actualizado: ${reminderId}`);
            
            return updatedReminder;

        } catch (error) {
            console.error('❌ Error en updateReminder:', error.message);
            throw error;
        }
    }

    /**
     * Cancelar recordatorio
     */
    static async cancelReminder(reminderId) {
        try {
            console.log(`❌ Cancelando recordatorio ${reminderId}`);

            const reminder = await TaskReminder.findById(reminderId);
            if (!reminder) {
                throw new Error('Recordatorio no encontrado');
            }

            if (reminder.status !== 'pending') {
                throw new Error('Solo se pueden cancelar recordatorios pendientes');
            }

            await TaskReminder.markAsFailed(reminderId, 'Cancelado por el usuario');
            console.log(`✅ Recordatorio cancelado: ${reminderId}`);
            
            return true;

        } catch (error) {
            console.error('❌ Error en cancelReminder:', error.message);
            throw error;
        }
    }

    /**
     * Obtener estadísticas de recordatorios
     */
    static async getReminderStats(clientId = null) {
        try {
            console.log(`📊 Obteniendo estadísticas de recordatorios${clientId ? ` para cliente ${clientId}` : ''}`);

            let query = `
                SELECT 
                    COUNT(*) as total_reminders,
                    SUM(CASE WHEN tr.status = 'pending' THEN 1 ELSE 0 END) as pending_reminders,
                    SUM(CASE WHEN tr.status = 'sent' THEN 1 ELSE 0 END) as sent_reminders,
                    SUM(CASE WHEN tr.status = 'failed' THEN 1 ELSE 0 END) as failed_reminders,
                    SUM(CASE WHEN tr.reminder_type = 'whatsapp' THEN 1 ELSE 0 END) as whatsapp_reminders,
                    SUM(CASE WHEN tr.reminder_type = 'email' THEN 1 ELSE 0 END) as email_reminders,
                    SUM(CASE WHEN tr.reminder_type = 'notification' THEN 1 ELSE 0 END) as notification_reminders,
                    AVG(CASE WHEN tr.status = 'sent' THEN 1 ELSE 0 END) as success_rate
                FROM task_reminders tr
                JOIN tasks t ON tr.task_id = t.id
            `;

            const params = [];

            if (clientId) {
                query += ' WHERE t.client_id = ?';
                params.push(clientId);
            }

            const results = await executeQuery(query, params);
            const stats = results[0];

            // Calcular tasa de éxito como porcentaje
            stats.success_rate = stats.total_reminders > 0 
                ? Math.round((stats.sent_reminders / stats.total_reminders) * 100)
                : 0;

            console.log(`✅ Estadísticas obtenidas: ${stats.total_reminders} recordatorios totales`);
            return stats;

        } catch (error) {
            console.error('❌ Error en getReminderStats:', error.message);
            throw error;
        }
    }

    /**
     * Limpiar recordatorios antiguos
     */
    static async cleanupOldReminders(daysOld = 30) {
        try {
            console.log(`🧹 Limpiando recordatorios antiguos (${daysOld} días)`);

            const deletedCount = await TaskReminder.cleanupOldReminders(daysOld);
            
            console.log(`✅ Limpieza completada: ${deletedCount} recordatorios eliminados`);
            return deletedCount;

        } catch (error) {
            console.error('❌ Error en cleanupOldReminders:', error.message);
            throw error;
        }
    }

    /**
     * Obtener próximos recordatorios (para preview)
     */
    static async getUpcomingReminders(clientId, hours = 24) {
        try {
            console.log(`📋 Obteniendo próximos recordatorios para cliente ${clientId} (${hours}h)`);

            const query = `
                SELECT tr.*, 
                       t.title as task_title,
                       t.description as task_description,
                       t.due_date as task_due_date,
                       t.priority as task_priority,
                       t.category as task_category
                FROM task_reminders tr
                JOIN tasks t ON tr.task_id = t.id
                WHERE t.client_id = ?
                  AND tr.status = 'pending'
                  AND tr.reminder_datetime BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? HOUR)
                ORDER BY tr.reminder_datetime ASC
            `;

            const results = await executeQuery(query, [clientId, hours]);
            
            const reminders = results.map(reminderData => new TaskReminder(reminderData));

            console.log(`✅ Encontrados ${reminders.length} recordatorios próximos`);
            return reminders;

        } catch (error) {
            console.error('❌ Error en getUpcomingReminders:', error.message);
            throw error;
        }
    }

    /**
     * Probar envío de recordatorio (para testing)
     */
    static async testReminder(reminderId) {
        try {
            console.log(`🧪 Probando envío de recordatorio ${reminderId}`);

            const reminder = await TaskReminder.findById(reminderId);
            if (!reminder) {
                throw new Error('Recordatorio no encontrado');
            }

            // Crear una copia temporal para testing
            const testReminder = { ...reminder };
            testReminder.id = `test_${reminder.id}`;

            const result = await this.sendTaskReminder(testReminder);
            
            console.log(`✅ Prueba completada: ${result.success ? 'ÉXITO' : 'ERROR'}`);
            return result;

        } catch (error) {
            console.error('❌ Error en testReminder:', error.message);
            throw error;
        }
    }

    /**
     * Reenviar recordatorio fallido
     */
    static async retryFailedReminder(reminderId) {
        try {
            console.log(`🔄 Reenviando recordatorio fallido ${reminderId}`);

            const reminder = await TaskReminder.findById(reminderId);
            if (!reminder) {
                throw new Error('Recordatorio no encontrado');
            }

            if (reminder.status !== 'failed') {
                throw new Error('Solo se pueden reenviar recordatorios fallidos');
            }

            // Resetear estado a pendiente
            await executeQuery(
                'UPDATE task_reminders SET status = ?, error_message = NULL WHERE id = ?',
                ['pending', reminderId]
            );

            // Intentar enviar nuevamente
            const result = await this.sendTaskReminder(reminder);

            if (result.success) {
                await TaskReminder.markAsSent(reminderId);
                console.log(`✅ Recordatorio reenviado exitosamente`);
            } else {
                await TaskReminder.markAsFailed(reminderId, result.error);
                console.log(`❌ Fallo al reenviar recordatorio: ${result.error}`);
            }

            return result;

        } catch (error) {
            console.error('❌ Error en retryFailedReminder:', error.message);
            throw error;
        }
    }
}

module.exports = TaskReminderService;
