// ============================================================================
// AUTO MESSAGE SERVICE - CRM CONDORITO
// Servicio para gestionar mensajes automáticos disparados por etiquetas
// ============================================================================

const { executeQuery } = require('../config/database-simple');

class AutoMessageService {

    /**
     * Crear mensaje programado cuando se asigna etiqueta con auto-message
     * @param {number} contactId - ID del contacto
     * @param {number} tagId - ID de la etiqueta
     * @param {number} clientId - ID del cliente
     * @returns {Object|null} - Mensaje programado creado o null si no se configuró auto-message
     */
    static async createAutoMessageForTag(contactId, tagId, clientId) {
        try {
            console.log(`🤖 Evaluando auto-message para contacto ${contactId}, etiqueta ${tagId}`);

            // 1. Obtener configuración de la etiqueta
            const tag = await this.getTagAutoConfig(tagId, clientId);
            if (!tag) {
                console.log(`⚠️  Etiqueta ${tagId} no encontrada`);
                return null;
            }

            if (!tag.has_auto_message || !tag.is_active_auto) {
                console.log(`ℹ️  Etiqueta "${tag.name}" no tiene auto-message habilitado`);
                return null;
            }

            // 2. Verificar que no exista ya un mensaje programado
            const existing = await this.findExistingAutoMessage(contactId, tagId, clientId);
            if (existing) {
                console.log(`⚠️  Ya existe mensaje automático activo para contacto ${contactId}, etiqueta ${tagId}`);
                return existing;
            }

            // 3. Obtener datos del contacto para variables
            const contact = await this.getContactData(contactId, clientId);
            if (!contact) {
                console.log(`❌ Contacto ${contactId} no encontrado`);
                return null;
            }

            // 4. Calcular fecha de envío (convertir horas decimales a milisegundos)
            const scheduledAt = new Date();
            const delayInMilliseconds = tag.auto_message_delay_hours * 60 * 60 * 1000; // horas -> milisegundos
            scheduledAt.setTime(scheduledAt.getTime() + delayInMilliseconds);
            
            console.log(`⏰ Cálculo de delay:`);
            console.log(`   📊 Delay configurado: ${tag.auto_message_delay_hours} horas`);
            console.log(`   🔢 Delay en milisegundos: ${delayInMilliseconds}`);
            console.log(`   📅 Fecha actual: ${new Date().toLocaleString()}`);
            console.log(`   📅 Fecha programada: ${scheduledAt.toLocaleString()}`);

            // 5. Preparar contenido del mensaje
            let messageContent = tag.auto_message_content;
            let templateId = tag.auto_message_template_id;
            let messageType = templateId ? 'template' : 'text';

            // 6. Crear usando el sistema existente de scheduled_messages
            const insertQuery = `
                INSERT INTO scheduled_messages (
                    client_id,
                    name,
                    description,
                    send_type,
                    recipient_contact_id,
                    recipient_phone,
                    message_type,
                    template_id,
                    message_content,
                    scheduled_at,
                    timezone,
                    status,
                    is_active,
                    auto_generated,
                    source_tag_id,
                    source_contact_id,
                    next_execution
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const insertParams = [
                clientId,
                `Auto: ${tag.name} - ${contact.display_name || contact.phone_number}`,
                `Mensaje automático generado por etiqueta "${tag.name}"`,
                'individual',
                contactId,
                contact.phone_number,
                messageType,
                templateId,
                messageContent,
                scheduledAt,
                'America/Argentina/Buenos_Aires',
                'active',
                true,
                true, // auto_generated
                tagId, // source_tag_id
                contactId, // source_contact_id
                scheduledAt // next_execution
            ];

            const result = await executeQuery(insertQuery, insertParams);
            const scheduledMessageId = result.insertId;

            console.log(`✅ Mensaje automático creado: ID ${scheduledMessageId}`);
            console.log(`   📅 Programado para: ${scheduledAt.toLocaleString()}`);
            console.log(`   👤 Contacto: ${contact.display_name || contact.phone_number}`);
            console.log(`   🏷️  Etiqueta: ${tag.name}`);

            // 7. Retornar datos del mensaje creado
            return {
                id: scheduledMessageId,
                scheduled_at: scheduledAt,
                contact: contact,
                tag: tag,
                message_type: messageType,
                template_id: templateId,
                message_content: messageContent
            };

        } catch (error) {
            console.error(`❌ Error creando auto-message para tag ${tagId}:`, error);
            throw error;
        }
    }

    /**
     * Cancelar mensaje programado cuando se quita etiqueta
     * @param {number} contactId - ID del contacto
     * @param {number} tagId - ID de la etiqueta
     * @param {number} clientId - ID del cliente
     * @returns {Object} - Resultado de la cancelación
     */
    static async cancelAutoMessageForTag(contactId, tagId, clientId) {
        try {
            console.log(`🚫 Cancelando auto-message para contacto ${contactId}, etiqueta ${tagId}`);

            const result = await executeQuery(`
                UPDATE scheduled_messages 
                SET status = 'cancelled', 
                    is_active = FALSE,
                    updated_at = CURRENT_TIMESTAMP
                WHERE client_id = ? 
                    AND source_tag_id = ? 
                    AND source_contact_id = ?
                    AND auto_generated = TRUE
                    AND status IN ('pending', 'active')
            `, [clientId, tagId, contactId]);

            console.log(`✅ Cancelados ${result.affectedRows} mensajes automáticos pendientes`);
            
            return {
                cancelled_count: result.affectedRows,
                contact_id: contactId,
                tag_id: tagId
            };

        } catch (error) {
            console.error(`❌ Error cancelando auto-message para tag ${tagId}:`, error);
            throw error;
        }
    }

    /**
     * Obtener configuración automática de etiqueta con template populated
     * @param {number} tagId - ID de la etiqueta
     * @param {number} clientId - ID del cliente
     * @returns {Object|null} - Configuración de la etiqueta
     */
    static async getTagAutoConfig(tagId, clientId) {
        try {
            const query = `
                SELECT 
                    ct.*,
                    mt.name as template_name, 
                    mt.content as template_content,
                    mt.variables as template_variables
                FROM contact_tags ct
                LEFT JOIN message_templates mt ON ct.auto_message_template_id = mt.id
                WHERE ct.id = ? AND ct.client_id = ?
            `;
            
            const [tag] = await executeQuery(query, [tagId, clientId]);
            return tag || null;

        } catch (error) {
            console.error(`❌ Error obteniendo config de tag ${tagId}:`, error);
            return null;
        }
    }

    /**
     * Obtener datos del contacto para variables del mensaje
     * @param {number} contactId - ID del contacto
     * @param {number} clientId - ID del cliente
     * @returns {Object|null} - Datos del contacto
     */
    static async getContactData(contactId, clientId) {
        try {
            const query = `
                SELECT 
                    id,
                    phone_number,
                    name,
                    custom_name,
                    COALESCE(custom_name, name, phone_number) as display_name,
                    profile_pic_url,
                    comments,
                    is_blocked,
                    last_message_at,
                    created_at
                FROM contacts 
                WHERE id = ? AND client_id = ? AND is_blocked = FALSE
            `;
            
            const [contact] = await executeQuery(query, [contactId, clientId]);
            return contact || null;

        } catch (error) {
            console.error(`❌ Error obteniendo datos de contacto ${contactId}:`, error);
            return null;
        }
    }

    /**
     * Verificar si ya existe mensaje automático pendiente
     * @param {number} contactId - ID del contacto
     * @param {number} tagId - ID de la etiqueta
     * @param {number} clientId - ID del cliente
     * @returns {Object|null} - Mensaje existente o null
     */
    static async findExistingAutoMessage(contactId, tagId, clientId) {
        try {
            const query = `
                SELECT * FROM scheduled_messages 
                WHERE client_id = ? 
                    AND source_tag_id = ? 
                    AND source_contact_id = ?
                    AND auto_generated = TRUE
                    AND status IN ('pending', 'active')
                LIMIT 1
            `;
            
            const [existing] = await executeQuery(query, [clientId, tagId, contactId]);
            return existing || null;

        } catch (error) {
            console.error(`❌ Error verificando mensaje existente:`, error);
            return null;
        }
    }

    /**
     * Obtener todos los mensajes automáticos de una etiqueta
     * @param {number} tagId - ID de la etiqueta
     * @param {number} clientId - ID del cliente
     * @returns {Array} - Lista de mensajes automáticos
     */
    static async getAutoMessagesByTag(tagId, clientId) {
        try {
            const query = `
                SELECT 
                    sm.*,
                    c.phone_number,
                    c.name as contact_name,
                    c.custom_name as contact_custom_name,
                    ct.name as tag_name
                FROM scheduled_messages sm
                LEFT JOIN contacts c ON sm.source_contact_id = c.id
                LEFT JOIN contact_tags ct ON sm.source_tag_id = ct.id
                WHERE sm.client_id = ? 
                    AND sm.source_tag_id = ?
                    AND sm.auto_generated = TRUE
                ORDER BY sm.created_at DESC
            `;
            
            const messages = await executeQuery(query, [clientId, tagId]);
            return messages;

        } catch (error) {
            console.error(`❌ Error obteniendo mensajes de tag ${tagId}:`, error);
            return [];
        }
    }

    /**
     * Obtener estadísticas de mensajes automáticos por etiqueta
     * @param {number} tagId - ID de la etiqueta
     * @param {number} clientId - ID del cliente
     * @returns {Object} - Estadísticas
     */
    static async getAutoMessageStats(tagId, clientId) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_messages,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
                    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count,
                    COUNT(CASE WHEN status = 'error' THEN 1 END) as error_count
                FROM scheduled_messages 
                WHERE client_id = ? 
                    AND source_tag_id = ?
                    AND auto_generated = TRUE
            `;
            
            const [stats] = await executeQuery(query, [clientId, tagId]);
            return stats || {
                total_messages: 0,
                pending_count: 0,
                active_count: 0,
                completed_count: 0,
                cancelled_count: 0,
                error_count: 0
            };

        } catch (error) {
            console.error(`❌ Error obteniendo stats de tag ${tagId}:`, error);
            return null;
        }
    }

    /**
     * Actualizar configuración de auto-message de una etiqueta
     * @param {number} tagId - ID de la etiqueta
     * @param {number} clientId - ID del cliente
     * @param {Object} config - Nueva configuración
     * @returns {boolean} - Éxito de la operación
     */
    static async updateTagAutoConfig(tagId, clientId, config) {
        try {
            const {
                has_auto_message,
                auto_message_template_id,
                auto_message_delay_hours,
                auto_message_content,
                is_active_auto
            } = config;

            const result = await executeQuery(`
                UPDATE contact_tags 
                SET has_auto_message = ?,
                    auto_message_template_id = ?,
                    auto_message_delay_hours = ?,
                    auto_message_content = ?,
                    is_active_auto = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND client_id = ?
            `, [
                has_auto_message,
                auto_message_template_id,
                auto_message_delay_hours,
                auto_message_content,
                is_active_auto,
                tagId,
                clientId
            ]);

            return result.affectedRows > 0;

        } catch (error) {
            console.error(`❌ Error actualizando config de tag ${tagId}:`, error);
            throw error;
        }
    }
}

module.exports = AutoMessageService;
