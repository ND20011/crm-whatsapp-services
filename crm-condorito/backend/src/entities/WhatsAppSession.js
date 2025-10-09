const { executeQuery } = require('../config/database-simple');

/**
 * Entidad WhatsAppSession - Maneja las sesiones de WhatsApp de los clientes
 */
class WhatsAppSession {
    constructor(data = {}) {
        this.id = data.id || null;
        this.client_id = data.client_id || null;
        this.session_id = data.session_id || null;
        this.phone_number = data.phone_number || null;
        this.status = data.status || 'disconnected'; // disconnected, connecting, connected, error
        this.qr_code = data.qr_code || null;
        this.connected_at = data.connected_at || null;
        this.disconnected_at = data.disconnected_at || null;
        this.last_activity = data.last_activity || null;
        this.error_message = data.error_message || null;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
    }

    /**
     * Crear nueva sesión de WhatsApp
     * @param {Object} sessionData - Datos de la sesión
     * @returns {Promise<WhatsAppSession>} Nueva sesión creada
     */
    static async create(sessionData) {
        try {
            const {
                client_id,
                session_id,
                phone_number = null,
                status = 'disconnected',
                qr_code = null
            } = sessionData;

            const result = await executeQuery(
                `INSERT INTO whatsapp_sessions 
                (client_id, session_id, phone_number, status, qr_code, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
                [client_id, session_id, phone_number, status, qr_code]
            );

            const newSession = await this.findById(result.insertId);
            console.log(`✅ WhatsApp session created for client_id: ${client_id}, session_id: ${session_id}`);
            
            return newSession;
        } catch (error) {
            console.error('❌ Error en WhatsAppSession.create:', error.message);
            throw error;
        }
    }

    /**
     * Buscar sesión por ID
     * @param {number} id - ID de la sesión
     * @returns {Promise<WhatsAppSession|null>} Sesión encontrada o null
     */
    static async findById(id) {
        try {
            const results = await executeQuery(
                'SELECT * FROM whatsapp_sessions WHERE id = ?',
                [id]
            );
            
            return results.length > 0 ? new WhatsAppSession(results[0]) : null;
        } catch (error) {
            console.error('❌ Error en WhatsAppSession.findById:', error.message);
            throw error;
        }
    }

    /**
     * Buscar sesión por client_id
     * @param {number} clientId - ID del cliente
     * @returns {Promise<WhatsAppSession|null>} Sesión encontrada o null
     */
    static async findByClientId(clientId) {
        try {
            const results = await executeQuery(
                'SELECT * FROM whatsapp_sessions WHERE client_id = ? ORDER BY created_at DESC LIMIT 1',
                [clientId]
            );
            
            return results.length > 0 ? new WhatsAppSession(results[0]) : null;
        } catch (error) {
            console.error('❌ Error en WhatsAppSession.findByClientId:', error.message);
            throw error;
        }
    }

    /**
     * Buscar sesión por session_id
     * @param {string} sessionId - ID de la sesión de WhatsApp
     * @returns {Promise<WhatsAppSession|null>} Sesión encontrada o null
     */
    static async findBySessionId(sessionId) {
        try {
            const results = await executeQuery(
                'SELECT * FROM whatsapp_sessions WHERE session_id = ?',
                [sessionId]
            );
            
            return results.length > 0 ? new WhatsAppSession(results[0]) : null;
        } catch (error) {
            console.error('❌ Error en WhatsAppSession.findBySessionId:', error.message);
            throw error;
        }
    }

    /**
     * Obtener todas las sesiones activas
     * @returns {Promise<WhatsAppSession[]>} Array de sesiones activas
     */
    static async findActiveSessions() {
        try {
            const results = await executeQuery(
                'SELECT * FROM whatsapp_sessions WHERE status IN (?, ?) ORDER BY last_activity DESC',
                ['connected', 'connecting']
            );
            
            return results.map(session => new WhatsAppSession(session));
        } catch (error) {
            console.error('❌ Error en WhatsAppSession.findActiveSessions:', error.message);
            throw error;
        }
    }

    /**
     * Actualizar sesión
     * @param {Object} updateData - Datos a actualizar
     * @returns {Promise<boolean>} True si se actualizó correctamente
     */
    async update(updateData) {
        try {
            const allowedFields = [
                'phone_number', 'status', 'qr_code', 'connected_at', 
                'disconnected_at', 'last_activity', 'error_message'
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
                `UPDATE whatsapp_sessions SET ${fields.join(', ')} WHERE id = ?`,
                values
            );
            
            console.log(`✅ WhatsApp session updated: ${this.session_id}`);
            return true;
        } catch (error) {
            console.error('❌ Error en WhatsAppSession.update:', error.message);
            throw error;
        }
    }

    /**
     * Actualizar estado de la sesión
     * @param {string} status - Nuevo estado (disconnected, connecting, connected, error)
     * @param {Object} additionalData - Datos adicionales opcionales
     * @returns {Promise<boolean>} True si se actualizó correctamente
     */
    async updateStatus(status, additionalData = {}) {
        try {
            const updateData = { status, ...additionalData };
            
            // Agregar timestamps automáticos según el estado
            if (status === 'connected') {
                updateData.connected_at = new Date();
                updateData.last_activity = new Date();
            } else if (status === 'disconnected') {
                updateData.disconnected_at = new Date();
            }
            
            return await this.update(updateData);
        } catch (error) {
            console.error('❌ Error en WhatsAppSession.updateStatus:', error.message);
            throw error;
        }
    }

    /**
     * Actualizar última actividad
     * @returns {Promise<boolean>} True si se actualizó correctamente
     */
    async updateLastActivity() {
        try {
            return await this.update({ last_activity: new Date() });
        } catch (error) {
            console.error('❌ Error en WhatsAppSession.updateLastActivity:', error.message);
            throw error;
        }
    }

    /**
     * Eliminar sesión
     * @returns {Promise<boolean>} True si se eliminó correctamente
     */
    async delete() {
        try {
            await executeQuery(
                'DELETE FROM whatsapp_sessions WHERE id = ?',
                [this.id]
            );
            
            console.log(`✅ WhatsApp session deleted: ${this.session_id}`);
            return true;
        } catch (error) {
            console.error('❌ Error en WhatsAppSession.delete:', error.message);
            throw error;
        }
    }

    /**
     * Obtener estadísticas de la sesión
     * @returns {Promise<Object>} Estadísticas de la sesión
     */
    async getStats() {
        try {
            const [conversationStats] = await executeQuery(`
                SELECT 
                    COUNT(DISTINCT c.id) as total_conversations,
                    COUNT(m.id) as total_messages,
                    SUM(CASE WHEN m.from_me = 1 AND m.is_from_bot = 0 THEN 1 ELSE 0 END) as manual_messages,
                    SUM(CASE WHEN m.from_me = 1 AND m.is_from_bot = 1 THEN 1 ELSE 0 END) as bot_messages,
                    SUM(CASE WHEN m.from_me = 0 THEN 1 ELSE 0 END) as received_messages
                FROM conversations c
                LEFT JOIN messages m ON c.id = m.conversation_id
                WHERE c.client_id = ?
            `, [this.client_id]);

            return {
                session_id: this.session_id,
                phone_number: this.phone_number,
                status: this.status,
                connected_at: this.connected_at,
                last_activity: this.last_activity,
                total_conversations: conversationStats?.total_conversations || 0,
                total_messages: conversationStats?.total_messages || 0,
                manual_messages: conversationStats?.manual_messages || 0,
                bot_messages: conversationStats?.bot_messages || 0,
                received_messages: conversationStats?.received_messages || 0
            };
        } catch (error) {
            console.error('❌ Error en WhatsAppSession.getStats:', error.message);
            throw error;
        }
    }

    /**
     * Verificar si la sesión está activa
     * @returns {boolean} True si está activa
     */
    isActive() {
        return this.status === 'connected';
    }

    /**
     * Verificar si la sesión está conectando
     * @returns {boolean} True si está conectando
     */
    isConnecting() {
        return this.status === 'connecting';
    }

    /**
     * Verificar si la sesión está desconectada
     * @returns {boolean} True si está desconectada
     */
    isDisconnected() {
        return this.status === 'disconnected';
    }

    /**
     * Verificar si la sesión tiene error
     * @returns {boolean} True si tiene error
     */
    hasError() {
        return this.status === 'error';
    }

    /**
     * Convertir a JSON para respuestas de API
     * @returns {Object} Representación JSON de la sesión
     */
    toJSON() {
        return {
            id: this.id,
            client_id: this.client_id,
            session_id: this.session_id,
            phone_number: this.phone_number,
            status: this.status,
            connected_at: this.connected_at,
            disconnected_at: this.disconnected_at,
            last_activity: this.last_activity,
            error_message: this.error_message,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }

    /**
     * Convertir a JSON público (sin datos sensibles)
     * @returns {Object} Representación JSON pública
     */
    toPublicJSON() {
        return {
            session_id: this.session_id,
            phone_number: this.phone_number,
            status: this.status,
            connected_at: this.connected_at,
            last_activity: this.last_activity,
            is_active: this.isActive(),
            is_connecting: this.isConnecting()
        };
    }
}

module.exports = WhatsAppSession;
