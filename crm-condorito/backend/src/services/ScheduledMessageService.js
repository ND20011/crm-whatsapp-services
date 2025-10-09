const ScheduledMessage = require('../entities/ScheduledMessage');
const MessageTemplate = require('../entities/MessageTemplate');
const Contact = require('../entities/Contact');
const WhatsAppService = require('./WhatsAppService');
const { executeQuery } = require('../config/database-simple');

// ============================================================================
// SCHEDULED MESSAGE SERVICE - CRM CONDORITO
// ============================================================================

/**
 * Obtener fecha actual de Buenos Aires
 * @returns {Date} Fecha actual en zona horaria de Buenos Aires
 */
function getBuenosAiresTime() {
    const currentTime = new Date().toLocaleString("en-US", {timeZone: "America/Argentina/Buenos_Aires"});
    return new Date(currentTime);
}

class ScheduledMessageService {

    /**
     * Procesar mensajes programados listos para ejecutar
     */
    static async processScheduledMessages() {
        try {
            console.log('🕐 Procesando mensajes programados...');
            
            const readyMessages = await ScheduledMessage.getMessagesReadyForExecution();
            
            if (readyMessages.length === 0) {
                console.log('ℹ️ No hay mensajes programados listos para ejecutar');
                return { processed: 0, success: 0, errors: 0 };
            }

            console.log(`📋 Encontrados ${readyMessages.length} mensajes para procesar`);
            
            let totalProcessed = 0;
            let totalSuccess = 0;
            let totalErrors = 0;

            for (const scheduledMessage of readyMessages) {
                try {
                    const result = await this.executeScheduledMessage(scheduledMessage);
                    totalProcessed++;
                    
                    if (result.success) {
                        totalSuccess++;
                    } else {
                        totalErrors++;
                    }
                } catch (error) {
                    console.error(`❌ Error procesando mensaje ${scheduledMessage.id}:`, error);
                    totalProcessed++;
                    totalErrors++;
                }
            }

            console.log(`✅ Procesamiento completado: ${totalProcessed} procesados, ${totalSuccess} exitosos, ${totalErrors} errores`);
            
            return {
                processed: totalProcessed,
                success: totalSuccess,
                errors: totalErrors
            };
        } catch (error) {
            console.error('❌ Error en processScheduledMessages:', error);
            throw error;
        }
    }

    /**
     * Ejecutar un mensaje programado específico
     */
    static async executeScheduledMessage(scheduledMessage) {
        const startTime = Date.now();
        let executionRecord = null;

        try {
            console.log(`🚀 Ejecutando mensaje programado: ${scheduledMessage.name} (ID: ${scheduledMessage.id})`);

            // Crear registro de ejecución
            executionRecord = await this.createExecutionRecord(scheduledMessage.id);

            // Obtener destinatarios
            const recipients = await this.getRecipients(scheduledMessage);
            
            if (recipients.length === 0) {
                await this.updateExecutionRecord(executionRecord.id, {
                    status: 'skipped',
                    messages_sent: 0,
                    messages_failed: 0,
                    recipients_processed: 0,
                    error_message: 'No recipients found',
                    execution_time_ms: Date.now() - startTime
                });

                await this.updateScheduledMessageAfterExecution(scheduledMessage, false);
                return { success: false, reason: 'No recipients found' };
            }

            // Preparar contenido del mensaje
            const messageContent = await this.prepareMessageContent(scheduledMessage);

            // Enviar mensajes
            const sendResults = await this.sendMessagesToRecipients(
                scheduledMessage, 
                recipients, 
                messageContent,
                executionRecord.id
            );

            // Actualizar registro de ejecución
            await this.updateExecutionRecord(executionRecord.id, {
                status: sendResults.totalErrors === 0 ? 'success' : 'error',
                messages_sent: sendResults.totalSent,
                messages_failed: sendResults.totalErrors,
                recipients_processed: recipients.length,
                execution_time_ms: Date.now() - startTime,
                details: JSON.stringify({
                    recipients_count: recipients.length,
                    send_type: scheduledMessage.send_type,
                    message_type: scheduledMessage.message_type
                })
            });

            // Actualizar mensaje programado después de la ejecución
            const wasSuccessful = sendResults.totalErrors === 0 && sendResults.totalSent > 0;
            await this.updateScheduledMessageAfterExecution(scheduledMessage, wasSuccessful);

            console.log(`✅ Mensaje ejecutado exitosamente: ${sendResults.totalSent} enviados, ${sendResults.totalErrors} errores`);

            return { 
                success: sendResults.totalErrors === 0,
                sent: sendResults.totalSent,
                errors: sendResults.totalErrors,
                recipients: recipients.length
            };

        } catch (error) {
            console.error(`❌ Error ejecutando mensaje programado ${scheduledMessage.id}:`, error);

            // Actualizar registro de ejecución con error
            if (executionRecord) {
                await this.updateExecutionRecord(executionRecord.id, {
                    status: 'error',
                    messages_sent: 0,
                    messages_failed: 0,
                    recipients_processed: 0,
                    error_message: error.message,
                    execution_time_ms: Date.now() - startTime
                });
            }

            // Marcar mensaje como error
            await ScheduledMessage.update(scheduledMessage.id, { status: 'error' });

            return { success: false, error: error.message };
        }
    }

    /**
     * Obtener destinatarios según el tipo de envío
     */
    static async getRecipients(scheduledMessage) {
        try {
            switch (scheduledMessage.send_type) {
                case 'individual':
                    return await this.getIndividualRecipient(scheduledMessage);
                
                case 'bulk_tags':
                    return await this.getRecipientsFromTags(scheduledMessage);
                
                case 'bulk_all':
                    return await this.getAllActiveContacts(scheduledMessage.client_id);
                
                default:
                    throw new Error(`Tipo de envío no soportado: ${scheduledMessage.send_type}`);
            }
        } catch (error) {
            console.error('❌ Error obteniendo destinatarios:', error);
            throw error;
        }
    }

    /**
     * Obtener destinatario individual
     */
    static async getIndividualRecipient(scheduledMessage) {
        if (scheduledMessage.recipient_contact_id) {
            const contact = await Contact.findById(scheduledMessage.recipient_contact_id, scheduledMessage.client_id);
            if (contact) {
                return [{
                    contact_id: contact.id,
                    phone_number: contact.phone_number,
                    contact_name: contact.name || contact.custom_name || contact.phone_number
                }];
            }
        }

        if (scheduledMessage.recipient_phone) {
            return [{
                contact_id: null,
                phone_number: scheduledMessage.recipient_phone,
                contact_name: scheduledMessage.recipient_phone
            }];
        }

        return [];
    }

    /**
     * Obtener destinatarios por etiquetas
     */
    static async getRecipientsFromTags(scheduledMessage) {
        if (!scheduledMessage.target_tag_ids || scheduledMessage.target_tag_ids.length === 0) {
            return [];
        }

        const placeholders = scheduledMessage.target_tag_ids.map(() => '?').join(',');
        const query = `
            SELECT DISTINCT c.id as contact_id, c.phone_number, 
                   COALESCE(c.custom_name, c.name, c.phone_number) as contact_name
            FROM contacts c
            INNER JOIN contact_tag_relations ctr ON c.id = ctr.contact_id
            WHERE c.client_id = ? 
              AND ctr.tag_id IN (${placeholders})
              AND c.is_blocked = false
            ORDER BY contact_name ASC
        `;

        const params = [scheduledMessage.client_id, ...scheduledMessage.target_tag_ids];
        return await executeQuery(query, params);
    }

    /**
     * Obtener todos los contactos activos
     */
    static async getAllActiveContacts(clientId) {
        const query = `
            SELECT id as contact_id, phone_number,
                   COALESCE(custom_name, name, phone_number) as contact_name
            FROM contacts 
            WHERE client_id = ? AND is_blocked = false
            ORDER BY name ASC
        `;

        return await executeQuery(query, [clientId]);
    }

    /**
     * Preparar contenido del mensaje
     */
    static async prepareMessageContent(scheduledMessage) {
        if (scheduledMessage.message_type === 'text') {
            return scheduledMessage.message_content;
        }

        if (scheduledMessage.message_type === 'template') {
            if (scheduledMessage.template_content) {
                return scheduledMessage.template_content;
            }

            // Obtener template
            const template = await MessageTemplate.findById(scheduledMessage.template_id);
            if (!template) {
                throw new Error(`Template ${scheduledMessage.template_id} no encontrado`);
            }

            return template.content;
        }

        throw new Error(`Tipo de mensaje no soportado: ${scheduledMessage.message_type}`);
    }

    /**
     * Enviar mensajes a todos los destinatarios
     */
    static async sendMessagesToRecipients(scheduledMessage, recipients, baseMessageContent, executionId) {
        let totalSent = 0;
        let totalErrors = 0;

        // Obtener código del cliente
        const clientQuery = 'SELECT client_code FROM clients WHERE id = ?';
        const clientResult = await executeQuery(clientQuery, [scheduledMessage.client_id]);
        
        if (clientResult.length === 0) {
            throw new Error(`Cliente ${scheduledMessage.client_id} no encontrado`);
        }

        const clientCode = clientResult[0].client_code;

        for (const recipient of recipients) {
            try {
                // Personalizar mensaje para este destinatario
                const personalizedMessage = await this.personalizeMessage(
                    baseMessageContent, 
                    recipient, 
                    scheduledMessage.template_variables
                );

                // Crear registro de destinatario
                const recipientRecord = await this.createRecipientRecord(
                    scheduledMessage.id,
                    executionId,
                    recipient,
                    personalizedMessage
                );

                // Enviar mensaje por WhatsApp
                const whatsappService = require('./WhatsAppService');
                const result = await whatsappService.sendMessage(
                    clientCode, 
                    recipient.phone_number, 
                    personalizedMessage,
                    false // no es bot
                );

                // Actualizar registro como enviado
                await this.updateRecipientRecord(recipientRecord.id, {
                    status: 'sent',
                    sent_at: getBuenosAiresTime(),
                    message_id: result.messageId
                });

                totalSent++;
                console.log(`✅ Mensaje enviado a ${recipient.phone_number}`);

                // Pequeña pausa para evitar rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error) {
                console.error(`❌ Error enviando a ${recipient.phone_number}:`, error);
                
                // Actualizar registro como fallido
                const recipientRecord = await this.createRecipientRecord(
                    scheduledMessage.id,
                    executionId,
                    recipient,
                    baseMessageContent
                );

                await this.updateRecipientRecord(recipientRecord.id, {
                    status: 'failed',
                    error_message: error.message
                });

                totalErrors++;
            }
        }

        return { totalSent, totalErrors };
    }

    /**
     * Personalizar mensaje con variables
     */
    static async personalizeMessage(messageContent, recipient, templateVariables = null) {
        let personalizedMessage = messageContent;

        // Reemplazar variables del contacto
        personalizedMessage = personalizedMessage.replace(/{NOMBRE_CONTACTO}/g, recipient.contact_name || recipient.name || 'Cliente');
        personalizedMessage = personalizedMessage.replace(/{TELEFONO}/g, recipient.phone_number);

        // Reemplazar variables del template si existen
        if (templateVariables) {
            for (const [key, value] of Object.entries(templateVariables)) {
                const regex = new RegExp(`{${key.toUpperCase()}}`, 'g');
                personalizedMessage = personalizedMessage.replace(regex, value);
            }
        }

        // Reemplazar variables del sistema
        const now = new Date();
        personalizedMessage = personalizedMessage.replace(/{FECHA}/g, now.toLocaleDateString('es-ES'));
        personalizedMessage = personalizedMessage.replace(/{HORA}/g, now.toLocaleTimeString('es-ES'));
        personalizedMessage = personalizedMessage.replace(/{FECHA_HORA}/g, now.toLocaleString('es-ES'));

        return personalizedMessage;
    }

    /**
     * Crear registro de ejecución
     */
    static async createExecutionRecord(scheduledMessageId) {
        // Usar fecha actual de Buenos Aires
        const buenosAiresTime = getBuenosAiresTime();
        const query = `
            INSERT INTO scheduled_message_executions (
                scheduled_message_id, execution_date, status
            ) VALUES (?, ?, 'success')
        `;

        const result = await executeQuery(query, [scheduledMessageId, buenosAiresTime]);
        return { id: result.insertId };
    }

    /**
     * Actualizar registro de ejecución
     */
    static async updateExecutionRecord(executionId, updateData) {
        const updates = [];
        const params = [];

        for (const [field, value] of Object.entries(updateData)) {
            updates.push(`${field} = ?`);
            params.push(value);
        }

        params.push(executionId);

        const query = `
            UPDATE scheduled_message_executions 
            SET ${updates.join(', ')} 
            WHERE id = ?
        `;

        await executeQuery(query, params);
    }

    /**
     * Crear registro de destinatario
     */
    static async createRecipientRecord(scheduledMessageId, executionId, recipient, messageContent) {
        const query = `
            INSERT INTO scheduled_message_recipients (
                scheduled_message_id, execution_id, contact_id, 
                phone_number, contact_name, final_message_content, status
            ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
        `;

        const params = [
            scheduledMessageId,
            executionId,
            recipient.contact_id,
            recipient.phone_number,
            recipient.contact_name,
            messageContent
        ];

        const result = await executeQuery(query, params);
        return { id: result.insertId };
    }

    /**
     * Actualizar registro de destinatario
     */
    static async updateRecipientRecord(recipientId, updateData) {
        const updates = [];
        const params = [];

        for (const [field, value] of Object.entries(updateData)) {
            updates.push(`${field} = ?`);
            params.push(value);
        }

        params.push(recipientId);

        const query = `
            UPDATE scheduled_message_recipients 
            SET ${updates.join(', ')} 
            WHERE id = ?
        `;

        await executeQuery(query, params);
    }

    /**
     * Actualizar mensaje programado después de la ejecución
     */
    static async updateScheduledMessageAfterExecution(scheduledMessage, wasSuccessful) {
        const updateData = {
            last_execution: getBuenosAiresTime(),
            execution_count: scheduledMessage.execution_count + 1
        };

        if (wasSuccessful) {
            updateData.success_count = scheduledMessage.success_count + 1;
        } else {
            updateData.error_count = scheduledMessage.error_count + 1;
        }

        // Calcular próxima ejecución si es recurrente
        if (scheduledMessage.is_recurring) {
            const nextExecution = scheduledMessage.calculateNextExecution(getBuenosAiresTime());
            
            if (nextExecution) {
                updateData.next_execution = nextExecution;
                updateData.status = 'active';
            } else {
                updateData.status = 'completed';
                updateData.is_active = false;
            }
        } else {
            updateData.status = 'completed';
            updateData.is_active = false;
        }

        await ScheduledMessage.update(scheduledMessage.id, updateData);
    }

    /**
     * Obtener estadísticas de mensajes programados
     */
    static async getStatistics(clientId) {
        try {
            const statsQuery = `
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused,
                    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
                    SUM(CASE WHEN is_recurring = true THEN 1 ELSE 0 END) as recurring,
                    SUM(execution_count) as total_executions,
                    SUM(success_count) as total_success,
                    SUM(error_count) as total_errors
                FROM scheduled_messages 
                WHERE client_id = ?
            `;

            const result = await executeQuery(statsQuery, [clientId]);
            return result[0];
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error);
            throw error;
        }
    }

    /**
     * Pausar mensaje programado
     */
    static async pauseScheduledMessage(id, clientId) {
        return await ScheduledMessage.update(id, { 
            status: 'paused',
            is_active: false 
        });
    }

    /**
     * Reanudar mensaje programado
     */
    static async resumeScheduledMessage(id, clientId) {
        const scheduledMessage = await ScheduledMessage.findById(id);
        
        if (!scheduledMessage) {
            throw new Error('Mensaje programado no encontrado');
        }

        // Si la fecha programada ya pasó, actualizar a la próxima ejecución
        let nextExecution = scheduledMessage.scheduled_at;
        
        if (new Date(scheduledMessage.scheduled_at) < new Date()) {
            if (scheduledMessage.is_recurring) {
                nextExecution = scheduledMessage.calculateNextExecution();
            } else {
                throw new Error('No se puede reanudar un mensaje no recurrente cuya fecha ya pasó');
            }
        }

        return await ScheduledMessage.update(id, { 
            status: 'active',
            is_active: true,
            next_execution: nextExecution
        });
    }

    /**
     * Duplicar mensaje programado
     */
    static async duplicateScheduledMessage(id, clientId, newName) {
        const original = await ScheduledMessage.findById(id);
        
        if (!original || original.client_id !== clientId) {
            throw new Error('Mensaje programado no encontrado');
        }

        // Crear copia con nueva fecha (24 horas después)
        const newScheduledAt = new Date();
        newScheduledAt.setDate(newScheduledAt.getDate() + 1);

        const duplicateData = {
            client_id: original.client_id,
            name: newName || `${original.name} (Copia)`,
            description: original.description,
            send_type: original.send_type,
            recipient_phone: original.recipient_phone,
            recipient_contact_id: original.recipient_contact_id,
            target_tag_ids: original.target_tag_ids,
            message_type: original.message_type,
            message_content: original.message_content,
            template_id: original.template_id,
            template_variables: original.template_variables,
            scheduled_at: newScheduledAt,
            timezone: original.timezone,
            is_recurring: original.is_recurring,
            recurrence_type: original.recurrence_type,
            recurrence_interval: original.recurrence_interval,
            recurrence_end_date: original.recurrence_end_date,
            max_executions: original.max_executions,
            status: 'pending',
            is_active: true
        };

        return await ScheduledMessage.create(duplicateData);
    }
}

module.exports = ScheduledMessageService;
