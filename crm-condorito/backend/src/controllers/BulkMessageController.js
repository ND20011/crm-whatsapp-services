const BulkMessage = require('../entities/BulkMessage');
const Contact = require('../entities/Contact');
const MessageTemplate = require('../entities/MessageTemplate');
const MessageService = require('../services/MessageService');
const { executeQuery } = require('../config/database-simple');

// ============================================================================
// BULK MESSAGE CONTROLLER - CRM CONDORITO
// ============================================================================

class BulkMessageController {

    /**
     * GET /api/messages/campaigns
     * Obtener lista de campañas de mensajes masivos
     */
    static async getCampaigns(req, res, next) {
        try {
            const clientId = req.user.id;
            const {
                page = 1,
                limit = 20,
                search = '',
                status = null,
                sortBy = 'created_at',
                sortOrder = 'DESC'
            } = req.query;

            // Validar parámetros
            const validSortFields = ['created_at', 'updated_at', 'campaign_name', 'scheduled_at', 'success_rate'];
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

            const options = {
                page: parseInt(page),
                limit: Math.min(parseInt(limit), 100),
                search: search.trim(),
                status,
                sortBy,
                sortOrder: sortOrder.toUpperCase()
            };

            const result = await BulkMessage.findAll(clientId, options);

            res.json({
                success: true,
                data: result.campaigns,
                pagination: result.pagination,
                filters: {
                    search: options.search,
                    status: options.status,
                    sortBy: options.sortBy,
                    sortOrder: options.sortOrder
                }
            });

        } catch (error) {
            console.error('❌ Error in BulkMessageController.getCampaigns:', error.message);
            next(error);
        }
    }

    /**
     * GET /api/messages/campaigns/:id
     * Obtener campaña específica por ID
     */
    static async getCampaignById(req, res, next) {
        try {
            const clientId = req.user.id;
            const campaignId = parseInt(req.params.id);

            if (!campaignId || isNaN(campaignId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de campaña inválido'
                });
            }

            const campaign = await BulkMessage.findById(campaignId, clientId);

            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    message: 'Campaña no encontrada'
                });
            }

            res.json({
                success: true,
                data: campaign
            });

        } catch (error) {
            console.error('❌ Error in BulkMessageController.getCampaignById:', error.message);
            next(error);
        }
    }

    /**
     * POST /api/messages/campaigns/preview
     * Previsualizar selección de contactos para campaña
     */
    static async previewContactSelection(req, res, next) {
        try {
            const clientId = req.user.id;
            const {
                contact_filter = {},
                selected_contact_ids = [],
                template_id = null
            } = req.body;

            let contacts = [];
            let total = 0;

            // Si hay IDs específicos, usarlos
            if (selected_contact_ids && selected_contact_ids.length > 0) {
                const placeholders = selected_contact_ids.map(() => '?').join(',');
                const query = `
                    SELECT id, name, custom_name, phone_number
                    FROM contacts 
                    WHERE id IN (${placeholders}) AND client_id = ?
                    ORDER BY name ASC
                `;
                
                contacts = await executeQuery(query, [...selected_contact_ids, clientId]);
                total = contacts.length;

            } else if (Object.keys(contact_filter).length > 0) {
                // Usar filtros para seleccionar contactos
                const options = {
                    page: 1,
                    limit: 100, // Máximo para preview
                    ...contact_filter
                };

                const result = await Contact.findAll(clientId, options);
                contacts = result.contacts.map(contact => ({
                    id: contact.id,
                    name: contact.name,
                    custom_name: contact.custom_name,
                    phone_number: contact.phone_number,
                    tags: contact.tags
                }));
                total = result.pagination.total;

            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Debe especificar contact_filter o selected_contact_ids'
                });
            }

            // Si se especifica un template, obtener preview del contenido
            let template_preview = null;
            if (template_id) {
                const template = await MessageTemplate.findById(template_id, clientId);
                if (template) {
                    template_preview = {
                        id: template.id,
                        name: template.name,
                        preview: template.getPreview(),
                        variables: template.extractVariables()
                    };
                }
            }

            res.json({
                success: true,
                data: {
                    contacts: contacts.slice(0, 20), // Mostrar solo los primeros 20 en preview
                    total_contacts: total,
                    showing: Math.min(contacts.length, 20),
                    template_preview,
                    estimated_delivery_time: BulkMessageController.calculateEstimatedTime(total)
                }
            });

        } catch (error) {
            console.error('❌ Error in BulkMessageController.previewContactSelection:', error.message);
            next(error);
        }
    }

    /**
     * POST /api/messages/campaigns
     * Crear nueva campaña de mensajes masivos
     */
    static async createCampaign(req, res, next) {
        try {
            const clientId = req.user.id;
            const {
                campaign_name,
                template_id = null,
                content,
                scheduled_at = null,
                contact_filter = {},
                selected_contact_ids = []
            } = req.body;

            // Validar datos requeridos
            if (!campaign_name || !campaign_name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Nombre de la campaña es requerido'
                });
            }

            if (!content || !content.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Contenido del mensaje es requerido'
                });
            }

            // Validar que hay contactos seleccionados
            if ((!selected_contact_ids || selected_contact_ids.length === 0) && 
                Object.keys(contact_filter).length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Debe seleccionar contactos o especificar filtros'
                });
            }

            // Obtener contactos seleccionados
            let selectedContacts = [];
            let totalContacts = 0;

            if (selected_contact_ids && selected_contact_ids.length > 0) {
                const placeholders = selected_contact_ids.map(() => '?').join(',');
                selectedContacts = await executeQuery(`
                    SELECT id, name, phone_number FROM contacts 
                    WHERE id IN (${placeholders}) AND client_id = ?
                `, [...selected_contact_ids, clientId]);
                totalContacts = selectedContacts.length;

            } else {
                // Usar filtros para obtener contactos
                const result = await Contact.findAll(clientId, {
                    page: 1,
                    limit: 10000, // Máximo para campañas
                    ...contact_filter
                });
                
                selectedContacts = result.contacts.map(contact => ({
                    id: contact.id,
                    name: contact.name,
                    phone_number: contact.phone_number
                }));
                totalContacts = selectedContacts.length;
            }

            if (totalContacts === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No se encontraron contactos con los filtros especificados'
                });
            }

            // Validar template si se especifica
            if (template_id) {
                const template = await MessageTemplate.findById(template_id, clientId);
                if (!template) {
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
            }

            // Determinar estado inicial
            const now = new Date();
            const scheduledDate = scheduled_at ? new Date(scheduled_at) : null;
            let status = 'pending';

            if (scheduledDate && scheduledDate > now) {
                status = 'scheduled';
            }

            // Crear campaña
            const campaign = new BulkMessage({
                client_id: clientId,
                campaign_name: campaign_name.trim(),
                template_id,
                content: content.trim(),
                scheduled_at: scheduledDate ? scheduledDate.toISOString() : null,
                status,
                contact_filter,
                selected_contacts: selectedContacts,
                total_contacts: totalContacts
            });

            await campaign.create();

            // Si es envío inmediato, procesar
            if (status === 'pending') {
                // Procesar en background
                setImmediate(() => {
                    BulkMessageController.processCampaign(campaign.id, clientId, req.app.get('socketio'))
                        .catch(error => {
                            console.error(`❌ Error processing campaign ${campaign.id}:`, error.message);
                        });
                });
            }

            // Recargar campaña con datos completos
            const createdCampaign = await BulkMessage.findById(campaign.id, clientId);

            res.status(201).json({
                success: true,
                message: 'Campaña creada exitosamente',
                data: {
                    ...createdCampaign,
                    estimated_delivery_time: BulkMessageController.calculateEstimatedTime(totalContacts)
                }
            });

        } catch (error) {
            console.error('❌ Error in BulkMessageController.createCampaign:', error.message);
            next(error);
        }
    }

    /**
     * PUT /api/messages/campaigns/:id
     * Actualizar campaña existente
     */
    static async updateCampaign(req, res, next) {
        try {
            const clientId = req.user.id;
            const campaignId = parseInt(req.params.id);
            const {
                campaign_name,
                template_id,
                content,
                scheduled_at,
                contact_filter,
                selected_contact_ids
            } = req.body;

            if (!campaignId || isNaN(campaignId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de campaña inválido'
                });
            }

            // Verificar que la campaña existe
            const existingCampaign = await BulkMessage.findById(campaignId, clientId);
            if (!existingCampaign) {
                return res.status(404).json({
                    success: false,
                    message: 'Campaña no encontrada'
                });
            }

            // Verificar que se puede editar
            if (!existingCampaign.canBeEdited()) {
                return res.status(400).json({
                    success: false,
                    message: 'No se puede editar una campaña en este estado'
                });
            }

            // Actualizar contactos si se especifican
            let selectedContacts = existingCampaign.selected_contacts;
            let totalContacts = existingCampaign.total_contacts;

            if (selected_contact_ids || contact_filter) {
                if (selected_contact_ids && selected_contact_ids.length > 0) {
                    const placeholders = selected_contact_ids.map(() => '?').join(',');
                    selectedContacts = await executeQuery(`
                        SELECT id, name, phone_number FROM contacts 
                        WHERE id IN (${placeholders}) AND client_id = ?
                    `, [...selected_contact_ids, clientId]);
                    totalContacts = selectedContacts.length;

                } else if (contact_filter && Object.keys(contact_filter).length > 0) {
                    const result = await Contact.findAll(clientId, {
                        page: 1,
                        limit: 10000,
                        ...contact_filter
                    });
                    
                    selectedContacts = result.contacts.map(contact => ({
                        id: contact.id,
                        name: contact.name,
                        phone_number: contact.phone_number
                    }));
                    totalContacts = selectedContacts.length;
                }
            }

            // Actualizar campaña
            const campaign = new BulkMessage({
                id: campaignId,
                client_id: clientId,
                campaign_name,
                template_id,
                content,
                scheduled_at,
                contact_filter: contact_filter || existingCampaign.contact_filter,
                selected_contacts: selectedContacts,
                total_contacts: totalContacts
            });

            await campaign.update();

            // Recargar campaña actualizada
            const updatedCampaign = await BulkMessage.findById(campaignId, clientId);

            res.json({
                success: true,
                message: 'Campaña actualizada exitosamente',
                data: updatedCampaign
            });

        } catch (error) {
            console.error('❌ Error in BulkMessageController.updateCampaign:', error.message);
            next(error);
        }
    }

    /**
     * DELETE /api/messages/campaigns/:id
     * Eliminar campaña
     */
    static async deleteCampaign(req, res, next) {
        try {
            const clientId = req.user.id;
            const campaignId = parseInt(req.params.id);

            if (!campaignId || isNaN(campaignId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de campaña inválido'
                });
            }

            // Verificar que la campaña existe
            const campaign = await BulkMessage.findById(campaignId, clientId);
            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    message: 'Campaña no encontrada'
                });
            }

            // Verificar que se puede eliminar
            if (!campaign.canBeDeleted()) {
                return res.status(400).json({
                    success: false,
                    message: 'No se puede eliminar una campaña en este estado'
                });
            }

            // Eliminar campaña
            await campaign.delete();

            res.json({
                success: true,
                message: 'Campaña eliminada exitosamente'
            });

        } catch (error) {
            console.error('❌ Error in BulkMessageController.deleteCampaign:', error.message);
            next(error);
        }
    }

    /**
     * POST /api/messages/campaigns/:id/send
     * Enviar campaña inmediatamente
     */
    static async sendCampaign(req, res, next) {
        try {
            const clientId = req.user.id;
            const campaignId = parseInt(req.params.id);

            if (!campaignId || isNaN(campaignId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de campaña inválido'
                });
            }

            // Verificar que la campaña existe
            const campaign = await BulkMessage.findById(campaignId, clientId);
            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    message: 'Campaña no encontrada'
                });
            }

            // Verificar que se puede enviar
            if (!['draft', 'scheduled', 'pending'].includes(campaign.status)) {
                return res.status(400).json({
                    success: false,
                    message: 'La campaña no se puede enviar en su estado actual'
                });
            }

            // Actualizar estado a pending para envío inmediato
            campaign.status = 'pending';
            campaign.scheduled_at = null;
            await campaign.update();

            // Procesar en background
            setImmediate(() => {
                BulkMessageController.processCampaign(campaignId, clientId, req.app.get('socketio'))
                    .catch(error => {
                        console.error(`❌ Error processing campaign ${campaignId}:`, error.message);
                    });
            });

            res.json({
                success: true,
                message: 'Campaña iniciada exitosamente',
                data: {
                    campaign_id: campaignId,
                    status: 'sending',
                    estimated_delivery_time: BulkMessageController.calculateEstimatedTime(campaign.total_contacts)
                }
            });

        } catch (error) {
            console.error('❌ Error in BulkMessageController.sendCampaign:', error.message);
            next(error);
        }
    }

    /**
     * POST /api/messages/campaigns/:id/cancel
     * Cancelar campaña
     */
    static async cancelCampaign(req, res, next) {
        try {
            const clientId = req.user.id;
            const campaignId = parseInt(req.params.id);

            if (!campaignId || isNaN(campaignId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de campaña inválido'
                });
            }

            // Verificar que la campaña existe
            const campaign = await BulkMessage.findById(campaignId, clientId);
            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    message: 'Campaña no encontrada'
                });
            }

            // Verificar que se puede cancelar
            if (!campaign.canBeCancelled()) {
                return res.status(400).json({
                    success: false,
                    message: 'La campaña no se puede cancelar en su estado actual'
                });
            }

            // Actualizar estado a cancelada
            campaign.status = 'cancelled';
            campaign.completed_at = new Date().toISOString();
            await campaign.update();

            res.json({
                success: true,
                message: 'Campaña cancelada exitosamente',
                data: campaign
            });

        } catch (error) {
            console.error('❌ Error in BulkMessageController.cancelCampaign:', error.message);
            next(error);
        }
    }

    /**
     * GET /api/messages/campaigns/stats
     * Obtener estadísticas de campañas
     */
    static async getCampaignStats(req, res, next) {
        try {
            const clientId = req.user.id;

            const stats = await BulkMessage.getStats(clientId);

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('❌ Error in BulkMessageController.getCampaignStats:', error.message);
            next(error);
        }
    }

    /**
     * GET /api/messages/campaigns/statuses
     * Obtener estados disponibles para campañas
     */
    static async getCampaignStatuses(req, res, next) {
        try {
            const statuses = BulkMessage.getValidStatuses();

            res.json({
                success: true,
                data: statuses
            });

        } catch (error) {
            console.error('❌ Error in BulkMessageController.getCampaignStatuses:', error.message);
            next(error);
        }
    }

    /**
     * Procesar campaña de mensajes masivos
     */
    static async processCampaign(campaignId, clientId, socketIo) {
        try {
            console.log(`📤 Starting bulk campaign processing: ${campaignId}`);

            // Obtener campaña
            const campaign = await BulkMessage.findById(campaignId, clientId);
            if (!campaign) {
                throw new Error('Campaña no encontrada');
            }

            // Marcar como iniciada
            await campaign.markAsStarted();

            // Obtener template si existe
            let template = null;
            if (campaign.template_id) {
                template = await MessageTemplate.findById(campaign.template_id, clientId);
                if (template) {
                    await template.incrementUsage();
                }
            }

            const contacts = campaign.selected_contacts;
            let sentCount = 0;
            let failedCount = 0;

            // Enviar mensajes con rate limiting
            const BATCH_SIZE = 5; // Enviar en lotes de 5
            const DELAY_BETWEEN_BATCHES = 2000; // 2 segundos entre lotes

            for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
                const batch = contacts.slice(i, i + BATCH_SIZE);
                
                // Procesar lote
                const batchPromises = batch.map(async (contact) => {
                    try {
                        let messageContent = campaign.content;

                        // Si hay template, procesarlo con variables del contacto
                        if (template) {
                            const variables = {
                                nombre: contact.name || 'Cliente',
                                telefono: contact.phone_number
                            };
                            messageContent = template.processTemplate(variables);
                        }

                        // Enviar mensaje
                        await MessageService.sendManualMessage(
                            req.user?.clientCode || 'BULK_SYSTEM',
                            clientId,
                            contact.phone_number,
                            messageContent,
                            socketIo
                        );

                        return { success: true, contact: contact.id };

                    } catch (error) {
                        console.error(`❌ Error sending to contact ${contact.id}:`, error.message);
                        return { success: false, contact: contact.id, error: error.message };
                    }
                });

                // Esperar resultados del lote
                const batchResults = await Promise.allSettled(batchPromises);
                
                // Contar resultados
                batchResults.forEach(result => {
                    if (result.status === 'fulfilled' && result.value.success) {
                        sentCount++;
                    } else {
                        failedCount++;
                    }
                });

                // Actualizar progreso
                await campaign.updateProgress(
                    batchResults.filter(r => r.status === 'fulfilled' && r.value.success).length,
                    batchResults.filter(r => r.status === 'rejected' || !r.value.success).length
                );

                // Emitir progreso via Socket.io SOLO al cliente específico
                if (socketIo) {
                    const roomName = `client_${clientCode}`;
                    console.log(`📡 Emitting bulk_campaign_progress to room: ${roomName}`);
                    
                    socketIo.to(roomName).emit('bulk_campaign_progress', {
                        campaign_id: campaignId,
                        sent: sentCount,
                        failed: failedCount,
                        total: contacts.length,
                        progress_percentage: Math.round(((sentCount + failedCount) / contacts.length) * 100)
                    });
                }

                // Pausa entre lotes (excepto en el último)
                if (i + BATCH_SIZE < contacts.length) {
                    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
                }
            }

            console.log(`✅ Bulk campaign ${campaignId} completed: ${sentCount} sent, ${failedCount} failed`);

        } catch (error) {
            console.error(`❌ Error processing bulk campaign ${campaignId}:`, error.message);
            
            // Marcar campaña como fallida
            try {
                const campaign = await BulkMessage.findById(campaignId, clientId);
                if (campaign) {
                    await campaign.markAsFailed(error.message);
                }
            } catch (updateError) {
                console.error('❌ Error marking campaign as failed:', updateError.message);
            }
        }
    }

    /**
     * Calcular tiempo estimado de entrega
     */
    static calculateEstimatedTime(totalContacts) {
        const MESSAGES_PER_MINUTE = 30; // Considerando rate limiting
        const estimatedMinutes = Math.ceil(totalContacts / MESSAGES_PER_MINUTE);
        
        if (estimatedMinutes < 60) {
            return `${estimatedMinutes} minutos`;
        } else {
            const hours = Math.floor(estimatedMinutes / 60);
            const minutes = estimatedMinutes % 60;
            return `${hours}h ${minutes}m`;
        }
    }
}

module.exports = BulkMessageController;
