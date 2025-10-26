const Message = require('../entities/Message');
const Conversation = require('../entities/Conversation');
const whatsappService = require('./WhatsAppService');
const fileStorageService = require('./FileStorageService');
const BotQuotaService = require('./BotQuotaService');

// 🚀 Sistema de logs optimizado para performance
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'INFO' : 'DEBUG');
const ENABLE_DEBUG = LOG_LEVEL === 'DEBUG' || LOG_LEVEL === 'TRACE';
const ENABLE_TRACE = LOG_LEVEL === 'TRACE';

// Helper de logs condicionales (solo se ejecutan si el nivel lo permite)
const log = {
    error: (msg, data) => console.error(`❌ ${msg}`, data || ''),
    warn: (msg, data) => console.warn(`⚠️ ${msg}`, data || ''),
    info: (msg, data) => console.log(`ℹ️ ${msg}`, data || ''),
    success: (msg, data) => console.log(`✅ ${msg}`, data || ''),
    bot: (msg, data) => console.log(`🤖 ${msg}`, data || ''),
    ai: (msg, data) => console.log(`🧠 ${msg}`, data || ''),
    // Logs de debug solo en desarrollo
    debug: (msg, data) => ENABLE_DEBUG && console.log(`🔍 ${msg}`, data || ''),
    trace: (msg, data) => ENABLE_TRACE && console.log(`📝 ${msg}`, data || ''),
    message: (msg, data) => ENABLE_DEBUG && console.log(`📨 ${msg}`, data || ''),
    send: (msg, data) => ENABLE_DEBUG && console.log(`📤 ${msg}`, data || ''),
    receive: (msg, data) => ENABLE_DEBUG && console.log(`📥 ${msg}`, data || ''),
    db: (msg, data) => ENABLE_DEBUG && console.log(`💾 ${msg}`, data || ''),
    socket: (msg, data) => ENABLE_DEBUG && console.log(`🔌 ${msg}`, data || '')
};

/**
 * Servicio de Mensajes - Maneja toda la lógica de mensajes de WhatsApp
 */
class MessageService {
    // Cache para rastrear mensajes ya procesados
    static processedMessages = new Set();

    /**
     * Manejar mensaje entrante de WhatsApp
     * @param {number} clientId - ID del cliente
     * @param {string} clientCode - Código del cliente
     * @param {Object} whatsappMessage - Mensaje de whatsapp-web.js
     * @param {Object} socketIo - Instancia de Socket.io
     * @returns {Promise<Message>} Mensaje guardado
     */
    static async handleIncomingMessage(clientId, clientCode, whatsappMessage, socketIo = null) {
        try {
            log.message(`Processing message for ${clientCode}: ${whatsappMessage.body?.substring(0, 50)}...`);

            const messageId = whatsappMessage.id._serialized;

            // Verificar si el mensaje ya está siendo procesado (cache en memoria)
            if (this.processedMessages.has(messageId)) {
                console.log(`⚠️ Message already being processed: ${messageId}, skipping...`);
                return null;
            }

            // Marcar mensaje como en proceso ANTES de verificar BD para evitar race conditions
            this.processedMessages.add(messageId);

            // Verificar si el mensaje ya existe en BD
            const existingMessage = await Message.findByMessageId(messageId);
            if (existingMessage) {
                console.log(`⚠️ Message already exists in DB: ${messageId}, skipping...`);
                // Limpiar del cache ya que no necesitamos procesarlo
                this.processedMessages.delete(messageId);
                return existingMessage;
            }

            // Extraer información del contacto
            // Si el mensaje es enviado por el cliente (fromMe=true), usar el destinatario (to)
            // Si el mensaje es recibido (fromMe=false), usar el remitente (from)
            const contactPhone = whatsappMessage.fromMe ? 
                                (whatsappMessage.to || whatsappMessage.from) : 
                                whatsappMessage.from;
            
            log.debug(`Contact determination: fromMe=${whatsappMessage.fromMe}, from=${whatsappMessage.from}, to=${whatsappMessage.to}, selected=${contactPhone}`);
            
            // Filtrar estados de WhatsApp completamente - no procesar como mensajes del CRM
            if (contactPhone.includes('status@broadcast') || 
                contactPhone.includes('broadcast') || 
                contactPhone === 'status@broadcast') {
                console.log(`📱 Estado de WhatsApp ignorado completamente: ${contactPhone}`);
                return null; // No procesar como mensaje del CRM
            }
            
            const contactName = whatsappMessage._data?.notifyName || 
                              whatsappMessage.author || 
                              contactPhone.split('@')[0];

            // Obtener o crear conversación
            const conversation = await Conversation.findOrCreate(clientId, contactPhone, contactName);

            // Clasificar el mensaje
            const classification = this.classifyMessage(clientCode, whatsappMessage);

            // Preparar datos del mensaje
            const messageData = {
                conversation_id: conversation.id,
                message_id: whatsappMessage.id._serialized,
                sender_type: classification.senderType,
                from_me: whatsappMessage.fromMe,
                is_from_bot: classification.isFromBot,
                content: whatsappMessage.body || '',
                message_type: this.getMessageType(whatsappMessage),
                sent_at: new Date(whatsappMessage.timestamp * 1000),
                is_read: whatsappMessage.fromMe // Mensajes propios se marcan como leídos
            };

            // Agregar datos de media si es multimedia
            if (whatsappMessage.hasMedia) {
                const mediaData = await this.processMediaMessage(whatsappMessage);
                Object.assign(messageData, mediaData);
            }

            // Guardar mensaje en BD con manejo de duplicados
            let savedMessage;
            try {
                savedMessage = await Message.create(messageData);
            } catch (error) {
                // Si es error de clave duplicada, verificar si el mensaje ya existe
                if (error.message.includes('Duplicate entry') && error.message.includes('message_id')) {
                    console.log(`⚠️ Duplicate message_id detected: ${messageId}, fetching existing message...`);
                    const existingMessage = await Message.findByMessageId(messageId);
                    if (existingMessage) {
                        // Limpiar del cache
                        this.processedMessages.delete(messageId);
                        return existingMessage;
                    }
                }
                // Si no es error de duplicado o no encontramos el mensaje, relanzar error
                throw error;
            }

            // Actualizar conversación
            await conversation.updateLastMessage(
                messageData.content || `[${messageData.message_type}]`,
                messageData.sent_at
            );

            // Incrementar contador de no leídos si es mensaje recibido
            if (!whatsappMessage.fromMe) {
                await conversation.incrementUnreadCount();
                
                // Enviar notificación push para mensajes recibidos
                await this.sendPushNotificationForMessage(clientId, savedMessage, conversation);
            }

            // Si el cliente envió un mensaje manual, deshabilitar bot para esta conversación
            if (classification.senderType === 'client') {
                await conversation.setBotEnabled(false);
                log.bot(`Bot disabled for conversation ${contactPhone} (manual message sent)`);
            }

            // Emitir evento por Socket.io SOLO al cliente específico
            if (socketIo) {
                const roomName = `client_${clientCode}`;
                console.log(`📡 Emitting message:new to room: ${roomName}`);
                
                socketIo.to(roomName).emit('message:new', {
                    clientCode,
                    message: savedMessage.toJSON(),
                    conversation: conversation.toJSON(),
                    timestamp: new Date()
                });

                // Emitir estadísticas actualizadas SOLO al cliente específico
                try {
                    const updatedStats = await this.getMessageStats(clientId);
                    console.log(`📊 Emitting stats:updated to room: ${roomName}`);
                    
                    socketIo.to(roomName).emit('stats:updated', {
                        clientCode,
                        stats: updatedStats,
                        timestamp: new Date()
                    });
                } catch (error) {
                    console.error('Error emitting stats update:', error);
                }
            }

            // Procesar respuesta automática si corresponde
            // Nota: Los estados de WhatsApp ya fueron filtrados arriba, así que aquí solo procesamos mensajes reales
            if (!whatsappMessage.fromMe && conversation.bot_enabled) {
                await this.processAutomaticResponse(clientId, clientCode, conversation, savedMessage, socketIo);
            } else if (!conversation.bot_enabled) {
                log.debug(`Bot is disabled for conversation ${contactPhone}`);
            }

            // Procesar mensaje del cliente a sí mismo (menú de control)
            if (whatsappMessage.fromMe && classification.senderType === 'client') {
                await this.processSelfMessage(clientId, clientCode, whatsappMessage, conversation);
            }

            console.log(`✅ Message processed: ${savedMessage.message_id} (${classification.senderType}) - Conversation: ${conversation.id}`);
            
            // Limpiar del cache después de un tiempo (evitar memoria infinita)
            setTimeout(() => {
                this.processedMessages.delete(messageId);
            }, 60000); // 1 minuto
            
            return savedMessage;

        } catch (error) {
            console.error('❌ Error in MessageService.handleIncomingMessage:', error.message);
            
            // Limpiar del cache en caso de error
            this.processedMessages.delete(whatsappMessage.id._serialized);
            
            throw error;
        }
    }

    /**
     * Clasificar mensaje según su origen
     * @param {string} clientCode - Código del cliente
     * @param {Object} whatsappMessage - Mensaje de WhatsApp
     * @returns {Object} Clasificación del mensaje
     */
    static classifyMessage(clientCode, whatsappMessage) {
        let senderType = 'contact';
        let isFromBot = false;

        if (whatsappMessage.fromMe) {
            // Verificar si es mensaje automático del bot
            if (this.isAutomaticBotMessage(clientCode, whatsappMessage)) {
                senderType = 'bot';
                isFromBot = true;
            } else {
                senderType = 'client';
            }
        }

        return { senderType, isFromBot };
    }

    /**
     * Verificar si un mensaje fue enviado automáticamente por el bot
     * @param {string} clientCode - Código del cliente
     * @param {Object} whatsappMessage - Mensaje de WhatsApp
     * @returns {boolean} True si es del bot
     */
    static isAutomaticBotMessage(clientCode, whatsappMessage) {
        // Verificar marcador [BOT] en el contenido
        if (whatsappMessage.body?.startsWith('[BOT]')) {
            return true;
        }

        // Verificar marcador [CRM-BOT] para mensajes del menú
        if (whatsappMessage.body?.startsWith('[CRM-BOT]')) {
            return true;
        }

        // Verificar si está en la lista de mensajes enviados por bot
        return whatsappService.isAutomaticBotMessage(
            clientCode, 
            whatsappMessage.id._serialized, 
            whatsappMessage.from
        );
    }

    /**
     * Procesar mensaje del cliente a sí mismo (menú de control)
     * @param {number} clientId - ID del cliente
     * @param {string} clientCode - Código del cliente
     * @param {Object} whatsappMessage - Mensaje de WhatsApp
     * @param {Conversation} conversation - Conversación
     */
    static async processSelfMessage(clientId, clientCode, whatsappMessage, conversation) {
        try {
            // Obtener información del cliente desde la BD
            const Client = require('../entities/Client');
            const client = await Client.findById(clientId);
            
            if (!client) {
                console.log(`⚠️ Client not found for self-message: ${clientCode}`);
                return;
            }

            // Verificar si es realmente un mensaje a sí mismo
            const SelfMenuService = require('./SelfMenuService');
            if (!SelfMenuService.isSelfMessage(client.phone, whatsappMessage)) {
                return; // No es mensaje a sí mismo
            }

            console.log(`📱 Self-message detected for ${clientCode}: ${whatsappMessage.body}`);

            // Obtener estadísticas del cliente
            const stats = await this.getClientStats(clientId);

            // Procesar con el servicio de menú
            await SelfMenuService.processSelfMessage(
                clientCode, 
                client.phone, 
                whatsappMessage, 
                stats
            );

        } catch (error) {
            console.error('❌ Error in MessageService.processSelfMessage:', error.message);
        }
    }

    /**
     * Obtener estadísticas del cliente para el menú
     * @param {number} clientId - ID del cliente
     * @returns {Object} Estadísticas del cliente
     */
    static async getClientStats(clientId) {
        try {
            const Contact = require('../entities/Contact');
            const Conversation = require('../entities/Conversation');
            const Message = require('../entities/Message');

            // Obtener estadísticas básicas
            const contactStats = await Contact.getStats(clientId);
            const conversationStats = await Conversation.getStats(clientId);
            const messageStats = await Message.getClientStats(clientId);

            return {
                totalContacts: contactStats.total_contacts || 0,
                totalConversations: conversationStats.total_conversations || 0,
                totalMessages: messageStats.total_messages || 0,
                botMessages: messageStats.bot_messages || 0,
                manualMessages: messageStats.manual_messages || 0,
                receivedMessages: messageStats.received_messages || 0,
                unreadMessages: conversationStats.unread_messages || 0,
                activeToday: messageStats.active_today || 0,
                receivedToday: messageStats.received_today || 0,
                sentToday: messageStats.sent_today || 0
            };
        } catch (error) {
            console.error('❌ Error getting client stats:', error.message);
            return {};
        }
    }

    /**
     * Determinar el tipo de mensaje
     * @param {Object} whatsappMessage - Mensaje de WhatsApp
     * @returns {string} Tipo de mensaje
     */
    static getMessageType(whatsappMessage) {
        if (whatsappMessage.type === 'chat') return 'text';
        if (whatsappMessage.type === 'image') return 'image';
        if (whatsappMessage.type === 'document') return 'document';
        if (whatsappMessage.type === 'ptt' || whatsappMessage.type === 'audio') return 'audio';
        if (whatsappMessage.type === 'video') return 'video';
        if (whatsappMessage.type === 'sticker') return 'sticker';
        if (whatsappMessage.type === 'location') return 'location';
        if (whatsappMessage.type === 'vcard') return 'contact_card';
        
        // Para tipos desconocidos, usar 'text' como fallback
        console.log(`⚠️ Unknown message type: ${whatsappMessage.type}, using 'text' as fallback`);
        return 'text';
    }

    /**
     * Procesar mensaje multimedia
     * @param {Object} whatsappMessage - Mensaje de WhatsApp
     * @returns {Promise<Object>} Datos de media
     */
    static async processMediaMessage(whatsappMessage) {
        try {
            log.debug('📎 Processing media message...');
            
            const media = await whatsappMessage.downloadMedia();
            
            if (!media) {
                log.warn('⚠️ No media data received from WhatsApp');
                return {
                    message_type: this.getMessageType(whatsappMessage),
                    media_url: null,
                    file_name: null,
                    media_mimetype: null,
                    media_size: null
                };
            }

            if (!media.data) {
                log.warn('⚠️ Media data is empty');
                return {
                    message_type: this.getMessageType(whatsappMessage),
                    media_url: null,
                    file_name: media.filename || null,
                    media_mimetype: media.mimetype || null,
                    media_size: null
                };
            }

            // Obtener información del archivo
            const messageType = this.getMessageType(whatsappMessage);
            const originalFileName = media.filename || `${messageType}_${Date.now()}`;
            const mimetype = media.mimetype;
            const fileSize = Buffer.byteLength(media.data, 'base64');

            log.debug(`📎 Media info: ${originalFileName} (${mimetype}, ${fileStorageService.formatFileSize(fileSize)})`);
            log.debug(`📎 WhatsApp message type: ${whatsappMessage.type} → Mapped to: ${messageType}`);
            log.debug(`📎 Media mimetype: ${mimetype}`);

            try {
                // Guardar archivo usando FileStorageService
                const fileInfo = await fileStorageService.saveFileFromBase64(
                    media.data,
                    originalFileName,
                    messageType,
                    mimetype
                );

                log.success(`📎 Media saved: ${fileInfo.fileName} → ${fileInfo.publicUrl}`);

                return {
                    message_type: messageType,
                    media_url: fileInfo.publicUrl,
                    file_name: fileInfo.originalName,
                    media_mimetype: fileInfo.mimetype,
                    media_size: fileInfo.size,
                    // Campos adicionales para referencia interna
                    media_path: fileInfo.filePath,
                    media_relative_path: fileInfo.relativePath
                };

            } catch (fileError) {
                log.error('❌ Error saving media file:', fileError.message);
                
                // Si falla el guardado, devolver metadatos sin URL
                return {
                    message_type: messageType,
                    media_url: null,
                    file_name: originalFileName,
                    media_mimetype: mimetype,
                    media_size: fileSize,
                    // Agregar información del error para debugging
                    media_error: fileError.message
                };
            }

        } catch (error) {
            log.error('❌ Error processing media message:', error.message);
            return {
                message_type: this.getMessageType(whatsappMessage),
                media_url: null,
                file_name: null,
                media_mimetype: null,
                media_size: null,
                media_error: error.message
            };
        }
    }

    /**
     * Procesar respuesta automática del bot
     * @param {number} clientId - ID del cliente
     * @param {string} clientCode - Código del cliente
     * @param {Conversation} conversation - Conversación
     * @param {Message} receivedMessage - Mensaje recibido
     * @param {Object} socketIo - Instancia de Socket.io
     */
    static async processAutomaticResponse(clientId, clientCode, conversation, receivedMessage, socketIo) {
        try {
            // Verificar que el bot esté habilitado para esta conversación
            if (!conversation.bot_enabled) {
                return;
            }

            // 🔍 VERIFICAR CUOTA DEL BOT ANTES DE RESPONDER usando servicio centralizado
            const quotaCheck = await BotQuotaService.checkQuotaAvailable(clientCode);
            if (!quotaCheck.success || !quotaCheck.available) {
                log.bot(`🚫 Bot quota exceeded for ${clientCode}: ${quotaCheck.usage || 0}/${quotaCheck.limit || 2500} (${quotaCheck.percentage || 0}%)`);
                return; // No enviar respuesta automática, pero todo lo demás sigue funcionando
            }

            // Verificar horarios de trabajo del bot
            const botConfig = await this.getBotConfiguration(clientId);
            if (!this.isBotWorkingHours(botConfig)) {
                console.log(`🤖 Bot outside working hours for client ${clientCode}`);
                return;
            }

            log.bot(`Processing automatic response for ${clientCode}`);

            // 🧠 EVALUAR REGLAS INTELIGENTES PRIMERO
            let selectedRule = null;
            let extractedData = {};
            let apiResponse = null;
            let shouldEscalate = false;
            let tagsApplied = [];

            if (botConfig.intelligent_rules_enabled) {
                const IntelligentRulesService = require('./IntelligentRulesService');
                
                try {
                    const conversationHistory = await Message.getConversationHistory(conversation.id, 10);
                    
                    const ruleResult = await IntelligentRulesService.processMessage({
                        message: receivedMessage.content,
                        conversation,
                        clientId,
                        clientCode,
                        conversationHistory,
                        botConfig
                    });
                    
                    if (ruleResult.handled) {
                        log.bot(`✅ Message handled by intelligent rule: ${ruleResult.ruleName}`);
                        
                        const actionResult = ruleResult.actionResult;
                        
                        // Procesar resultado según tipo de acción
                        if (actionResult.type === 'escalate_human' && actionResult.success) {
                            // Enviar mensaje de escalación y terminar
                            await this.sendAutomaticMessage(
                                clientCode, 
                                conversation.contact_phone, 
                                actionResult.escalationMessage,
                                conversation.id,
                                socketIo
                            );
                            
                            log.bot(`👤 Conversation escalated to human: ${actionResult.escalationMessage}`);
                            return; // No continuar con IA
                            
                        } else if (actionResult.type === 'call_api') {
                            // Guardar respuesta de API para usar en contexto de IA
                            apiResponse = actionResult.apiResponse;
                            selectedRule = ruleResult.ruleName;
                            extractedData = ruleResult.extractedData;
                            
                            if (actionResult.additionalTagsApplied) {
                                tagsApplied = actionResult.additionalTagsApplied;
                            }
                            
                            log.bot(`🌐 API called successfully, continuing with enriched context`);
                            
                        } else if (actionResult.type === 'assign_tags') {
                            // Solo etiquetas aplicadas, continuar con IA normal
                            tagsApplied = actionResult.tagsApplied || [];
                            selectedRule = ruleResult.ruleName;
                            extractedData = ruleResult.extractedData;
                            
                            log.bot(`🏷️ Tags applied: ${tagsApplied.join(', ')}, continuing with IA`);
                        }
                    } else {
                        log.bot(`ℹ️ No intelligent rule applied: ${ruleResult.reason || 'unknown'}`);
                    }
                    
                } catch (ruleError) {
                    console.error('❌ Error processing intelligent rules:', ruleError.message);
                    log.bot(`⚠️ Intelligent rules failed, continuing with normal IA flow`);
                }
            }

            // 🤖 CONTINUAR CON FLUJO NORMAL DE IA (con contexto enriquecido si hay)
            const history = await Message.getConversationHistory(conversation.id, 10);
            const AIService = require("./AIService");
            const productSearchEnabled = botConfig.product_search_enabled ? 1 : 0;
            
            // Crear contexto enriquecido para la IA
            const enrichedContext = {
                appliedRule: selectedRule,
                extractedData: Object.keys(extractedData).length > 0 ? extractedData : null,
                apiResponse: apiResponse,
                tagsApplied: tagsApplied.length > 0 ? tagsApplied : null
            };
            
            // Usar el nuevo método que retorna tokens con contexto enriquecido
            const aiResult = await AIService.getResponseWithTokens(
                clientCode, 
                receivedMessage.content, 
                history, 
                productSearchEnabled,
                enrichedContext
            );
            
            if (aiResult.success && aiResult.response && aiResult.response.trim()) {
                // Enviar respuesta automática
                const sendResult = await this.sendAutomaticMessage(
                    clientCode, 
                    conversation.contact_phone, 
                    aiResult.response,
                    conversation.id,
                    socketIo
                );
                
                // 📈 CONSUMIR CUOTA DESPUÉS DE ENVÍO EXITOSO (mensajes + tokens)
                if (sendResult) {
                    const tokensUsed = aiResult.tokens.total_tokens || 0;
                    const updatedQuota = await BotQuotaService.checkAndConsumeQuota(clientCode, 1, tokensUsed);
                    if (updatedQuota.success && updatedQuota.consumed) {
                        log.bot(`📈 Cuota actualizada para ${clientCode}:`);
                        log.bot(`   📨 Mensajes: ${updatedQuota.usage}/${updatedQuota.limit} (${updatedQuota.percentage}%)`);
                        log.bot(`   🎯 Tokens: ${updatedQuota.tokenUsage}/${updatedQuota.tokenLimit} (${updatedQuota.tokenPercentage}%)`);
                    } else {
                        log.bot(`⚠️ Failed to update quota for ${clientCode}: ${updatedQuota.message || "Unknown error"}`);
                    }
                }
            }

        } catch (error) {
            console.error('❌ Error in automatic response:', error.message);
            // No lanzar error para no interrumpir el flujo principal
        }
    }

    /**
     * Enviar mensaje automático del bot
     * @param {string} clientCode - Código del cliente
     * @param {string} to - Número de destino
     * @param {string} message - Mensaje a enviar
     * @param {number} conversationId - ID de la conversación
     * @param {Object} socketIo - Instancia de Socket.io
     * @returns {Promise<Message>} Mensaje enviado
     */
    static async sendAutomaticMessage(clientCode, to, message, conversationId, socketIo) {
        try {
            // Enviar mensaje por WhatsApp
            const result = await whatsappService.sendMessage(clientCode, to, message, true);

            // Guardar en BD
            const messageData = {
                conversation_id: conversationId,
                message_id: result.messageId,
                sender_type: 'bot',
                from_me: true,
                is_from_bot: true,
                content: message,
                message_type: 'text',
                sent_at: new Date(result.timestamp * 1000),
                is_read: true
            };

            // Guardar mensaje en BD con manejo de duplicados
            let savedMessage;
            try {
                savedMessage = await Message.create(messageData);
            } catch (error) {
                // Si es error de clave duplicada, verificar si el mensaje ya existe
                if (error.message.includes('Duplicate entry') && error.message.includes('message_id')) {
                    console.log(`⚠️ Duplicate message_id detected in sendAutomaticMessage: ${result.messageId}, fetching existing message...`);
                    const existingMessage = await Message.findByMessageId(result.messageId);
                    if (existingMessage) {
                        return existingMessage;
                    }
                }
                // Si no es error de duplicado o no encontramos el mensaje, relanzar error
                throw error;
            }

            // Actualizar conversación
            const conversation = await Conversation.findById(conversationId);
            if (conversation) {
                await conversation.updateLastMessage(message, messageData.sent_at);
            }

            // Emitir evento por Socket.io SOLO al cliente específico
            if (socketIo) {
                const roomName = `client_${clientCode}`;
                console.log(`📡 Emitting message:new to room: ${roomName} (bot response)`);
                
                socketIo.to(roomName).emit('message:new', {
                    clientCode,
                    message: savedMessage.toJSON(),
                    conversation: conversation?.toJSON(),
                    timestamp: new Date()
                });
            }

            log.success(`Automatic message sent: ${result.messageId}`);
            return savedMessage;

        } catch (error) {
            console.error('❌ Error sending automatic message:', error.message);
            throw error;
        }
    }

    /**
     * Enviar mensaje manual desde el CRM
     * @param {string} clientCode - Código del cliente
     * @param {number} clientId - ID del cliente
     * @param {string} to - Número de destino
     * @param {string} message - Mensaje a enviar
     * @param {Object} socketIo - Instancia de Socket.io
     * @returns {Promise<Message>} Mensaje enviado
     */
    static async sendManualMessage(clientCode, clientId, to, message, socketIo) {
        try {
            // Obtener o crear conversación
            const conversation = await Conversation.findOrCreate(clientId, to);

            // Deshabilitar bot para esta conversación (mensaje manual)
            await conversation.setBotEnabled(false);

            // Enviar mensaje por WhatsApp
            const result = await whatsappService.sendMessage(clientCode, to, message, false);

            // Guardar en BD
            const messageData = {
                conversation_id: conversation.id,
                message_id: result.messageId,
                sender_type: 'client',
                from_me: true,
                is_from_bot: false,
                content: message,
                message_type: 'text',
                sent_at: new Date(result.timestamp * 1000),
                is_read: true
            };

            // Marcar mensaje como procesado para evitar duplicados en eventos
            this.processedMessages.add(result.messageId);

            // Guardar mensaje en BD con manejo de duplicados
            let savedMessage;
            try {
                savedMessage = await Message.create(messageData);
            } catch (error) {
                // Si es error de clave duplicada, verificar si el mensaje ya existe
                if (error.message.includes('Duplicate entry') && error.message.includes('message_id')) {
                    console.log(`⚠️ Duplicate message_id detected in sendManualMessage: ${result.messageId}, fetching existing message...`);
                    const existingMessage = await Message.findByMessageId(result.messageId);
                    if (existingMessage) {
                        // Limpiar del cache
                        setTimeout(() => {
                            this.processedMessages.delete(result.messageId);
                        }, 60000); // 1 minuto
                        return existingMessage;
                    }
                }
                // Si no es error de duplicado o no encontramos el mensaje, relanzar error
                throw error;
            }

            setTimeout(() => {
                this.processedMessages.delete(result.messageId);
            }, 60000); // 1 minuto

            // Actualizar conversación
            await conversation.updateLastMessage(message, messageData.sent_at);

            // Emitir evento por Socket.io SOLO al cliente específico
            if (socketIo) {
                const roomName = `client_${clientCode}`;
                console.log(`📡 Emitting message:new to room: ${roomName} (manual message)`);
                
                socketIo.to(roomName).emit('message:new', {
                    clientCode,
                    message: savedMessage.toJSON(),
                    conversation: conversation.toJSON(),
                    timestamp: new Date()
                });
            }

            console.log(`📤 Manual message sent: ${result.messageId}`);
            return savedMessage;

        } catch (error) {
            console.error('❌ Error sending manual message:', error.message);
            throw error;
        }
    }

    /**
     * Obtener conversaciones de un cliente
     * @param {number} clientId - ID del cliente
     * @param {Object} options - Opciones de filtrado
     * @returns {Promise<Array>} Array de conversaciones
     */
    static async getConversations(clientId, options = {}) {
        try {
            return await Conversation.findByClientId(clientId, options);
        } catch (error) {
            console.error('❌ Error in MessageService.getConversations:', error.message);
            throw error;
        }
    }

    /**
     * Obtener mensajes de una conversación
     * @param {number} conversationId - ID de la conversación
     * @param {Object} options - Opciones de filtrado
     * @returns {Promise<Array>} Array de mensajes
     */
    static async getMessages(conversationId, options = {}) {
        try {
            return await Message.findByConversationId(conversationId, options);
        } catch (error) {
            console.error('❌ Error in MessageService.getMessages:', error.message);
            throw error;
        }
    }

    /**
     * Marcar conversación como leída
     * @param {number} conversationId - ID de la conversación
     * @returns {Promise<boolean>} True si se marcó correctamente
     */
    static async markConversationAsRead(conversationId) {
        try {
            const conversation = await Conversation.findById(conversationId);
            if (!conversation) {
                throw new Error('Conversación no encontrada');
            }

            return await conversation.markAsRead();
        } catch (error) {
            console.error('❌ Error in MessageService.markConversationAsRead:', error.message);
            throw error;
        }
    }

    /**
     * Buscar mensajes por contenido
     * @param {number} clientId - ID del cliente
     * @param {string} searchTerm - Término de búsqueda
     * @param {Object} options - Opciones de filtrado
     * @returns {Promise<Array>} Array de mensajes encontrados
     */
    static async searchMessages(clientId, searchTerm, options = {}) {
        try {
            return await Message.searchByContent(clientId, searchTerm, options);
        } catch (error) {
            console.error('❌ Error in MessageService.searchMessages:', error.message);
            throw error;
        }
    }

    /**
     * Obtener configuración del bot para un cliente
     * @param {number} clientId - ID del cliente
     * @returns {Promise<Object>} Configuración del bot
     */
    static async getBotConfiguration(clientId) {
        try {
            const { executeQuery } = require('../config/database-simple');
            let results = await executeQuery(
                'SELECT * FROM bot_configurations WHERE client_id = ?',
                [clientId]
            );
            
            // Si no existe configuración, crear una por defecto
            if (results.length === 0) {
                console.log(`⚠️ No bot configuration found for client ID ${clientId}, creating default configuration`);
                
                // Obtener información del cliente para el mensaje de bienvenida
                const clientResults = await executeQuery(
                    'SELECT company_name FROM clients WHERE id = ?',
                    [clientId]
                );
                
                const companyName = clientResults.length > 0 ? clientResults[0].company_name : 'nuestra empresa';
                
                // Crear configuración por defecto
                await executeQuery(`
                    INSERT INTO bot_configurations (
                        client_id, 
                        is_enabled, 
                        working_hours_start, 
                        working_hours_end, 
                        working_days,
                        auto_response_delay,
                        welcome_message,
                        fallback_message,
                        max_auto_responses_per_conversation,
                        product_search_enabled
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    clientId,
                    true,
                    '00:00:00',
                    '23:59:00',
                    JSON.stringify([0, 1, 2, 3, 4, 5, 6]), // Todos los días
                    2000,
                    `¡Hola! Bienvenido a ${companyName}. ¿En qué podemos ayudarte?`,
                    'Lo siento, no pude entender tu consulta. Un agente te contactará pronto.',
                    5,
                    false  // Por defecto, solo respuestas de texto
                ]);
                
                console.log(`✅ Default bot configuration created for client ID ${clientId}`);
                
                // Volver a obtener la configuración recién creada
                results = await executeQuery(
                    'SELECT * FROM bot_configurations WHERE client_id = ?',
                    [clientId]
                );
            }
            
            return results.length > 0 ? results[0] : null;
        } catch (error) {
            console.error('❌ Error getting bot configuration:', error.message);
            return null;
        }
    }

    /**
     * Verificar si el bot está en horario de trabajo
     * @param {Object} botConfig - Configuración del bot
     * @returns {boolean} True si está en horario
     */
    static isBotWorkingHours(botConfig) {
        return botConfig.is_enabled;
        if (!botConfig || !botConfig.is_enabled) {
            return false;
        }

        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.getDay(); // 0 = Domingo, 1 = Lunes, etc.

        // Verificar días de trabajo
        let workingDays;
        try {
            workingDays = botConfig.working_days ? 
                JSON.parse(botConfig.working_days) : 
                [0, 1, 2, 3, 4, 5, 6]; // Todos los días por defecto
        } catch (e) {
            workingDays = [0, 1, 2, 3, 4, 5, 6];
        }

        if (!workingDays.includes(currentDay)) {
            return false;
        }

        // Verificar horarios
        const startHour = parseInt(botConfig.working_hours_start?.split(':')[0] || '0');
        const endHour = parseInt(botConfig.working_hours_end?.split(':')[0] || '23');

        return currentHour >= startHour && currentHour < endHour;
    }

    /**
     * Obtener estadísticas de mensajes para un cliente
     * @param {number} clientId - ID del cliente
     * @param {Object} options - Opciones de filtrado
     * @returns {Promise<Object>} Estadísticas de mensajes
     */
    static async getMessageStats(clientId, options = {}) {
        try {
            const { hours = 24 } = options;
            const { executeQuery } = require('../config/database-simple');

            const [stats] = await executeQuery(`
                SELECT 
                    COUNT(m.id) as total_messages,
                    SUM(CASE WHEN m.from_me = 1 AND m.is_from_bot = 0 THEN 1 ELSE 0 END) as manual_messages,
                    SUM(CASE WHEN m.from_me = 1 AND m.is_from_bot = 1 THEN 1 ELSE 0 END) as bot_messages,
                    SUM(CASE WHEN m.from_me = 0 THEN 1 ELSE 0 END) as received_messages,
                    COUNT(DISTINCT c.id) as active_conversations,
                    SUM(CASE WHEN m.from_me = 0 AND m.is_read = 0 THEN 1 ELSE 0 END) as unread_messages
                FROM conversations c
                LEFT JOIN messages m ON c.id = m.conversation_id 
                    AND m.sent_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
                WHERE c.client_id = ?
            `, [hours, clientId]);

            return {
                total_messages: stats?.total_messages || 0,
                manual_messages: stats?.manual_messages || 0,
                bot_messages: stats?.bot_messages || 0,
                received_messages: stats?.received_messages || 0,
                active_conversations: stats?.active_conversations || 0,
                unread_messages: stats?.unread_messages || 0,
                period_hours: hours
            };
        } catch (error) {
            console.error('❌ Error in MessageService.getMessageStats:', error.message);
            throw error;
        }
    }

    // ============================================================================
    // BOT QUOTA MANAGEMENT
    // ============================================================================

    /**
     * Verificar si el cliente puede enviar respuestas automáticas del bot
     * @deprecated Usar BotQuotaService.checkQuotaAvailable() directamente
     * @param {number} clientId - ID del cliente
     * @param {string} clientCode - Código del cliente
     * @returns {Promise<Object>} Estado de la cuota del bot
     */
    static async checkBotQuota(clientId, clientCode) {
        try {
            console.log(`⚠️ DEPRECATED: MessageService.checkBotQuota() - Use BotQuotaService.checkQuotaAvailable() instead`);
            
            // Delegar al servicio centralizado
            const quotaCheck = await BotQuotaService.checkQuotaAvailable(clientCode);
            
            // Adaptar formato de respuesta para compatibilidad hacia atrás
            return {
                allowed: quotaCheck.available,
                usage: quotaCheck.usage || 0,
                limit: quotaCheck.limit || 2500,
                remaining: quotaCheck.remaining || 2500,
                percentage: quotaCheck.percentage || 0,
                reason: quotaCheck.available ? 'OK' : 'Quota exceeded'
            };
            
        } catch (error) {
            console.error('❌ Error checking bot quota (deprecated method):', error.message);
            return { 
                allowed: true, 
                error: error.message,
                usage: 0,
                limit: 2500,
                remaining: 2500,
                percentage: 0
            }; // En caso de error, permitir (fail-safe)
        }
    }

    /**
     * Asegurar que las columnas de bot quota existan en la tabla clients
     */
    static async ensureBotQuotaColumns() {
        try {
            const { executeQuery } = require('../config/database-simple');
            
            // Verificar si las columnas existen
            const columns = await executeQuery('DESCRIBE clients');
            const columnNames = columns.map(col => col.Field);
            
            console.log('📋 Columnas existentes en clients:', columnNames);
            
            const requiredColumns = ['monthly_bot_limit', 'current_bot_usage', 'bot_usage_reset_date'];
            const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
            
            if (missingColumns.length > 0) {
                console.log(`⚡ Añadiendo columnas faltantes: ${missingColumns.join(', ')}`);
                
                // Añadir columnas faltantes
                if (missingColumns.includes('monthly_bot_limit')) {
                    await executeQuery(`
                        ALTER TABLE clients 
                        ADD COLUMN monthly_bot_limit INT DEFAULT 2500 
                        COMMENT 'Límite mensual de respuestas automáticas del bot'
                    `);
                }
                
                if (missingColumns.includes('current_bot_usage')) {
                    await executeQuery(`
                        ALTER TABLE clients 
                        ADD COLUMN current_bot_usage INT DEFAULT 0 
                        COMMENT 'Uso actual del bot en el mes'
                    `);
                }
                
                if (missingColumns.includes('bot_usage_reset_date')) {
                    await executeQuery(`
                        ALTER TABLE clients 
                        ADD COLUMN bot_usage_reset_date DATE DEFAULT (DATE_FORMAT(NOW(), '%Y-%m-01')) 
                        COMMENT 'Fecha de reset del contador mensual'
                    `);
                }
                
                console.log('✅ Columnas de bot quota añadidas correctamente');
                
                // Sincronizar datos existentes después de añadir las columnas
                await MessageService.syncBotUsageFromHistory();
            } else {
                console.log('✅ Todas las columnas de bot quota ya existen');
            }
            
        } catch (error) {
            console.error('❌ Error asegurando columnas de bot quota:', error.message);
        }
    }

    /**
     * Sincronizar el current_bot_usage con los datos reales del historial
     */
    static async syncBotUsageFromHistory() {
        try {
            const { executeQuery } = require('../config/database-simple');
            
            console.log('🔄 Sincronizando bot usage desde historial de mensajes...');
            
            // Obtener todos los clientes
            const clients = await executeQuery('SELECT id, client_code FROM clients');
            console.log('📋 Clientes encontrados:', clients);
            
            for (const client of clients) {
                // Calcular mensajes del bot desde el inicio del mes actual
                const firstDayOfMonth = new Date();
                firstDayOfMonth.setDate(1);
                firstDayOfMonth.setHours(0, 0, 0, 0);
                
                console.log(`🔍 Buscando mensajes del bot para cliente ${client.client_code} desde ${firstDayOfMonth.toISOString()}`);
                
                // Verificar primero si hay mensajes en general para este cliente
                const [totalMessages] = await executeQuery(`
                    SELECT COUNT(*) as total_count
                    FROM messages m
                    INNER JOIN conversations c ON m.conversation_id = c.id
                    WHERE c.client_id = ?
                `, [client.id]);
                
                console.log(`📊 Cliente ${client.client_code}: ${totalMessages?.total_count || 0} mensajes totales`);
                
                // Verificar mensajes del bot
                const [botMessagesCount] = await executeQuery(`
                    SELECT COUNT(*) as bot_count
                    FROM messages m
                    INNER JOIN conversations c ON m.conversation_id = c.id
                    WHERE c.client_id = ? 
                    AND m.is_from_bot = 1 
                    AND m.sent_at >= ?
                `, [client.id, firstDayOfMonth.toISOString()]);
                
                const actualBotCount = botMessagesCount?.bot_count || 0;
                
                console.log(`📊 Cliente ${client.client_code}: ${actualBotCount} mensajes del bot este mes`);
                
                // Ver el estado actual de la base de datos
                const [currentState] = await executeQuery(`
                    SELECT monthly_bot_limit, current_bot_usage, bot_usage_reset_date 
                    FROM clients WHERE id = ?
                `, [client.id]);
                
                console.log(`📊 Estado actual en BD para ${client.client_code}:`, currentState);
                
                // Actualizar current_bot_usage con el valor real
                const updateResult = await executeQuery(`
                    UPDATE clients 
                    SET current_bot_usage = ?, 
                        bot_usage_reset_date = DATE_FORMAT(NOW(), '%Y-%m-01')
                    WHERE id = ?
                `, [actualBotCount, client.id]);
                
                console.log(`📊 Resultado UPDATE para ${client.client_code}:`, updateResult);
                
                // Verificar que se actualizó correctamente
                const [updatedState] = await executeQuery(`
                    SELECT monthly_bot_limit, current_bot_usage, bot_usage_reset_date 
                    FROM clients WHERE id = ?
                `, [client.id]);
                
                console.log(`📊 Estado actualizado en BD para ${client.client_code}:`, updatedState);
            }
            
            console.log('✅ Sincronización de bot usage completada');
            
        } catch (error) {
            console.error('❌ Error sincronizando bot usage:', error.message);
            console.error('❌ Stack trace:', error.stack);
        }
    }

    /**
     * Incrementar el contador de uso del bot
     * @deprecated Usar BotQuotaService.checkAndConsumeQuota() directamente
     * @param {number} clientId - ID del cliente
     * @param {string} clientCode - Código del cliente (para logs)
     * @returns {Promise<Object>} Nuevo estado de uso
     */
    static async incrementBotUsage(clientId, clientCode = 'unknown') {
        try {
            console.log(`⚠️ DEPRECATED: MessageService.incrementBotUsage() - Use BotQuotaService.checkAndConsumeQuota() instead`);
            
            // Delegar al servicio centralizado
            const updatedQuota = await BotQuotaService.checkAndConsumeQuota(clientCode, 1);
            
            if (updatedQuota.success && updatedQuota.consumed) {
                console.log(`📈 Bot usage updated for ${clientCode}: ${updatedQuota.usage}/${updatedQuota.limit} (${updatedQuota.percentage}%) - ${updatedQuota.remaining} remaining`);
                
                // Logs de advertencia cuando se acerca al límite
                const remaining = updatedQuota.remaining;
                if (remaining <= 100 && remaining > 50) {
                    console.log(`⚠️ Bot quota warning for ${clientCode}: ${remaining} messages remaining (${updatedQuota.percentage}%)`);
                } else if (remaining <= 50 && remaining > 10) {
                    console.log(`🚨 Bot quota critical for ${clientCode}: Only ${remaining} messages left (${updatedQuota.percentage}%)`);
                } else if (remaining <= 10 && remaining > 0) {
                    console.log(`🔴 Bot quota almost exceeded for ${clientCode}: ${remaining} messages left (${updatedQuota.percentage}%)`);
                }
                
                return {
                    usage: updatedQuota.usage,
                    limit: updatedQuota.limit,
                    remaining: updatedQuota.remaining,
                    percentage: updatedQuota.percentage
                };
            } else {
                console.log(`❌ Failed to increment bot usage for ${clientCode}: ${updatedQuota.message || 'Unknown error'}`);
                return null;
            }
            
        } catch (error) {
            console.error('❌ Error incrementing bot usage (deprecated method):', error.message);
            return null;
        }
    }

    /**
     * Obtener estadísticas de uso del bot para un cliente
     * @param {number} clientId - ID del cliente
     * @returns {Promise<Object>} Estadísticas de uso del bot
     */
    static async getBotUsageStats(clientId) {
        try {
            const { executeQuery } = require('../config/database-simple');
            
            // Asegurar que las columnas existan
            await MessageService.ensureBotQuotaColumns();
            
            const [stats] = await executeQuery(
                'SELECT monthly_bot_limit, current_bot_usage, bot_usage_reset_date FROM clients WHERE id = ?',
                [clientId]
            );
            
            console.log(`📊 getBotUsageStats para cliente ${clientId}:`, stats);
            
            if (!stats) {
                console.log(`❌ No se encontraron stats para cliente ${clientId}`);
                return { 
                    monthly_bot_limit: 2500, 
                    current_bot_usage: 0, 
                    bot_usage_reset_date: new Date().toISOString().split('T')[0],
                    next_reset_date: new Date().toISOString().split('T')[0]
                };
            }
            
            // Valores por defecto si son null
            const monthlyLimit = stats.monthly_bot_limit || 2500;
            const currentUsage = stats.current_bot_usage || 0;
            const resetDate = stats.bot_usage_reset_date || new Date().toISOString().split('T')[0];
            
            const remaining = monthlyLimit - currentUsage;
            const percentage = monthlyLimit > 0 ? 
                Math.round((currentUsage / monthlyLimit) * 100) : 0;
            
            // Calcular próxima fecha de reset
            const resetDateObj = new Date(resetDate);
            const nextReset = new Date(resetDateObj.getFullYear(), resetDateObj.getMonth() + 1, 1);
            
            const result = {
                monthly_bot_limit: monthlyLimit,
                current_bot_usage: currentUsage,
                remaining,
                percentage,
                bot_usage_reset_date: resetDate,
                next_reset_date: nextReset.toISOString().split('T')[0],
                status: remaining > 0 ? 'active' : 'exceeded'
            };
            
            console.log(`📊 Resultado getBotUsageStats:`, result);
            
            return result;
            
        } catch (error) {
            console.error('❌ Error getting bot usage stats:', error.message);
            return { 
                monthly_bot_limit: 0, 
                current_bot_usage: 0, 
                remaining: 0,
                percentage: 0,
                status: 'error',
                error: error.message 
            };
        }
    }

    /**
     * Actualizar el límite mensual del bot para un cliente
     * @param {number} clientId - ID del cliente
     * @param {number} newLimit - Nuevo límite mensual
     * @returns {Promise<boolean>} Éxito de la operación
     */
    static async updateBotLimit(clientId, newLimit) {
        try {
            const { executeQuery } = require('../config/database-simple');
            
            if (newLimit < 0) {
                throw new Error('El límite debe ser un número positivo');
            }
            
            await executeQuery(
                'UPDATE clients SET monthly_bot_limit = ? WHERE id = ?',
                [newLimit, clientId]
            );
            
            return true;
            
        } catch (error) {
            console.error('❌ Error updating bot limit:', error.message);
            return false;
        }
    }

    /**
     * Resetear manualmente el contador de uso del bot para un cliente
     * @param {number} clientId - ID del cliente
     * @param {string} clientCode - Código del cliente (para logs)
     * @returns {Promise<boolean>} Éxito de la operación
     */
    static async manualResetBotUsage(clientId, clientCode = 'unknown') {
        try {
            const { executeQuery } = require('../config/database-simple');
            
            // Obtener estado actual
            const [client] = await executeQuery(
                'SELECT current_bot_usage, monthly_bot_limit FROM clients WHERE id = ?',
                [clientId]
            );
            
            if (!client) {
                console.log(`❌ Cliente no encontrado para reset manual: ${clientCode}`);
                return false;
            }
            
            const today = new Date();
            const resetDate = new Date(today.getFullYear(), today.getMonth(), 1);
            
            console.log(`🔄 RESET MANUAL ejecutado para cliente ${clientCode}: ${client.current_bot_usage} -> 0`);
            
            // Resetear contador y actualizar fecha
            await executeQuery(
                'UPDATE clients SET current_bot_usage = 0, bot_usage_reset_date = ? WHERE id = ?',
                [resetDate.toISOString().split('T')[0], clientId]
            );
            
            console.log(`✅ Reset manual completado para ${clientCode}: 0/${client.monthly_bot_limit}`);
            return true;
            
        } catch (error) {
            console.error('❌ Error en reset manual:', error.message);
            return false;
        }
    }

    /**
     * Enviar notificación push cuando llega un mensaje nuevo
     * @param {number} clientId - ID del cliente
     * @param {Object} message - Mensaje guardado
     * @param {Object} conversation - Conversación
     */
    static async sendPushNotificationForMessage(clientId, message, conversation) {
        try {
            // Solo enviar notificaciones para mensajes recibidos (no enviados por el cliente)
            if (message.from_me) {
                return;
            }

            console.log(`🔔 Sending push notification for new message from ${conversation.contact_name}`);

            const PushNotificationService = require('./PushNotificationService');
            
            // Preparar el contenido de la notificación
            let notificationBody = message.content;
            
            // Personalizar el mensaje según el tipo
            if (message.message_type !== 'text') {
                switch (message.message_type) {
                    case 'image':
                        notificationBody = '📷 Imagen';
                        break;
                    case 'video':
                        notificationBody = '🎥 Video';
                        break;
                    case 'audio':
                        notificationBody = '🎵 Audio';
                        break;
                    case 'document':
                        notificationBody = '📄 Documento';
                        break;
                    case 'sticker':
                        notificationBody = '😊 Sticker';
                        break;
                    default:
                        notificationBody = `📱 ${message.message_type}`;
                }
            }

            // Truncar mensaje si es muy largo
            if (notificationBody.length > 100) {
                notificationBody = notificationBody.substring(0, 97) + '...';
            }

            const notification = {
                title: `💬 ${conversation.contact_name}`,
                body: notificationBody,
                type: 'message',
                urgency: 'normal',
                data: {
                    conversationId: conversation.id,
                    messageId: message.id,
                    contactPhone: conversation.contact_phone,
                    contactName: conversation.contact_name,
                    url: `/chat/${conversation.id}` // URL para abrir la conversación
                }
            };

            // Enviar notificación al cliente (asumiendo que user_id = client_id por ahora)
            // TODO: En el futuro, obtener todos los usuarios del cliente que tengan suscripciones activas
            const result = await PushNotificationService.sendToUser(clientId, clientId, notification);
            
            if (result.success) {
                console.log(`✅ Push notification sent for message from ${conversation.contact_name}`);
            } else {
                console.log(`⚠️ Push notification not sent: ${result.reason || result.error}`);
            }

        } catch (error) {
            console.error('❌ Error sending push notification for message:', error.message);
            // No relanzar el error para no afectar el procesamiento del mensaje
        }
    }
}

module.exports = MessageService;
