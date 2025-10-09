const MessageTemplate = require('../entities/MessageTemplate');
const { executeQuery } = require('../config/database-simple');

// ============================================================================
// TEMPLATE CONTROLLER - CRM CONDORITO
// ============================================================================

class TemplateController {

    /**
     * GET /api/messages/templates
     * Obtener lista de templates del cliente con filtros y paginación
     */
    static async getTemplates(req, res, next) {
        try {
            const clientId = req.user.id;
            const {
                page = 1,
                limit = 20,
                search = '',
                category = null,
                is_active = null,
                sortBy = 'created_at',
                sortOrder = 'DESC'
            } = req.query;

            // Validar parámetros
            const validSortFields = ['created_at', 'updated_at', 'name', 'category', 'usage_count'];
            const validSortOrders = ['ASC', 'DESC'];

            if (!validSortFields.includes(sortBy)) {
                return res.status(400).json({
                    success: false,
                    message: `Campo de ordenamiento inválido. Válidos: ${validSortFields.join(', ')}`
                });
            }

            if (!validSortOrders.includes(sortOrder.toUpperCase())) {
                return res.status(400).json({
                    success: false,
                    message: 'Orden inválido. Válidos: ASC, DESC'
                });
            }

            // Usar consulta directa en lugar de la entidad
            const { executeQuery } = require('../config/database-simple');
            
            const pageNum = parseInt(page);
            const limitNum = Math.min(parseInt(limit), 100);
            const offset = (pageNum - 1) * limitNum;

            // Construir WHERE clause
            let whereClause = 'WHERE client_id = ?';
            let queryParams = [parseInt(clientId)];

            // Filtro de búsqueda
            if (search && search.trim()) {
                whereClause += ' AND (name LIKE ? OR content LIKE ?)';
                const searchTerm = `%${search.trim()}%`;
                queryParams.push(searchTerm, searchTerm);
            }

            // Filtro de categoría
            if (category) {
                whereClause += ' AND category = ?';
                queryParams.push(category);
            }

            // Filtro de estado activo
            if (is_active !== null) {
                whereClause += ' AND is_active = ?';
                queryParams.push(is_active === 'true' ? 1 : 0);
            }

            // Validar y construir ORDER BY
            const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';
            const finalSortOrder = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

            // Query principal
            const query = `SELECT * FROM message_templates ${whereClause} ORDER BY ${finalSortBy} ${finalSortOrder} LIMIT ${limitNum} OFFSET ${offset}`;
            const templates = await executeQuery(query, queryParams);

            // Contar total
            const countQuery = `SELECT COUNT(*) as total FROM message_templates ${whereClause}`;
            const countResult = await executeQuery(countQuery, queryParams);
            const total = countResult[0].total;

            // Procesar variables JSON
            const processedTemplates = templates.map(template => {
                if (template.variables) {
                    try {
                        template.variables = JSON.parse(template.variables);
                    } catch (e) {
                        template.variables = [];
                    }
                } else {
                    template.variables = [];
                }
                return template;
            });

            res.json({
                success: true,
                templates: processedTemplates,
                total: parseInt(total),
                page: pageNum,
                limit: limitNum,
                total_pages: Math.ceil(total / limitNum)
            });

        } catch (error) {
            console.error('❌ Error in TemplateController.getTemplates:', error.message);
            next(error);
        }
    }

    /**
     * GET /api/messages/templates/:id
     * Obtener template específico por ID
     */
    static async getTemplateById(req, res, next) {
        try {
            const clientId = req.user.id;
            const templateId = parseInt(req.params.id);

            if (!templateId || isNaN(templateId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de template inválido'
                });
            }

            const template = await MessageTemplate.findById(templateId);

            if (!template || template.client_id !== clientId) {
                return res.status(404).json({
                    success: false,
                    message: 'Template no encontrado'
                });
            }

            res.json({
                success: true,
                template: template
            });

        } catch (error) {
            console.error('❌ Error in TemplateController.getTemplateById:', error.message);
            next(error);
        }
    }

    /**
     * POST /api/messages/templates
     * Crear nuevo template
     */
    static async createTemplate(req, res, next) {
        try {
            const clientId = req.user.id;
            const {
                name,
                content,
                variables = [],
                category = 'general',
                is_active = true
            } = req.body;

            // Validar datos requeridos
            if (!name || !name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Nombre del template es requerido'
                });
            }

            if (!content || !content.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Contenido del template es requerido'
                });
            }

            // Verificar estructura de la tabla (debug)
            try {
                const tableCheck = await executeQuery('DESCRIBE message_templates');
                console.log('📋 Table structure:', tableCheck);
            } catch (tableError) {
                console.error('❌ Table check error:', tableError.message);
                return res.status(500).json({
                    success: false,
                    message: 'Error de base de datos: tabla no existe'
                });
            }

            // Verificar que no existe un template con el mismo nombre
            const existingTemplate = await executeQuery(
                'SELECT id FROM message_templates WHERE client_id = ? AND name = ?',
                [clientId, name.trim()]
            );

            if (existingTemplate.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'Ya existe un template con este nombre'
                });
            }

            // Crear nuevo template
            console.log('🔄 TemplateController: Creating template for client:', clientId);
            const createdTemplate = await MessageTemplate.create({
                client_id: clientId,
                name: name.trim(),
                content: content.trim(),
                variables: Array.isArray(variables) ? variables : [],
                category,
                is_active: Boolean(is_active)
            });

            console.log('✅ TemplateController: Template created successfully:', createdTemplate);

            res.status(201).json({
                success: true,
                message: 'Template creado exitosamente',
                template: createdTemplate
            });

        } catch (error) {
            console.error('❌ Error in TemplateController.createTemplate:', error.message);
            next(error);
        }
    }

    /**
     * PUT /api/messages/templates/:id
     * Actualizar template existente
     */
    static async updateTemplate(req, res, next) {
        try {
            const clientId = req.user.id;
            const templateId = parseInt(req.params.id);
            const {
                name,
                content,
                variables,
                category,
                is_active
            } = req.body;

            if (!templateId || isNaN(templateId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de template inválido'
                });
            }

            // Verificar que el template existe
            const existingTemplate = await MessageTemplate.findById(templateId);
            if (!existingTemplate || existingTemplate.client_id !== clientId) {
                return res.status(404).json({
                    success: false,
                    message: 'Template no encontrado'
                });
            }

            // Si se está actualizando el nombre, verificar que no exista otro template con ese nombre
            if (name && name.trim() !== existingTemplate.name) {
                const duplicateTemplate = await executeQuery(
                    'SELECT id FROM message_templates WHERE client_id = ? AND name = ? AND id != ?',
                    [clientId, name.trim(), templateId]
                );

                if (duplicateTemplate.length > 0) {
                    return res.status(409).json({
                        success: false,
                        message: 'Ya existe otro template con este nombre'
                    });
                }
            }

            // Preparar datos de actualización
            const updateData = {};
            if (name !== undefined) updateData.name = name.trim();
            if (content !== undefined) updateData.content = content.trim();
            if (variables !== undefined) updateData.variables = Array.isArray(variables) ? variables : [];
            if (category !== undefined) updateData.category = category;
            if (is_active !== undefined) updateData.is_active = Boolean(is_active);

            // Actualizar template
            const updatedTemplate = await MessageTemplate.update(templateId, updateData);

            res.json({
                success: true,
                message: 'Template actualizado exitosamente',
                template: updatedTemplate
            });

        } catch (error) {
            console.error('❌ Error in TemplateController.updateTemplate:', error.message);
            next(error);
        }
    }

    /**
     * DELETE /api/messages/templates/:id
     * Eliminar template
     */
    static async deleteTemplate(req, res, next) {
        try {
            const clientId = req.user.id;
            const templateId = parseInt(req.params.id);

            if (!templateId || isNaN(templateId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de template inválido'
                });
            }

            // Verificar que el template existe
            const template = await MessageTemplate.findById(templateId);
            if (!template || template.client_id !== clientId) {
                return res.status(404).json({
                    success: false,
                    message: 'Template no encontrado'
                });
            }

            // Eliminar template
            const deleted = await MessageTemplate.delete(templateId);
            
            if (!deleted) {
                return res.status(500).json({
                    success: false,
                    message: 'Error al eliminar el template'
                });
            }

            res.json({
                success: true,
                message: 'Template eliminado exitosamente'
            });

        } catch (error) {
            console.error('❌ Error in TemplateController.deleteTemplate:', error.message);
            next(error);
        }
    }

    /**
     * POST /api/messages/templates/:id/preview
     * Generar preview del template con variables personalizadas
     */
    static async previewTemplate(req, res, next) {
        try {
            const clientId = req.user.id;
            const templateId = parseInt(req.params.id);
            const { variables = {} } = req.body;

            if (!templateId || isNaN(templateId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de template inválido'
                });
            }

            // Obtener template
            const template = await MessageTemplate.findById(templateId);
            if (!template || template.client_id !== clientId) {
                return res.status(404).json({
                    success: false,
                    message: 'Template no encontrado'
                });
            }

            // Procesar template con variables
            let previewContent = template.content;
            for (const [key, value] of Object.entries(variables)) {
                const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
                previewContent = previewContent.replace(regex, value);
            }

            // Extraer variables del contenido
            const variableRegex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
            const extractedVariables = [...template.content.matchAll(variableRegex)].map(match => match[1]);
            const uniqueVariables = [...new Set(extractedVariables)];

            res.json({
                success: true,
                preview_content: previewContent,
                original_content: template.content,
                variables_used: variables,
                extracted_variables: uniqueVariables
            });

        } catch (error) {
            console.error('❌ Error in TemplateController.previewTemplate:', error.message);
            next(error);
        }
    }

    /**
     * POST /api/messages/templates/:id/use
     * Usar template (incrementar contador de uso)
     */
    static async useTemplate(req, res, next) {
        try {
            const clientId = req.user.id;
            const templateId = parseInt(req.params.id);
            const { variables = {} } = req.body;

            if (!templateId || isNaN(templateId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de template inválido'
                });
            }

            // Obtener template
            const template = await MessageTemplate.findById(templateId);
            if (!template || template.client_id !== clientId) {
                return res.status(404).json({
                    success: false,
                    message: 'Template no encontrado'
                });
            }

            if (!template.is_active) {
                return res.status(400).json({
                    success: false,
                    message: 'Template no está activo'
                });
            }

            // Procesar template con variables
            let processedContent = template.content;
            for (const [key, value] of Object.entries(variables)) {
                const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
                processedContent = processedContent.replace(regex, value);
            }

            // Incrementar contador de uso
            await MessageTemplate.incrementUsage(templateId);

            // Obtener template actualizado para devolver el nuevo usage_count
            const updatedTemplate = await MessageTemplate.findById(templateId);

            res.json({
                success: true,
                message: 'Template procesado exitosamente',
                template_id: template.id,
                template_name: template.name,
                original_content: template.content,
                processed_content: processedContent,
                variables_used: variables,
                usage_count: updatedTemplate.usage_count
            });

        } catch (error) {
            console.error('❌ Error in TemplateController.useTemplate:', error.message);
            next(error);
        }
    }

    /**
     * GET /api/messages/templates/categories
     * Obtener categorías disponibles
     */
    static async getCategories(req, res, next) {
        try {
            const clientId = req.user.id;
            const categories = await MessageTemplate.getCategories(clientId);

            res.json({
                success: true,
                categories: categories
            });

        } catch (error) {
            console.error('❌ Error in TemplateController.getCategories:', error.message);
            next(error);
        }
    }

    /**
     * GET /api/messages/templates/stats
     * Obtener estadísticas de uso de templates
     */
    static async getTemplateStats(req, res, next) {
        try {
            const clientId = req.user.id;

            const stats = await MessageTemplate.getStats(clientId);

            res.json({
                success: true,
                stats: stats
            });

        } catch (error) {
            console.error('❌ Error in TemplateController.getTemplateStats:', error.message);
            next(error);
        }
    }

    /**
     * POST /api/messages/templates/duplicate/:id
     * Duplicar template existente
     */
    static async duplicateTemplate(req, res, next) {
        try {
            const clientId = req.user.id;
            const templateId = parseInt(req.params.id);
            const { name_suffix = 'Copia' } = req.body;

            if (!templateId || isNaN(templateId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de template inválido'
                });
            }

            // Obtener template original
            const originalTemplate = await MessageTemplate.findById(templateId);
            if (!originalTemplate || originalTemplate.client_id !== clientId) {
                return res.status(404).json({
                    success: false,
                    message: 'Template no encontrado'
                });
            }

            // Generar nombre único para la copia
            const { new_name } = req.body;
            let newName = new_name || `${originalTemplate.name} (Copia)`;
            let counter = 1;
            
            while (true) {
                const existingTemplate = await executeQuery(
                    'SELECT id FROM message_templates WHERE client_id = ? AND name = ?',
                    [clientId, newName]
                );

                if (existingTemplate.length === 0) {
                    break;
                }

                if (new_name) {
                    newName = `${new_name} (${counter})`;
                } else {
                    newName = `${originalTemplate.name} (Copia ${counter})`;
                }
                counter++;
            }

            // Crear template duplicado
            const duplicatedTemplate = await MessageTemplate.create({
                client_id: clientId,
                name: newName,
                content: originalTemplate.content,
                variables: originalTemplate.variables,
                category: originalTemplate.category,
                is_active: true // Activar por defecto
            });

            res.status(201).json({
                success: true,
                message: 'Template duplicado exitosamente',
                template: duplicatedTemplate
            });

        } catch (error) {
            console.error('❌ Error in TemplateController.duplicateTemplate:', error.message);
            next(error);
        }
    }

    /**
     * PUT /api/messages/templates/:id/toggle
     * Activar/desactivar template
     */
    static async toggleTemplate(req, res, next) {
        try {
            const clientId = req.user.id;
            const templateId = parseInt(req.params.id);

            if (!templateId || isNaN(templateId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de template inválido'
                });
            }

            // Obtener template actual
            const template = await MessageTemplate.findById(templateId);
            if (!template || template.client_id !== clientId) {
                return res.status(404).json({
                    success: false,
                    message: 'Template no encontrado'
                });
            }

            // Cambiar estado
            const newActiveState = !template.is_active;
            const updatedTemplate = await MessageTemplate.update(templateId, {
                is_active: newActiveState
            });

            res.json({
                success: true,
                message: `Template ${newActiveState ? 'activado' : 'desactivado'} exitosamente`,
                template: updatedTemplate
            });

        } catch (error) {
            console.error('❌ Error in TemplateController.toggleTemplate:', error.message);
            next(error);
        }
    }
}

module.exports = TemplateController;
