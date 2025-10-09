const { executeQuery } = require('../config/database-simple');

/**
 * Entidad Conversation - Maneja las conversaciones de WhatsApp
 */
class Conversation {
    constructor(data = {}) {
        this.id = data.id || null;
        this.client_id = data.client_id || null;
        this.contact_id = data.contact_id || null;
        this.contact_phone = data.contact_phone || null;
        this.contact_name = data.contact_name || null;
        this.last_message = data.last_message || null;
        this.last_message_at = data.last_message_at || null;
        this.unread_count = data.unread_count || 0;
        this.is_archived = data.is_archived || false;
        this.is_pinned = data.is_pinned || false;
        this.bot_enabled = data.bot_enabled !== undefined ? data.bot_enabled : true;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
    }

    /**
     * Crear nueva conversación
     * @param {Object} conversationData - Datos de la conversación
     * @returns {Promise<Conversation>} Nueva conversación creada
     */
    static async create(conversationData) {
        try {
            const {
                client_id,
                contact_id,
                contact_phone,
                contact_name = null,
                last_message = null,
                bot_enabled = true
            } = conversationData;

            const result = await executeQuery(
                `INSERT INTO conversations 
                (client_id, contact_id, contact_phone, contact_name, last_message, last_message_at, bot_enabled, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?, NOW(), ?, NOW(), NOW())`,
                [client_id, contact_id, contact_phone, contact_name, last_message, bot_enabled]
            );

            const newConversation = await this.findById(result.insertId);
            console.log(`✅ Conversation created: ${contact_phone} for client_id: ${client_id}`);
            
            return newConversation;
        } catch (error) {
            console.error('❌ Error en Conversation.create:', error.message);
            throw error;
        }
    }

    /**
     * Buscar conversación por ID
     * @param {number} id - ID de la conversación
     * @returns {Promise<Conversation|null>} Conversación encontrada o null
     */
    static async findById(id) {
        try {
            const results = await executeQuery(
                'SELECT * FROM conversations WHERE id = ?',
                [id]
            );
            
            return results.length > 0 ? new Conversation(results[0]) : null;
        } catch (error) {
            console.error('❌ Error en Conversation.findById:', error.message);
            throw error;
        }
    }

    /**
     * Buscar conversación por client_id y contact_phone
     * @param {number} clientId - ID del cliente
     * @param {string} contactPhone - Teléfono del contacto
     * @returns {Promise<Conversation|null>} Conversación encontrada o null
     */
    static async findByClientAndPhone(clientId, contactPhone) {
        try {
            // Normalizar número de teléfono (remover @c.us si existe)
            const cleanPhone = contactPhone.replace('@c.us', '');
            
            const results = await executeQuery(
                'SELECT * FROM conversations WHERE client_id = ? AND contact_phone = ?',
                [clientId, cleanPhone]
            );
            
            return results.length > 0 ? new Conversation(results[0]) : null;
        } catch (error) {
            console.error('❌ Error en Conversation.findByClientAndPhone:', error.message);
            throw error;
        }
    }

    /**
     * Obtener conversaciones de un cliente
     * @param {number} clientId - ID del cliente
     * @param {Object} options - Opciones de filtrado
     * @returns {Promise<Conversation[]>} Array de conversaciones
     */
    static async findByClientId(clientId, options = {}) {
        try {
            const {
                limit = 50,
                offset = 0,
                archived = false,
                search = null,
                orderBy = 'last_message_at',
                orderDirection = 'DESC'
            } = options;

            let query = `
                SELECT c.*, 
                       COUNT(DISTINCT m.id) as total_messages,
                       SUM(CASE WHEN m.from_me = 0 AND m.is_read = 0 THEN 1 ELSE 0 END) as unread_messages
                FROM conversations c
                LEFT JOIN messages m ON c.id = m.conversation_id
                WHERE c.client_id = ? AND c.is_archived = ?
            `;
            
            const params = [clientId, archived ? 1 : 0];

            if (search) {
                query += ` AND (c.contact_name LIKE ? OR c.contact_phone LIKE ?)`;
                params.push(`%${search}%`, `%${search}%`);
            }

            query += ` GROUP BY c.id ORDER BY c.${orderBy} ${orderDirection} LIMIT ${limit} OFFSET ${offset}`;
            // No agregar limit y offset como parámetros, usar directamente en la query

            const results = await executeQuery(query, params);
            
            return results.map(row => {
                const conversation = new Conversation(row);
                conversation.total_messages = row.total_messages || 0;
                conversation.unread_messages = row.unread_messages || 0;
                return conversation;
            });
        } catch (error) {
            console.error('❌ Error en Conversation.findByClientId:', error.message);
            throw error;
        }
    }

    /**
     * Obtener o crear conversación
     * @param {number} clientId - ID del cliente
     * @param {string} contactPhone - Teléfono del contacto
     * @param {string} contactName - Nombre del contacto (opcional)
     * @returns {Promise<Conversation>} Conversación existente o nueva
     */
    static async findOrCreate(clientId, contactPhone, contactName = null) {
        try {
            // Normalizar número de teléfono
            const cleanPhone = contactPhone.replace('@c.us', '');
            
            console.log(`🔍 Looking for conversation: client_id=${clientId}, phone=${cleanPhone}`);
            
            // Buscar conversación existente
            let conversation = await this.findByClientAndPhone(clientId, cleanPhone);
            
            if (!conversation) {
                console.log(`📝 Creating new conversation for ${cleanPhone}`);
                
                // Primero crear o encontrar el contacto
                const Contact = require('./Contact');
                const contact = await Contact.findOrCreate(clientId, cleanPhone, contactName);
                
                // Crear nueva conversación con el contact_id
                conversation = await this.create({
                    client_id: clientId,
                    contact_id: contact.id,
                    contact_phone: contact.phone_number,
                    contact_name: contact.name || contactName
                });
            } else {
                console.log(`✅ Found existing conversation: ID ${conversation.id}`);
                
                if (contactName && !conversation.contact_name) {
                    // Actualizar nombre si no existe
                    await conversation.update({ contact_name: contactName });
                }
            }
            
            return conversation;
        } catch (error) {
            console.error('❌ Error en Conversation.findOrCreate:', error.message);
            throw error;
        }
    }

    /**
     * Actualizar conversación
     * @param {Object} updateData - Datos a actualizar
     * @returns {Promise<boolean>} True si se actualizó correctamente
     */
    async update(updateData) {
        try {
            const allowedFields = [
                'contact_name', 'last_message', 'last_message_at', 'unread_count',
                'is_archived', 'is_pinned', 'bot_enabled'
            ];
            
            const fields = [];
            const values = [];
            
            for (const [key, value] of Object.entries(updateData)) {
                if (allowedFields.includes(key)) {
                    fields.push(`${key} = ?`);
                    values.push(value);
                    this[key] = value; // Actualizar la instancia
                }
            }
            
            if (fields.length === 0) {
                throw new Error('No hay campos válidos para actualizar');
            }
            
            fields.push('updated_at = NOW()');
            values.push(this.id);
            
            await executeQuery(
                `UPDATE conversations SET ${fields.join(', ')} WHERE id = ?`,
                values
            );
            
            console.log(`✅ Conversation updated: ${this.contact_phone}`);
            return true;
        } catch (error) {
            console.error('❌ Error en Conversation.update:', error.message);
            throw error;
        }
    }

    /**
     * Actualizar último mensaje
     * @param {string} lastMessage - Último mensaje
     * @param {Date} timestamp - Timestamp del mensaje
     * @returns {Promise<boolean>} True si se actualizó correctamente
     */
    async updateLastMessage(lastMessage, timestamp = new Date()) {
        try {
            return await this.update({
                last_message: lastMessage,
                last_message_at: timestamp
            });
        } catch (error) {
            console.error('❌ Error en Conversation.updateLastMessage:', error.message);
            throw error;
        }
    }

    /**
     * Incrementar contador de mensajes no leídos
     * @returns {Promise<boolean>} True si se actualizó correctamente
     */
    async incrementUnreadCount() {
        try {
            await executeQuery(
                'UPDATE conversations SET unread_count = unread_count + 1, updated_at = NOW() WHERE id = ?',
                [this.id]
            );
            
            this.unread_count += 1;
            return true;
        } catch (error) {
            console.error('❌ Error en Conversation.incrementUnreadCount:', error.message);
            throw error;
        }
    }

    /**
     * Marcar conversación como leída
     * @returns {Promise<boolean>} True si se actualizó correctamente
     */
    async markAsRead() {
        try {
            // Actualizar contador de no leídos
            await this.update({ unread_count: 0 });
            
            // Marcar todos los mensajes como leídos
            await executeQuery(
                'UPDATE messages SET is_read = 1, read_at = NOW() WHERE conversation_id = ? AND is_read = 0',
                [this.id]
            );
            
            console.log(`✅ Conversation marked as read: ${this.contact_phone}`);
            return true;
        } catch (error) {
            console.error('❌ Error en Conversation.markAsRead:', error.message);
            throw error;
        }
    }

    /**
     * Archivar/desarchivar conversación
     * @param {boolean} archived - Si archivar o no
     * @returns {Promise<boolean>} True si se actualizó correctamente
     */
    async setArchived(archived = true) {
        try {
            return await this.update({ is_archived: archived });
        } catch (error) {
            console.error('❌ Error en Conversation.setArchived:', error.message);
            throw error;
        }
    }

    /**
     * Fijar/desfijar conversación
     * @param {boolean} pinned - Si fijar o no
     * @returns {Promise<boolean>} True si se actualizó correctamente
     */
    async setPinned(pinned = true) {
        try {
            return await this.update({ is_pinned: pinned });
        } catch (error) {
            console.error('❌ Error en Conversation.setPinned:', error.message);
            throw error;
        }
    }

    /**
     * Habilitar/deshabilitar bot para esta conversación
     * @param {boolean} enabled - Si habilitar bot o no
     * @returns {Promise<boolean>} True si se actualizó correctamente
     */
    async setBotEnabled(enabled = true) {
        try {
            return await this.update({ bot_enabled: enabled });
        } catch (error) {
            console.error('❌ Error en Conversation.setBotEnabled:', error.message);
            throw error;
        }
    }

    /**
     * Eliminar conversación y todos sus mensajes
     * @returns {Promise<boolean>} True si se eliminó correctamente
     */
    async delete() {
        try {
            // Eliminar mensajes primero (por foreign key)
            await executeQuery(
                'DELETE FROM messages WHERE conversation_id = ?',
                [this.id]
            );
            
            // Eliminar conversación
            await executeQuery(
                'DELETE FROM conversations WHERE id = ?',
                [this.id]
            );
            
            console.log(`✅ Conversation deleted: ${this.contact_phone}`);
            return true;
        } catch (error) {
            console.error('❌ Error en Conversation.delete:', error.message);
            throw error;
        }
    }

    /**
     * Obtener estadísticas de la conversación
     * @returns {Promise<Object>} Estadísticas de la conversación
     */
    async getStats() {
        try {
            const [stats] = await executeQuery(`
                SELECT 
                    COUNT(m.id) as total_messages,
                    SUM(CASE WHEN m.from_me = 1 AND m.is_from_bot = 0 THEN 1 ELSE 0 END) as manual_messages,
                    SUM(CASE WHEN m.from_me = 1 AND m.is_from_bot = 1 THEN 1 ELSE 0 END) as bot_messages,
                    SUM(CASE WHEN m.from_me = 0 THEN 1 ELSE 0 END) as received_messages,
                    SUM(CASE WHEN m.from_me = 0 AND m.is_read = 0 THEN 1 ELSE 0 END) as unread_messages,
                    MAX(m.sent_at) as last_activity
                FROM messages m
                WHERE m.conversation_id = ?
            `, [this.id]);

            return {
                conversation_id: this.id,
                contact_phone: this.contact_phone,
                contact_name: this.contact_name,
                total_messages: stats?.total_messages || 0,
                manual_messages: stats?.manual_messages || 0,
                bot_messages: stats?.bot_messages || 0,
                received_messages: stats?.received_messages || 0,
                unread_messages: stats?.unread_messages || 0,
                last_activity: stats?.last_activity,
                bot_enabled: this.bot_enabled,
                is_archived: this.is_archived,
                is_pinned: this.is_pinned
            };
        } catch (error) {
            console.error('❌ Error en Conversation.getStats:', error.message);
            throw error;
        }
    }

    /**
     * Convertir a JSON para respuestas de API
     * @returns {Object} Representación JSON de la conversación
     */
    toJSON() {
        return {
            id: this.id,
            client_id: this.client_id,
            contact_phone: this.contact_phone,
            contact_name: this.contact_name,
            last_message: this.last_message,
            last_message_at: this.last_message_at,
            unread_count: this.unread_count,
            is_archived: this.is_archived,
            is_pinned: this.is_pinned,
            bot_enabled: this.bot_enabled,
            created_at: this.created_at,
            updated_at: this.updated_at,
            // Campos adicionales que pueden estar disponibles
            total_messages: this.total_messages,
            unread_messages: this.unread_messages
        };
    }

    /**
     * Obtener estadísticas de conversaciones por cliente
     * @param {number} clientId - ID del cliente
     * @returns {Promise<Object>} Estadísticas de conversaciones
     */
    static async getStats(clientId) {
        try {
            const results = await executeQuery(`
                SELECT 
                    COUNT(*) as total_conversations,
                    COUNT(CASE WHEN is_archived = 0 THEN 1 END) as active_conversations,
                    COUNT(CASE WHEN is_archived = 1 THEN 1 END) as archived_conversations,
                    SUM(unread_count) as unread_messages,
                    COUNT(CASE WHEN bot_enabled = 1 THEN 1 END) as bot_enabled_conversations,
                    COUNT(CASE WHEN DATE(last_message_at) = CURDATE() THEN 1 END) as active_today
                FROM conversations 
                WHERE client_id = ?
            `, [clientId]);

            return results[0] || {
                total_conversations: 0,
                active_conversations: 0,
                archived_conversations: 0,
                unread_messages: 0,
                bot_enabled_conversations: 0,
                active_today: 0
            };
        } catch (error) {
            console.error('❌ Error en Conversation.getStats:', error.message);
            throw error;
        }
    }
}

module.exports = Conversation;
