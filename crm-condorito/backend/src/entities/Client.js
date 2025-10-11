const { executeQuery } = require('../config/database-simple');
const bcrypt = require('bcryptjs');

// ============================================================================
// ENTITY CLIENT - CRM CONDORITO
// ============================================================================

class Client {
    constructor(data = {}) {
        this.id = data.id || null;
        this.client_code = data.client_code || null;
        this.password = data.password || null;
        this.company_name = data.company_name || null;
        this.email = data.email || null;
        this.phone = data.phone || null;
        this.status = data.status || 'active';
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
    }

    // ========================================================================
    // MÉTODOS ESTÁTICOS (CONSULTAS)
    // ========================================================================

    /**
     * Buscar cliente por ID
     * @param {number} id - ID del cliente
     * @returns {Promise<Client|null>} Cliente encontrado o null
     */
    static async findById(id) {
        try {
            const results = await executeQuery(
                'SELECT * FROM clients WHERE id = ? AND status != "deleted"',
                [id]
            );
            
            return results.length > 0 ? new Client(results[0]) : null;
        } catch (error) {
            console.error('❌ Error en Client.findById:', error.message);
            throw error;
        }
    }

    /**
     * Buscar cliente por código de cliente
     * @param {string} clientCode - Código único del cliente
     * @returns {Promise<Client|null>} Cliente encontrado o null
     */
    static async findByClientCode(clientCode) {
        try {
            const results = await executeQuery(
                'SELECT * FROM clients WHERE client_code = ? AND status != "deleted"',
                [clientCode]
            );
            
            return results.length > 0 ? new Client(results[0]) : null;
        } catch (error) {
            console.error('❌ Error en Client.findByClientCode:', error.message);
            throw error;
        }
    }

    /**
     * Buscar cliente por email
     * @param {string} email - Email del cliente
     * @returns {Promise<Client|null>} Cliente encontrado o null
     */
    static async findByEmail(email) {
        try {
            const results = await executeQuery(
                'SELECT * FROM clients WHERE email = ? AND status != "deleted"',
                [email]
            );
            
            return results.length > 0 ? new Client(results[0]) : null;
        } catch (error) {
            console.error('❌ Error en Client.findByEmail:', error.message);
            throw error;
        }
    }

    /**
     * Obtener todos los clientes activos
     * @param {Object} options - Opciones de paginación y filtros
     * @returns {Promise<Object>} Lista de clientes con metadatos
     */
    static async findAll(options = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                status = 'active',
                search = '',
                sortBy = 'created_at',
                sortOrder = 'DESC'
            } = options;

            const offset = (page - 1) * limit;
            
            // Construir WHERE clause
            let whereClause = 'WHERE status = ?';
            let params = [status];
            
            if (search) {
                whereClause += ' AND (client_code LIKE ? OR company_name LIKE ? OR email LIKE ?)';
                const searchTerm = `%${search}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }
            
            // Query para contar total
            const countQuery = `SELECT COUNT(*) as total FROM clients ${whereClause}`;
            const countResults = await executeQuery(countQuery, params);
            const total = countResults[0].total;
            
            // Query para obtener datos
            const dataQuery = `
                SELECT * FROM clients 
                ${whereClause}
                ORDER BY ${sortBy} ${sortOrder}
                LIMIT ? OFFSET ?
            `;
            
            const results = await executeQuery(dataQuery, [...params, limit, offset]);
            const clients = results.map(row => new Client(row));
            
            return {
                clients,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasNext: page < Math.ceil(total / limit),
                    hasPrev: page > 1
                }
            };
            
        } catch (error) {
            console.error('❌ Error en Client.findAll:', error.message);
            throw error;
        }
    }

    /**
     * Verificar credenciales de login
     * @param {string} clientCode - Código del cliente
     * @param {string} password - Contraseña
     * @returns {Promise<Client|null>} Cliente si las credenciales son válidas
     */
    static async verifyCredentials(clientCode, password) {
        try {
            const client = await Client.findByClientCode(clientCode);
            
            if (!client) {
                return null;
            }
            
            if (client.status !== 'active') {
                throw new Error('Cliente inactivo o suspendido');
            }
            
            const isValidPassword = await bcrypt.compare(password, client.password);
            
            if (!isValidPassword) {
                return null;
            }
            
            return client;
            
        } catch (error) {
            console.error('❌ Error en Client.verifyCredentials:', error.message);
            throw error;
        }
    }

    // ========================================================================
    // MÉTODOS DE INSTANCIA
    // ========================================================================

    /**
     * Guardar cliente (crear o actualizar)
     * @returns {Promise<Client>} Cliente guardado
     */
    async save() {
        try {
            if (this.id) {
                // Actualizar cliente existente
                await executeQuery(`
                    UPDATE clients 
                    SET company_name = ?, email = ?, phone = ?, status = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [this.company_name, this.email, this.phone, this.status, this.id]);
                
                console.log(`✅ Cliente ${this.client_code} actualizado`);
            } else {
                // Crear nuevo cliente
                if (this.password) {
                    this.password = await bcrypt.hash(this.password, 12);
                }
                
                const result = await executeQuery(`
                    INSERT INTO clients (client_code, password, company_name, email, phone, status)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    this.client_code,
                    this.password,
                    this.company_name,
                    this.email,
                    this.phone,
                    this.status
                ]);
                
                this.id = result.insertId;
                console.log(`✅ Cliente ${this.client_code} creado (ID: ${this.id})`);
            }
            
            // Recargar datos actualizados
            const updated = await Client.findById(this.id);
            Object.assign(this, updated);
            
            return this;
            
        } catch (error) {
            console.error('❌ Error en Client.save:', error.message);
            throw error;
        }
    }

    /**
     * Eliminar cliente (soft delete)
     * @returns {Promise<boolean>} True si se eliminó correctamente
     */
    async delete() {
        try {
            if (!this.id) {
                throw new Error('No se puede eliminar un cliente sin ID');
            }
            
            await executeQuery(
                'UPDATE clients SET status = "deleted", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [this.id]
            );
            
            this.status = 'deleted';
            console.log(`✅ Cliente ${this.client_code} eliminado (soft delete)`);
            
            return true;
            
        } catch (error) {
            console.error('❌ Error en Client.delete:', error.message);
            throw error;
        }
    }

    /**
     * Cambiar contraseña del cliente
     * @param {string} newPassword - Nueva contraseña
     * @returns {Promise<boolean>} True si se cambió correctamente
     */
    async changePassword(newPassword) {
        try {
            if (!this.id) {
                throw new Error('No se puede cambiar contraseña de un cliente sin ID');
            }
            
            const hashedPassword = await bcrypt.hash(newPassword, 12);
            
            await executeQuery(
                'UPDATE clients SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [hashedPassword, this.id]
            );
            
            this.password = hashedPassword;
            console.log(`✅ Contraseña cambiada para cliente ${this.client_code}`);
            
            return true;
            
        } catch (error) {
            console.error('❌ Error en Client.changePassword:', error.message);
            throw error;
        }
    }

    /**
     * Obtener sesión de WhatsApp del cliente
     * @returns {Promise<Object|null>} Sesión de WhatsApp o null
     */
    async getWhatsAppSession() {
        try {
            const results = await executeQuery(
                'SELECT * FROM whatsapp_sessions WHERE client_id = ? ORDER BY created_at DESC LIMIT 1',
                [this.id]
            );
            
            return results.length > 0 ? results[0] : null;
            
        } catch (error) {
            console.error('❌ Error en Client.getWhatsAppSession:', error.message);
            throw error;
        }
    }

    /**
     * Obtener configuración del bot
     * @returns {Promise<Object|null>} Configuración del bot o null
     */
    async getBotConfiguration() {
        try {
            const results = await executeQuery(
                'SELECT * FROM bot_configurations WHERE client_id = ?',
                [this.id]
            );
            
            return results.length > 0 ? results[0] : null;
            
        } catch (error) {
            console.error('❌ Error en Client.getBotConfiguration:', error.message);
            throw error;
        }
    }

    /**
     * Obtener estadísticas del cliente
     * @returns {Promise<Object>} Estadísticas del cliente
     */
    async getStats() {
        try {
            const stats = {};
            
            // Total de contactos
            const contactsResult = await executeQuery(
                'SELECT COUNT(*) as total FROM contacts WHERE client_id = ?',
                [this.id]
            );
            stats.totalContacts = contactsResult[0].total;
            
            // Total de conversaciones
            const conversationsResult = await executeQuery(
                'SELECT COUNT(*) as total FROM conversations WHERE client_id = ?',
                [this.id]
            );
            stats.totalConversations = conversationsResult[0].total;
            
            // Total de mensajes
            const messagesResult = await executeQuery(`
                SELECT COUNT(*) as total 
                FROM messages m 
                JOIN conversations c ON m.conversation_id = c.id 
                WHERE c.client_id = ?
            `, [this.id]);
            stats.totalMessages = messagesResult[0].total;
            
            // Mensajes del bot vs manuales
            const botMessagesResult = await executeQuery(`
                SELECT 
                    SUM(CASE WHEN m.is_from_bot = 1 THEN 1 ELSE 0 END) as bot_messages,
                    SUM(CASE WHEN m.from_me = 1 AND m.is_from_bot = 0 THEN 1 ELSE 0 END) as manual_messages
                FROM messages m 
                JOIN conversations c ON m.conversation_id = c.id 
                WHERE c.client_id = ?
            `, [this.id]);
            
            stats.botMessages = botMessagesResult[0].bot_messages || 0;
            stats.manualMessages = botMessagesResult[0].manual_messages || 0;
            
            // Total de templates
            const templatesResult = await executeQuery(
                'SELECT COUNT(*) as total FROM message_templates WHERE client_id = ? AND is_active = 1',
                [this.id]
            );
            stats.totalTemplates = templatesResult[0].total;
            
            return stats;
            
        } catch (error) {
            console.error('❌ Error en Client.getStats:', error.message);
            throw error;
        }
    }

    /**
     * Convertir a objeto JSON (sin contraseña)
     * @returns {Object} Objeto JSON del cliente
     */
    toJSON() {
        const { password, ...clientData } = this;
        return clientData;
    }

    /**
     * Validar datos del cliente
     * @returns {Object} Resultado de validación
     */
    validate() {
        const errors = [];
        
        if (!this.client_code || this.client_code.length < 3) {
            errors.push('El código de cliente debe tener al menos 3 caracteres');
        }
        
        if (!this.company_name || this.company_name.length < 2) {
            errors.push('El nombre de la empresa debe tener al menos 2 caracteres');
        }
        
        if (this.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
            errors.push('El email no tiene un formato válido');
        }
        
        if (!['active', 'inactive', 'suspended'].includes(this.status)) {
            errors.push('El status debe ser active, inactive o suspended');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

module.exports = Client;
