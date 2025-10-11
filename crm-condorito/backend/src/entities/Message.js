const { executeQuery } = require('../config/database-simple');

/**
 * Entidad Message - Maneja los mensajes de WhatsApp
 */
class Message {
    constructor(data = {}) {
        this.id = data.id || null;
        this.conversation_id = data.conversation_id || null;
        this.message_id = data.message_id || null; // ID único de WhatsApp
        this.sender_type = data.sender_type || 'contact'; // contact, client, bot
        this.from_me = data.from_me || false;
        this.is_from_bot = data.is_from_bot || false;
        this.content = data.content || null;
        this.message_type = data.message_type || 'text'; // text, image, document, audio, video
        this.media_url = data.media_url || null;
        this.file_name = data.file_name || null;
        this.media_mimetype = data.media_mimetype || null;
        this.media_size = data.media_size || null;
        this.quoted_message_id = data.quoted_message_id || null;
        this.is_read = data.is_read !== undefined ? data.is_read : false;
        this.read_at = data.read_at || null;
        this.sent_at = data.sent_at || null;
        this.delivered_at = data.delivered_at || null;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
    }

    /**
     * Crear nuevo mensaje
     * @param {Object} messageData - Datos del mensaje
     * @returns {Promise<Message>} Nuevo mensaje creado
     */
    static async create(messageData) {
        try {
            const {
                conversation_id,
                message_id,
                sender_type = 'contact',
                from_me = false,
                is_from_bot = false,
                content,
                message_type = 'text',
                media_url = null,
                file_name = null,
                media_mimetype = null,
                media_size = null,
                quoted_message_id = null,
                is_read = false,
                sent_at = new Date()
            } = messageData;

            const result = await executeQuery(
                `INSERT INTO messages 
                (conversation_id, message_id, sender_type, from_me, is_from_bot, content, 
                 message_type, media_url, file_name, mime_type, file_size, 
                 quoted_message_id, is_read, sent_at, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    conversation_id, message_id, sender_type, from_me, is_from_bot, content,
                    message_type, media_url, file_name, media_mimetype, media_size,
                    quoted_message_id, is_read, sent_at
                ]
            );

            const newMessage = await this.findById(result.insertId);
            console.log(`✅ Message created: ${message_id} (${sender_type})`);
            
            return newMessage;
        } catch (error) {
            console.error('❌ Error en Message.create:', error.message);
            throw error;
        }
    }

    /**
     * Buscar mensaje por ID
     * @param {number} id - ID del mensaje
     * @returns {Promise<Message|null>} Mensaje encontrado o null
     */
    static async findById(id) {
        try {
            const results = await executeQuery(
                'SELECT * FROM messages WHERE id = ?',
                [id]
            );
            
            return results.length > 0 ? new Message(results[0]) : null;
        } catch (error) {
            console.error('❌ Error en Message.findById:', error.message);
            throw error;
        }
    }

    /**
     * Buscar mensaje por message_id de WhatsApp
     * @param {string} messageId - ID del mensaje de WhatsApp
     * @returns {Promise<Message|null>} Mensaje encontrado o null
     */
    static async findByMessageId(messageId) {
        try {
            const results = await executeQuery(
                'SELECT * FROM messages WHERE message_id = ?',
                [messageId]
            );

            return results.length > 0 ? new Message(results[0]) : null;
        } catch (error) {
            console.error('❌ Error en Message.findByMessageId:', error.message);
            throw error;
        }
    }


    /**
     * Obtener mensajes de una conversación
     * @param {number} conversationId - ID de la conversación
     * @param {Object} options - Opciones de filtrado
     * @returns {Promise<Message[]>} Array de mensajes
     */
    static async findByConversationId(conversationId, options = {}) {
        try {
            const {
                limit = 50,
                offset = 0,
                orderBy = 'sent_at',
                orderDirection = 'ASC',
                messageType = null,
                senderType = null,
                unreadOnly = false
            } = options;

            // Para obtener los ÚLTIMOS N mensajes en orden cronológico, usamos subconsulta
            let query;
            if (orderDirection === 'ASC' && offset === 0) {
                // Caso especial: obtener los últimos N mensajes en orden cronológico
                query = `
                    SELECT * FROM (
                        SELECT m.*, c.contact_phone, c.contact_name
                        FROM messages m
                        LEFT JOIN conversations c ON m.conversation_id = c.id
                        WHERE m.conversation_id = ?
                        ORDER BY m.sent_at DESC
                        LIMIT ${limit}
                    ) AS recent_messages
                    ORDER BY sent_at ASC
                `;
            } else {
                // Caso normal: usar la lógica original
                query = `
                    SELECT m.*, c.contact_phone, c.contact_name
                    FROM messages m
                    LEFT JOIN conversations c ON m.conversation_id = c.id
                    WHERE m.conversation_id = ?
                `;
            }
            
            const params = [conversationId];

            // Solo agregar filtros adicionales en el caso normal
            if (!(orderDirection === 'ASC' && offset === 0)) {
                if (messageType) {
                    query += ` AND m.message_type = ?`;
                    params.push(messageType);
                }

                if (senderType) {
                    query += ` AND m.sender_type = ?`;
                    params.push(senderType);
                }

                if (unreadOnly) {
                    query += ` AND m.is_read = 0`;
                }

                query += ` ORDER BY m.${orderBy} ${orderDirection} LIMIT ${limit} OFFSET ${offset}`;
            }
            // Para el caso especial (ASC + offset=0), la query ya está completa con la subconsulta

            const results = await executeQuery(query, params);
            
            return results.map(row => {
                const message = new Message(row);
                message.contact_phone = row.contact_phone;
                message.contact_name = row.contact_name;
                return message;
            });
        } catch (error) {
            console.error('❌ Error en Message.findByConversationId:', error.message);
            throw error;
        }
    }

    /**
     * Obtener mensajes recientes de un cliente
     * @param {number} clientId - ID del cliente
     * @param {Object} options - Opciones de filtrado
     * @returns {Promise<Message[]>} Array de mensajes
     */
    static async findRecentByClientId(clientId, options = {}) {
        try {
            const {
                limit = 100,
                hours = 24,
                messageType = null,
                senderType = null
            } = options;

            let query = `
                SELECT m.*, c.contact_phone, c.contact_name
                FROM messages m
                INNER JOIN conversations c ON m.conversation_id = c.id
                WHERE c.client_id = ? AND m.sent_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
            `;
            
            const params = [clientId, hours];

            if (messageType) {
                query += ` AND m.message_type = ?`;
                params.push(messageType);
            }

            if (senderType) {
                query += ` AND m.sender_type = ?`;
                params.push(senderType);
            }

            query += ` ORDER BY m.sent_at DESC LIMIT ${limit}`;
            // No agregar limit como parámetro, usar directamente en la query

            const results = await executeQuery(query, params);
            
            return results.map(row => {
                const message = new Message(row);
                message.contact_phone = row.contact_phone;
                message.contact_name = row.contact_name;
                return message;
            });
        } catch (error) {
            console.error('❌ Error en Message.findRecentByClientId:', error.message);
            throw error;
        }
    }

    /**
     * Buscar mensajes por contenido (búsqueda de texto)
     * @param {number} clientId - ID del cliente
     * @param {string} searchTerm - Término de búsqueda
     * @param {Object} options - Opciones de filtrado
     * @returns {Promise<Message[]>} Array de mensajes encontrados
     */
    static async searchByContent(clientId, searchTerm, options = {}) {
        try {
            const {
                limit = 50,
                offset = 0,
                conversationId = null
            } = options;

            let query = `
                SELECT m.*, c.contact_phone, c.contact_name
                FROM messages m
                INNER JOIN conversations c ON m.conversation_id = c.id
                WHERE c.client_id = ? AND m.content LIKE ?
            `;
            
            const params = [clientId, `%${searchTerm}%`];

            if (conversationId) {
                query += ` AND m.conversation_id = ?`;
                params.push(conversationId);
            }

            query += ` ORDER BY m.sent_at DESC LIMIT ${limit} OFFSET ${offset}`;
            // No agregar limit y offset como parámetros, usar directamente en la query

            const results = await executeQuery(query, params);
            
            return results.map(row => {
                const message = new Message(row);
                message.contact_phone = row.contact_phone;
                message.contact_name = row.contact_name;
                return message;
            });
        } catch (error) {
            console.error('❌ Error en Message.searchByContent:', error.message);
            throw error;
        }
    }

    /**
     * Actualizar mensaje
     * @param {Object} updateData - Datos a actualizar
     * @returns {Promise<boolean>} True si se actualizó correctamente
     */
    async update(updateData) {
        try {
            const allowedFields = [
                'content', 'is_read', 'read_at', 'delivered_at', 'media_url',
                'file_name', 'mime_type', 'file_size'
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
                `UPDATE messages SET ${fields.join(', ')} WHERE id = ?`,
                values
            );
            
            console.log(`✅ Message updated: ${this.message_id}`);
            return true;
        } catch (error) {
            console.error('❌ Error en Message.update:', error.message);
            throw error;
        }
    }

    /**
     * Marcar mensaje como leído
     * @returns {Promise<boolean>} True si se actualizó correctamente
     */
    async markAsRead() {
        try {
            return await this.update({
                is_read: true,
                read_at: new Date()
            });
        } catch (error) {
            console.error('❌ Error en Message.markAsRead:', error.message);
            throw error;
        }
    }

    /**
     * Marcar mensaje como entregado
     * @returns {Promise<boolean>} True si se actualizó correctamente
     */
    async markAsDelivered() {
        try {
            return await this.update({
                delivered_at: new Date()
            });
        } catch (error) {
            console.error('❌ Error en Message.markAsDelivered:', error.message);
            throw error;
        }
    }

    /**
     * Eliminar mensaje
     * @returns {Promise<boolean>} True si se eliminó correctamente
     */
    async delete() {
        try {
            await executeQuery(
                'DELETE FROM messages WHERE id = ?',
                [this.id]
            );
            
            console.log(`✅ Message deleted: ${this.message_id}`);
            return true;
        } catch (error) {
            console.error('❌ Error en Message.delete:', error.message);
            throw error;
        }
    }

    /**
     * Obtener historial de conversación para IA
     * @param {number} conversationId - ID de la conversación
     * @param {number} limit - Límite de mensajes
     * @returns {Promise<Array>} Array de mensajes formateados para IA
     */
    static async getConversationHistory(conversationId, limit = 10) {
        try {
            const messages = await this.findByConversationId(conversationId, {
                limit,
                orderBy: 'sent_at',
                orderDirection: 'DESC'
            });

            // Formatear para IA (más reciente primero, luego invertir)
            return messages.reverse().map(message => {
                const sender = message.from_me ? 
                    (message.is_from_bot ? 'Bot' : 'Cliente') : 
                    'Usuario';
                
                return `${sender}: ${message.content}`;
            });
        } catch (error) {
            console.error('❌ Error en Message.getConversationHistory:', error.message);
            throw error;
        }
    }

    /**
     * Verificar si es un mensaje multimedia
     * @returns {boolean} True si es multimedia
     */
    isMediaMessage() {
        return ['image', 'document', 'audio', 'video'].includes(this.message_type);
    }

    /**
     * Verificar si es un mensaje de texto
     * @returns {boolean} True si es texto
     */
    isTextMessage() {
        return this.message_type === 'text';
    }

    /**
     * Verificar si es un mensaje del bot
     * @returns {boolean} True si es del bot
     */
    isBotMessage() {
        return this.is_from_bot;
    }

    /**
     * Verificar si es un mensaje manual del cliente
     * @returns {boolean} True si es manual del cliente
     */
    isClientMessage() {
        return this.from_me && !this.is_from_bot;
    }

    /**
     * Verificar si es un mensaje recibido
     * @returns {boolean} True si es recibido
     */
    isReceivedMessage() {
        return !this.from_me;
    }

    /**
     * Convertir a JSON para respuestas de API
     * @returns {Object} Representación JSON del mensaje
     */
    toJSON() {
        return {
            id: this.id,
            conversation_id: this.conversation_id,
            message_id: this.message_id,
            sender_type: this.sender_type,
            from_me: this.from_me,
            is_from_bot: this.is_from_bot,
            content: this.content,
            message_type: this.message_type,
            media_url: this.media_url,
            file_name: this.file_name,
            media_mimetype: this.media_mimetype,
            media_size: this.media_size,
            quoted_message_id: this.quoted_message_id,
            is_read: this.is_read,
            read_at: this.read_at,
            sent_at: this.sent_at,
            delivered_at: this.delivered_at,
            created_at: this.created_at,
            updated_at: this.updated_at,
            // Campos adicionales que pueden estar disponibles
            contact_phone: this.contact_phone,
            contact_name: this.contact_name
        };
    }

    /**
     * Convertir a formato para IA
     * @returns {Object} Representación para IA
     */
    toAIFormat() {
        const sender = this.from_me ? 
            (this.is_from_bot ? 'Bot' : 'Cliente') : 
            'Usuario';
        
        return {
            sender,
            content: this.content,
            timestamp: this.sent_at,
            type: this.message_type
        };
    }

    /**
     * Obtener estadísticas de mensajes por cliente
     * @param {number} clientId - ID del cliente
     * @returns {Promise<Object>} Estadísticas de mensajes
     */
    static async getClientStats(clientId) {
        try {
            const results = await executeQuery(`
                SELECT 
                    COUNT(*) as total_messages,
                    COUNT(CASE WHEN sender_type = 'bot' THEN 1 END) as bot_messages,
                    COUNT(CASE WHEN sender_type = 'client' THEN 1 END) as manual_messages,
                    COUNT(CASE WHEN sender_type = 'contact' THEN 1 END) as received_messages,
                    COUNT(CASE WHEN DATE(sent_at) = CURDATE() THEN 1 END) as active_today,
                    COUNT(CASE WHEN DATE(sent_at) = CURDATE() AND sender_type = 'contact' THEN 1 END) as received_today,
                    COUNT(CASE WHEN DATE(sent_at) = CURDATE() AND sender_type IN ('client', 'bot') THEN 1 END) as sent_today
                FROM messages m
                JOIN conversations c ON m.conversation_id = c.id
                WHERE c.client_id = ?
            `, [clientId]);

            return results[0] || {
                total_messages: 0,
                bot_messages: 0,
                manual_messages: 0,
                received_messages: 0,
                active_today: 0,
                received_today: 0,
                sent_today: 0
            };
        } catch (error) {
            console.error('❌ Error en Message.getClientStats:', error.message);
            throw error;
        }
    }
}

module.exports = Message;
