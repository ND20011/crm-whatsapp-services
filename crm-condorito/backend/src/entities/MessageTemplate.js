const { executeQuery } = require('../config/database-simple');

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
            console.log('🔄 Creating template with data:', templateData);
            
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
            console.log('🔄 Executing INSERT query...');
            
            const result = await executeQuery(query, [client_id, name, content, variablesJson, category, is_active]);
            console.log('✅ INSERT result:', result);

            if (!result.insertId) {
                throw new Error('No insertId returned from database');
            }

            console.log('🔄 Finding created template by ID:', result.insertId);
            const createdTemplate = await MessageTemplate.findById(result.insertId);
            console.log('✅ Created template found:', createdTemplate);

            return createdTemplate;

        } catch (error) {
            console.error('❌ Error creating template:', error.message);
            console.error('❌ Stack trace:', error.stack);
            throw error;
        }
    }

    /**
     * Buscar template por ID
     */
    static async findById(id) {
        try {
            console.log('🔄 Finding template by ID:', id);
            const query = 'SELECT * FROM message_templates WHERE id = ?';
            const rows = await executeQuery(query, [id]);
            console.log('✅ Query result rows:', rows.length);

            if (rows.length === 0) {
                console.log('⚠️ Template not found');
                return null;
            }

            const templateData = rows[0];
            console.log('✅ Template data found:', templateData);
            
            // Parsear variables JSON
            if (templateData.variables) {
                try {
                    templateData.variables = JSON.parse(templateData.variables);
                } catch (e) {
                    console.warn('⚠️ Error parsing variables JSON:', e.message);
                    templateData.variables = [];
                }
            } else {
                templateData.variables = [];
            }

            const template = new MessageTemplate(templateData);
            console.log('✅ Template instance created:', template);
            return template;

        } catch (error) {
            console.error('❌ Error finding template by ID:', error.message);
            console.error('❌ Stack trace:', error.stack);
            throw error;
        }
    }

    /**
     * Listar templates con filtros completos
     */
    static async findAll(clientId, options = {}) {
        try {
            console.log('🔄 MessageTemplate.findAll called with:', { clientId, options });
            console.log('🔄 clientId type:', typeof clientId, 'value:', clientId);
            
            // PRUEBA SIMPLE PRIMERO
            const simpleQuery = 'SELECT * FROM message_templates WHERE client_id = ? LIMIT 10';
            const simpleParams = [parseInt(clientId)];
            
            console.log('🔄 Simple Query:', simpleQuery);
            console.log('🔄 Simple Params:', simpleParams);
            
            const rows = await executeQuery(simpleQuery, simpleParams);
            console.log('✅ Query executed successfully, rows:', rows.length);

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

            // Contar total simple
            const countQuery = 'SELECT COUNT(*) as total FROM message_templates WHERE client_id = ?';
            const countResult = await executeQuery(countQuery, [parseInt(clientId)]);
            const total = countResult[0].total;

            return {
                templates,
                pagination: {
                    page: 1,
                    limit: 10,
                    total: parseInt(total),
                    totalPages: Math.ceil(total / 10),
                    hasNext: false,
                    hasPrev: false
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
