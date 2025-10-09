const { executeQuery } = require('../config/database-simple');

// ============================================================================
// MESSAGE TEMPLATE ENTITY - CRM CONDORITO
// ============================================================================

class MessageTemplate {
    constructor(data = {}) {
        this.id = data.id || null;
        this.client_id = data.client_id || null;
        this.name = data.name || null;
        this.content = data.content || null;
        this.variables = data.variables || [];
        this.category = data.category || 'general';
        this.is_active = data.is_active !== undefined ? data.is_active : true;
        this.usage_count = data.usage_count || 0;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
    }

    /**
     * Crear nuevo template
     */
    async create() {
        try {
            // Validar datos requeridos
            if (!this.client_id || !this.name || !this.content) {
                throw new Error('client_id, name y content son requeridos');
            }

            // Validar categoría
            if (!this.isValidCategory(this.category)) {
                throw new Error('Categoría inválida');
            }

            const query = `
                INSERT INTO message_templates (
                    client_id, name, content, variables, category, is_active
                ) VALUES (?, ?, ?, ?, ?, ?)
            `;

            const values = [
                this.client_id,
                this.name.trim(),
                this.content.trim(),
                JSON.stringify(this.variables || []),
                this.category,
                this.is_active ? 1 : 0
            ];

            const result = await executeQuery(query, values);
            this.id = result.insertId;

            console.log(`✅ Template created with ID: ${this.id}`);
            return this;

        } catch (error) {
            console.error('❌ Error creating template:', error.message);
            throw error;
        }
    }

    /**
     * Actualizar template existente
     */
    async update() {
        try {
            if (!this.id) {
                throw new Error('ID del template es requerido para actualizar');
            }

            // Validar categoría si se proporciona
            if (this.category && !this.isValidCategory(this.category)) {
                throw new Error('Categoría inválida');
            }

            const query = `
                UPDATE message_templates SET 
                    name = COALESCE(?, name),
                    content = COALESCE(?, content),
                    variables = COALESCE(?, variables),
                    category = COALESCE(?, category),
                    is_active = COALESCE(?, is_active),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND client_id = ?
            `;

            const values = [
                this.name ? this.name.trim() : null,
                this.content ? this.content.trim() : null,
                this.variables ? JSON.stringify(this.variables) : null,
                this.category,
                this.is_active !== null ? (this.is_active ? 1 : 0) : null,
                this.id,
                this.client_id
            ];

            const result = await executeQuery(query, values);

            if (result.affectedRows === 0) {
                throw new Error('Template no encontrado o no autorizado');
            }

            console.log(`✅ Template updated: ${this.id}`);
            return this;

        } catch (error) {
            console.error('❌ Error updating template:', error.message);
            throw error;
        }
    }

    /**
     * Eliminar template
     */
    async delete() {
        try {
            if (!this.id || !this.client_id) {
                throw new Error('ID del template y client_id son requeridos');
            }

            const query = 'DELETE FROM message_templates WHERE id = ? AND client_id = ?';
            const result = await executeQuery(query, [this.id, this.client_id]);

            if (result.affectedRows === 0) {
                throw new Error('Template no encontrado o no autorizado');
            }

            console.log(`✅ Template deleted: ${this.id}`);
            return true;

        } catch (error) {
            console.error('❌ Error deleting template:', error.message);
            throw error;
        }
    }

    /**
     * Buscar template por ID
     */
    static async findById(id, clientId) {
        try {
            const query = 'SELECT * FROM message_templates WHERE id = ? AND client_id = ?';
            const rows = await executeQuery(query, [id, clientId]);

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
     * Listar templates con filtros y paginación
     */
    static async findAll(clientId, options = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                search = '',
                category = null,
                is_active = null,
                sortBy = 'created_at',
                sortOrder = 'DESC'
            } = options;

            const offset = (page - 1) * limit;
            
            let whereConditions = ['client_id = ?'];
            let queryParams = [clientId];

            // Filtro de búsqueda
            if (search && search.trim()) {
                whereConditions.push('(name LIKE ? OR content LIKE ?)');
                const searchTerm = `%${search}%`;
                queryParams.push(searchTerm, searchTerm);
            }

            // Filtro de categoría
            if (category && category !== 'all') {
                whereConditions.push('category = ?');
                queryParams.push(category);
            }

            // Filtro de estado activo
            if (is_active !== null) {
                whereConditions.push('is_active = ?');
                queryParams.push(is_active ? 1 : 0);
            }

            // Construir query principal - simplificado
            const query = `
                SELECT * FROM message_templates
                WHERE client_id = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `;

            const simpleParams = [clientId, limit, offset];

            const rows = await executeQuery(query, simpleParams);

            // Procesar variables JSON para cada template
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

            // Contar total para paginación - simplificado
            const countQuery = `
                SELECT COUNT(*) as total
                FROM message_templates
                WHERE client_id = ?
            `;
            
            const countResult = await executeQuery(countQuery, [clientId]);
            const total = countResult[0].total;

            return {
                templates,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: parseInt(total),
                    pages: Math.ceil(total / limit)
                }
            };

        } catch (error) {
            console.error('❌ Error finding templates:', error.message);
            throw error;
        }
    }

    /**
     * Obtener estadísticas de uso de templates
     */
    static async getUsageStats(clientId) {
        try {
            const query = `
                SELECT 
                    category,
                    COUNT(*) as total_templates,
                    SUM(usage_count) as total_usage,
                    AVG(usage_count) as avg_usage_per_template,
                    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_templates
                FROM message_templates 
                WHERE client_id = ?
                GROUP BY category
                ORDER BY total_usage DESC
            `;

            const stats = await executeQuery(query, [clientId]);

            // Obtener totales generales
            const totalQuery = `
                SELECT 
                    COUNT(*) as total_templates,
                    SUM(usage_count) as total_usage,
                    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_templates,
                    COUNT(DISTINCT category) as total_categories
                FROM message_templates 
                WHERE client_id = ?
            `;

            const totals = await executeQuery(totalQuery, [clientId]);

            return {
                by_category: stats,
                totals: totals[0]
            };

        } catch (error) {
            console.error('❌ Error getting template stats:', error.message);
            throw error;
        }
    }

    /**
     * Incrementar contador de uso
     */
    async incrementUsage() {
        try {
            if (!this.id || !this.client_id) {
                throw new Error('ID del template y client_id son requeridos');
            }

            const query = `
                UPDATE message_templates 
                SET usage_count = usage_count + 1
                WHERE id = ? AND client_id = ?
            `;

            await executeQuery(query, [this.id, this.client_id]);
            this.usage_count = (this.usage_count || 0) + 1;

        } catch (error) {
            console.error('❌ Error incrementing template usage:', error.message);
            throw error;
        }
    }

    /**
     * Procesar template con variables
     */
    processTemplate(variables = {}) {
        try {
            let processedContent = this.content;

            // Reemplazar variables estándar
            const standardVariables = this.getStandardVariables();
            Object.assign(variables, standardVariables);

            // Reemplazar todas las variables en el contenido
            Object.keys(variables).forEach(key => {
                const regex = new RegExp(`\\{${key}\\}`, 'g');
                processedContent = processedContent.replace(regex, variables[key] || `{${key}}`);
            });

            return processedContent;

        } catch (error) {
            console.error('❌ Error processing template:', error.message);
            return this.content;
        }
    }

    /**
     * Obtener preview del template con variables de ejemplo
     */
    getPreview(customVariables = {}) {
        const exampleVariables = {
            nombre: 'Juan Pérez',
            empresa: 'Mi Empresa',
            telefono: '+54 9 11 1234-5678',
            numero_pedido: '12345',
            tiempo_estimado: '24-48 horas',
            fecha: new Date().toLocaleDateString('es-AR'),
            hora: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
            ...customVariables
        };

        return this.processTemplate(exampleVariables);
    }

    /**
     * Extraer variables del contenido del template
     */
    extractVariables() {
        try {
            const variableRegex = /\{([^}]+)\}/g;
            const variables = [];
            let match;

            while ((match = variableRegex.exec(this.content)) !== null) {
                const variable = match[1];
                if (!variables.includes(variable)) {
                    variables.push(variable);
                }
            }

            return variables;

        } catch (error) {
            console.error('❌ Error extracting variables:', error.message);
            return [];
        }
    }

    /**
     * Obtener variables estándar del sistema
     */
    getStandardVariables() {
        const now = new Date();
        return {
            fecha: now.toLocaleDateString('es-AR'),
            hora: now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
            fecha_completa: now.toLocaleDateString('es-AR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            }),
            año: now.getFullYear().toString(),
            mes: (now.getMonth() + 1).toString().padStart(2, '0'),
            dia: now.getDate().toString().padStart(2, '0')
        };
    }

    /**
     * Validar categoría
     */
    isValidCategory(category) {
        const validCategories = [
            'general', 'saludo', 'despedida', 'confirmacion', 
            'seguimiento', 'promocion', 'soporte', 'automatico',
            'ventas', 'marketing', 'recordatorio'
        ];
        return validCategories.includes(category);
    }

    /**
     * Obtener categorías disponibles
     */
    static getAvailableCategories() {
        return [
            { value: 'general', label: 'General', description: 'Templates de uso general' },
            { value: 'saludo', label: 'Saludo', description: 'Mensajes de bienvenida' },
            { value: 'despedida', label: 'Despedida', description: 'Mensajes de cierre' },
            { value: 'confirmacion', label: 'Confirmación', description: 'Confirmaciones de pedidos/servicios' },
            { value: 'seguimiento', label: 'Seguimiento', description: 'Mensajes de seguimiento post-venta' },
            { value: 'promocion', label: 'Promoción', description: 'Ofertas y promociones' },
            { value: 'soporte', label: 'Soporte', description: 'Mensajes de soporte técnico' },
            { value: 'automatico', label: 'Automático', description: 'Respuestas automáticas del bot' },
            { value: 'ventas', label: 'Ventas', description: 'Proceso de ventas' },
            { value: 'marketing', label: 'Marketing', description: 'Campañas de marketing' },
            { value: 'recordatorio', label: 'Recordatorio', description: 'Recordatorios y notificaciones' }
        ];
    }
}

module.exports = MessageTemplate;
