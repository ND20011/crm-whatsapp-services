const ScheduledMessage = require('../entities/ScheduledMessage');
const ScheduledMessageService = require('../services/ScheduledMessageService');
const MessageTemplate = require('../entities/MessageTemplate');
const Contact = require('../entities/Contact');
const { executeQuery } = require('../config/database-simple');

// ============================================================================
// SCHEDULED MESSAGE CONTROLLER - CRM CONDORITO
// ============================================================================

class ScheduledMessageController {

    /**
     * GET /api/scheduled-messages
     * Obtener lista de mensajes programados con filtros
     */
    static async getScheduledMessages(req, res, next) {
        try {
            const clientId = req.user.id;
            const {
                page = 1,
                limit = 20,
                status = null,
                send_type = null,
                is_active = null,
                is_recurring = null,
                search = '',
                sortBy = 'created_at',
                sortOrder = 'DESC'
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: Math.min(parseInt(limit), 100),
                status,
                send_type,
                is_active: is_active !== null ? is_active === 'true' : null,
                is_recurring: is_recurring !== null ? is_recurring === 'true' : null,
                search: search.trim(),
                sortBy,
                sortOrder
            };

            const result = await ScheduledMessage.findAll(clientId, options);

            res.json({
                success: true,
                data: result.scheduledMessages,
                pagination: result.pagination
            });

        } catch (error) {
            console.error('❌ Error in getScheduledMessages:', error);
            next(error);
        }
    }

    /**
     * GET /api/scheduled-messages/:id
     * Obtener mensaje programado específico
     */
    static async getScheduledMessage(req, res, next) {
        try {
            const { id } = req.params;
            const clientId = req.user.id;

            const scheduledMessage = await ScheduledMessage.findById(id);

            if (!scheduledMessage) {
                return res.status(404).json({
                    success: false,
                    message: 'Mensaje programado no encontrado'
                });
            }

            if (scheduledMessage.client_id !== clientId) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para ver este mensaje programado'
                });
            }

            res.json({
                success: true,
                data: scheduledMessage
            });

        } catch (error) {
            console.error('❌ Error in getScheduledMessage:', error);
            next(error);
        }
    }

    /**
     * POST /api/scheduled-messages
     * Crear nuevo mensaje programado
     */
    static async createScheduledMessage(req, res, next) {
        try {
            const clientId = req.user.id;
            const messageData = {
                ...req.body,
                client_id: clientId
            };

            console.log('📝 Creando mensaje programado:', JSON.stringify(messageData, null, 2));

            // Validaciones básicas inline
            if (!messageData.name || messageData.name.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'El nombre del mensaje es requerido'
                });
            }

            if (!messageData.scheduled_at) {
                return res.status(400).json({
                    success: false,
                    message: 'La fecha programada es requerida'
                });
            }

            // Validar fecha en el futuro
            const scheduledDate = new Date(messageData.scheduled_at);
            const now = new Date();
            
            if (isNaN(scheduledDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Formato de fecha inválido'
                });
            }

            if (scheduledDate <= now) {
                return res.status(400).json({
                    success: false,
                    message: 'La fecha programada debe ser en el futuro'
                });
            }

            // Validar send_type
            if (!['individual', 'bulk_tags', 'bulk_all'].includes(messageData.send_type)) {
                return res.status(400).json({
                    success: false,
                    message: 'Tipo de envío inválido'
                });
            }

            // Validar message_type  
            if (!['text', 'template'].includes(messageData.message_type)) {
                return res.status(400).json({
                    success: false,
                    message: 'Tipo de mensaje inválido'
                });
            }

            console.log('✅ Validaciones pasadas, creando mensaje...');

            // Mapear campos para compatibilidad con tabla migrada
            if (messageData.message_content) {
                messageData.content = messageData.message_content;
            } else if (messageData.message_type === 'text') {
                messageData.content = 'Mensaje de texto programado';
            } else {
                messageData.content = 'Mensaje con template programado';
            }

            // Mapear recipient_contact_id a contact_id si existe
            if (messageData.recipient_contact_id) {
                messageData.contact_id = messageData.recipient_contact_id;
            }

            const scheduledMessage = await ScheduledMessage.create(messageData);

            console.log('✅ Mensaje programado creado exitosamente:', scheduledMessage.id);

            res.status(201).json({
                success: true,
                message: 'Mensaje programado creado exitosamente',
                data: scheduledMessage
            });

        } catch (error) {
            console.error('❌ Error in createScheduledMessage:', error);
            
            if (error.message && error.message.includes('Validation errors')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * PUT /api/scheduled-messages/:id
     * Actualizar mensaje programado
     */
    static async updateScheduledMessage(req, res, next) {
        try {
            const { id } = req.params;
            const clientId = req.user.id;

            // Verificar que el mensaje existe y pertenece al cliente
            const existingMessage = await ScheduledMessage.findById(id);
            
            if (!existingMessage) {
                return res.status(404).json({
                    success: false,
                    message: 'Mensaje programado no encontrado'
                });
            }

            if (existingMessage.client_id !== clientId) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para modificar este mensaje programado'
                });
            }

            // Permitir reactivación si se está cambiando el status o la fecha
            const isReactivating = req.body.status === 'pending' && 
                                 ['completed', 'error', 'cancelled'].includes(existingMessage.status);
            
            // No permitir editar mensajes completed a menos que se esté reactivando
            if (existingMessage.status === 'completed' && !isReactivating) {
                return res.status(400).json({
                    success: false,
                    message: 'No se puede modificar un mensaje completado. Para reprogramarlo, cambie la fecha/hora.'
                });
            }

            const updatedMessage = await ScheduledMessage.update(id, req.body);

            res.json({
                success: true,
                message: 'Mensaje programado actualizado exitosamente',
                data: updatedMessage
            });

        } catch (error) {
            console.error('❌ Error in updateScheduledMessage:', error);
            next(error);
        }
    }

    /**
     * DELETE /api/scheduled-messages/:id
     * Eliminar mensaje programado
     */
    static async deleteScheduledMessage(req, res, next) {
        try {
            const { id } = req.params;
            const clientId = req.user.id;

            // Verificar que el mensaje existe y pertenece al cliente
            const existingMessage = await ScheduledMessage.findById(id);
            
            if (!existingMessage) {
                return res.status(404).json({
                    success: false,
                    message: 'Mensaje programado no encontrado'
                });
            }

            if (existingMessage.client_id !== clientId) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para eliminar este mensaje programado'
                });
            }

            const deleted = await ScheduledMessage.delete(id);

            if (deleted) {
                res.json({
                    success: true,
                    message: 'Mensaje programado eliminado exitosamente'
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Error al eliminar el mensaje programado'
                });
            }

        } catch (error) {
            console.error('❌ Error in deleteScheduledMessage:', error);
            next(error);
        }
    }

    /**
     * POST /api/scheduled-messages/:id/pause
     * Pausar mensaje programado
     */
    static async pauseScheduledMessage(req, res, next) {
        try {
            const { id } = req.params;
            const clientId = req.user.id;

            const updatedMessage = await ScheduledMessageService.pauseScheduledMessage(id, clientId);

            res.json({
                success: true,
                message: 'Mensaje programado pausado exitosamente',
                data: updatedMessage
            });

        } catch (error) {
            console.error('❌ Error in pauseScheduledMessage:', error);
            next(error);
        }
    }

    /**
     * POST /api/scheduled-messages/:id/resume
     * Reanudar mensaje programado
     */
    static async resumeScheduledMessage(req, res, next) {
        try {
            const { id } = req.params;
            const clientId = req.user.id;

            const updatedMessage = await ScheduledMessageService.resumeScheduledMessage(id, clientId);

            res.json({
                success: true,
                message: 'Mensaje programado reanudado exitosamente',
                data: updatedMessage
            });

        } catch (error) {
            console.error('❌ Error in resumeScheduledMessage:', error);
            
            if (error.message.includes('cuya fecha ya pasó')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            
            next(error);
        }
    }

    /**
     * POST /api/scheduled-messages/:id/duplicate
     * Duplicar mensaje programado
     */
    static async duplicateScheduledMessage(req, res, next) {
        try {
            const { id } = req.params;
            const { name } = req.body;
            const clientId = req.user.id;

            const duplicatedMessage = await ScheduledMessageService.duplicateScheduledMessage(id, clientId, name);

            res.status(201).json({
                success: true,
                message: 'Mensaje programado duplicado exitosamente',
                data: duplicatedMessage
            });

        } catch (error) {
            console.error('❌ Error in duplicateScheduledMessage:', error);
            next(error);
        }
    }

    /**
     * GET /api/scheduled-messages/:id/executions
     * Obtener historial de ejecuciones
     */
    static async getExecutionHistory(req, res, next) {
        try {
            const { id } = req.params;
            const clientId = req.user.id;
            const { page = 1, limit = 20 } = req.query;

            // Verificar que el mensaje pertenece al cliente
            const scheduledMessage = await ScheduledMessage.findById(id);
            
            if (!scheduledMessage || scheduledMessage.client_id !== clientId) {
                return res.status(404).json({
                    success: false,
                    message: 'Mensaje programado no encontrado'
                });
            }

            const offset = (page - 1) * limit;

            // Primero obtener las ejecuciones básicas
            // Validar y sanitizar los valores de limit y offset
            const safeLimit = Math.max(1, Math.min(100, parseInt(limit))); // Entre 1 y 100
            const safeOffset = Math.max(0, parseInt(offset)); // Mínimo 0
            
            const executionsQuery = `
                SELECT * FROM scheduled_message_executions
                WHERE scheduled_message_id = ?
                ORDER BY execution_date DESC
                LIMIT ${safeLimit} OFFSET ${safeOffset}
            `;

            const executions = await executeQuery(executionsQuery, [parseInt(id)]);

            // Luego agregar información de destinatarios para cada ejecución
            for (let execution of executions) {
                const recipientsQuery = `
                    SELECT 
                        COUNT(*) as total_recipients,
                        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as recipients_sent,
                        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as recipients_failed
                    FROM scheduled_message_recipients 
                    WHERE execution_id = ?
                `;
                
                const recipientsResult = await executeQuery(recipientsQuery, [execution.id]);
                const recipientsInfo = recipientsResult[0];
                
                execution.total_recipients = recipientsInfo.total_recipients || 0;
                execution.recipients_sent = recipientsInfo.recipients_sent || 0;
                execution.recipients_failed = recipientsInfo.recipients_failed || 0;
            }

            // Contar total
            const countQuery = `
                SELECT COUNT(*) as total 
                FROM scheduled_message_executions 
                WHERE scheduled_message_id = ?
            `;
            const countResult = await executeQuery(countQuery, [parseInt(id)]);
            const total = countResult[0].total;

            res.json({
                success: true,
                data: executions,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: parseInt(total),
                    pages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('❌ Error in getExecutionHistory:', error);
            next(error);
        }
    }

    /**
     * GET /api/scheduled-messages/:id/recipients/:executionId
     * Obtener detalles de destinatarios de una ejecución específica
     */
    static async getExecutionRecipients(req, res, next) {
        try {
            const { id, executionId } = req.params;
            const clientId = req.user.id;
            const { page = 1, limit = 50, status = null } = req.query;

            // Verificar permisos
            const scheduledMessage = await ScheduledMessage.findById(id);
            if (!scheduledMessage || scheduledMessage.client_id !== clientId) {
                return res.status(404).json({
                    success: false,
                    message: 'Mensaje programado no encontrado'
                });
            }

            const offset = (page - 1) * limit;
            let whereClause = 'WHERE smr.execution_id = ?';
            let params = [parseInt(executionId)];

            if (status) {
                whereClause += ' AND smr.status = ?';
                params.push(status);
            }

            const recipientsQuery = `
                SELECT smr.*, c.name as contact_full_name
                FROM scheduled_message_recipients smr
                LEFT JOIN contacts c ON smr.contact_id = c.id
                ${whereClause}
                ORDER BY smr.sent_at DESC, smr.phone_number ASC
                LIMIT ? OFFSET ?
            `;

            params.push(parseInt(limit), offset);
            const recipients = await executeQuery(recipientsQuery, params);

            // Contar total
            const countQuery = `
                SELECT COUNT(*) as total 
                FROM scheduled_message_recipients smr
                ${whereClause}
            `;
            const countResult = await executeQuery(countQuery, params.slice(0, -2));
            const total = countResult[0].total;

            res.json({
                success: true,
                data: recipients,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: parseInt(total),
                    pages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('❌ Error in getExecutionRecipients:', error);
            next(error);
        }
    }

    /**
     * GET /api/scheduled-messages/statistics
     * Obtener estadísticas de mensajes programados
     */
    static async getStatistics(req, res, next) {
        try {
            const clientId = req.user.id;

            const statistics = await ScheduledMessageService.getStatistics(clientId);

            res.json({
                success: true,
                data: statistics
            });

        } catch (error) {
            console.error('❌ Error in getStatistics:', error);
            next(error);
        }
    }

    /**
     * POST /api/scheduled-messages/process
     * Procesar mensajes programados manualmente (para testing)
     */
    static async processScheduledMessages(req, res, next) {
        try {
            console.log('🔧 Procesamiento manual de mensajes programados iniciado');
            
            const result = await ScheduledMessageService.processScheduledMessages();

            res.json({
                success: true,
                message: 'Mensajes programados procesados exitosamente',
                data: result
            });

        } catch (error) {
            console.error('❌ Error in processScheduledMessages:', error);
            next(error);
        }
    }

}

/**
 * Validar datos del mensaje programado
 */
async function validateMessageData(data) {
    // Validar fecha programada no sea en el pasado
    const scheduledDate = new Date(data.scheduled_at);
    const now = new Date();
    
    if (scheduledDate <= now) {
        return 'La fecha programada debe ser en el futuro';
    }

    // Validar template si es necesario
    if (data.message_type === 'template' && data.template_id) {
        const template = await MessageTemplate.findById(data.template_id);
        if (!template || template.client_id !== data.client_id) {
            return 'Template no encontrado o no pertenece al cliente';
        }
    }

    // Validar contacto individual si es necesario
    if (data.send_type === 'individual' && data.recipient_contact_id) {
        const contact = await Contact.findById(data.recipient_contact_id);
        if (!contact || contact.client_id !== data.client_id) {
            return 'Contacto no encontrado o no pertenece al cliente';
        }
    }

    // Validar etiquetas si es necesario
    if (data.send_type === 'bulk_tags' && data.target_tag_ids) {
        const tagIds = Array.isArray(data.target_tag_ids) ? data.target_tag_ids : [data.target_tag_ids];
        const placeholders = tagIds.map(() => '?').join(',');
        
        const tagQuery = `
            SELECT COUNT(*) as count 
            FROM contact_tags 
            WHERE id IN (${placeholders}) AND client_id = ?
        `;
        
        const result = await executeQuery(tagQuery, [...tagIds, data.client_id]);
        
        if (result[0].count !== tagIds.length) {
            return 'Algunas etiquetas no existen o no pertenecen al cliente';
        }
    }

    return null; // No hay errores
}

module.exports = ScheduledMessageController;
