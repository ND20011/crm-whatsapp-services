const express = require('express');
const { authenticateToken, requireActiveClient, logAccess } = require('../middleware/auth');
const MessageService = require('../services/MessageService');
const BotQuotaService = require('../services/BotQuotaService');
const TemplateController = require('../controllers/TemplateController');
const BulkMessageController = require('../controllers/BulkMessageController');

const router = express.Router();

// ============================================================================
// MESSAGES ROUTES - CRM CONDORITO
// ============================================================================

/**
 * GET /api/messages/bot/quota/debug
 * Debug endpoint temporal sin autenticación
 */
router.get('/bot/quota/debug', async (req, res, next) => {
    try {
        console.log('🔍 DEBUG: Iniciando diagnóstico de bot quota...');
        
        // Ejecutar sincronización
        await MessageService.syncBotUsageFromHistory();
        
        // Obtener todos los clientes para mostrar su estado
        const { executeQuery } = require('../config/database-simple');
        const clients = await executeQuery(`
            SELECT id, client_code, monthly_bot_limit, current_bot_usage, bot_usage_reset_date 
            FROM clients
        `);
        
        console.log('📊 Estado de todos los clientes:', clients);
        
        res.json({
            success: true,
            message: 'Debug completado - revisa los logs del servidor',
            clients: clients
        });
        
    } catch (error) {
        console.error('❌ Error en debug:', error.message);
        res.json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

// Aplicar autenticación a todas las rutas de mensajes
router.use(authenticateToken);
router.use(requireActiveClient);
router.use(logAccess);

// ============================================================================
// CONVERSATIONS - IMPLEMENTADO
// ============================================================================

/**
 * GET /api/messages/conversations
 * Obtener lista de conversaciones del cliente
 */
router.get('/conversations', async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const {
            archived = false,
            search = null
        } = req.query;

        const options = {
            archived: archived === 'true',
            search: search || null
        };

        console.log('🔍 Cargando todas las conversaciones:', options);

        const conversations = await MessageService.getConversations(clientId, options);

        res.status(200).json({
            success: true,
            conversations,
            total: conversations.length,
            filters: {
                search: options.search,
                archived: options.archived
            }
        });

    } catch (error) {
        console.error('❌ Error getting conversations:', error.message);
        next(error);
    }
});

/**
 * GET /api/messages/conversation/:id
 * Obtener mensajes de una conversación específica
 */
router.get('/conversation/:id', async (req, res, next) => {
    try {
        const { id: conversationId } = req.params;
        const {
            limit = 50,
            offset = 0,
            messageType = null,
            senderType = null
        } = req.query;

        const options = {
            limit: parseInt(limit),
            offset: parseInt(offset),
            messageType: messageType || null,
            senderType: senderType || null
        };

        const messages = await MessageService.getMessages(parseInt(conversationId), options);

        res.status(200).json({
            success: true,
            messages,
            conversation_id: parseInt(conversationId),
            pagination: {
                limit: options.limit,
                offset: options.offset,
                total: messages.length
            }
        });

    } catch (error) {
        console.error('❌ Error getting messages:', error.message);
        next(error);
    }
});

/**
 * POST /api/messages/conversation/:id/read
 * Marcar conversación como leída
 */
router.post('/conversation/:id/read', async (req, res, next) => {
    try {
        const { id: conversationId } = req.params;

        const success = await MessageService.markConversationAsRead(parseInt(conversationId));

        if (success) {
            // Emitir estadísticas actualizadas por WebSocket
            try {
                const clientId = req.user?.id;
                const clientCode = req.user?.client_code;
                
                if (clientId && clientCode) {
                    const updatedStats = await MessageService.getMessageStats(clientId);
                    const socketIo = req.app.get('socketio');
                    
                    if (socketIo) {
                        const roomName = `client_${clientCode}`;
                        console.log(`📊 Emitting stats:updated to room: ${roomName} (mark as read)`);
                        
                        socketIo.to(roomName).emit('stats:updated', {
                            clientCode,
                            stats: updatedStats,
                            timestamp: new Date()
                        });
                    }
                }
            } catch (error) {
                console.error('Error emitting stats update after mark as read:', error);
            }

            res.status(200).json({
                success: true,
                message: 'Conversación marcada como leída',
                conversation_id: parseInt(conversationId)
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'No se pudo marcar la conversación como leída'
            });
        }

    } catch (error) {
        console.error('❌ Error marking conversation as read:', error.message);
        next(error);
    }
});

/**
 * DELETE /api/messages/conversation/:id
 * Eliminar conversación completa (conversación y todos sus mensajes)
 */
router.delete('/conversation/:id', async (req, res, next) => {
    try {
        const { id: conversationId } = req.params;
        const clientId = req.user.id;
        
        console.log(`🗑️ Eliminando conversación ID: ${conversationId} para cliente ID: ${clientId}`);
        
        const { executeQuery } = require('../config/database-simple');
        const Conversation = require('../entities/Conversation');
        
        // Verificar que la conversación existe y pertenece al cliente
        const conversation = await executeQuery(
            'SELECT * FROM conversations WHERE id = ? AND client_id = ?',
            [parseInt(conversationId), clientId]
        );
        
        if (conversation.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Conversación no encontrada'
            });
        }
        
        // Eliminar todos los mensajes de la conversación
        console.log(`🗑️ Eliminando mensajes de la conversación ${conversationId}`);
        await executeQuery(
            'DELETE FROM messages WHERE conversation_id = ?',
            [parseInt(conversationId)]
        );
        
        // Eliminar la conversación
        console.log(`🗑️ Eliminando conversación ${conversationId}`);
        await executeQuery(
            'DELETE FROM conversations WHERE id = ? AND client_id = ?',
            [parseInt(conversationId), clientId]
        );
        
        console.log(`✅ Conversación ${conversationId} eliminada exitosamente`);
        
        // Emitir evento por WebSocket para actualizar la UI en tiempo real
        const socketIo = req.app.get('socketio');
        if (socketIo) {
            const clientCode = req.user.clientCode;
            const roomName = `client_${clientCode}`;
            console.log(`📡 Emitting conversation:deleted to room: ${roomName}`);
            socketIo.to(roomName).emit('conversation:deleted', {
                clientCode,
                conversationId: parseInt(conversationId),
                timestamp: new Date()
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Conversación eliminada exitosamente',
            conversation_id: parseInt(conversationId)
        });
        
    } catch (error) {
        console.error('❌ Error deleting conversation:', error.message);
        next(error);
    }
});

/**
 * GET /api/messages/search
 * Buscar mensajes por contenido
 */
router.get('/search', async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const {
            q: searchTerm,
            limit = 50,
            offset = 0,
            conversationId = null
        } = req.query;

        if (!searchTerm) {
            return res.status(400).json({
                success: false,
                message: 'Parámetro de búsqueda "q" es requerido'
            });
        }

        const options = {
            limit: parseInt(limit),
            offset: parseInt(offset),
            conversationId: conversationId ? parseInt(conversationId) : null
        };

        const messages = await MessageService.searchMessages(clientId, searchTerm, options);

        res.status(200).json({
            success: true,
            messages,
            search_term: searchTerm,
            pagination: {
                limit: options.limit,
                offset: options.offset,
                total: messages.length
            }
        });

    } catch (error) {
        console.error('❌ Error searching messages:', error.message);
        next(error);
    }
});

// ============================================================================
// SEND MESSAGES - IMPLEMENTADO BÁSICO
// ============================================================================

/**
 * POST /api/messages/send
 * Enviar mensaje individual (redirige a WhatsApp controller)
 */
router.post('/send', (req, res) => {
    // Redirigir al endpoint de WhatsApp que ya está implementado
    res.status(200).json({
        success: true,
        message: 'Use POST /api/whatsapp/send-message para enviar mensajes',
        redirect: 'POST /api/whatsapp/send-message'
    });
});

/**
 * POST /api/messages/send-bulk
 * Enviar mensajes masivos (legacy endpoint - redirige a campaigns)
 */
router.post('/send-bulk', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Usa POST /api/messages/campaigns para crear campañas de mensajes masivos',
        redirect: 'POST /api/messages/campaigns',
        new_endpoints: {
            create_campaign: 'POST /api/messages/campaigns',
            preview_contacts: 'POST /api/messages/campaigns/preview',
            send_campaign: 'POST /api/messages/campaigns/:id/send'
        }
    });
});

// ============================================================================
// STATISTICS - IMPLEMENTADO
// ============================================================================

/**
 * GET /api/messages/stats
 * Obtener estadísticas de mensajes
 */
router.get('/stats', async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const { hours = 24 } = req.query;

        const stats = await MessageService.getMessageStats(clientId, {
            hours: parseInt(hours)
        });

        res.status(200).json({
            success: true,
            stats
        });

    } catch (error) {
        console.error('❌ Error getting message stats:', error.message);
        next(error);
    }
});

// ============================================================================
// TEMPLATES - ETAPA 4 ✅ COMPLETADO
// ============================================================================

/**
 * GET /api/messages/templates
 * Obtener templates de mensajes del cliente
 */
router.get('/templates', TemplateController.getTemplates);

/**
 * GET /api/messages/templates/categories
 * Obtener categorías disponibles
 */
router.get('/templates/categories', TemplateController.getCategories);

/**
 * GET /api/messages/templates/stats
 * Obtener estadísticas de uso de templates
 */
router.get('/templates/stats', TemplateController.getTemplateStats);

/**
 * GET /api/messages/templates/:id
 * Obtener template específico por ID
 */
router.get('/templates/:id', TemplateController.getTemplateById);

/**
 * POST /api/messages/templates
 * Crear nuevo template de mensaje
 */
router.post('/templates', TemplateController.createTemplate);

/**
 * POST /api/messages/templates/:id/preview
 * Generar preview del template con variables personalizadas
 */
router.post('/templates/:id/preview', TemplateController.previewTemplate);

/**
 * POST /api/messages/templates/:id/use
 * Usar template (incrementar contador de uso)
 */
router.post('/templates/:id/use', TemplateController.useTemplate);

/**
 * POST /api/messages/templates/duplicate/:id
 * Duplicar template existente
 */
router.post('/templates/duplicate/:id', TemplateController.duplicateTemplate);

/**
 * PUT /api/messages/templates/:id
 * Actualizar template de mensaje
 */
router.put('/templates/:id', TemplateController.updateTemplate);

/**
 * PUT /api/messages/templates/:id/toggle
 * Activar/desactivar template
 */
router.put('/templates/:id/toggle', TemplateController.toggleTemplate);

/**
 * DELETE /api/messages/templates/:id
 * Eliminar template de mensaje
 */
router.delete('/templates/:id', TemplateController.deleteTemplate);

// ============================================================================
// BULK MESSAGES / CAMPAIGNS - ETAPA 4 ✅ COMPLETADO
// ============================================================================

/**
 * GET /api/messages/campaigns
 * Obtener lista de campañas de mensajes masivos
 */
router.get('/campaigns', BulkMessageController.getCampaigns);

/**
 * GET /api/messages/campaigns/stats
 * Obtener estadísticas de campañas
 */
router.get('/campaigns/stats', BulkMessageController.getCampaignStats);

/**
 * GET /api/messages/campaigns/statuses
 * Obtener estados disponibles para campañas
 */
router.get('/campaigns/statuses', BulkMessageController.getCampaignStatuses);

/**
 * POST /api/messages/campaigns/preview
 * Previsualizar selección de contactos para campaña
 */
router.post('/campaigns/preview', BulkMessageController.previewContactSelection);

/**
 * GET /api/messages/campaigns/:id
 * Obtener campaña específica por ID
 */
router.get('/campaigns/:id', BulkMessageController.getCampaignById);

/**
 * POST /api/messages/campaigns
 * Crear nueva campaña de mensajes masivos
 */
router.post('/campaigns', BulkMessageController.createCampaign);

/**
 * PUT /api/messages/campaigns/:id
 * Actualizar campaña existente
 */
router.put('/campaigns/:id', BulkMessageController.updateCampaign);

/**
 * DELETE /api/messages/campaigns/:id
 * Eliminar campaña
 */
router.delete('/campaigns/:id', BulkMessageController.deleteCampaign);

/**
 * POST /api/messages/campaigns/:id/send
 * Enviar campaña inmediatamente
 */
router.post('/campaigns/:id/send', BulkMessageController.sendCampaign);

/**
 * POST /api/messages/campaigns/:id/cancel
 * Cancelar campaña
 */
router.post('/campaigns/:id/cancel', BulkMessageController.cancelCampaign);

// ============================================================================
// BOT CONTROL - GLOBAL
// ============================================================================

/**
 * POST /api/messages/bot/enable-all
 * Activar bot para todas las conversaciones del cliente
 */
router.post('/bot/enable-all', async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const { executeQuery } = require('../config/database-simple');
        
        // Activar bot para todas las conversaciones del cliente
        const result = await executeQuery(
            'UPDATE conversations SET bot_enabled = 1, updated_at = NOW() WHERE client_id = ?',
            [clientId]
        );
        
        console.log(`🤖 Bot enabled for all conversations of client ${clientId}`);
        
        res.status(200).json({
            success: true,
            message: 'Bot activado para todas las conversaciones',
            affected_conversations: result.affectedRows,
            client_id: clientId
        });
        
    } catch (error) {
        console.error('❌ Error enabling bot for all conversations:', error.message);
        next(error);
    }
});

/**
 * POST /api/messages/bot/disable-all
 * Desactivar bot para todas las conversaciones del cliente
 */
router.post('/bot/disable-all', async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const { executeQuery } = require('../config/database-simple');
        
        // Desactivar bot para todas las conversaciones del cliente
        const result = await executeQuery(
            'UPDATE conversations SET bot_enabled = 0, updated_at = NOW() WHERE client_id = ?',
            [clientId]
        );
        
        console.log(`🚫 Bot disabled for all conversations of client ${clientId}`);
        
        res.status(200).json({
            success: true,
            message: 'Bot desactivado para todas las conversaciones',
            affected_conversations: result.affectedRows,
            client_id: clientId
        });
        
    } catch (error) {
        console.error('❌ Error disabling bot for all conversations:', error.message);
        next(error);
    }
});

/**
 * GET /api/messages/bot/status
 * Obtener estadísticas del estado del bot
 */
router.get('/bot/status', async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const { executeQuery } = require('../config/database-simple');
        
        // Obtener estadísticas del bot
        const [stats] = await executeQuery(`
            SELECT 
                COUNT(*) as total_conversations,
                SUM(CASE WHEN bot_enabled = 1 THEN 1 ELSE 0 END) as bot_enabled_conversations,
                SUM(CASE WHEN bot_enabled = 0 THEN 1 ELSE 0 END) as bot_disabled_conversations,
                ROUND((SUM(CASE WHEN bot_enabled = 1 THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as bot_enabled_percentage
            FROM conversations 
            WHERE client_id = ?
        `, [clientId]);
        
        res.status(200).json({
            success: true,
            bot_status: {
                total_conversations: stats?.total_conversations || 0,
                bot_enabled_conversations: stats?.bot_enabled_conversations || 0,
                bot_disabled_conversations: stats?.bot_disabled_conversations || 0,
                bot_enabled_percentage: stats?.bot_enabled_percentage || 0,
                client_id: clientId
            }
        });
        
    } catch (error) {
        console.error('❌ Error getting bot status:', error.message);
        next(error);
    }
});

// ============================================================================
// BOT CONTROL - POR CONVERSACIÓN
// ============================================================================

/**
 * POST /api/messages/conversation/:id/bot/enable
 * Activar bot para una conversación específica
 */
router.post('/conversation/:id/bot/enable', async (req, res, next) => {
    try {
        const { id: conversationId } = req.params;
        const clientId = req.user.id;
        
        const Conversation = require('../entities/Conversation');
        const conversation = await Conversation.findById(parseInt(conversationId));
        
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversación no encontrada'
            });
        }
        
        // Verificar que la conversación pertenece al cliente
        if (conversation.client_id !== clientId) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para modificar esta conversación'
            });
        }
        
        await conversation.setBotEnabled(true);
        
        console.log(`🤖 Bot enabled for conversation ${conversationId} (${conversation.contact_phone})`);
        
        res.status(200).json({
            success: true,
            message: 'Bot activado para esta conversación',
            conversation: {
                id: conversation.id,
                contact_phone: conversation.contact_phone,
                contact_name: conversation.contact_name,
                bot_enabled: true
            }
        });
        
    } catch (error) {
        console.error('❌ Error enabling bot for conversation:', error.message);
        next(error);
    }
});

/**
 * POST /api/messages/conversation/:id/bot/disable
 * Desactivar bot para una conversación específica
 */
router.post('/conversation/:id/bot/disable', async (req, res, next) => {
    try {
        const { id: conversationId } = req.params;
        const clientId = req.user.id;
        
        const Conversation = require('../entities/Conversation');
        const conversation = await Conversation.findById(parseInt(conversationId));
        
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversación no encontrada'
            });
        }
        
        // Verificar que la conversación pertenece al cliente
        if (conversation.client_id !== clientId) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para modificar esta conversación'
            });
        }
        
        await conversation.setBotEnabled(false);
        
        console.log(`🚫 Bot disabled for conversation ${conversationId} (${conversation.contact_phone})`);
        
        res.status(200).json({
            success: true,
            message: 'Bot desactivado para esta conversación',
            conversation: {
                id: conversation.id,
                contact_phone: conversation.contact_phone,
                contact_name: conversation.contact_name,
                bot_enabled: false
            }
        });
        
    } catch (error) {
        console.error('❌ Error disabling bot for conversation:', error.message);
        next(error);
    }
});

/**
 * GET /api/messages/conversation/:id/bot/status
 * Obtener estado del bot para una conversación específica
 */
router.get('/conversation/:id/bot/status', async (req, res, next) => {
    try {
        const { id: conversationId } = req.params;
        const clientId = req.user.id;
        
        const Conversation = require('../entities/Conversation');
        const conversation = await Conversation.findById(parseInt(conversationId));
        
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversación no encontrada'
            });
        }
        
        // Verificar que la conversación pertenece al cliente
        if (conversation.client_id !== clientId) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para acceder a esta conversación'
            });
        }
        
        res.status(200).json({
            success: true,
            conversation: {
                id: conversation.id,
                contact_phone: conversation.contact_phone,
                contact_name: conversation.contact_name,
                bot_enabled: conversation.bot_enabled,
                last_message_at: conversation.last_message_at
            }
        });
        
    } catch (error) {
        console.error('❌ Error getting bot status for conversation:', error.message);
        next(error);
    }
});

// ============================================================================
// BOT CONFIGURATION - HORARIOS Y CONFIGURACIÓN
// ============================================================================

/**
 * GET /api/messages/bot/disabled-conversations
 * Obtener lista de conversaciones con bot desactivado
 */
router.get('/bot/disabled-conversations', async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const { limit = 50, offset = 0 } = req.query;
        
        const { executeQuery } = require('../config/database-simple');
        
        // Validar y sanitizar los valores de limit y offset
        const safeLimit = Math.max(1, Math.min(100, parseInt(limit))); // Entre 1 y 100
        const safeOffset = Math.max(0, parseInt(offset)); // Mínimo 0
        
        // Obtener conversaciones con bot desactivado
        const query = `
            SELECT c.id, c.contact_phone, c.contact_name, c.last_message, 
                   c.last_message_at, c.unread_count, c.bot_enabled,
                   c.created_at, c.updated_at
            FROM conversations c
            WHERE c.client_id = ? AND c.bot_enabled = 0
            ORDER BY c.last_message_at DESC
            LIMIT ${safeLimit} OFFSET ${safeOffset}
        `;
        
        const conversations = await executeQuery(query, [clientId]);
        
        // Contar total de conversaciones con bot desactivado
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM conversations 
            WHERE client_id = ? AND bot_enabled = 0
        `;
        const countResult = await executeQuery(countQuery, [clientId]);
        const total = countResult[0].total;
        
        console.log(`📋 Found ${conversations.length} conversations with bot disabled for client ${clientId}`);
        
        res.status(200).json({
            success: true,
            data: conversations,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: (parseInt(offset) + conversations.length) < total
            }
        });
        
    } catch (error) {
        console.error('❌ Error getting disabled bot conversations:', error.message);
        next(error);
    }
});

/**
 * POST /api/messages/bot/enable-conversations
 * Activar bot para conversaciones específicas
 */
router.post('/bot/enable-conversations', async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const { conversation_ids } = req.body;
        
        if (!conversation_ids || !Array.isArray(conversation_ids) || conversation_ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere un array de IDs de conversaciones'
            });
        }
        
        const { executeQuery } = require('../config/database-simple');
        
        // Verificar que todas las conversaciones pertenecen al cliente
        const placeholders = conversation_ids.map(() => '?').join(',');
        const verifyQuery = `
            SELECT id, contact_phone, contact_name 
            FROM conversations 
            WHERE client_id = ? AND id IN (${placeholders})
        `;
        
        const verifyParams = [clientId, ...conversation_ids];
        const existingConversations = await executeQuery(verifyQuery, verifyParams);
        
        if (existingConversations.length !== conversation_ids.length) {
            return res.status(400).json({
                success: false,
                message: 'Algunas conversaciones no existen o no pertenecen a tu cuenta'
            });
        }
        
        // Activar bot para las conversaciones especificadas
        const updateQuery = `
            UPDATE conversations 
            SET bot_enabled = 1, updated_at = NOW() 
            WHERE client_id = ? AND id IN (${placeholders})
        `;
        
        const result = await executeQuery(updateQuery, verifyParams);
        
        console.log(`🤖 Bot enabled for ${result.affectedRows} conversations of client ${clientId}`);
        
        res.status(200).json({
            success: true,
            message: `Bot activado para ${result.affectedRows} conversaciones`,
            affected_conversations: result.affectedRows,
            conversations: existingConversations
        });
        
    } catch (error) {
        console.error('❌ Error enabling bot for specific conversations:', error.message);
        next(error);
    }
});

/**
 * GET /api/messages/bot/config
 * Obtener configuración actual del bot
 */
router.get('/bot/config', async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const { executeQuery } = require('../config/database-simple');
        
        // Obtener configuración del bot
        const results = await executeQuery(
            'SELECT * FROM bot_configurations WHERE client_id = ?',
            [clientId]
        );
        
        let botConfig;
        if (results.length === 0) {
            // Crear configuración por defecto si no existe
            await executeQuery(`
                INSERT INTO bot_configurations 
                (client_id, is_enabled, working_hours_start, working_hours_end, working_days, 
                 auto_response_delay, fallback_message, max_auto_responses_per_conversation, product_search_enabled) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                clientId, 
                true, 
                '00:00:00', 
                '23:59:00', 
                JSON.stringify([0, 1, 2, 3, 4, 5, 6]), // Todos los días
                2000, 
                'Lo siento, no pude entender tu consulta. Un agente te contactará pronto.',
                5,
                false  // Por defecto, solo respuestas de texto (sin búsqueda de productos)
            ]);
            
            // Obtener la configuración recién creada
            const newResults = await executeQuery(
                'SELECT * FROM bot_configurations WHERE client_id = ?',
                [clientId]
            );
            botConfig = newResults[0];
        } else {
            botConfig = results[0];
        }
        
        // Parsear working_days si es string
        if (typeof botConfig.working_days === 'string') {
            try {
                botConfig.working_days = JSON.parse(botConfig.working_days);
            } catch (e) {
                botConfig.working_days = [1, 2, 3, 4, 5];
            }
        }
        
        res.status(200).json({
            success: true,
            bot_config: {
                id: botConfig.id,
                client_id: botConfig.client_id,
                is_enabled: botConfig.is_enabled,
                working_hours: {
                    start: botConfig.working_hours_start,
                    end: botConfig.working_hours_end,
                    days: botConfig.working_days
                },
                settings: {
                    auto_response_delay: botConfig.auto_response_delay,
                    max_auto_responses_per_conversation: botConfig.max_auto_responses_per_conversation,
                    fallback_message: botConfig.fallback_message,
                    welcome_message: botConfig.welcome_message,
                    custom_instructions: botConfig.custom_instructions,
                    product_search_enabled: botConfig.product_search_enabled
                },
                created_at: botConfig.created_at,
                updated_at: botConfig.updated_at
            }
        });
        
    } catch (error) {
        console.error('❌ Error getting bot configuration:', error.message);
        next(error);
    }
});

/**
 * POST /api/messages/bot/toggle
 * Alternar estado global del bot (habilitar/deshabilitar)
 */
router.post('/bot/toggle', async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const { executeQuery } = require('../config/database-simple');
        
        // Obtener configuración actual
        const currentConfig = await executeQuery(
            'SELECT is_enabled FROM bot_configurations WHERE client_id = ?',
            [clientId]
        );
        
        let newStatus;
        if (currentConfig.length === 0) {
            // Crear configuración por defecto si no existe (habilitado)
            await executeQuery(`
                INSERT INTO bot_configurations 
                (client_id, is_enabled, working_hours_start, working_hours_end, working_days, 
                 auto_response_delay, fallback_message, max_auto_responses_per_conversation, product_search_enabled) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                clientId, 
                false, // Lo creamos deshabilitado ya que el usuario quiere togglear
                '00:00:00', 
                '23:59:00', 
                JSON.stringify([0, 1, 2, 3, 4, 5, 6]),
                2000, 
                'Lo siento, no pude entender tu consulta. Un agente te contactará pronto.',
                5,
                false
            ]);
            newStatus = false;
        } else {
            // Alternar el estado actual
            newStatus = !currentConfig[0].is_enabled;
            await executeQuery(
                'UPDATE bot_configurations SET is_enabled = ?, updated_at = NOW() WHERE client_id = ?',
                [newStatus, clientId]
            );
        }
        
        console.log(`🤖 Cliente ${req.user.client_code} ${newStatus ? 'habilitó' : 'deshabilitó'} el bot globalmente`);
        
        res.status(200).json({
            success: true,
            message: `Bot ${newStatus ? 'habilitado' : 'deshabilitado'} globalmente`,
            data: {
                is_enabled: newStatus,
                status: newStatus ? 'enabled' : 'disabled'
            }
        });
        
    } catch (error) {
        console.error('❌ Error toggling bot status:', error.message);
        next(error);
    }
});

/**
 * PUT /api/messages/bot/config
 * Actualizar configuración del bot
 */
router.put('/bot/config', async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const { executeQuery } = require('../config/database-simple');
        
        const {
            is_enabled,
            working_hours_start,
            working_hours_end,
            working_days,
            auto_response_delay,
            max_auto_responses_per_conversation,
            fallback_message,
            welcome_message,
            custom_instructions,
            product_search_enabled
        } = req.body;
        
        // Validar horarios
        if (working_hours_start && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(working_hours_start)) {
            return res.status(400).json({
                success: false,
                message: 'Formato de hora de inicio inválido. Use HH:MM (ej: 09:00)'
            });
        }
        
        if (working_hours_end && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(working_hours_end)) {
            return res.status(400).json({
                success: false,
                message: 'Formato de hora de fin inválido. Use HH:MM (ej: 18:00)'
            });
        }
        
        // Validar días de trabajo
        if (working_days && (!Array.isArray(working_days) || !working_days.every(day => day >= 0 && day <= 6))) {
            return res.status(400).json({
                success: false,
                message: 'Días de trabajo inválidos. Use array de números 0-6 (0=Domingo, 1=Lunes, etc.)'
            });
        }
        
        // Construir query de actualización dinámicamente
        const updateFields = [];
        const updateValues = [];
        
        if (is_enabled !== undefined) {
            updateFields.push('is_enabled = ?');
            updateValues.push(is_enabled);
        }
        
        if (working_hours_start) {
            updateFields.push('working_hours_start = ?');
            updateValues.push(working_hours_start + ':00');
        }
        
        if (working_hours_end) {
            updateFields.push('working_hours_end = ?');
            updateValues.push(working_hours_end + ':00');
        }
        
        if (working_days) {
            updateFields.push('working_days = ?');
            updateValues.push(JSON.stringify(working_days));
        }
        
        if (auto_response_delay !== undefined) {
            updateFields.push('auto_response_delay = ?');
            updateValues.push(auto_response_delay);
        }
        
        if (max_auto_responses_per_conversation !== undefined) {
            updateFields.push('max_auto_responses_per_conversation = ?');
            updateValues.push(max_auto_responses_per_conversation);
        }
        
        if (fallback_message !== undefined) {
            updateFields.push('fallback_message = ?');
            updateValues.push(fallback_message);
        }
        
        if (welcome_message !== undefined) {
            updateFields.push('welcome_message = ?');
            updateValues.push(welcome_message);
        }
        
        if (custom_instructions !== undefined) {
            updateFields.push('custom_instructions = ?');
            updateValues.push(custom_instructions);
        }
        
        if (product_search_enabled !== undefined) {
            updateFields.push('product_search_enabled = ?');
            updateValues.push(product_search_enabled);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No se proporcionaron campos para actualizar'
            });
        }
        
        // Agregar updated_at
        updateFields.push('updated_at = NOW()');
        updateValues.push(clientId);
        
        // Ejecutar actualización
        const result = await executeQuery(
            `UPDATE bot_configurations SET ${updateFields.join(', ')} WHERE client_id = ?`,
            updateValues
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Configuración del bot no encontrada'
            });
        }
        
        // Obtener configuración actualizada
        const updatedConfig = await executeQuery(
            'SELECT * FROM bot_configurations WHERE client_id = ?',
            [clientId]
        );
        
        const botConfig = updatedConfig[0];
        
        // Parsear working_days
        if (typeof botConfig.working_days === 'string') {
            try {
                botConfig.working_days = JSON.parse(botConfig.working_days);
            } catch (e) {
                botConfig.working_days = [1, 2, 3, 4, 5];
            }
        }
        
        console.log(`⚙️ Bot configuration updated for client ${clientId}`);
        
        res.status(200).json({
            success: true,
            message: 'Configuración del bot actualizada correctamente',
            bot_config: {
                id: botConfig.id,
                client_id: botConfig.client_id,
                is_enabled: botConfig.is_enabled,
                working_hours: {
                    start: botConfig.working_hours_start,
                    end: botConfig.working_hours_end,
                    days: botConfig.working_days
                },
                settings: {
                    auto_response_delay: botConfig.auto_response_delay,
                    max_auto_responses_per_conversation: botConfig.max_auto_responses_per_conversation,
                    fallback_message: botConfig.fallback_message,
                    welcome_message: botConfig.welcome_message,
                    custom_instructions: botConfig.custom_instructions
                },
                updated_at: botConfig.updated_at
            }
        });
        
    } catch (error) {
        console.error('❌ Error updating bot configuration:', error.message);
        next(error);
    }
});

/**
 * POST /api/messages/bot/config/reset
 * Resetear configuración del bot a valores por defecto
 */
router.post('/bot/config/reset', async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const { executeQuery } = require('../config/database-simple');
        
        // Resetear a configuración por defecto
        const result = await executeQuery(`
            UPDATE bot_configurations 
            SET is_enabled = ?, 
                working_hours_start = ?, 
                working_hours_end = ?, 
                working_days = ?, 
                auto_response_delay = ?, 
                max_auto_responses_per_conversation = ?, 
                fallback_message = ?, 
                welcome_message = NULL, 
                custom_instructions = NULL,
                product_search_enabled = ?,
                updated_at = NOW()
            WHERE client_id = ?
        `, [
            true,
            '00:00:00',
            '23:59:00',
            JSON.stringify([0, 1, 2, 3, 4, 5, 6]),
            2000,
            5,
            'Lo siento, no pude entender tu consulta. Un agente te contactará pronto.',
            false,  // Por defecto, solo respuestas de texto (sin búsqueda de productos)
            clientId
        ]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Configuración del bot no encontrada'
            });
        }
        
        console.log(`🔄 Bot configuration reset to defaults for client ${clientId}`);
        
        res.status(200).json({
            success: true,
            message: 'Configuración del bot restablecida a valores por defecto',
            bot_config: {
                is_enabled: true,
                working_hours: {
                    start: '00:00:00',
                    end: '23:59:00',
                    days: [0, 1, 2, 3, 4, 5, 6]
                },
                settings: {
                    auto_response_delay: 2000,
                    max_auto_responses_per_conversation: 5,
                    fallback_message: 'Lo siento, no pude entender tu consulta. Un agente te contactará pronto.',
                    welcome_message: null,
                    custom_instructions: null
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Error resetting bot configuration:', error.message);
        next(error);
    }
});

/**
 * GET /api/messages/bot/config/working-hours/status
 * Verificar si el bot está en horario de trabajo actualmente
 */
router.get('/bot/config/working-hours/status', async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const MessageService = require('../services/MessageService');
        
        // Obtener configuración del bot
        const botConfig = await MessageService.getBotConfiguration(clientId);
        
        if (!botConfig) {
            return res.status(404).json({
                success: false,
                message: 'Configuración del bot no encontrada'
            });
        }
        
        // Verificar si está en horario de trabajo
        const isWorkingHours = MessageService.isBotWorkingHours(botConfig);
        
        // Información adicional
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentDay = now.getDay();
        
        const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        
        let workingDays;
        try {
            workingDays = botConfig.working_days ? JSON.parse(botConfig.working_days) : [1, 2, 3, 4, 5];
        } catch (e) {
            workingDays = [1, 2, 3, 4, 5];
        }
        
        res.status(200).json({
            success: true,
            working_hours_status: {
                is_working_hours: isWorkingHours,
                is_bot_enabled: botConfig.is_enabled,
                current_time: {
                    hour: currentHour,
                    minute: currentMinute,
                    day: currentDay,
                    day_name: dayNames[currentDay],
                    formatted: `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`
                },
                configured_hours: {
                    start: botConfig.working_hours_start,
                    end: botConfig.working_hours_end,
                    working_days: workingDays,
                    working_days_names: workingDays.map(day => dayNames[day])
                },
                status_message: isWorkingHours && botConfig.is_enabled ? 
                    'Bot activo - En horario de trabajo' : 
                    !botConfig.is_enabled ? 
                        'Bot deshabilitado' : 
                        'Bot inactivo - Fuera de horario de trabajo'
            }
        });
        
    } catch (error) {
        console.error('❌ Error checking working hours status:', error.message);
        next(error);
    }
});

// ============================================================================

// HEALTH CHECK
// ============================================================================

/**
 * GET /api/messages/health
 * Health check específico para el módulo de mensajes
 */
router.get('/health', async (req, res) => {
    try {
        // Verificar servicios relacionados
        const AIService = require('../services/AIService');
        const aiHealth = await AIService.healthCheck();

        res.json({
            module: 'messages',
            status: 'ACTIVE',
            timestamp: new Date().toISOString(),
            services: {
                message_service: 'active',
                ai_service: aiHealth.status
            },
            endpoints: {
                active: [
                    'GET /api/messages/conversations',
                    'GET /api/messages/conversation/:id',
                    'POST /api/messages/conversation/:id/read',
                    'GET /api/messages/search',
                    'GET /api/messages/stats',
                    'POST /api/messages/bot/enable-all',
                    'POST /api/messages/bot/disable-all',
                    'GET /api/messages/bot/status',
                    'POST /api/messages/conversation/:id/bot/enable',
                    'POST /api/messages/conversation/:id/bot/disable',
                    'GET /api/messages/conversation/:id/bot/status',
                    'GET /api/messages/bot/config',
                    'PUT /api/messages/bot/config',
                    'POST /api/messages/bot/config/reset',
                    'GET /api/messages/bot/config/working-hours/status'
                ],
                development: [
                    'POST /api/messages/send-bulk',
                    'GET /api/messages/templates',
                    'POST /api/messages/templates',
                    'PUT /api/messages/templates/:id',
                    'DELETE /api/messages/templates/:id'
                ]
            }
        });
    } catch (error) {
        res.status(500).json({
            module: 'messages',
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// ============================================================================
// TESTING ENDPOINTS (SIN AUTENTICACIÓN - PARA DASHBOARD)
// ============================================================================

/**
 * GET /api/messages/bot/status/public
 * Endpoint público para testing del estado del bot (sin autenticación)
 */
router.get('/bot/status/public', async (req, res) => {
    try {
        console.log('🧪 Public bot status endpoint called');
        
        // Datos de ejemplo para testing
        const mockBotStatus = {
            enabled: true,
            responses: 47,
            responsesToday: 12,
            enabledConversations: 15,
            disabledConversations: 3,
            percentage: 83.33,
            productSearchEnabled: true
        };

        res.json({
            success: true,
            bot_status: {
                total_conversations: mockBotStatus.enabledConversations + mockBotStatus.disabledConversations,
                bot_enabled_conversations: mockBotStatus.enabledConversations,
                bot_disabled_conversations: mockBotStatus.disabledConversations,
                bot_enabled_percentage: mockBotStatus.percentage,
                responses_today: mockBotStatus.responsesToday,
                total_responses: mockBotStatus.responses,
                product_search_enabled: mockBotStatus.productSearchEnabled,
                status: mockBotStatus.enabled ? 'active' : 'inactive'
            },
            message: 'Bot status retrieved successfully (PUBLIC TEST ENDPOINT)'
        });
        
    } catch (error) {
        console.error('❌ Error in public bot status:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error retrieving bot status',
            error: error.message
        });
    }
});

/**
 * GET /api/messages/bot/quota/public
 * Endpoint público para testing de la cuota del bot (sin autenticación)
 */
router.get('/bot/quota/public', async (req, res) => {
    try {
        console.log('🧪 Public bot quota endpoint called');
        
        // Datos de ejemplo para testing
        const mockQuota = {
            usage: 1847,
            limit: 2500,
            remaining: 653,
            percentage: 73.88,
            allowed: true,
            resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()
        };

        res.json({
            success: true,
            quota: mockQuota,
            message: mockQuota.allowed 
                ? `Tienes ${mockQuota.remaining} respuestas automáticas disponibles este mes`
                : 'Límite mensual de respuestas automáticas excedido'
        });
        
    } catch (error) {
        console.error('❌ Error in public bot quota:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error retrieving bot quota',
            error: error.message
        });
    }
});

// ============================================================================
// WHATSAPP STATUS PUBLIC ENDPOINT
// ============================================================================

/**
 * GET /api/messages/whatsapp/status/public
 * Endpoint público para testing del estado de WhatsApp (sin autenticación)
 */
router.get('/whatsapp/status/public', async (req, res) => {
    try {
        console.log('🧪 Public WhatsApp status endpoint called');
        
        // Datos de ejemplo para testing
        const mockWhatsAppStatus = {
            connected: true,
            phoneNumber: '+54911XXXXXXXX',
            clientInfo: {
                pushname: 'CRM Condorito',
                wid: 'demo@c.us'
            },
            lastSeen: new Date().toISOString(),
            battery: 85,
            plugged: true
        };

        res.json({
            success: true,
            status: 'connected',
            connected: mockWhatsAppStatus.connected,
            hasQR: false,
            phoneNumber: mockWhatsAppStatus.phoneNumber,
            clientInfo: mockWhatsAppStatus.clientInfo,
            data: mockWhatsAppStatus,
            message: 'WhatsApp status retrieved successfully (PUBLIC TEST ENDPOINT)'
        });
        
    } catch (error) {
        console.error('❌ Error in public WhatsApp status:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error retrieving WhatsApp status',
            error: error.message
        });
    }
});

/**
 * POST /api/messages/bot/products/enable
 * Habilitar búsqueda de productos para el bot
 */
router.post('/bot/products/enable', async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const { executeQuery } = require('../config/database-simple');
        
        const result = await executeQuery(`
            UPDATE bot_configurations 
            SET product_search_enabled = TRUE, updated_at = NOW()
            WHERE client_id = ?
        `, [clientId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Configuración del bot no encontrada'
            });
        }
        
        res.json({
            success: true,
            message: 'Búsqueda de productos habilitada correctamente',
            product_search_enabled: true
        });
        
    } catch (error) {
        console.error('❌ Error enabling product search:', error.message);
        next(error);
    }
});

/**
 * POST /api/messages/bot/products/disable
 * Deshabilitar búsqueda de productos para el bot
 */
router.post('/bot/products/disable', async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const { executeQuery } = require('../config/database-simple');
        
        const result = await executeQuery(`
            UPDATE bot_configurations 
            SET product_search_enabled = FALSE, updated_at = NOW()
            WHERE client_id = ?
        `, [clientId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Configuración del bot no encontrada'
            });
        }
        
        res.json({
            success: true,
            message: 'Búsqueda de productos deshabilitada correctamente',
            product_search_enabled: false
        });
        
    } catch (error) {
        console.error('❌ Error disabling product search:', error.message);
        next(error);
    }
});

/**
 * GET /api/messages/bot/products/status
 * Obtener estado de la búsqueda de productos
 */
router.get('/bot/products/status', async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const { executeQuery } = require('../config/database-simple');
        
        const results = await executeQuery(
            'SELECT product_search_enabled FROM bot_configurations WHERE client_id = ?',
            [clientId]
        );
        
        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Configuración del bot no encontrada'
            });
        }
        
        const productSearchEnabled = results[0].product_search_enabled;
        
        res.json({
            success: true,
            product_search_status: {
                enabled: productSearchEnabled,
                mode: productSearchEnabled ? 'Respuestas con búsqueda de productos' : 'Solo respuestas de texto',
                description: productSearchEnabled 
                    ? 'El bot puede buscar y mostrar productos de la base de datos'
                    : 'El bot solo responde con información del archivo de texto'
            }
        });
        
    } catch (error) {
        console.error('❌ Error getting product search status:', error.message);
        next(error);
    }
});

// ============================================================================
// BOT QUOTA MANAGEMENT
// ============================================================================

/**
 * GET /api/messages/bot/quota
 * Obtener estado de cuota del bot
 */
router.get('/bot/quota', authenticateToken, logAccess, async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const clientCode = req.user.clientCode;
        
        console.log(`📊 Obteniendo quota para cliente ${clientCode} (ID: ${clientId})`);
        
        // Usar servicio centralizado en lugar del método deprecated
        const quotaStatus = await BotQuotaService.checkQuotaAvailable(clientCode);
        const usageStats = await MessageService.getBotUsageStats(clientId);
        
        console.log(`📊 quotaStatus:`, quotaStatus);
        console.log(`📊 usageStats:`, usageStats);
        
        res.json({
            success: true,
            quota: {
                // Información de mensajes
                usage: quotaStatus.usage || 0,
                limit: quotaStatus.limit || 2500,
                remaining: quotaStatus.remaining || 2500,
                percentage: quotaStatus.percentage || 0,
                // Información de tokens
                tokenUsage: quotaStatus.tokenUsage || 0,
                tokenLimit: quotaStatus.tokenLimit || 100000,
                tokensRemaining: quotaStatus.tokensRemaining || 100000,
                tokenPercentage: quotaStatus.tokenPercentage || 0,
                // Información general
                resetDate: usageStats.next_reset_date,
                status: quotaStatus.available ? "active" : "exceeded",
                allowed: quotaStatus.available,
                limits: quotaStatus.limits
            },
            message: quotaStatus.message || (
                quotaStatus.available 
                    ? `Tienes ${quotaStatus.remaining} mensajes y ${quotaStatus.tokensRemaining} tokens disponibles este mes`
                    : "Límite mensual excedido"
            )
        });
        
    } catch (error) {
        console.error('❌ Error getting bot quota:', error.message);
        next(error);
    }
});

/**
 * POST /api/messages/bot/quota/sync
 * Sincronizar cuota del bot con el historial (endpoint temporal)
 */
router.post('/bot/quota/sync', authenticateToken, logAccess, async (req, res, next) => {
    try {
        console.log('🔄 Iniciando sincronización manual de bot quota...');
        
        // Forzar sincronización
        await MessageService.syncBotUsageFromHistory();
        
        // Obtener estado actualizado usando servicio centralizado
        const clientId = req.user.id;
        const clientCode = req.user.clientCode;
        const quotaStatus = await BotQuotaService.checkQuotaAvailable(clientCode);
        
        res.json({
            success: true,
            message: 'Sincronización completada',
            quota: {
                usage: quotaStatus.usage || 0,
                limit: quotaStatus.limit || 2500,
                remaining: quotaStatus.remaining || 2500,
                percentage: quotaStatus.percentage || 0
            }
        });
        
    } catch (error) {
        console.error('❌ Error syncing bot quota:', error.message);
        next(error);
    }
});

/**
 * PUT /api/messages/bot/quota
 * Actualizar límite mensual del bot
 */
router.put('/bot/quota', authenticateToken, logAccess, async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const { monthly_bot_limit } = req.body;
        
        // Validaciones
        if (!monthly_bot_limit || !Number.isInteger(monthly_bot_limit) || monthly_bot_limit < 0) {
            return res.status(400).json({
                success: false,
                message: 'monthly_bot_limit debe ser un número entero positivo',
                code: 'INVALID_LIMIT'
            });
        }
        
        if (monthly_bot_limit > 50000) {
            return res.status(400).json({
                success: false,
                message: 'El límite máximo permitido es 50,000 mensajes por mes',
                code: 'LIMIT_TOO_HIGH'
            });
        }
        
        const success = await MessageService.updateBotLimit(clientId, monthly_bot_limit);
        
        if (success) {
            // Obtener nuevo estado
            const newStats = await MessageService.getBotUsageStats(clientId);
            
            res.json({
                success: true,
                message: 'Límite mensual del bot actualizado correctamente',
                quota: {
                    monthly_bot_limit,
                    current_usage: newStats.current_bot_usage,
                    remaining: newStats.remaining,
                    percentage: newStats.percentage
                }
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Error al actualizar el límite del bot',
                code: 'UPDATE_FAILED'
            });
        }
        
    } catch (error) {
        console.error('❌ Error updating bot quota:', error.message);
        next(error);
    }
});

/**
 * POST /api/messages/bot/quota/reset
 * Resetear contador de uso del bot (solo para testing/admin)
 */
router.post('/bot/quota/reset', authenticateToken, logAccess, async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const clientCode = req.user.clientCode;
        
        const { executeQuery } = require('../config/database-simple');
        
        // Reset del contador y fecha
        const today = new Date();
        const resetDate = new Date(today.getFullYear(), today.getMonth(), 1);
        
        await executeQuery(
            'UPDATE clients SET current_bot_usage = 0, bot_usage_reset_date = ? WHERE id = ?',
            [resetDate.toISOString().split('T')[0], clientId]
        );
        
        // Obtener nuevo estado
        const newStats = await MessageService.getBotUsageStats(clientId);
        
        res.json({
            success: true,
            message: 'Contador de uso del bot reseteado correctamente',
            quota: {
                usage: 0,
                limit: newStats.monthly_bot_limit,
                remaining: newStats.monthly_bot_limit,
                percentage: 0,
                resetDate: newStats.bot_usage_reset_date
            }
        });
        
        console.log(`🔄 Manual bot quota reset for client ${clientCode}`);
        
    } catch (error) {
        console.error('❌ Error resetting bot quota:', error.message);
        next(error);
    }
});

/**
 * GET /api/messages/bot/quota/history
 * Obtener historial de uso del bot (mensajes enviados por día)
 */
router.get('/bot/quota/history', authenticateToken, logAccess, async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const { days = 30 } = req.query;
        
        const { executeQuery } = require('../config/database-simple');
        
        // Obtener estadísticas de mensajes del bot por día
        const history = await executeQuery(`
            SELECT 
                DATE(m.sent_at) as date,
                COUNT(m.id) as bot_messages_sent,
                COUNT(DISTINCT c.id) as conversations_active
            FROM messages m
            INNER JOIN conversations c ON m.conversation_id = c.id
            WHERE c.client_id = ? 
                AND m.is_from_bot = 1 
                AND m.sent_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY DATE(m.sent_at)
            ORDER BY date DESC
        `, [clientId, parseInt(days)]);
        
        // Calcular totales
        const totalBotMessages = history.reduce((sum, day) => sum + day.bot_messages_sent, 0);
        const avgPerDay = history.length > 0 ? Math.round(totalBotMessages / history.length) : 0;
        
        res.json({
            success: true,
            history,
            summary: {
                total_days: history.length,
                total_bot_messages: totalBotMessages,
                avg_per_day: avgPerDay,
                period_days: parseInt(days)
            }
        });
        
    } catch (error) {
        console.error('❌ Error getting bot quota history:', error.message);
        next(error);
    }
});

// ============================================================================
// TESTING ENDPOINTS - FUNCIONALIDADES PREMIUM
// ============================================================================

router.get('/test-premium', async (req, res) => {
    try {
        const clientId = req.user.id;
        const { executeQuery } = require('../config/database');
        
        // Test templates directo
        const templates = await executeQuery('SELECT * FROM message_templates WHERE client_id = ? LIMIT 5', [clientId]);
        const templatesProcessed = templates.map(t => {
            if (t.variables) {
                try {
                    t.variables = JSON.parse(t.variables);
                } catch (e) {
                    t.variables = [];
                }
            }
            return t;
        });
        
        // Test contactos directo
        const contacts = await executeQuery('SELECT * FROM contacts WHERE client_id = ? LIMIT 5', [clientId]);
        
        // Test etiquetas directo
        const tags = await executeQuery('SELECT * FROM contact_tags WHERE client_id = ? LIMIT 5', [clientId]);
        
        res.json({
            success: true,
            message: '🎉 Funcionalidades Premium Funcionando',
            data: {
                templates: {
                    count: templatesProcessed.length,
                    sample: templatesProcessed.slice(0, 2)
                },
                contacts: {
                    count: contacts.length,
                    sample: contacts.slice(0, 2)
                },
                tags: {
                    count: tags.length,
                    sample: tags
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Error testing premium:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;