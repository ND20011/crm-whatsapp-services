const { executeQuery } = require('../config/database-simple');

// ============================================================================
// SCHEDULED MESSAGE ENTITY - CRM CONDORITO
// ============================================================================

/**
 * Obtener fecha actual de Buenos Aires
 * @returns {Date} Fecha actual en zona horaria de Buenos Aires
 */
function getBuenosAiresTime() {
    const currentTime = new Date().toLocaleString("en-US", {timeZone: "America/Argentina/Buenos_Aires"});
    return new Date(currentTime);
}

class ScheduledMessage {
    constructor(data = {}) {
        this.id = data.id || null;
        this.client_id = data.client_id;
        this.name = data.name;
        this.description = data.description || null;
        this.send_type = data.send_type;
        this.recipient_phone = data.recipient_phone || null;
        this.recipient_contact_id = data.recipient_contact_id || null;
        this.target_tag_ids = data.target_tag_ids || null;
        this.message_type = data.message_type || 'text';
        this.message_content = data.message_content || null;
        this.template_id = data.template_id || null;
        this.template_variables = data.template_variables || null;
        this.scheduled_at = data.scheduled_at;
        this.timezone = data.timezone || 'America/Argentina/Buenos_Aires';
        this.is_recurring = data.is_recurring || false;
        this.recurrence_type = data.recurrence_type || null;
        this.recurrence_interval = data.recurrence_interval || null;
        this.recurrence_end_date = data.recurrence_end_date || null;
        this.max_executions = data.max_executions || null;
        this.status = data.status || 'pending';
        this.is_active = data.is_active !== undefined ? data.is_active : true;
        this.next_execution = data.next_execution || null;
        this.last_execution = data.last_execution || null;
        this.execution_count = data.execution_count || 0;
        this.success_count = data.success_count || 0;
        this.error_count = data.error_count || 0;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }

    /**
     * Crear nuevo mensaje programado
     */
    static async create(data) {
        try {
            // Validar datos requeridos
            const errors = this.validate(data);
            if (errors.length > 0) {
                throw new Error(`Validation errors: ${errors.join(', ')}`);
            }

            // Calcular next_execution basado en scheduled_at
            const nextExecution = data.scheduled_at;

            // Mapear campos para compatibilidad con tabla existente
            const contentValue = data.message_content || data.content || 'Mensaje programado';
            const contactIdValue = data.recipient_contact_id || data.contact_id || null;

            const query = `
                INSERT INTO scheduled_messages (
                    client_id, name, description, send_type, recipient_phone, 
                    recipient_contact_id, contact_id, target_tag_ids, message_type, 
                    message_content, content, template_id, template_variables, 
                    scheduled_at, timezone, is_recurring, recurrence_type,
                    recurrence_interval, recurrence_end_date, max_executions,
                    status, is_active, next_execution
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const params = [
                data.client_id,
                data.name,
                data.description || null,
                data.send_type,
                data.recipient_phone || null,
                data.recipient_contact_id || null,
                contactIdValue, // contact_id (campo legacy)
                data.target_tag_ids ? JSON.stringify(data.target_tag_ids) : null,
                data.message_type || 'text',
                data.message_content || null,
                contentValue, // content (campo requerido legacy)
                data.template_id || null,
                data.template_variables ? JSON.stringify(data.template_variables) : null,
                data.scheduled_at,
                data.timezone || 'America/Argentina/Buenos_Aires',
                data.is_recurring || false,
                data.recurrence_type || null,
                data.recurrence_interval || null,
                data.recurrence_end_date || null,
                data.max_executions || null,
                data.status || 'pending',
                data.is_active !== undefined ? data.is_active : true,
                nextExecution
            ];

            const result = await executeQuery(query, params);
            return await this.findById(result.insertId);
        } catch (error) {
            console.error('❌ Error creating scheduled message:', error);
            throw error;
        }
    }

    /**
     * Buscar mensaje programado por ID
     */
    static async findById(id) {
        try {
            const query = `
                SELECT sm.*, 
                       c.name as contact_name, c.phone_number as contact_phone,
                       mt.name as template_name, mt.content as template_content
                FROM scheduled_messages sm
                LEFT JOIN contacts c ON sm.recipient_contact_id = c.id
                LEFT JOIN message_templates mt ON sm.template_id = mt.id
                WHERE sm.id = ?
            `;
            
            const results = await executeQuery(query, [id]);
            if (results.length === 0) {
                return null;
            }

            const data = results[0];
            // Parsear JSON fields solo si son strings
            if (data.target_tag_ids && typeof data.target_tag_ids === 'string') {
                data.target_tag_ids = JSON.parse(data.target_tag_ids);
            }
            if (data.template_variables && typeof data.template_variables === 'string') {
                data.template_variables = JSON.parse(data.template_variables);
            }

            return new ScheduledMessage(data);
        } catch (error) {
            console.error('❌ Error finding scheduled message:', error);
            throw error;
        }
    }

    /**
     * Listar mensajes programados con filtros
     */
    static async findAll(clientId, options = {}) {
        try {
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
            } = options;

            const offset = (page - 1) * limit;
            
            let whereConditions = ['sm.client_id = ?'];
            let queryParams = [clientId];

            // Filtros
            if (status) {
                whereConditions.push('sm.status = ?');
                queryParams.push(status);
            }

            if (send_type) {
                whereConditions.push('sm.send_type = ?');
                queryParams.push(send_type);
            }

            if (is_active !== null) {
                whereConditions.push('sm.is_active = ?');
                queryParams.push(is_active);
            }

            if (is_recurring !== null) {
                whereConditions.push('sm.is_recurring = ?');
                queryParams.push(is_recurring);
            }

            if (search.trim()) {
                whereConditions.push('(sm.name LIKE ? OR sm.description LIKE ? OR sm.message_content LIKE ?)');
                const searchTerm = `%${search}%`;
                queryParams.push(searchTerm, searchTerm, searchTerm);
            }

            // Validar campos de ordenamiento
            const validSortFields = ['created_at', 'scheduled_at', 'next_execution', 'name', 'status'];
            const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';

            const query = `
                SELECT sm.*,
                       c.name as contact_name, c.phone_number as contact_phone,
                       mt.name as template_name,
                       COUNT(sme.id) as total_executions
                FROM scheduled_messages sm
                LEFT JOIN contacts c ON sm.recipient_contact_id = c.id
                LEFT JOIN message_templates mt ON sm.template_id = mt.id
                LEFT JOIN scheduled_message_executions sme ON sm.id = sme.scheduled_message_id
                WHERE ${whereConditions.join(' AND ')}
                GROUP BY sm.id
                ORDER BY sm.${safeSortBy} ${sortOrder.toUpperCase()}
                LIMIT ${limit} OFFSET ${offset}
            `;

            const results = await executeQuery(query, queryParams);
            
            // Procesar resultados
            const scheduledMessages = results.map(row => {
                // Parsear JSON fields solo si son strings
                if (row.target_tag_ids && typeof row.target_tag_ids === 'string') {
                    row.target_tag_ids = JSON.parse(row.target_tag_ids);
                }
                if (row.template_variables && typeof row.template_variables === 'string') {
                    row.template_variables = JSON.parse(row.template_variables);
                }
                return new ScheduledMessage(row);
            });

            // Contar total
            const countQuery = `
                SELECT COUNT(DISTINCT sm.id) as total
                FROM scheduled_messages sm
                WHERE ${whereConditions.join(' AND ')}
            `;
            
            const countResult = await executeQuery(countQuery, queryParams);
            const total = countResult[0].total;

            return {
                scheduledMessages,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: parseInt(total),
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error('❌ Error finding scheduled messages:', error);
            throw error;
        }
    }

    /**
     * Actualizar mensaje programado
     */
    static async update(id, updateData) {
        try {
            const updates = [];
            const params = [];

            // Campos actualizables
            const allowedFields = [
                'name', 'description', 'scheduled_at', 'message_content',
                'template_id', 'template_variables', 'status', 'is_active',
                'recurrence_end_date', 'max_executions', 'next_execution',
                'last_execution', 'execution_count', 'success_count', 'error_count'
            ];

            for (const field of allowedFields) {
                if (updateData.hasOwnProperty(field)) {
                    updates.push(`${field} = ?`);
                    if (field === 'template_variables' && updateData[field]) {
                        params.push(JSON.stringify(updateData[field]));
                    } else {
                        params.push(updateData[field]);
                    }
                }
            }

            if (updates.length === 0) {
                throw new Error('No valid fields to update');
            }

            // Recalcular next_execution si se actualiza scheduled_at
            if (updateData.scheduled_at) {
                updates.push('next_execution = ?');
                params.push(updateData.scheduled_at);
            }

            params.push(id);

            const query = `
                UPDATE scheduled_messages 
                SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `;

            await executeQuery(query, params);
            return await this.findById(id);
        } catch (error) {
            console.error('❌ Error updating scheduled message:', error);
            throw error;
        }
    }

    /**
     * Eliminar mensaje programado
     */
    static async delete(id) {
        try {
            const query = 'DELETE FROM scheduled_messages WHERE id = ?';
            const result = await executeQuery(query, [id]);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('❌ Error deleting scheduled message:', error);
            throw error;
        }
    }

    /**
     * Obtener mensajes listos para ejecutar
     */
    static async getMessagesReadyForExecution() {
        try {
            // Usar fecha actual de Buenos Aires
            const buenosAiresTime = getBuenosAiresTime();
            
            const query = `
                SELECT sm.*,
                       mt.content as template_content
                FROM scheduled_messages sm
                LEFT JOIN message_templates mt ON sm.template_id = mt.id
                WHERE sm.is_active = true 
                  AND sm.status IN ('pending', 'active')
                  AND sm.next_execution <= ?
                ORDER BY sm.next_execution ASC
            `;

            const results = await executeQuery(query, [buenosAiresTime]);
            return results.map(row => {
                // Parsear JSON fields solo si son strings
                if (row.target_tag_ids && typeof row.target_tag_ids === 'string') {
                    row.target_tag_ids = JSON.parse(row.target_tag_ids);
                }
                if (row.template_variables && typeof row.template_variables === 'string') {
                    row.template_variables = JSON.parse(row.template_variables);
                }
                return new ScheduledMessage(row);
            });
        } catch (error) {
            console.error('❌ Error getting messages ready for execution:', error);
            throw error;
        }
    }

    /**
     * Validar datos del mensaje programado
     */
    static validate(data) {
        const errors = [];

        if (!data.client_id) {
            errors.push('client_id is required');
        }

        if (!data.name || data.name.trim().length === 0) {
            errors.push('name is required');
        }

        if (!data.send_type) {
            errors.push('send_type is required');
        }

        if (!['individual', 'bulk_tags', 'bulk_all'].includes(data.send_type)) {
            errors.push('send_type must be individual, bulk_tags, or bulk_all');
        }

        if (data.send_type === 'individual' && !data.recipient_phone && !data.recipient_contact_id) {
            errors.push('recipient_phone or recipient_contact_id is required for individual messages');
        }

        if (data.send_type === 'bulk_tags' && (!data.target_tag_ids || data.target_tag_ids.length === 0)) {
            errors.push('target_tag_ids is required for bulk_tags messages');
        }

        if (!data.scheduled_at) {
            errors.push('scheduled_at is required');
        }

        if (data.message_type === 'text' && !data.message_content) {
            errors.push('message_content is required for text messages');
        }

        if (data.message_type === 'template' && !data.template_id) {
            errors.push('template_id is required for template messages');
        }

        if (data.is_recurring) {
            if (!data.recurrence_type) {
                errors.push('recurrence_type is required for recurring messages');
            }
            if (!data.recurrence_interval || data.recurrence_interval <= 0) {
                errors.push('recurrence_interval must be positive for recurring messages');
            }
        }

        return errors;
    }

    /**
     * Calcular próxima ejecución para mensajes recurrentes
     */
    calculateNextExecution(lastExecution = null) {
        if (!this.is_recurring) {
            return null;
        }

        const baseDate = lastExecution ? new Date(lastExecution) : new Date(this.scheduled_at);
        const nextDate = new Date(baseDate);

        switch (this.recurrence_type) {
            case 'minutes':
                nextDate.setMinutes(nextDate.getMinutes() + this.recurrence_interval);
                break;
            case 'hours':
                nextDate.setHours(nextDate.getHours() + this.recurrence_interval);
                break;
            case 'days':
                nextDate.setDate(nextDate.getDate() + this.recurrence_interval);
                break;
            case 'weeks':
                nextDate.setDate(nextDate.getDate() + (this.recurrence_interval * 7));
                break;
            case 'months':
                nextDate.setMonth(nextDate.getMonth() + this.recurrence_interval);
                break;
            default:
                return null;
        }

        // Verificar si excede fecha de fin
        if (this.recurrence_end_date && nextDate > new Date(this.recurrence_end_date)) {
            return null;
        }

        // Verificar máximo de ejecuciones
        if (this.max_executions && this.execution_count >= this.max_executions) {
            return null;
        }

        return nextDate;
    }
}

module.exports = ScheduledMessage;
