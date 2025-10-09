const { executeQuery } = require('../config/database-simple');

// ============================================================================
// CONTACT ENTITY - CRM CONDORITO
// ============================================================================

class Contact {
    constructor(data = {}) {
        this.id = data.id || null;
        this.client_id = data.client_id || null;
        this.phone_number = data.phone_number || null;
        this.name = data.name || null;
        this.custom_name = data.custom_name || null;
        this.profile_pic_url = data.profile_pic_url || null;
        this.comments = data.comments || null;
        this.is_blocked = data.is_blocked || false;
        this.last_message_at = data.last_message_at || null;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
        this.tags = data.tags || []; // Array de tags asociadas
    }

    /**
     * Crear nuevo contacto
     */
    async create() {
        try {
            // Validar datos requeridos
            if (!this.client_id || !this.phone_number) {
                throw new Error('client_id y phone_number son requeridos');
            }

            // Formatear número de teléfono
            this.phone_number = this.formatPhoneNumber(this.phone_number);

            const query = `
                INSERT INTO contacts (
                    client_id, phone_number, name, custom_name, 
                    profile_pic_url, comments, is_blocked
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
                this.client_id,
                this.phone_number,
                this.name,
                this.custom_name,
                this.profile_pic_url,
                this.comments,
                this.is_blocked ? 1 : 0
            ];

            const result = await executeQuery(query, values);
            this.id = result.insertId;

            console.log(`✅ Contact created with ID: ${this.id}`);
            return this;

        } catch (error) {
            console.error('❌ Error creating contact:', error.message);
            throw error;
        }
    }

    /**
     * Actualizar contacto existente
     */
    async update() {
        try {
            if (!this.id) {
                throw new Error('ID del contacto es requerido para actualizar');
            }

            // Formatear número de teléfono si se proporciona
            if (this.phone_number) {
                this.phone_number = this.formatPhoneNumber(this.phone_number);
            }

            const query = `
                UPDATE contacts SET 
                    phone_number = COALESCE(?, phone_number),
                    name = COALESCE(?, name),
                    custom_name = COALESCE(?, custom_name),
                    profile_pic_url = COALESCE(?, profile_pic_url),
                    comments = COALESCE(?, comments),
                    is_blocked = COALESCE(?, is_blocked),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND client_id = ?
            `;

            const values = [
                this.phone_number,
                this.name,
                this.custom_name,
                this.profile_pic_url,
                this.comments,
                this.is_blocked !== null ? (this.is_blocked ? 1 : 0) : null,
                this.id,
                this.client_id
            ];

            const result = await executeQuery(query, values);

            if (result.affectedRows === 0) {
                throw new Error('Contacto no encontrado o no autorizado');
            }

            console.log(`✅ Contact updated: ${this.id}`);
            return this;

        } catch (error) {
            console.error('❌ Error updating contact:', error.message);
            throw error;
        }
    }

    /**
     * Eliminar contacto
     */
    async delete() {
        try {
            if (!this.id || !this.client_id) {
                throw new Error('ID del contacto y client_id son requeridos');
            }

            // Eliminar relaciones con tags primero
            await executeQuery(
                'DELETE FROM contact_tag_relations WHERE contact_id = ?',
                [this.id]
            );

            // Eliminar contacto
            const query = 'DELETE FROM contacts WHERE id = ? AND client_id = ?';
            const result = await executeQuery(query, [this.id, this.client_id]);

            if (result.affectedRows === 0) {
                throw new Error('Contacto no encontrado o no autorizado');
            }

            console.log(`✅ Contact deleted: ${this.id}`);
            return true;

        } catch (error) {
            console.error('❌ Error deleting contact:', error.message);
            throw error;
        }
    }

    /**
     * Buscar contacto por ID
     */
    static async findById(id, clientId) {
        try {
            const query = `
                SELECT c.*, 
                    GROUP_CONCAT(
                        JSON_OBJECT(
                            'id', ct.id,
                            'name', ct.name,
                            'color', ct.color
                        )
                    ) as tags_json
                FROM contacts c
                LEFT JOIN contact_tag_relations ctr ON c.id = ctr.contact_id
                LEFT JOIN contact_tags ct ON ctr.tag_id = ct.id
                WHERE c.id = ? AND c.client_id = ?
                GROUP BY c.id
            `;

            const rows = await executeQuery(query, [id, clientId]);

            if (rows.length === 0) {
                return null;
            }

            const contactData = rows[0];
            
            // Parsear tags
            if (contactData.tags_json) {
                try {
                    contactData.tags = JSON.parse(`[${contactData.tags_json}]`);
                } catch (e) {
                    contactData.tags = [];
                }
            } else {
                contactData.tags = [];
            }
            
            delete contactData.tags_json;

            return new Contact(contactData);

        } catch (error) {
            console.error('❌ Error finding contact by ID:', error.message);
            throw error;
        }
    }

    /**
     * Buscar contacto por número de teléfono
     */
    static async findByPhone(phoneNumber, clientId) {
        try {
            const formattedPhone = Contact.formatPhoneNumber(phoneNumber);
            
            const query = `
                SELECT * FROM contacts 
                WHERE phone_number = ? AND client_id = ?
            `;

            const rows = await executeQuery(query, [formattedPhone, clientId]);

            if (rows.length === 0) {
                return null;
            }

            return new Contact(rows[0]);

        } catch (error) {
            console.error('❌ Error finding contact by phone:', error.message);
            throw error;
        }
    }

    /**
     * Obtener o crear contacto (método requerido por Conversation.findOrCreate)
     * @param {number} clientId - ID del cliente
     * @param {string} phoneNumber - Número de teléfono
     * @param {string} name - Nombre del contacto (opcional)
     * @returns {Promise<Contact>} Contacto existente o nuevo
     */
    static async findOrCreate(clientId, phoneNumber, name = null) {
        try {
            const cleanPhone = Contact.formatPhoneNumber(phoneNumber);
            
            console.log(`🔍 Looking for contact: client_id=${clientId}, phone=${cleanPhone}`);
            
            // Buscar contacto existente
            let contact = await this.findByPhone(cleanPhone, clientId);
            
            if (!contact) {
                console.log(`📝 Creating new contact for ${cleanPhone}`);
                
                // Crear nuevo contacto
                contact = new Contact({
                    client_id: clientId,
                    phone_number: cleanPhone,
                    name: name || cleanPhone.split('@')[0] // Usar número como nombre por defecto
                });
                
                await contact.create();
                console.log(`✅ Contact created with ID: ${contact.id}`);
            } else {
                console.log(`✅ Found existing contact: ID ${contact.id}`);
                
                // Actualizar nombre si no existe y se proporciona uno
                if (name && !contact.name) {
                    contact.name = name;
                    await contact.update();
                    console.log(`✅ Updated contact name to: ${name}`);
                }
            }
            
            return contact;
        } catch (error) {
            console.error('❌ Error en Contact.findOrCreate:', error.message);
            throw error;
        }
    }

    /**
     * Listar contactos con filtros y paginación
     */
    static async findAll(clientId, options = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                search = '',
                blocked = null,
                tagId = null,
                tagIds = null,
                tagAssignedFrom = null,
                tagAssignedTo = null,
                sortBy = 'created_at',
                sortOrder = 'DESC'
            } = options;

            const offset = (page - 1) * limit;
            
            let whereConditions = ['c.client_id = ?'];
            let queryParams = [clientId];

            // Filtro de búsqueda
            if (search.trim()) {
                whereConditions.push(`(
                    c.name LIKE ? OR 
                    c.custom_name LIKE ? OR 
                    c.phone_number LIKE ? OR 
                    c.comments LIKE ?
                )`);
                const searchTerm = `%${search}%`;
                queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
            }

            // Filtro de bloqueados
            if (blocked !== null) {
                whereConditions.push('c.is_blocked = ?');
                queryParams.push(blocked ? 1 : 0);
            }

            // Filtro por tags (individual o múltiples)
            let joinClause = '';
            let tagFilterApplied = false;
            
            if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
                // Filtro por múltiples etiquetas
                joinClause = 'INNER JOIN contact_tag_relations ctr ON c.id = ctr.contact_id';
                const placeholders = tagIds.map(() => '?').join(',');
                whereConditions.push(`ctr.tag_id IN (${placeholders})`);
                queryParams.push(...tagIds);
                tagFilterApplied = true;
                
                // Filtro por fecha de asignación de etiquetas
                if (tagAssignedFrom) {
                    whereConditions.push('ctr.created_at >= ?');
                    queryParams.push(tagAssignedFrom + ' 00:00:00');
                }
                if (tagAssignedTo) {
                    whereConditions.push('ctr.created_at <= ?');
                    queryParams.push(tagAssignedTo + ' 23:59:59');
                }
                
            } else if (tagId) {
                // Filtro por etiqueta individual (retrocompatibilidad)
                joinClause = 'INNER JOIN contact_tag_relations ctr ON c.id = ctr.contact_id';
                whereConditions.push('ctr.tag_id = ?');
                queryParams.push(tagId);
                tagFilterApplied = true;
                
                // Filtro por fecha de asignación de etiquetas
                if (tagAssignedFrom) {
                    whereConditions.push('ctr.created_at >= ?');
                    queryParams.push(tagAssignedFrom + ' 00:00:00');
                }
                if (tagAssignedTo) {
                    whereConditions.push('ctr.created_at <= ?');
                    queryParams.push(tagAssignedTo + ' 23:59:59');
                }
            }

            // Validar campos de ordenamiento
            const validSortFields = ['created_at', 'updated_at', 'name', 'custom_name', 'last_message_at', 'phone_number'];
            const validSortOrders = ['ASC', 'DESC'];
            
            const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';
            const safeSortOrder = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

            // Construir query principal con paginación
            const selectClause = tagFilterApplied ? 'SELECT DISTINCT' : 'SELECT';
            const query = `
                ${selectClause} c.id, c.client_id, c.phone_number, c.name, c.custom_name, 
                       c.profile_pic_url, c.comments, c.is_blocked, c.last_message_at,
                       c.created_at, c.updated_at
                FROM contacts c
                ${joinClause}
                WHERE ${whereConditions.join(' AND ')}
                ORDER BY c.${safeSortBy} ${safeSortOrder}
                LIMIT ${limit} OFFSET ${offset}
            `;

            // No agregamos limit y offset a queryParams, los interpolamos directamente

            // Logs removidos para producción

            const rows = await executeQuery(query, queryParams);

            // Cargar tags para cada contacto de manera separada
            const contacts = [];
            for (const row of rows) {
                // Obtener tags del contacto con fecha de asignación
                const tagsQuery = `
                    SELECT ct.id, ct.name, ct.color, ct.description, 
                           ctr.created_at as assigned_at
                    FROM contact_tags ct
                    INNER JOIN contact_tag_relations ctr ON ct.id = ctr.tag_id
                    WHERE ctr.contact_id = ? AND ct.client_id = ?
                    ORDER BY ct.name ASC
                `;
                
                const tagsResult = await executeQuery(tagsQuery, [row.id, clientId]);
                row.tags = tagsResult || [];
                
                contacts.push(new Contact(row));
            }

            // Contar total para paginación (simplificado)
            const countQuery = `
                SELECT COUNT(DISTINCT c.id) as total
                FROM contacts c
                ${joinClause}
                WHERE ${whereConditions.join(' AND ')}
            `;
            
            // Logs removidos para producción
            
            const countResult = await executeQuery(countQuery, queryParams);
            const total = countResult[0].total;

            return {
                contacts,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: parseInt(total),
                    pages: Math.ceil(total / limit)
                }
            };

        } catch (error) {
            console.error('❌ Error finding contacts:', error.message);
            throw error;
        }
    }

    /**
     * Formatear número de teléfono a formato estándar
     */
    static formatPhoneNumber(phone) {
        if (!phone) return null;
        
        // Remover caracteres no numéricos
        let cleaned = phone.replace(/\D/g, '');
        
        // Si empieza con 54 (Argentina), mantenerlo
        // Si empieza con 9, agregar 54
        // Si no tiene código de país, agregar 549
        if (cleaned.startsWith('54')) {
            return cleaned;
        } else if (cleaned.startsWith('9')) {
            return '54' + cleaned;
        } else {
            return '549' + cleaned;
        }
    }

    /**
     * Actualizar timestamp del último mensaje
     */
    async updateLastMessageAt() {
        try {
            if (!this.id || !this.client_id) {
                throw new Error('ID del contacto y client_id son requeridos');
            }

            const query = `
                UPDATE contacts SET 
                    last_message_at = CURRENT_TIMESTAMP
                WHERE id = ? AND client_id = ?
            `;

            await executeQuery(query, [this.id, this.client_id]);

        } catch (error) {
            console.error('❌ Error updating last message timestamp:', error.message);
            throw error;
        }
    }

    /**
     * Formatear número de teléfono de instancia
     */
    formatPhoneNumber(phone) {
        return Contact.formatPhoneNumber(phone);
    }
}

module.exports = Contact;