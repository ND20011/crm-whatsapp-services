const Contact = require('../entities/Contact');
const { executeQuery } = require('../config/database-simple');
const AutoMessageService = require('../services/AutoMessageService');

// ============================================================================
// CONTACT CONTROLLER - CRM CONDORITO
// ============================================================================

class ContactController {

    /**
     * GET /api/contacts/by-tags
     * Obtener contactos filtrados por etiquetas (optimizado para filtrado en chat)
     */
    static async getContactsByTags(req, res, next) {
        try {
            const clientId = req.user.id;
            const { tagIds, tagId } = req.query;
            
            // Aceptar tanto tagIds (array) como tagId (single)
            let tagIdsArray = [];
            if (tagIds) {
                tagIdsArray = Array.isArray(tagIds) ? tagIds : tagIds.split(',');
            } else if (tagId) {
                tagIdsArray = [tagId];
            }
            
            if (tagIdsArray.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Se requiere al menos un tagId o tagIds'
                });
            }
            
            // Validar que los tagIds sean números
            const validTagIds = tagIdsArray
                .map(id => parseInt(id))
                .filter(id => !isNaN(id) && id > 0);
                
            if (validTagIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Los tagIds deben ser números válidos'
                });
            }
            
            // Query optimizada para obtener contactos con sus etiquetas
            const placeholders = validTagIds.map(() => '?').join(',');
            const query = `
                SELECT DISTINCT c.phone_number, c.name, c.custom_name
                FROM contacts c
                INNER JOIN contact_tag_relations ctr ON c.id = ctr.contact_id
                WHERE c.client_id = ? AND ctr.tag_id IN (${placeholders})
                ORDER BY c.name ASC, c.phone_number ASC
            `;
            
            const params = [clientId, ...validTagIds];
            const contacts = await executeQuery(query, params);
            
            // Crear un mapa de teléfonos para filtrado rápido en frontend
            const phoneNumbers = contacts.map(contact => contact.phone_number);
            
            res.json({
                success: true,
                data: {
                    contacts: contacts,
                    phoneNumbers: phoneNumbers,
                    tagIds: validTagIds,
                    total: contacts.length
                }
            });
            
        } catch (error) {
            console.error('❌ Error in ContactController.getContactsByTags:', error.message);
            next(error);
        }
    }

    /**
     * GET /api/contacts
     * Obtener lista de contactos del cliente con filtros y paginación
     */
    static async getContacts(req, res, next) {
        try {
            const clientId = req.user.id;
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
            } = req.query;

            // Validar parámetros
            const validSortFields = ['created_at', 'updated_at', 'name', 'custom_name', 'last_message_at'];
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

            // Validar y parsear números
            const parsedPage = parseInt(page) || 1;
            const parsedLimit = Math.min(parseInt(limit) || 20, 100);
            const parsedTagId = tagId ? parseInt(tagId) : null;
            
            // Procesar tagIds (múltiples etiquetas)
            let parsedTagIds = null;
            if (tagIds) {
                if (Array.isArray(tagIds)) {
                    parsedTagIds = tagIds.map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0);
                } else if (typeof tagIds === 'string') {
                    parsedTagIds = tagIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id) && id > 0);
                }
                if (parsedTagIds && parsedTagIds.length === 0) {
                    parsedTagIds = null;
                }
            }
            
            // Validar fechas de asignación
            let validatedTagAssignedFrom = null;
            let validatedTagAssignedTo = null;
            
            if (tagAssignedFrom) {
                const fromDate = new Date(tagAssignedFrom);
                if (!isNaN(fromDate.getTime())) {
                    validatedTagAssignedFrom = tagAssignedFrom;
                }
            }
            
            if (tagAssignedTo) {
                const toDate = new Date(tagAssignedTo);
                if (!isNaN(toDate.getTime())) {
                    validatedTagAssignedTo = tagAssignedTo;
                }
            }

            // Validar que los números sean válidos
            if (isNaN(parsedPage) || parsedPage < 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Página inválida'
                });
            }

            if (isNaN(parsedLimit) || parsedLimit < 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Límite inválido'
                });
            }

            if (tagId && isNaN(parsedTagId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de etiqueta inválido'
                });
            }

            const options = {
                page: parsedPage,
                limit: parsedLimit,
                search: search.trim(),
                blocked: blocked !== null ? blocked === 'true' : null,
                tagId: parsedTagId,
                tagIds: parsedTagIds,
                tagAssignedFrom: validatedTagAssignedFrom,
                tagAssignedTo: validatedTagAssignedTo,
                sortBy,
                sortOrder: sortOrder.toUpperCase()
            };

            // Log removido para producción

            const result = await Contact.findAll(clientId, options);

            res.json({
                success: true,
                data: result.contacts,
                pagination: result.pagination,
                filters: {
                    search: options.search,
                    blocked: options.blocked,
                    tagId: options.tagId,
                    tagIds: options.tagIds,
                    tagAssignedFrom: options.tagAssignedFrom,
                    tagAssignedTo: options.tagAssignedTo,
                    sortBy: options.sortBy,
                    sortOrder: options.sortOrder
                }
            });

        } catch (error) {
            console.error('❌ Error in ContactController.getContacts:', error.message);
            next(error);
        }
    }

    /**
     * GET /api/contacts/:id
     * Obtener contacto específico por ID
     */
    static async getContactById(req, res, next) {
        try {
            const clientId = req.user.id;
            const contactId = parseInt(req.params.id);

            if (!contactId || isNaN(contactId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de contacto inválido'
                });
            }

            const contact = await Contact.findById(contactId, clientId);

            if (!contact) {
                return res.status(404).json({
                    success: false,
                    message: 'Contacto no encontrado'
                });
            }

            res.json({
                success: true,
                data: contact
            });

        } catch (error) {
            console.error('❌ Error in ContactController.getContactById:', error.message);
            next(error);
        }
    }

    /**
     * POST /api/contacts
     * Crear nuevo contacto
     */
    static async createContact(req, res, next) {
        try {
            const clientId = req.user.id;
            const {
                phone_number,
                name,
                custom_name,
                profile_pic_url,
                comments,
                is_blocked = false,
                tags = []
            } = req.body;

            // Validar datos requeridos
            if (!phone_number) {
                return res.status(400).json({
                    success: false,
                    message: 'Número de teléfono es requerido'
                });
            }

            // Verificar si el contacto ya existe
            const existingContact = await Contact.findByPhone(phone_number, clientId);
            if (existingContact) {
                return res.status(409).json({
                    success: false,
                    message: 'Ya existe un contacto con este número de teléfono'
                });
            }

            // Crear nuevo contacto
            const contact = new Contact({
                client_id: clientId,
                phone_number,
                name,
                custom_name,
                profile_pic_url,
                comments,
                is_blocked: Boolean(is_blocked)
            });

            await contact.create();

            // Actualizar conversaciones existentes con el nuevo contacto
            if (name) {
                console.log(`🔄 Actualizando conversaciones existentes para nuevo contacto con teléfono: "${phone_number}"`);
                await executeQuery(`
                    UPDATE conversations 
                    SET contact_name = ?, contact_id = ? 
                    WHERE contact_phone = ? AND client_id = ? AND contact_id IS NULL
                `, [name, contact.id, phone_number, clientId]);
                console.log(`✅ Conversaciones actualizadas para nuevo contacto ID ${contact.id}`);
            }

            // Agregar tags si se proporcionan
            if (tags && tags.length > 0) {
                await ContactController.addTagsToContact(contact.id, tags, clientId);
            }

            // Recargar contacto con tags
            const createdContact = await Contact.findById(contact.id, clientId);

            res.status(201).json({
                success: true,
                message: 'Contacto creado exitosamente',
                data: createdContact
            });

        } catch (error) {
            console.error('❌ Error in ContactController.createContact:', error.message);
            next(error);
        }
    }

    /**
     * PUT /api/contacts/:id
     * Actualizar contacto existente
     */
    static async updateContact(req, res, next) {
        try {
            const clientId = req.user.id;
            const contactId = parseInt(req.params.id);
            const {
                phone_number,
                name,
                custom_name,
                profile_pic_url,
                comments,
                is_blocked,
                tags
            } = req.body;

            if (!contactId || isNaN(contactId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de contacto inválido'
                });
            }

            // Verificar que el contacto existe
            const existingContact = await Contact.findById(contactId, clientId);
            if (!existingContact) {
                return res.status(404).json({
                    success: false,
                    message: 'Contacto no encontrado'
                });
            }

            // Si se está actualizando el teléfono, verificar que no exista otro contacto con ese número
            if (phone_number && phone_number !== existingContact.phone_number) {
                const duplicateContact = await Contact.findByPhone(phone_number, clientId);
                if (duplicateContact && duplicateContact.id !== contactId) {
                    return res.status(409).json({
                        success: false,
                        message: 'Ya existe otro contacto con este número de teléfono'
                    });
                }
            }

            // Actualizar contacto
            const contact = new Contact({
                id: contactId,
                client_id: clientId,
                phone_number,
                name,
                custom_name,
                profile_pic_url,
                comments,
                is_blocked
            });

            await contact.update();

            // Si se actualizó el nombre, también actualizar las conversaciones relacionadas
            if (name !== undefined) {
                console.log(`🔄 Actualizando conversaciones para contacto ID ${contactId} con nuevo nombre: "${name}"`);
                await executeQuery(`
                    UPDATE conversations 
                    SET contact_name = ? 
                    WHERE contact_id = ? AND client_id = ?
                `, [name, contactId, clientId]);
                console.log(`✅ Conversaciones actualizadas para contacto ID ${contactId}`);
            }

            // Si se actualizó el teléfono, también actualizar las conversaciones relacionadas
            if (phone_number !== undefined) {
                console.log(`🔄 Actualizando conversaciones para contacto ID ${contactId} con nuevo teléfono: "${phone_number}"`);
                await executeQuery(`
                    UPDATE conversations 
                    SET contact_phone = ? 
                    WHERE contact_id = ? AND client_id = ?
                `, [phone_number, contactId, clientId]);
                console.log(`✅ Conversaciones actualizadas con nuevo teléfono para contacto ID ${contactId}`);
            }

            // Actualizar tags si se proporcionan
            if (tags !== undefined) {
                // Eliminar tags existentes
                await executeQuery(
                    'DELETE FROM contact_tag_relations WHERE contact_id = ?',
                    [contactId]
                );

                // Agregar nuevas tags
                if (tags.length > 0) {
                    await ContactController.addTagsToContact(contactId, tags, clientId);
                }
            }

            // Recargar contacto actualizado con tags
            const updatedContact = await Contact.findById(contactId, clientId);

            res.json({
                success: true,
                message: 'Contacto actualizado exitosamente',
                data: updatedContact
            });

        } catch (error) {
            console.error('❌ Error in ContactController.updateContact:', error.message);
            next(error);
        }
    }

    /**
     * DELETE /api/contacts/:id
     * Eliminar contacto
     */
    static async deleteContact(req, res, next) {
        try {
            const clientId = req.user.id;
            const contactId = parseInt(req.params.id);

            if (!contactId || isNaN(contactId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de contacto inválido'
                });
            }

            // Verificar que el contacto existe
            const contact = await Contact.findById(contactId, clientId);
            if (!contact) {
                return res.status(404).json({
                    success: false,
                    message: 'Contacto no encontrado'
                });
            }

            // Eliminar contacto
            await contact.delete();

            res.json({
                success: true,
                message: 'Contacto eliminado exitosamente'
            });

        } catch (error) {
            console.error('❌ Error in ContactController.deleteContact:', error.message);
            next(error);
        }
    }

    /**
     * POST /api/contacts/:id/tags
     * Agregar tags a un contacto
     */
    static async addContactTags(req, res, next) {
        try {
            const clientId = req.user.id;
            const contactId = parseInt(req.params.id);
            const { tags = [], tagIds = [] } = req.body;
            
            // Aceptar tanto 'tags' como 'tagIds' para compatibilidad
            const tagsToProcess = tags.length > 0 ? tags : tagIds;

            if (!contactId || isNaN(contactId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de contacto inválido'
                });
            }

            if (!Array.isArray(tagsToProcess)) {
                return res.status(400).json({
                    success: false,
                    message: 'Se requiere un array de tags o tagIds'
                });
            }

            // Verificar que el contacto existe
            const contact = await Contact.findById(contactId, clientId);
            if (!contact) {
                return res.status(404).json({
                    success: false,
                    message: 'Contacto no encontrado'
                });
            }

            // REEMPLAZAR todas las etiquetas del contacto
            await ContactController.replaceContactTags(contactId, tagsToProcess, clientId);

            // Recargar contacto con tags actualizadas
            const updatedContact = await Contact.findById(contactId, clientId);

            res.json({
                success: true,
                message: 'Tags actualizadas exitosamente',
                data: updatedContact
            });

        } catch (error) {
            console.error('❌ Error in ContactController.addContactTags:', error.message);
            next(error);
        }
    }

    /**
     * DELETE /api/contacts/:id/tags/:tagId
     * Remover tag específica de un contacto
     */
    static async removeContactTag(req, res, next) {
        try {
            const clientId = req.user.id;
            const contactId = parseInt(req.params.id);
            const tagId = parseInt(req.params.tagId);

            if (!contactId || isNaN(contactId) || !tagId || isNaN(tagId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de contacto o tag inválido'
                });
            }

            // Verificar que el contacto existe
            const contact = await Contact.findById(contactId, clientId);
            if (!contact) {
                return res.status(404).json({
                    success: false,
                    message: 'Contacto no encontrado'
                });
            }

            // Eliminar relación tag-contacto
            const result = await executeQuery(`
                DELETE ctr FROM contact_tag_relations ctr
                INNER JOIN contact_tags ct ON ctr.tag_id = ct.id
                WHERE ctr.contact_id = ? AND ctr.tag_id = ? AND ct.client_id = ?
            `, [contactId, tagId, clientId]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Tag no encontrada en este contacto'
                });
            }

            res.json({
                success: true,
                message: 'Tag removida exitosamente'
            });

        } catch (error) {
            console.error('❌ Error in ContactController.removeContactTag:', error.message);
            next(error);
        }
    }

    /**
     * Método auxiliar para agregar tags a un contacto
     */
    static async addTagsToContact(contactId, tags, clientId) {
        try {
            if (!Array.isArray(tags) || tags.length === 0) {
                return;
            }

            // Verificar que todas las tags pertenecen al cliente
            const tagIds = tags.filter(tagId => Number.isInteger(tagId) && tagId > 0);
            
            if (tagIds.length === 0) {
                return;
            }

            const placeholders = tagIds.map(() => '?').join(',');
            const verifyQuery = `
                SELECT id FROM contact_tags 
                WHERE id IN (${placeholders}) AND client_id = ?
            `;
            
            const validTags = await executeQuery(verifyQuery, [...tagIds, clientId]);
            const validTagIds = validTags.map(tag => tag.id);

            if (validTagIds.length === 0) {
                throw new Error('Ninguna de las tags proporcionadas es válida');
            }

            // Insertar relaciones (ignorar duplicados)
            const insertPromises = validTagIds.map(tagId => {
                return executeQuery(`
                    INSERT IGNORE INTO contact_tag_relations (contact_id, tag_id)
                    VALUES (?, ?)
                `, [contactId, tagId]);
            });

            await Promise.all(insertPromises);

        } catch (error) {
            console.error('❌ Error adding tags to contact:', error.message);
            throw error;
        }
    }

    /**
     * Método auxiliar para reemplazar todas las tags de un contacto
     */
    static async replaceContactTags(contactId, tags, clientId) {
        try {
            console.log(`🏷️  Reemplazando tags para contacto ${contactId}...`);

            // 🆕 1. Obtener etiquetas actuales para comparar cambios
            const currentTagsQuery = `
                SELECT ctr.tag_id 
                FROM contact_tag_relations ctr 
                WHERE ctr.contact_id = ?
            `;
            const currentTagsResult = await executeQuery(currentTagsQuery, [contactId]);
            const currentTagIds = currentTagsResult.map(row => row.tag_id);

            // 🆕 2. Determinar etiquetas nuevas a agregar
            const newTagIds = (tags || []).filter(tagId => Number.isInteger(tagId) && tagId > 0);
            const addedTags = newTagIds.filter(tagId => !currentTagIds.includes(tagId));
            const removedTags = currentTagIds.filter(tagId => !newTagIds.includes(tagId));

            console.log(`   📊 Tags actuales: [${currentTagIds.join(', ')}]`);
            console.log(`   📊 Tags nuevas: [${newTagIds.join(', ')}]`);
            console.log(`   ➕ Tags agregadas: [${addedTags.join(', ')}]`);
            console.log(`   ➖ Tags removidas: [${removedTags.join(', ')}]`);

            // 3. Eliminar todas las etiquetas existentes del contacto
            await executeQuery(`
                DELETE FROM contact_tag_relations 
                WHERE contact_id = ?
            `, [contactId]);

            // Si no hay tags nuevas, solo procesar removals y terminar
            if (!Array.isArray(tags) || tags.length === 0) {
                // 🆕 Cancelar mensajes automáticos para todas las etiquetas removidas
                for (const tagId of removedTags) {
                    try {
                        await AutoMessageService.cancelAutoMessageForTag(contactId, tagId, clientId);
                    } catch (error) {
                        console.error(`⚠️  Error cancelando auto-message para tag ${tagId}:`, error.message);
                    }
                }
                return;
            }

            // Verificar que todas las tags pertenecen al cliente
            const tagIds = newTagIds;
            
            if (tagIds.length === 0) {
                return;
            }

            const placeholders = tagIds.map(() => '?').join(',');
            const verifyQuery = `
                SELECT id FROM contact_tags 
                WHERE id IN (${placeholders}) AND client_id = ?
            `;
            
            const validTags = await executeQuery(verifyQuery, [...tagIds, clientId]);
            const validTagIds = validTags.map(tag => tag.id);

            if (validTagIds.length === 0) {
                console.warn('⚠️ Ninguna de las tags proporcionadas es válida');
                return;
            }

            // Insertar las nuevas relaciones
            const insertPromises = validTagIds.map(tagId => {
                return executeQuery(`
                    INSERT INTO contact_tag_relations (contact_id, tag_id)
                    VALUES (?, ?)
                `, [contactId, tagId]);
            });

            await Promise.all(insertPromises);

            // 🆕 4. Procesar mensajes automáticos para etiquetas agregadas
            for (const tagId of addedTags) {
                if (validTagIds.includes(tagId)) {
                    try {
                        await AutoMessageService.createAutoMessageForTag(contactId, tagId, clientId);
                    } catch (error) {
                        console.error(`⚠️  Error creando auto-message para tag ${tagId}:`, error.message);
                        // No fallar la operación por error en mensaje automático
                    }
                }
            }

            // 🆕 5. Cancelar mensajes automáticos para etiquetas removidas
            for (const tagId of removedTags) {
                try {
                    await AutoMessageService.cancelAutoMessageForTag(contactId, tagId, clientId);
                } catch (error) {
                    console.error(`⚠️  Error cancelando auto-message para tag ${tagId}:`, error.message);
                }
            }

            console.log(`✅ Tags actualizadas exitosamente para contacto ${contactId}`);

        } catch (error) {
            console.error('❌ Error replacing tags for contact:', error.message);
            throw error;
        }
    }
}

module.exports = ContactController;
