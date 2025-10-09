const { executeQuery } = require('../config/database-simple');
const AutoMessageService = require('../services/AutoMessageService');

// ============================================================================
// TAG CONTROLLER - CRM CONDORITO
// ============================================================================

class TagController {

    /**
     * GET /api/contacts/tags
     * Obtener etiquetas de contactos del cliente
     */
    static async getTags(req, res, next) {
        try {
            const clientId = req.user.id;
            const { search = '', sortBy = 'created_at', sortOrder = 'DESC' } = req.query;

            let whereConditions = ['client_id = ?'];
            let queryParams = [clientId];

            // Filtro de búsqueda
            if (search.trim()) {
                whereConditions.push('(name LIKE ? OR description LIKE ?)');
                const searchTerm = `%${search}%`;
                queryParams.push(searchTerm, searchTerm);
            }

            // Validar ordenamiento
            const validSortFields = ['created_at', 'updated_at', 'name'];
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

            const query = `
                SELECT ct.*, COUNT(ctr.contact_id) as contact_count
                FROM contact_tags ct
                LEFT JOIN contact_tag_relations ctr ON ct.id = ctr.tag_id
                WHERE ${whereConditions.join(' AND ')}
                GROUP BY ct.id
                ORDER BY ct.${sortBy} ${sortOrder.toUpperCase()}
            `;

            const tags = await executeQuery(query, queryParams);

            res.json({
                success: true,
                data: tags,
                total: tags.length
            });

        } catch (error) {
            console.error('❌ Error in TagController.getTags:', error.message);
            next(error);
        }
    }

    /**
     * POST /api/contacts/tags
     * Crear nueva etiqueta
     */
    static async createTag(req, res, next) {
        try {
            const clientId = req.user.id;
            const { 
                name, 
                color = '#007bff', 
                description = '',
                // Campos de auto-message
                has_auto_message = false,
                auto_message_template_id = null,
                auto_message_delay_hours = 24,
                auto_message_content = null,
                is_active_auto = true
            } = req.body;

            // Validar datos requeridos
            if (!name || !name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Nombre de la etiqueta es requerido'
                });
            }

            // Validar formato de color (hex)
            const colorRegex = /^#[0-9A-F]{6}$/i;
            if (!colorRegex.test(color)) {
                return res.status(400).json({
                    success: false,
                    message: 'Color debe estar en formato hexadecimal (#RRGGBB)'
                });
            }

            // Validar configuración de auto-message si está habilitada
            if (has_auto_message) {
                // Validar delay (ahora acepta decimales para minutos)
                if (!auto_message_delay_hours || auto_message_delay_hours < 0.1 || auto_message_delay_hours > 168) {
                    return res.status(400).json({
                        success: false,
                        message: 'El retraso debe estar entre 0.1 y 168 horas (6 minutos a 7 días)'
                    });
                }

                // Validar que tenga template O contenido
                if (!auto_message_template_id && (!auto_message_content || !auto_message_content.trim())) {
                    return res.status(400).json({
                        success: false,
                        message: 'Debe especificar un template o contenido del mensaje'
                    });
                }

                // Si hay template, verificar que existe
                if (auto_message_template_id) {
                    const templateExists = await executeQuery(
                        'SELECT id FROM message_templates WHERE id = ? AND client_id = ?',
                        [auto_message_template_id, clientId]
                    );
                    
                    if (templateExists.length === 0) {
                        return res.status(400).json({
                            success: false,
                            message: 'Template de mensaje no encontrado'
                        });
                    }
                }
            }

            // Verificar que no existe una etiqueta con el mismo nombre para este cliente
            const existingTag = await executeQuery(
                'SELECT id FROM contact_tags WHERE client_id = ? AND name = ?',
                [clientId, name.trim()]
            );

            if (existingTag.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'Ya existe una etiqueta con este nombre'
                });
            }

            // Crear etiqueta con campos de auto-message
            const query = `
                INSERT INTO contact_tags (
                    client_id, name, color, description,
                    has_auto_message, auto_message_template_id, 
                    auto_message_delay_hours, auto_message_content, is_active_auto
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
                clientId, 
                name.trim(), 
                color, 
                description.trim(),
                has_auto_message || false,
                auto_message_template_id,
                auto_message_delay_hours || 24,
                auto_message_content ? auto_message_content.trim() : null,
                is_active_auto !== false
            ];
            const result = await executeQuery(query, values);

            // Obtener etiqueta creada
            const createdTag = await executeQuery(
                'SELECT * FROM contact_tags WHERE id = ?',
                [result.insertId]
            );

            res.status(201).json({
                success: true,
                message: 'Etiqueta creada exitosamente',
                data: createdTag[0]
            });

        } catch (error) {
            console.error('❌ Error in TagController.createTag:', error.message);
            next(error);
        }
    }

    /**
     * PUT /api/contacts/tags/:id
     * Actualizar etiqueta
     */
    static async updateTag(req, res, next) {
        try {
            const clientId = req.user.id;
            const tagId = parseInt(req.params.id);
            const { 
                name, 
                color, 
                description,
                // Campos de auto-message
                has_auto_message,
                auto_message_template_id,
                auto_message_delay_hours,
                auto_message_content,
                is_active_auto
            } = req.body;

            if (!tagId || isNaN(tagId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de etiqueta inválido'
                });
            }

            // Verificar que la etiqueta existe y pertenece al cliente
            const existingTag = await executeQuery(
                'SELECT * FROM contact_tags WHERE id = ? AND client_id = ?',
                [tagId, clientId]
            );

            if (existingTag.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Etiqueta no encontrada'
                });
            }

            // Preparar campos a actualizar
            let updateFields = [];
            let updateValues = [];

            if (name && name.trim()) {
                // Verificar que no existe otra etiqueta con el mismo nombre
                const duplicateTag = await executeQuery(
                    'SELECT id FROM contact_tags WHERE client_id = ? AND name = ? AND id != ?',
                    [clientId, name.trim(), tagId]
                );

                if (duplicateTag.length > 0) {
                    return res.status(409).json({
                        success: false,
                        message: 'Ya existe otra etiqueta con este nombre'
                    });
                }

                updateFields.push('name = ?');
                updateValues.push(name.trim());
            }

            if (color) {
                // Validar formato de color
                const colorRegex = /^#[0-9A-F]{6}$/i;
                if (!colorRegex.test(color)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Color debe estar en formato hexadecimal (#RRGGBB)'
                    });
                }

                updateFields.push('color = ?');
                updateValues.push(color);
            }

            if (description !== undefined) {
                updateFields.push('description = ?');
                updateValues.push(description.trim());
            }

            // Manejar campos de auto-message
            if (has_auto_message !== undefined) {
                // Validar configuración si se está habilitando
                if (has_auto_message) {
                    // Validar delay (ahora acepta decimales para minutos)
                    if (auto_message_delay_hours && (auto_message_delay_hours < 0.1 || auto_message_delay_hours > 168)) {
                        return res.status(400).json({
                            success: false,
                            message: 'El retraso debe estar entre 0.1 y 168 horas (6 minutos a 7 días)'
                        });
                    }

                    // Si hay template, verificar que existe
                    if (auto_message_template_id) {
                        const templateExists = await executeQuery(
                            'SELECT id FROM message_templates WHERE id = ? AND client_id = ?',
                            [auto_message_template_id, clientId]
                        );
                        
                        if (templateExists.length === 0) {
                            return res.status(400).json({
                                success: false,
                                message: 'Template de mensaje no encontrado'
                            });
                        }
                    }
                }

                updateFields.push('has_auto_message = ?');
                updateValues.push(has_auto_message || false);
            }

            if (auto_message_template_id !== undefined) {
                updateFields.push('auto_message_template_id = ?');
                updateValues.push(auto_message_template_id);
            }

            if (auto_message_delay_hours !== undefined) {
                updateFields.push('auto_message_delay_hours = ?');
                updateValues.push(auto_message_delay_hours || 24);
            }

            if (auto_message_content !== undefined) {
                updateFields.push('auto_message_content = ?');
                updateValues.push(auto_message_content ? auto_message_content.trim() : null);
            }

            if (is_active_auto !== undefined) {
                updateFields.push('is_active_auto = ?');
                updateValues.push(is_active_auto !== false);
            }

            if (updateFields.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No se proporcionaron campos para actualizar'
                });
            }

            // Actualizar etiqueta
            updateFields.push('updated_at = CURRENT_TIMESTAMP');
            updateValues.push(tagId, clientId);

            const updateQuery = `
                UPDATE contact_tags SET ${updateFields.join(', ')}
                WHERE id = ? AND client_id = ?
            `;

            await executeQuery(updateQuery, updateValues);

            // Obtener etiqueta actualizada
            const updatedTag = await executeQuery(
                'SELECT * FROM contact_tags WHERE id = ? AND client_id = ?',
                [tagId, clientId]
            );

            res.json({
                success: true,
                message: 'Etiqueta actualizada exitosamente',
                data: updatedTag[0]
            });

        } catch (error) {
            console.error('❌ Error in TagController.updateTag:', error.message);
            next(error);
        }
    }

    /**
     * DELETE /api/contacts/tags/:id
     * Eliminar etiqueta
     */
    static async deleteTag(req, res, next) {
        try {
            const clientId = req.user.id;
            const tagId = parseInt(req.params.id);

            if (!tagId || isNaN(tagId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de etiqueta inválido'
                });
            }

            // Verificar que la etiqueta existe y pertenece al cliente
            const existingTag = await executeQuery(
                'SELECT * FROM contact_tags WHERE id = ? AND client_id = ?',
                [tagId, clientId]
            );

            if (existingTag.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Etiqueta no encontrada'
                });
            }

            // Verificar cuántos contactos usan esta etiqueta
            const usageCount = await executeQuery(
                'SELECT COUNT(*) as count FROM contact_tag_relations WHERE tag_id = ?',
                [tagId]
            );

            // 🔧 PASO 1: Cancelar todos los mensajes automáticos pendientes de esta etiqueta
            console.log(`🗑️ Cancelando mensajes automáticos para etiqueta ${tagId}...`);
            
            const cancelResult = await executeQuery(`
                UPDATE scheduled_messages 
                SET status = 'cancelled', 
                    updated_at = CURRENT_TIMESTAMP,
                    execution_result = 'Cancelado: Etiqueta eliminada'
                WHERE client_id = ? 
                    AND source_tag_id = ? 
                    AND auto_generated = TRUE 
                    AND status IN ('pending', 'active')
            `, [clientId, tagId]);

            const cancelledCount = cancelResult.affectedRows || 0;
            console.log(`✅ Cancelados ${cancelledCount} mensajes automáticos pendientes`);

            // 🔧 PASO 2: Eliminar relaciones con contactos
            await executeQuery(
                'DELETE FROM contact_tag_relations WHERE tag_id = ?',
                [tagId]
            );

            // 🔧 PASO 3: Eliminar etiqueta
            await executeQuery(
                'DELETE FROM contact_tags WHERE id = ? AND client_id = ?',
                [tagId, clientId]
            );

            console.log(`✅ Etiqueta ${existingTag[0].name} eliminada exitosamente`);

            res.json({
                success: true,
                message: 'Etiqueta eliminada exitosamente',
                details: {
                    contactsAffected: usageCount[0].count,
                    cancelledAutoMessages: cancelledCount
                }
            });

        } catch (error) {
            console.error('❌ Error in TagController.deleteTag:', error.message);
            next(error);
        }
    }

    /**
     * GET /api/contacts/tags/:id/contacts
     * Obtener contactos que tienen una etiqueta específica
     */
    static async getTagContacts(req, res, next) {
        try {
            const clientId = req.user.id;
            const tagId = parseInt(req.params.id);
            const { page = 1, limit = 20 } = req.query;

            if (!tagId || isNaN(tagId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de etiqueta inválido'
                });
            }

            // Verificar que la etiqueta existe y pertenece al cliente
            const existingTag = await executeQuery(
                'SELECT * FROM contact_tags WHERE id = ? AND client_id = ?',
                [tagId, clientId]
            );

            if (existingTag.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Etiqueta no encontrada'
                });
            }

            const offset = (page - 1) * limit;

            // Obtener contactos con esta etiqueta
            const query = `
                SELECT c.*, ct.name as tag_name, ct.color as tag_color
                FROM contacts c
                INNER JOIN contact_tag_relations ctr ON c.id = ctr.contact_id
                INNER JOIN contact_tags ct ON ctr.tag_id = ct.id
                WHERE ct.id = ? AND c.client_id = ?
                ORDER BY c.created_at DESC
                LIMIT ? OFFSET ?
            `;

            const contacts = await executeQuery(query, [tagId, clientId, limit, offset]);

            // Contar total
            const countQuery = `
                SELECT COUNT(*) as total
                FROM contacts c
                INNER JOIN contact_tag_relations ctr ON c.id = ctr.contact_id
                WHERE ctr.tag_id = ? AND c.client_id = ?
            `;

            const countResult = await executeQuery(countQuery, [tagId, clientId]);
            const total = countResult[0].total;

            res.json({
                success: true,
                data: {
                    tag: existingTag[0],
                    contacts: contacts,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: parseInt(total),
                        pages: Math.ceil(total / limit)
                    }
                }
            });

        } catch (error) {
            console.error('❌ Error in TagController.getTagContacts:', error.message);
            next(error);
        }
    }

    /**
     * GET /api/contacts/tags/:id/auto-message
     * Obtener configuración de mensaje automático de una etiqueta
     */
    static async getAutoMessageConfig(req, res, next) {
        try {
            const tagId = parseInt(req.params.id);
            const clientId = req.user.id;

            if (!tagId || isNaN(tagId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de etiqueta inválido'
                });
            }

            const config = await AutoMessageService.getTagAutoConfig(tagId, clientId);
            
            if (!config) {
                return res.status(404).json({
                    success: false,
                    message: 'Etiqueta no encontrada'
                });
            }

            // También obtener estadísticas
            const stats = await AutoMessageService.getAutoMessageStats(tagId, clientId);

            res.json({
                success: true,
                data: {
                    config: config,
                    stats: stats
                }
            });

        } catch (error) {
            console.error('❌ Error in TagController.getAutoMessageConfig:', error.message);
            next(error);
        }
    }

    /**
     * PUT /api/contacts/tags/:id/auto-message
     * Actualizar configuración de mensaje automático de una etiqueta
     */
    static async updateAutoMessageConfig(req, res, next) {
        try {
            const tagId = parseInt(req.params.id);
            const clientId = req.user.id;
            const {
                has_auto_message,
                auto_message_template_id,
                auto_message_delay_hours,
                auto_message_content,
                is_active_auto
            } = req.body;

            if (!tagId || isNaN(tagId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de etiqueta inválido'
                });
            }

            // Validaciones
            if (has_auto_message) {
                if (!auto_message_template_id && !auto_message_content) {
                    return res.status(400).json({
                        success: false,
                        message: 'Debe especificar un template o contenido del mensaje'
                    });
                }

                if (auto_message_delay_hours && (auto_message_delay_hours < 1 || auto_message_delay_hours > 8760)) {
                    return res.status(400).json({
                        success: false,
                        message: 'El retraso debe estar entre 1 hora y 1 año (8760 horas)'
                    });
                }
            }

            // Verificar que la etiqueta existe y pertenece al cliente
            const existingTag = await executeQuery(
                'SELECT id FROM contact_tags WHERE id = ? AND client_id = ?',
                [tagId, clientId]
            );

            if (existingTag.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Etiqueta no encontrada'
                });
            }

            // Si se especifica template, verificar que existe
            if (auto_message_template_id) {
                const templateExists = await executeQuery(
                    'SELECT id FROM message_templates WHERE id = ? AND client_id = ?',
                    [auto_message_template_id, clientId]
                );

                if (templateExists.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Template especificado no encontrado'
                    });
                }
            }

            // Actualizar configuración
            const success = await AutoMessageService.updateTagAutoConfig(tagId, clientId, {
                has_auto_message: Boolean(has_auto_message),
                auto_message_template_id: auto_message_template_id || null,
                auto_message_delay_hours: auto_message_delay_hours || 24,
                auto_message_content: auto_message_content || null,
                is_active_auto: is_active_auto !== undefined ? Boolean(is_active_auto) : true
            });

            if (!success) {
                return res.status(500).json({
                    success: false,
                    message: 'Error actualizando configuración'
                });
            }

            // Obtener configuración actualizada
            const updatedConfig = await AutoMessageService.getTagAutoConfig(tagId, clientId);

            res.json({
                success: true,
                message: 'Configuración de mensaje automático actualizada exitosamente',
                data: updatedConfig
            });

        } catch (error) {
            console.error('❌ Error in TagController.updateAutoMessageConfig:', error.message);
            next(error);
        }
    }

    /**
     * GET /api/contacts/tags/:id/auto-messages
     * Obtener lista de mensajes automáticos generados por una etiqueta
     */
    static async getAutoMessages(req, res, next) {
        try {
            const tagId = parseInt(req.params.id);
            const clientId = req.user.id;

            if (!tagId || isNaN(tagId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de etiqueta inválido'
                });
            }

            const messages = await AutoMessageService.getAutoMessagesByTag(tagId, clientId);
            const stats = await AutoMessageService.getAutoMessageStats(tagId, clientId);

            res.json({
                success: true,
                data: {
                    messages: messages,
                    stats: stats
                }
            });

        } catch (error) {
            console.error('❌ Error in TagController.getAutoMessages:', error.message);
            next(error);
        }
    }

    /**
     * GET /api/contacts/tags/auto-message/variables
     * Obtener variables disponibles para mensajes automáticos
     */
    static async getAutoMessageVariables(req, res, next) {
        try {
            const variables = [
                {
                    name: 'NOMBRE_CONTACTO',
                    description: 'Nombre del contacto (personalizado o del teléfono)',
                    example: 'Juan Pérez',
                    format: '{NOMBRE_CONTACTO}'
                },
                {
                    name: 'TELEFONO',
                    description: 'Número de teléfono del contacto',
                    example: '5491150239962',
                    format: '{TELEFONO}'
                },
                {
                    name: 'FECHA',
                    description: 'Fecha actual del sistema',
                    example: '03/10/2025',
                    format: '{FECHA}'
                },
                {
                    name: 'HORA',
                    description: 'Hora actual del sistema',
                    example: '14:30:25',
                    format: '{HORA}'
                },
                {
                    name: 'FECHA_HORA',
                    description: 'Fecha y hora actual del sistema',
                    example: '03/10/2025, 14:30:25',
                    format: '{FECHA_HORA}'
                }
            ];

            res.json({
                success: true,
                data: variables,
                message: 'Variables disponibles para mensajes automáticos'
            });

        } catch (error) {
            console.error('❌ Error in TagController.getAutoMessageVariables:', error.message);
            next(error);
        }
    }

    /**
     * DELETE /api/contacts/tags/:id/auto-message
     * Desactivar completamente el mensaje automático de una etiqueta
     */
    static async disableAutoMessage(req, res, next) {
        try {
            const tagId = parseInt(req.params.id);
            const clientId = req.user.id;

            if (!tagId || isNaN(tagId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de etiqueta inválido'
                });
            }

            // Desactivar configuración
            const success = await AutoMessageService.updateTagAutoConfig(tagId, clientId, {
                has_auto_message: false,
                is_active_auto: false
            });

            if (!success) {
                return res.status(500).json({
                    success: false,
                    message: 'Error desactivando mensaje automático'
                });
            }

            res.json({
                success: true,
                message: 'Mensaje automático desactivado exitosamente'
            });

        } catch (error) {
            console.error('❌ Error in TagController.disableAutoMessage:', error.message);
            next(error);
        }
    }
}

module.exports = TagController;
