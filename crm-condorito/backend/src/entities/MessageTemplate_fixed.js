const { executeQuery } = require('../config/database');

/**
 * Entidad MessageTemplate - VERSIÓN SIMPLIFICADA
 */
class MessageTemplate {
    constructor(data = {}) {
        this.id = data.id || null;
        this.client_id = data.client_id || null;
        this.name = data.name || '';
        this.content = data.content || '';
        this.variables = data.variables || [];
        this.category = data.category || 'general';
        this.is_active = data.is_active || true;
        this.usage_count = data.usage_count || 0;
        this.last_used = data.last_used || null;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
    }

    /**
     * Crear nuevo template
     */
    static async create(templateData) {
        try {
            const {
                client_id,
                name,
                content,
                variables = [],
                category = 'general',
                is_active = true
            } = templateData;

            const query = `
                INSERT INTO message_templates (client_id, name, content, variables, category, is_active)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            const variablesJson = JSON.stringify(variables);
            const result = await executeQuery(query, [client_id, name, content, variablesJson, category, is_active]);

            return await MessageTemplate.findById(result.insertId);

        } catch (error) {
            console.error('❌ Error creating template:', error.message);
            throw error;
        }
    }

    /**
     * Buscar template por ID
     */
    static async findById(id) {
        try {
            const query = 'SELECT * FROM message_templates WHERE id = ?';
            const rows = await executeQuery(query, [id]);

            if (rows.length === 0) {
                return null;
            }

            const templateData = rows[0];
            
            // Parsear variables JSON
            if (templateData.variables) {
                try {
                    templateData.variables = JSON.parse(templateData.variables);
                } catch (e) {
                    templateData.variables = [];
                }
            } else {
                templateData.variables = [];
            }

            return new MessageTemplate(templateData);

        } catch (error) {
            console.error('❌ Error finding template by ID:', error.message);
            throw error;
        }
    }

    /**
     * Listar templates (VERSIÓN SIMPLE)
     */
    static async findAll(clientId, options = {}) {
        try {
            const {
                page = 1,
                limit = 20
            } = options;

            const offset = (page - 1) * limit;

            // Query simple
            const query = `
                SELECT * FROM message_templates
                WHERE client_id = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `;

            const rows = await executeQuery(query, [clientId, limit, offset]);

            // Procesar variables JSON
            const templates = rows.map(row => {
                if (row.variables) {
                    try {
                        row.variables = JSON.parse(row.variables);
                    } catch (e) {
                        row.variables = [];
                    }
                } else {
                    row.variables = [];
                }
                return new MessageTemplate(row);
            });

            // Contar total
            const countResult = await executeQuery('SELECT COUNT(*) as total FROM message_templates WHERE client_id = ?', [clientId]);
            const total = countResult[0].total;

            return {
                templates,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: parseInt(total),
                    totalPages: Math.ceil(total / limit),
                    hasNext: page < Math.ceil(total / limit),
                    hasPrev: page > 1
                }
            };

        } catch (error) {
            console.error('❌ Error finding templates:', error.message);
            throw error;
        }
    }

    /**
     * Actualizar template
     */
    static async update(id, updateData) {
        try {
            const {
                name,
                content,
                variables,
                category,
                is_active
            } = updateData;

            const fields = [];
            const values = [];

            if (name !== undefined) {
                fields.push('name = ?');
                values.push(name);
            }

            if (content !== undefined) {
                fields.push('content = ?');
                values.push(content);
            }

            if (variables !== undefined) {
                fields.push('variables = ?');
                values.push(JSON.stringify(variables));
            }

            if (category !== undefined) {
                fields.push('category = ?');
                values.push(category);
            }

            if (is_active !== undefined) {
                fields.push('is_active = ?');
                values.push(is_active);
            }

            if (fields.length === 0) {
                throw new Error('No fields to update');
            }

            fields.push('updated_at = CURRENT_TIMESTAMP');
            values.push(id);

            const query = `
                UPDATE message_templates 
                SET ${fields.join(', ')}
                WHERE id = ?
            `;

            await executeQuery(query, values);

            return await MessageTemplate.findById(id);

        } catch (error) {
            console.error('❌ Error updating template:', error.message);
            throw error;
        }
    }

    /**
     * Eliminar template
     */
    static async delete(id) {
        try {
            const query = 'DELETE FROM message_templates WHERE id = ?';
            const result = await executeQuery(query, [id]);

            return result.affectedRows > 0;

        } catch (error) {
            console.error('❌ Error deleting template:', error.message);
            throw error;
        }
    }

    /**
     * Incrementar contador de uso
     */
    static async incrementUsage(id) {
        try {
            const query = `
                UPDATE message_templates 
                SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP
                WHERE id = ?
            `;

            await executeQuery(query, [id]);

        } catch (error) {
            console.error('❌ Error incrementing usage:', error.message);
            throw error;
        }
    }

    /**
     * Obtener categorías disponibles
     */
    static async getCategories(clientId) {
        try {
            const query = `
                SELECT DISTINCT category, COUNT(*) as count
                FROM message_templates 
                WHERE client_id = ?
                GROUP BY category
                ORDER BY category
            `;

            const rows = await executeQuery(query, [clientId]);
            return rows;

        } catch (error) {
            console.error('❌ Error getting categories:', error.message);
            throw error;
        }
    }

    /**
     * Obtener estadísticas de templates
     */
    static async getStats(clientId) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_templates,
                    COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_templates,
                    COUNT(CASE WHEN is_active = 0 THEN 1 END) as inactive_templates,
                    SUM(usage_count) as total_usage,
                    AVG(usage_count) as avg_usage_per_template
                FROM message_templates 
                WHERE client_id = ?
            `;

            const result = await executeQuery(query, [clientId]);
            return result[0];

        } catch (error) {
            console.error('❌ Error getting stats:', error.message);
            throw error;
        }
    }
}

module.exports = MessageTemplate;
