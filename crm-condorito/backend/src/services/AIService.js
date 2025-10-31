const axios = require('axios');

// 🚀 Sistema de logs optimizado para performance
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'INFO' : 'DEBUG');
const ENABLE_DEBUG = LOG_LEVEL === 'DEBUG' || LOG_LEVEL === 'TRACE';

// 🚀 Cache simple en memoria para respuestas similares (optimización de tokens)
const responseCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

// Helper de logs condicionales
const log = {
    error: (msg, data) => console.error(`❌ ${msg}`, data || ''),
    warn: (msg, data) => console.warn(`⚠️ ${msg}`, data || ''),
    info: (msg, data) => console.log(`ℹ️ ${msg}`, data || ''),
    success: (msg, data) => console.log(`✅ ${msg}`, data || ''),
    ai: (msg, data) => console.log(`🧠 ${msg}`, data || ''),
    debug: (msg, data) => ENABLE_DEBUG && console.log(`🔍 ${msg}`, data || ''),
    api: (msg, data) => ENABLE_DEBUG && console.log(`📡 ${msg}`, data || '')
};

// 🔑 Configuración de OpenAI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

// 🎯 Modos de AI disponibles
const AI_MODES = {
    PROMPT_ONLY: 'prompt_only',      // Solo responde basado en el prompt del negocio
    DATABASE_SEARCH: 'database_search' // Busca en base de datos (en desarrollo)
};

/**
 * Servicio de IA - Integración con endpoint externo de respuestas automáticas
 */
class AIService {

    /**
     * Obtener respuesta de IA para un mensaje usando OpenAI
     * @param {string} clientCode - Código del cliente
     * @param {string} question - Pregunta del usuario
     * @param {Array} conversationHistory - Historial de conversación
     * @param {number} permisoProducto - Permiso de producto (0 por defecto)
     * @returns {Promise<string>} Respuesta de la IA
     */
    static async getResponse(clientCode, question, conversationHistory = [], permisoProducto = 0) {
        try {
            log.ai(`Getting AI response for client: ${clientCode}`);

            // 1. Obtener configuración del cliente
            const clientConfig = await this.getClientAIConfig(clientCode);
            if (!clientConfig || !clientConfig.enabled) {
                log.warn(`AI disabled for client: ${clientCode}`);
                return 'El asistente automático está desactivado para este cliente.';
            }

            // 2. Verificar modo de AI
            const aiMode = clientConfig.ai_mode || AI_MODES.PROMPT_ONLY;

            if (aiMode === AI_MODES.DATABASE_SEARCH) {
                log.warn(`Database search mode not implemented yet for client: ${clientCode}`);
                return 'El modo de búsqueda en base de datos está en desarrollo. Por favor contacta al administrador.';
            }

            // 3. Construir el prompt del sistema con datos del negocio
            const systemPrompt = this.buildSystemPrompt(clientConfig);

            // 4. Construir historial de conversación para OpenAI
            const messages = this.buildConversationMessages(systemPrompt, conversationHistory, question);

            log.api(`Calling OpenAI API for client: ${clientCode}`);
            log.debug(`Question: ${question ? question.substring(0, 100) : 'No question'}...`);

            // 5. Llamar a OpenAI API
            const response = await axios.post(OPENAI_API_URL, {
                model: OPENAI_MODEL,
                messages: messages,
                max_tokens: clientConfig.max_tokens || 500,
                temperature: clientConfig.temperature || 0.7
            }, {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                }
            });

            // 6. Verificar respuesta
            if (!response.data || !response.data.choices || !response.data.choices[0]) {
                console.error('❌ OpenAI Response Error:', response.data);
                throw new Error('No se recibió una respuesta válida de OpenAI.');
            }

            const respuesta = response.data.choices[0].message.content.trim();
            const tokensUsed = response.data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

            log.success(`OpenAI response received: ${respuesta ? respuesta.substring(0, 100) : "Empty response"}...`);
            log.ai(`Tokens used: ${tokensUsed.total_tokens} (input: ${tokensUsed.prompt_tokens}, output: ${tokensUsed.completion_tokens})`);

            // Reportar tokens consumidos al BotQuotaService si está disponible
            try {
                const BotQuotaService = require("./BotQuotaService");
                await BotQuotaService.consumeTokens(clientCode, tokensUsed.total_tokens);
                log.ai(`Tokens reported to quota service: ${tokensUsed.total_tokens}`);
            } catch (tokenError) {
                log.warn(`Failed to report tokens to quota service: ${tokenError.message}`);
            }

            return this.formatResponseForWhatsApp(respuesta);
        } catch (error) {
            console.error('❌ Error al obtener la respuesta de OpenAI:', error.message);

            // Log detallado del error
            if (error.response) {
                console.error('❌ OpenAI API Error Response:', {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    data: error.response.data
                });
            } else if (error.request) {
                console.error('❌ OpenAI API No Response:', error.request);
            } else {
                console.error('❌ OpenAI API Request Error:', error.message);
            }

            // Retornar mensaje de error genérico
            return 'Disculpa, hubo un problema al procesar tu mensaje. Por favor intenta de nuevo más tarde.';
        }
    }

    /**
     * Construir el prompt del sistema con datos del negocio
     * @param {Object} clientConfig - Configuración del cliente
     * @param {Object} enrichedContext - Contexto enriquecido de reglas inteligentes
     * @returns {string} Prompt del sistema
     */
    static buildSystemPrompt(clientConfig, enrichedContext = null) {
        const businessPrompt = clientConfig.business_prompt ||
            'Sos un asistente que responde mensajes de WhatsApp de un negocio.';

        // 🚀 OPTIMIZACIÓN: Prompt más conciso para reducir tokens
        let baseInstructions = `${businessPrompt}

Responde en español, sé amable y conciso. Si no sabes algo, sugiere contactar directamente.`;

        // 🧠 AGREGAR CONTEXTO ENRIQUECIDO DE REGLAS INTELIGENTES
        if (enrichedContext && Object.keys(enrichedContext).some(key => enrichedContext[key] !== null)) {
            baseInstructions += `

CONTEXTO ADICIONAL:`;

            if (enrichedContext.appliedRule) {
                baseInstructions += `\n- Se aplicó la regla: "${enrichedContext.appliedRule}"`;
            }

            if (enrichedContext.extractedData) {
                baseInstructions += `\n- Datos extraídos: ${JSON.stringify(enrichedContext.extractedData)}`;
            }

            if (enrichedContext.apiResponse) {
                baseInstructions += `\n- Respuesta de API externa: ${JSON.stringify(enrichedContext.apiResponse)}`;
                baseInstructions += `\n- IMPORTANTE: Usa esta información de la API para responder la consulta del usuario de manera natural y útil.`;
            }

            if (enrichedContext.tagsApplied && enrichedContext.tagsApplied.length > 0) {
                baseInstructions += `\n- Etiquetas aplicadas al contacto: ${enrichedContext.tagsApplied.join(', ')}`;
            }
        }

        return baseInstructions.trim();
    }

    /**
     * Construir mensajes de conversación para OpenAI
     * @param {string} systemPrompt - Prompt del sistema
     * @param {Array} conversationHistory - Historial de conversación (array de objetos con content y sender_type)
     * @param {string} currentQuestion - Pregunta actual
     * @returns {Array} Array de mensajes para OpenAI
     */
    static buildConversationMessages(systemPrompt, conversationHistory, currentQuestion) {
        const messages = [
            { role: 'system', content: systemPrompt }
        ];

        // Agregar historial de conversación (últimos 3 mensajes para optimizar tokens)
        const recentHistory = conversationHistory.slice(-3);

        for (let i = 0; i < recentHistory.length; i++) {
            const msg = recentHistory[i];

            // Determinar el rol basado en sender_type
            let role;
            if (msg.sender_type === 'bot' || msg.sender_type === 'assistant') {
                role = 'assistant';
            } else {
                role = 'user'; // client, user, etc.
            }

            // Usar msg.content si es un objeto, o msg directamente si es string (compatibilidad)
            const content = typeof msg === 'object' && msg.content ? msg.content : msg;

            messages.push({ role: role, content: content });
        }

        // Agregar pregunta actual
        if (currentQuestion) {
            messages.push({ role: 'user', content: currentQuestion });
        }

        log.debug('Built conversation messages:', messages.length);
        return messages;
    }

    /**
     * Verificar si el servicio de IA está disponible
     * @returns {Promise<boolean>} True si está disponible
     */
    static async isAvailable() {
        try {
            // Verificar disponibilidad de OpenAI API
            const response = await axios.post(OPENAI_API_URL, {
                model: OPENAI_MODEL,
                messages: [{ role: 'user', content: 'test' }],
                max_tokens: 1
            }, {
                timeout: 5000,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                validateStatus: (status) => status < 500
            });

            return response.status < 500;
        } catch (error) {
            console.error('❌ OpenAI Service availability check failed:', error.message);
            return false;
        }
    }

    /**
     * Obtener configuración de búsqueda de productos para un cliente
     * @param {string} clientCode - Código del cliente
     * @returns {Promise<Object>} Configuración de búsqueda de productos
     */
    static async getClientProductSearchConfig(clientCode) {
        try {
            console.log('🛒 Getting product search config for clientCode:', clientCode);
            const { executeQuery } = require('../config/database-simple');

            // Buscar configuración de productos en bot_configurations
            const query = `
                SELECT 
                    bc.product_search_enabled,
                    bc.product_endpoint_url,
                    bc.product_endpoint_method,
                    bc.product_endpoint_body,
                    bc.product_endpoint_headers,
                    bc.product_search_param_name,
                    bc.product_response_path,
                    bc.product_max_results,
                    bc.product_cache_ttl,
                    bc.product_timeout,
                    bc.product_link_enabled,
                    bc.product_link_template,
                    bc.product_link_id_field,
                    bc.product_link_text,
                    c.id as client_id,
                    c.client_code
                FROM bot_configurations bc
                INNER JOIN clients c ON bc.client_id = c.id
                WHERE c.client_code = ?
            `;

            const results = await executeQuery(query, [clientCode]);
            console.log('🔍 Product search query results count:', results?.length, 'for clientCode:', clientCode);

            if (results && results.length > 0) {
                const config = results[0];
                console.log('✅ Found product search config for client:', clientCode);

                return {
                    product_search_enabled: config.product_search_enabled === 1,
                    product_endpoint_url: config.product_endpoint_url || '',
                    product_endpoint_method: config.product_endpoint_method || 'GET',
                    product_endpoint_body: config.product_endpoint_body || '',
                    product_endpoint_headers: config.product_endpoint_headers || '{}',
                    product_search_param_name: config.product_search_param_name || 'search',
                    product_response_path: config.product_response_path || 'data',
                    product_max_results: parseInt(config.product_max_results) || 30,
                    product_cache_ttl: parseInt(config.product_cache_ttl) || 600,
                    product_timeout: parseInt(config.product_timeout) || 8000,
                    product_link_enabled: config.product_link_enabled === 1,
                    product_link_template: config.product_link_template || '',
                    product_link_id_field: config.product_link_id_field || 'id',
                    product_link_text: config.product_link_text || 'Ver producto'
                };
            }

            console.log('❌ No product search config found for client:', clientCode);
            return null;
        } catch (error) {
            console.error('❌ Error getting product search config for client:', clientCode, 'Error:', error.message);
            console.error('❌ Stack trace:', error.stack);
            return null;
        }
    }

    /**
     * Obtener configuración de IA para un cliente
     * @param {string} clientCode - Código del cliente
     * @returns {Promise<Object>} Configuración de IA
     */
    static async getClientAIConfig(clientCode) {
        try {
            console.log('🔍 Getting AI config for clientCode:', clientCode);
            const { executeQuery } = require('../config/database-simple');

            // Buscar configuración personalizada del cliente (IA + productos)
            const query = `
                SELECT 
                    ac.*,
                    bc.product_search_enabled,
                    bc.product_endpoint_url,
                    bc.product_endpoint_method,
                    bc.product_endpoint_body,
                    bc.product_endpoint_headers,
                    bc.product_search_param_name,
                    bc.product_response_path,
                    bc.product_max_results,
                    bc.product_cache_ttl,
                    bc.product_timeout,
                    bc.product_link_enabled,
                    bc.product_link_template,
                    bc.product_link_id_field,
                    bc.product_link_text,
                    bc.permiso_producto,
                    c.id as client_id,
                    c.client_code
                FROM ai_configurations ac
                INNER JOIN clients c ON ac.client_id = c.id
                LEFT JOIN bot_configurations bc ON bc.client_id = c.id
                WHERE c.client_code = ?
            `;

            const results = await executeQuery(query, [clientCode]);
            console.log('🔍 Query results count:', results?.length, 'for clientCode:', clientCode);

            if (results && results.length > 0) {
                const config = results[0];
                console.log('✅ Found AI config for client:', clientCode, 'prompt preview:', config.business_prompt?.substring(0, 50) + '...');
                console.log('🛒 Product search enabled:', config.product_search_enabled, 'URL:', config.product_endpoint_url ? 'configured' : 'not configured');

                // Manejar working_days con más cuidado
                let workingDays = [0, 1, 2, 3, 4, 5, 6]; // Default
                try {
                    if (config.working_days) {
                        // Si ya es un array, usarlo directamente
                        if (Array.isArray(config.working_days)) {
                            workingDays = config.working_days;
                        } else {
                            // Si es string, intentar parsearlo
                            workingDays = JSON.parse(config.working_days);
                        }
                    }
                } catch (jsonError) {
                    console.log('⚠️ Error parsing working_days, using default:', jsonError.message);
                    workingDays = [0, 1, 2, 3, 4, 5, 6];
                }

                return {
                    enabled: config.enabled === 1,
                    ai_mode: config.ai_mode || AI_MODES.PROMPT_ONLY,
                    business_prompt: config.business_prompt,
                    max_tokens: parseInt(config.max_tokens) || 500,
                    temperature: parseFloat(config.temperature) || 0.7,
                    maxHistoryMessages: parseInt(config.max_history_messages) || 10,
                    responseTimeout: parseInt(config.response_timeout) || 30000,
                    fallbackMessage: config.fallback_message || 'Disculpa, no pude procesar tu mensaje en este momento.',
                    workingHours: {
                        enabled: config.working_hours_enabled === 1,
                        start: config.working_hours_start || '00:00',
                        end: config.working_hours_end || '23:59',
                        days: workingDays
                    },
                    // Información del cliente
                    client_id: config.client_id,
                    client_code: config.client_code,
                    // Configuración de productos desde bot_configurations
                    product_search_enabled: config.product_search_enabled === 1,
                    product_endpoint_url: config.product_endpoint_url || '',
                    product_endpoint_method: config.product_endpoint_method || 'GET',
                    product_endpoint_body: config.product_endpoint_body || '',
                    product_endpoint_headers: config.product_endpoint_headers || '{}',
                    product_search_param_name: config.product_search_param_name || 'search',
                    product_response_path: config.product_response_path || 'data',
                    product_max_results: parseInt(config.product_max_results) || 30,
                    product_cache_ttl: parseInt(config.product_cache_ttl) || 600,
                    product_timeout: parseInt(config.product_timeout) || 8000,
                    // Configuración de links de productos
                    product_link_enabled: config.product_link_enabled === 1,
                    product_link_template: config.product_link_template || '',
                    product_link_id_field: config.product_link_id_field || 'id',
                    product_link_text: config.product_link_text || 'Ver producto',
                    permiso_producto: config.permiso_producto || 0
                };
            }

            console.log('❌ No AI config found for client:', clientCode, 'returning default config');
            // Configuración por defecto si no existe
            return null
        } catch (error) {
            console.error('❌ Error getting AI config for client:', clientCode, 'Error:', error.message);
            console.error('❌ Stack trace:', error.stack);

            // Retornar configuración básica en caso de error
            return null
        }
    }

    /**
     * Procesar respuesta de IA para formato de WhatsApp
     * @param {string} aiResponse - Respuesta cruda de la IA
     * @returns {string} Respuesta formateada
     */
    static formatResponseForWhatsApp(aiResponse) {
        if (!aiResponse || typeof aiResponse !== 'string') {
            return 'Disculpa, no pude generar una respuesta.';
        }

        // Limpiar y formatear la respuesta
        let formatted = aiResponse.trim();

        // Limitar longitud (WhatsApp tiene límites)
        if (formatted.length > 4000) {
            formatted = formatted.substring(0, 3900) + '...\n\n_Mensaje truncado por longitud_';
        }

        // Escapar caracteres especiales si es necesario
        // formatted = formatted.replace(/\*/g, '\\*'); // Ejemplo para markdown

        return formatted;
    }

    /**
     * Obtener estadísticas de uso de IA
     * @param {string} clientCode - Código del cliente
     * @param {Object} options - Opciones de filtrado
     * @returns {Promise<Object>} Estadísticas de IA
     */
    static async getUsageStats(clientCode, options = {}) {
        try {
            const { hours = 24 } = options;
            const { executeQuery } = require('../config/database-simple');

            // Obtener estadísticas de mensajes del bot
            const [stats] = await executeQuery(`
                SELECT 
                    COUNT(m.id) as total_ai_messages,
                    AVG(CHAR_LENGTH(m.content)) as avg_message_length,
                    COUNT(DISTINCT c.id) as conversations_with_ai,
                    MIN(m.sent_at) as first_ai_message,
                    MAX(m.sent_at) as last_ai_message
                FROM messages m
                INNER JOIN conversations c ON m.conversation_id = c.id
                INNER JOIN clients cl ON c.client_id = cl.id
                WHERE cl.client_code = ? 
                    AND m.is_from_bot = 1 
                    AND m.sent_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
            `, [clientCode, hours]);

            return {
                total_ai_messages: stats?.total_ai_messages || 0,
                avg_message_length: Math.round(stats?.avg_message_length || 0),
                conversations_with_ai: stats?.conversations_with_ai || 0,
                first_ai_message: stats?.first_ai_message,
                last_ai_message: stats?.last_ai_message,
                period_hours: hours,
                client_code: clientCode
            };
        } catch (error) {
            console.error('❌ Error getting AI usage stats:', error.message);
            return {
                total_ai_messages: 0,
                avg_message_length: 0,
                conversations_with_ai: 0,
                first_ai_message: null,
                last_ai_message: null,
                period_hours: hours,
                client_code: clientCode,
                error: error.message
            };
        }
    }

    /**
     * Actualizar configuración de IA para un cliente
     * @param {string} clientCode - Código del cliente
     * @param {Object} config - Nueva configuración
     * @returns {Promise<boolean>} True si se actualizó correctamente
     */
    static async updateClientAIConfig(clientCode, config) {
        try {
            const { executeQuery } = require('../config/database-simple');

            // Obtener ID del cliente
            const [client] = await executeQuery(`
                SELECT id FROM clients WHERE client_code = ?
            `, [clientCode]);

            if (!client) {
                throw new Error(`Cliente no encontrado: ${clientCode}`);
            }

            const clientId = client.id;

            // Verificar si ya existe configuración
            const [existingConfig] = await executeQuery(`
                SELECT id FROM ai_configurations WHERE client_id = ?
            `, [clientId]);

            const workingDays = Array.isArray(config.workingHours?.days)
                ? JSON.stringify(config.workingHours.days)
                : JSON.stringify([0, 1, 2, 3, 4, 5, 6]);

            if (existingConfig) {
                // Actualizar configuración existente
                await executeQuery(`
                    UPDATE ai_configurations SET
                        enabled = ?,
                        ai_mode = ?,
                        business_prompt = ?,
                        max_tokens = ?,
                        temperature = ?,
                        max_history_messages = ?,
                        response_timeout = ?,
                        fallback_message = ?,
                        working_hours_enabled = ?,
                        working_hours_start = ?,
                        working_hours_end = ?,
                        working_days = ?,
                        updated_at = NOW()
                    WHERE client_id = ?
                `, [
                    config.enabled ? 1 : 0,
                    config.ai_mode || AI_MODES.PROMPT_ONLY,
                    config.business_prompt,
                    config.max_tokens || 500,
                    config.temperature || 0.7,
                    config.maxHistoryMessages || 10,
                    config.responseTimeout || 30000,
                    config.fallbackMessage || 'Disculpa, no pude procesar tu mensaje en este momento.',
                    config.workingHours?.enabled ? 1 : 0,
                    config.workingHours?.start || '00:00',
                    config.workingHours?.end || '23:59',
                    workingDays,
                    clientId
                ]);
            } else {
                // Crear nueva configuración
                await executeQuery(`
                    INSERT INTO ai_configurations (
                        client_id, enabled, ai_mode, business_prompt, max_tokens, 
                        temperature, max_history_messages, response_timeout, 
                        fallback_message, working_hours_enabled, working_hours_start, 
                        working_hours_end, working_days, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                `, [
                    clientId,
                    config.enabled ? 1 : 0,
                    config.ai_mode || AI_MODES.PROMPT_ONLY,
                    config.business_prompt,
                    config.max_tokens || 500,
                    config.temperature || 0.7,
                    config.maxHistoryMessages || 10,
                    config.responseTimeout || 30000,
                    config.fallbackMessage || 'Disculpa, no pude procesar tu mensaje en este momento.',
                    config.workingHours?.enabled ? 1 : 0,
                    config.workingHours?.start || '00:00',
                    config.workingHours?.end || '23:59',
                    workingDays
                ]);
            }

            log.success(`AI configuration updated for client: ${clientCode}`);
            return true;
        } catch (error) {
            console.error('❌ Error updating AI config for client:', clientCode, error.message);
            return false;
        }
    }

    /**
     * Health check del servicio de IA
     * @returns {Promise<Object>} Estado del servicio
     */
    static async healthCheck() {
        try {
            const isAvailable = await this.isAvailable();

            return {
                status: isAvailable ? 'healthy' : 'unhealthy',
                service: 'OpenAI API',
                url: OPENAI_API_URL,
                model: OPENAI_MODEL,
                timestamp: new Date().toISOString(),
                available: isAvailable
            };
        } catch (error) {
            return {
                status: 'error',
                service: 'OpenAI API',
                url: OPENAI_API_URL,
                model: OPENAI_MODEL,
                timestamp: new Date().toISOString(),
                available: false,
                error: error.message
            };
        }
    }

    /**
     * Obtener modos de AI disponibles
     * @returns {Object} Modos disponibles
     */
    static getAvailableModes() {
        return {
            modes: AI_MODES,
            descriptions: {
                [AI_MODES.PROMPT_ONLY]: 'Responde solo basándose en el prompt del negocio configurado',
                [AI_MODES.DATABASE_SEARCH]: 'Busca información en base de datos (en desarrollo)'
            }
        };
    }

    /**
     * Obtener respuesta de IA con información detallada de tokens
     * @param {string} clientCode - Código del cliente
     * @param {string} question - Pregunta del usuario
     * @param {Array} conversationHistory - Historial de conversación
     * @param {number} permisoProducto - Permiso de producto (0 por defecto)
     * @param {Object} enrichedContext - Contexto enriquecido de reglas inteligentes
     * @returns {Promise<Object>} Objeto con respuesta y tokens
     */
    static async getResponseWithTokens(clientCode, question, conversationHistory = [], permisoProducto = 0, enrichedContext = null) {
        try {
            // 1. Obtener configuración del cliente
            const clientConfig = await this.getClientAIConfig(clientCode);
            if (!clientConfig || !clientConfig.enabled) {
                throw new Error('IA no habilitada para este cliente');
            }

            log.debug(`Procesando pregunta con permisoProducto: ${permisoProducto}`);
            log.debug(`Question: ${question ? question.substring(0, 100) : 'No question'}...`);

            // 🚀 OPTIMIZACIÓN: Verificar caché para preguntas generales
            if (permisoProducto !== 1) {
                const cacheKey = this.generateCacheKey(clientCode, question);
                const cachedResponse = this.getCachedResponse(cacheKey);
                if (cachedResponse) {
                    return {
                        response: cachedResponse,
                        tokens: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
                        success: true,
                        fromCache: true
                    };
                }
            }

            // 🛒 FLUJO CON BÚSQUEDA DE PRODUCTOS
            if (permisoProducto === 1) {
                return await this.processWithProductSearch(clientCode, clientConfig, question, conversationHistory, enrichedContext);
            }

            // 🔄 FLUJO NORMAL (sin búsqueda de productos)
            const result = await this.processNormalResponse(clientConfig, question, conversationHistory, enrichedContext);

            // 🚀 OPTIMIZACIÓN: Guardar en caché respuestas normales exitosas
            if (result.success) {
                const cacheKey = this.generateCacheKey(clientCode, question);
                this.setCachedResponse(cacheKey, result.response);
            }

            return result;

        } catch (error) {
            console.error('❌ Error al obtener la respuesta de OpenAI con tokens:', error.message);

            // Manejo específico de errores 429 (Rate Limit)
            if (error.response?.status === 429) {
                console.error('❌ OpenAI Rate Limit Exceeded (429):', {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    data: error.response.data,
                    clientCode: clientCode
                });

                // Verificar si es por tokens o por rate limit
                const errorMessage = error.response.data?.error?.message || '';
                console.error('❌ Rate limit details:', errorMessage);

                if (errorMessage.toLowerCase().includes('token')) {
                    return {
                        response: 'Has alcanzado el límite de tokens por minuto. Por favor intenta con un mensaje más corto o espera unos minutos.',
                        tokens: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
                        success: false,
                        error: 'TOKEN_LIMIT_EXCEEDED'
                    };
                } else {
                    return {
                        response: 'Estamos procesando muchas consultas en este momento. Por favor intenta en unos minutos.',
                        tokens: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
                        success: false,
                        error: 'RATE_LIMIT_EXCEEDED'
                    };
                }
            }

            // Log detallado del error para otros casos
            if (error.response) {
                console.error('❌ OpenAI API Error Response:', {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    data: error.response.data
                });
            } else if (error.request) {
                console.error('❌ OpenAI API No Response:', error.request);
            } else {
                console.error('❌ OpenAI API Request Error:', error.message);
            }

            return {
                response: 'Disculpa, hubo un problema al procesar tu mensaje. Por favor intenta de nuevo más tarde.',
                tokens: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
                success: false,
                error: error.message
            };
        }
    }

    // ============================================================================
    // MÉTODOS PARA BÚSQUEDA DE PRODUCTOS
    // ============================================================================

    /**
     * Procesar respuesta normal (sin búsqueda de productos)
     */
    static async processNormalResponse(clientConfig, question, conversationHistory, enrichedContext = null) {
        // 2. Construir prompt del sistema con contexto enriquecido
        const systemPrompt = this.buildSystemPrompt(clientConfig, enrichedContext);

        // 3. Construir mensajes para OpenAI
        const messages = this.buildConversationMessages(systemPrompt, conversationHistory, question);

        log.debug(`Sending ${messages.length} messages to OpenAI (normal flow)`);

        // 4. Llamar a OpenAI API
        const response = await axios.post(OPENAI_API_URL, {
            model: OPENAI_MODEL,
            messages: messages,
            max_tokens: clientConfig.max_tokens || 500,
            temperature: clientConfig.temperature || 0.7
        }, {
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            }
        });

        // 5. Verificar respuesta
        if (!response.data || !response.data.choices || !response.data.choices[0]) {
            console.error('❌ OpenAI Response Error:', response.data);
            throw new Error('No se recibió una respuesta válida de OpenAI.');
        }

        const respuesta = response.data.choices[0].message.content.trim();
        const tokensUsed = response.data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

        log.success(`OpenAI response received: ${respuesta ? respuesta.substring(0, 100) : 'Empty response'}...`);
        log.ai(`Tokens used: ${tokensUsed.total_tokens} (input: ${tokensUsed.prompt_tokens}, output: ${tokensUsed.completion_tokens})`);

        return {
            response: this.formatResponseForWhatsApp(respuesta),
            tokens: tokensUsed,
            success: true
        };
    }

    /**
     * Procesar respuesta con búsqueda de productos
     */
    static async processWithProductSearch(clientCode, clientConfig, question, conversationHistory, enrichedContext = null) {
        let totalTokens = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

        try {
            log.debug('🛒 Iniciando flujo con búsqueda de productos');

            // PASO 1: Detectar si necesita buscar productos
            const detectionResult = await this.detectProductRequest(question, conversationHistory, clientConfig);
            totalTokens = this.sumTokens(totalTokens, detectionResult.tokens);

            if (!detectionResult.needsProduct) {
                log.debug('📝 No se detectó consulta de producto, usando flujo normal');
                const normalResult = await this.processNormalResponse(clientConfig, question, conversationHistory, enrichedContext);
                normalResult.tokens = this.sumTokens(totalTokens, normalResult.tokens);
                return normalResult;
            }

            log.debug(`🔍 Producto detectado: "${detectionResult.productName}"`);

            // PASO 2: Buscar productos
            const searchResult = await this.searchAndFormatProducts(
                clientCode,
                clientConfig,
                detectionResult.productName,
                question,
                conversationHistory
            );
            totalTokens = this.sumTokens(totalTokens, searchResult.tokens);

            return {
                response: this.formatResponseForWhatsApp(searchResult.response),
                tokens: totalTokens,
                success: true,
                productSearchUsed: true,
                productsFound: searchResult.productsFound || 0
            };

        } catch (error) {
            console.error('❌ Error en búsqueda de productos:', error.message);

            // Fallback a respuesta normal
            log.debug('🔄 Fallback a respuesta normal debido a error');
            const fallbackResult = await this.processNormalResponse(clientConfig, question, conversationHistory, enrichedContext);
            fallbackResult.tokens = this.sumTokens(totalTokens, fallbackResult.tokens);
            fallbackResult.productSearchError = error.message;
            return fallbackResult;
        }
    }

    /**
     * Detectar si la pregunta requiere búsqueda de productos
     */
    static async detectProductRequest(question, conversationHistory, clientConfig) {
        // 🚀 OPTIMIZACIÓN: Prompt más conciso para detección de productos
        const detectionPrompt = `Analiza si el usuario busca un producto específico.

Responde:
- "info producto: NOMBRE_SINGULAR" si busca un producto
- "respuesta normal" si es consulta general

Ejemplos:
"¿Tienes anillos?" → "info producto: anillo"
"Hola" → "respuesta normal"

Consulta: "${question}"`;

        const messages = [
            { role: 'system', content: detectionPrompt },
            { role: 'user', content: question }
        ];

        const response = await axios.post(OPENAI_API_URL, {
            model: OPENAI_MODEL,
            messages: messages,
            max_tokens: 50,
            temperature: 0.3
        }, {
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            }
        });

        const result = response.data.choices[0].message.content.trim().toLowerCase();
        const tokens = response.data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

        if (result.startsWith('info producto:')) {
            const productName = result.replace('info producto:', '').trim();
            return {
                needsProduct: true,
                productName: productName,
                tokens: tokens
            };
        }

        return {
            needsProduct: false,
            productName: null,
            tokens: tokens
        };
    }

    /**
     * Buscar productos y generar respuesta
     */
    static async searchAndFormatProducts(clientCode, clientConfig, productName, originalQuestion, conversationHistory, attempt = 1) {
        const ProductSearchService = require('./ProductSearchService');
        const maxAttempts = 3;

        try {
            // Buscar productos
            const searchResult = await ProductSearchService.searchProducts(
                clientConfig.client_id,
                clientConfig,
                productName
            );

            if (searchResult.success && searchResult.products.length > 0) {
                log.debug(`✅ Productos encontrados: ${searchResult.products.length}`);

                // Generar respuesta con productos encontrados
                try {
                    return await this.generateProductResponse(
                        searchResult.products,
                        originalQuestion,
                        conversationHistory,
                        clientConfig,
                        searchResult.fromCache,
                        productName
                    );
                } catch (responseError) {
                    // Error generando respuesta (ej: 429 de OpenAI), NO reintentar búsqueda
                    console.error(`❌ Error generando respuesta con productos encontrados:`, responseError.message);

                    // Si es error 429 de OpenAI, devolver mensaje específico
                    if (responseError.response?.status === 429) {
                        // Generar link de búsqueda si está configurado
                        let responseMessage = `Encontré ${searchResult.products.length} productos relacionados con "${productName}"`;

                        if (clientConfig.product_link_template) {
                            // Crear link de búsqueda con el nombre del producto
                            let searchLink = '';
                            if (clientConfig.product_link_template.includes('{SEARCH_TERM}')) {
                                searchLink = clientConfig.product_link_template.replace(/{SEARCH_TERM}/g, encodeURIComponent(productName));
                            } else {
                                // Fallback: crear link básico de búsqueda
                                const baseUrl = clientConfig.product_link_template.split('?')[0];
                                searchLink = `${baseUrl}?b=${encodeURIComponent(productName)}`;
                            }
                            responseMessage += `, podes verlos: ${searchLink}`;
                        } else {
                            responseMessage += '.';
                        }

                        return {
                            response: responseMessage,
                            tokens: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
                            success: true,
                            productsFound: searchResult.products.length,
                            fromCache: searchResult.fromCache,
                            openaiError: true
                        };
                    }

                    // Para otros errores, lanzar para que se maneje en el catch principal
                    throw responseError;
                }
            } else {
                log.debug(`❌ No se encontraron productos para: "${productName}" (intento ${attempt})`);

                // Si no encontró productos, intentar reformular (máximo 3 intentos)
                if (attempt < maxAttempts) {
                    const alternativeTerms = await this.generateAlternativeSearchTerms(
                        productName,
                        originalQuestion,
                        clientConfig
                    );

                    if (alternativeTerms.success && alternativeTerms.terms.length > 0) {
                        log.debug(`🔄 Reintentando con términos alternativos: ${alternativeTerms.terms.join(', ')}`);

                        // Intentar con el primer término alternativo
                        return await this.searchAndFormatProducts(
                            clientCode,
                            clientConfig,
                            alternativeTerms.terms[0],
                            originalQuestion,
                            conversationHistory,
                            attempt + 1
                        );
                    }
                }

                // No se encontraron productos después de todos los intentos
                return await this.generateNoProductsFoundResponse(
                    productName,
                    originalQuestion,
                    conversationHistory,
                    clientConfig
                );
            }

        } catch (error) {
            console.error(`❌ Error en búsqueda de productos (intento ${attempt}):`, error.message);

            // Solo reintentar si es un error de búsqueda de productos, no de generación de respuesta
            if (error.openaiError || (error.response && error.response.status === 429)) {
                // Error de OpenAI generando respuesta - no reintentar búsqueda
                console.log(`🚫 Error de OpenAI, no reintentando búsqueda de productos`);
                throw error;
            }

            // Error real de búsqueda de productos - sí reintentar
            if (attempt < maxAttempts) {
                log.debug(`🔄 Reintentando búsqueda debido a error de productos (${attempt + 1}/${maxAttempts})`);
                return await this.searchAndFormatProducts(
                    clientCode,
                    clientConfig,
                    productName,
                    originalQuestion,
                    conversationHistory,
                    attempt + 1
                );
            }

            throw error;
        }
    }

    /**
     * Generar respuesta con productos encontrados
     */
    static async generateProductResponse(products, originalQuestion, conversationHistory, clientConfig, fromCache = false, productName = '') {
        const systemPrompt = this.buildSystemPrompt(clientConfig);

        // 🚀 OPTIMIZACIÓN: Limitar a 5 productos y solo campos esenciales
        const optimizedProducts = products.slice(0, 5).map(product => ({
            name: product.name || product.title || product.producto || 'Producto sin nombre',
            price: product.price || product.precio || product.cost || 'Consultar precio',
            stock: product.stock || product.cantidad || product.available || 'Consultar stock'
        }));

        const productPrompt = `${systemPrompt}

PRODUCTOS ENCONTRADOS (${optimizedProducts.length} de ${products.length}):
${JSON.stringify(optimizedProducts, null, 2)}

INSTRUCCIONES:
- Responde naturalmente basándote en estos productos
- Incluye precios y disponibilidad si están disponibles
- Tono conversacional para WhatsApp
- Si hay más productos disponibles, menciona que hay más opciones

PREGUNTA: "${originalQuestion}"`;

        const messages = this.buildConversationMessages(productPrompt, conversationHistory, originalQuestion);

        const response = await axios.post(OPENAI_API_URL, {
            model: OPENAI_MODEL,
            messages: messages,
            max_tokens: clientConfig.max_tokens || 500,
            temperature: clientConfig.temperature || 0.7
        }, {
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            }
        });

        let respuesta = response.data.choices[0].message.content.trim();
        const tokens = response.data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

        // Agregar links de productos si están configurados
        if (clientConfig.product_link_template) {
            const linksSection = this.generateProductLinks(products, clientConfig, productName);
            if (linksSection) {
                respuesta += '\n\n' + linksSection;
                console.log(`🔗 Links agregados a la respuesta (${products.length} productos)`);
            }
        }

        log.success(`🛒 Respuesta con productos generada (${fromCache ? 'cache' : 'nueva búsqueda'})`);

        return {
            response: respuesta,
            tokens: tokens,
            productsFound: products.length
        };
    }

    /**
     * Generar links de productos basados en la configuración
     */
    static generateProductLinks(products, clientConfig, searchTerm = '') {
        try {
            const {
                product_link_template,
                product_link_id_field,
                product_link_text,
                product_max_results
            } = clientConfig;

            if (!product_link_template) {
                return null;
            }

            // Determinar si es un link específico por producto o un link general de búsqueda
            const isProductSpecific = product_link_template.includes('{PRODUCT_ID}');
            const isSearchLink = product_link_template.includes('{SEARCH_TERM}');

            let linksText = '';

            if (isProductSpecific) {
                // Generar un link por cada producto (limitado por max_results)
                const maxLinks = Math.min(products.length, product_max_results || 5);
                const linksArray = [];

                for (let i = 0; i < maxLinks; i++) {
                    const product = products[i];
                    const productId = this.extractProductId(product, product_link_id_field);

                    if (productId) {
                        const link = product_link_template.replace(/{PRODUCT_ID}/g, encodeURIComponent(productId));
                        const productName = product.name || product.title || product.producto || `Producto ${i + 1}`;
                        linksArray.push(`🔗 ${productName}: ${product_link_text} ${link}`);
                    }
                }

                if (linksArray.length > 0) {
                    linksText = linksArray.join('\n');
                }

            } else if (isSearchLink) {
                // Generar un link general de búsqueda
                const link = product_link_template.replace(/{SEARCH_TERM}/g, encodeURIComponent(searchTerm));
                linksText = `🔗 ${product_link_text}: ${link}`;

            } else {
                // Link estático sin variables
                linksText = `🔗 ${product_link_text}: ${product_link_template}`;
            }

            return linksText || null;

        } catch (error) {
            console.error('❌ Error generando links de productos:', error.message);

            // FALLBACK FINAL: Si hay error, intentar crear link básico de búsqueda
            if (searchTerm && clientConfig.product_link_template) {
                try {
                    const baseUrl = clientConfig.product_link_template.split('?')[0];
                    const fallbackLink = `${baseUrl}?b=${encodeURIComponent(searchTerm)}`;
                    console.log('🔗 Usando fallback final para link de búsqueda');
                    return `🔗 Podes verlos: ${fallbackLink}`;
                } catch (fallbackError) {
                    console.error('❌ Error en fallback final:', fallbackError.message);
                }
            }

            return null;
        }
    }

    /**
     * Extraer ID del producto según el campo configurado
     */
    static extractProductId(product, idField) {
        try {
            // Buscar el campo en diferentes niveles del objeto
            if (product[idField] !== undefined) {
                return product[idField];
            }

            // Buscar en campos anidados comunes
            const commonPaths = [
                `data.${idField}`,
                `attributes.${idField}`,
                `properties.${idField}`
            ];

            for (const path of commonPaths) {
                const value = this.getNestedValue(product, path);
                if (value !== undefined) {
                    return value;
                }
            }

            // Fallback a campos comunes si no se encuentra el campo específico
            const fallbackFields = ['id', 'product_id', 'sku', 'code', '_id'];
            for (const field of fallbackFields) {
                if (product[field] !== undefined) {
                    console.log(`⚠️ Campo '${idField}' no encontrado, usando '${field}' como fallback`);
                    return product[field];
                }
            }

            return null;
        } catch (error) {
            console.error(`❌ Error extrayendo ID del producto con campo '${idField}':`, error.message);
            return null;
        }
    }

    /**
     * Obtener valor anidado de un objeto usando dot notation
     */
    static getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    /**
     * Generar términos alternativos de búsqueda
     */
    static async generateAlternativeSearchTerms(originalTerm, originalQuestion, clientConfig) {
        const alternativePrompt = `No se encontraron productos para "${originalTerm}".

Genera 2-3 términos de búsqueda alternativos que podrían funcionar mejor:
- Más específicos o más generales
- Sinónimos o variaciones
- Términos relacionados

Pregunta original: "${originalQuestion}"

Responde solo los términos separados por comas, sin explicaciones adicionales.`;

        try {
            const messages = [
                { role: 'system', content: alternativePrompt },
                { role: 'user', content: originalTerm }
            ];

            const response = await axios.post(OPENAI_API_URL, {
                model: OPENAI_MODEL,
                messages: messages,
                max_tokens: 100,
                temperature: 0.5
            }, {
                timeout: 15000,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                }
            });

            const result = response.data.choices[0].message.content.trim();
            const terms = result.split(',').map(term => term.trim()).filter(term => term.length > 0);

            return {
                success: true,
                terms: terms,
                tokens: response.data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
            };

        } catch (error) {
            console.error('❌ Error generando términos alternativos:', error.message);
            return {
                success: false,
                terms: [],
                tokens: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
            };
        }
    }

    /**
     * Generar respuesta cuando no se encuentran productos
     */
    static async generateNoProductsFoundResponse(productName, originalQuestion, conversationHistory, clientConfig) {
        const systemPrompt = this.buildSystemPrompt(clientConfig);

        const noProductsPrompt = `${systemPrompt}

SITUACIÓN: No se encontraron productos para "${productName}" en el catálogo.

INSTRUCCIONES:
- Informa amablemente que no se encontró el producto específico
- Ofrece alternativas o ayuda adicional
- Sugiere contactar para más información
- Mantén un tono útil y profesional

PREGUNTA ORIGINAL: "${originalQuestion}"`;

        const messages = this.buildConversationMessages(noProductsPrompt, conversationHistory, originalQuestion);

        const response = await axios.post(OPENAI_API_URL, {
            model: OPENAI_MODEL,
            messages: messages,
            max_tokens: clientConfig.max_tokens || 300,
            temperature: clientConfig.temperature || 0.7
        }, {
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            }
        });

        const respuesta = response.data.choices[0].message.content.trim();
        const tokens = response.data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

        log.debug(`📝 Respuesta generada para producto no encontrado: "${productName}"`);

        return {
            response: respuesta,
            tokens: tokens,
            productsFound: 0
        };
    }

    /**
     * Sumar tokens de diferentes requests
     */
    static sumTokens(tokens1, tokens2) {
        return {
            prompt_tokens: (tokens1.prompt_tokens || 0) + (tokens2.prompt_tokens || 0),
            completion_tokens: (tokens1.completion_tokens || 0) + (tokens2.completion_tokens || 0),
            total_tokens: (tokens1.total_tokens || 0) + (tokens2.total_tokens || 0)
        };
    }

    // ============================================================================
    // MÉTODOS DE CACHÉ PARA OPTIMIZACIÓN DE TOKENS
    // ============================================================================

    /**
     * Generar clave de caché para una consulta
     */
    static generateCacheKey(clientCode, question, productName = null) {
        const normalizedQuestion = question.toLowerCase().trim();
        const key = productName
            ? `${clientCode}:product:${productName}:${normalizedQuestion}`
            : `${clientCode}:general:${normalizedQuestion}`;
        return key;
    }

    /**
     * Obtener respuesta del caché si existe y es válida
     */
    static getCachedResponse(cacheKey) {
        const cached = responseCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
            log.debug(`📋 Cache hit para: ${cacheKey.substring(0, 50)}...`);
            return cached.response;
        }

        if (cached) {
            // Eliminar entrada expirada
            responseCache.delete(cacheKey);
        }

        return null;
    }

    /**
     * Guardar respuesta en caché
     */
    static setCachedResponse(cacheKey, response) {
        responseCache.set(cacheKey, {
            response: response,
            timestamp: Date.now()
        });

        // Limpiar caché si crece mucho (mantener últimas 100 entradas)
        if (responseCache.size > 100) {
            const firstKey = responseCache.keys().next().value;
            responseCache.delete(firstKey);
        }

        log.debug(`💾 Respuesta cacheada para: ${cacheKey.substring(0, 50)}...`);
    }

    /**
     * Método genérico para llamadas a OpenAI (para uso de otros servicios)
     * @param {Array} messages - Array de mensajes para OpenAI
     * @param {number} maxTokens - Máximo de tokens
     * @param {number} temperature - Temperatura (creatividad)
     * @param {string} model - Modelo a usar (opcional)
     * @returns {string} Respuesta de OpenAI
     */
    static async getChatCompletion(messages, maxTokens = 500, temperature = 0.7, model = null) {
        try {
            const selectedModel = model || OPENAI_MODEL;
            
            log.debug(`🤖 Generic OpenAI call: ${messages.length} messages, model: ${selectedModel}`);

            const response = await axios.post(OPENAI_API_URL, {
                model: selectedModel,
                messages: messages,
                max_tokens: maxTokens,
                temperature: temperature
            }, {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                }
            });

            const content = response.data.choices[0].message.content;
            
            log.debug(`✅ OpenAI response received (${response.data.usage?.total_tokens || 0} tokens)`);
            
            return content;

        } catch (error) {
            log.error(`❌ Error in generic OpenAI call: ${error.message}`);
            throw new Error(`OpenAI API error: ${error.message}`);
        }
    }
}

module.exports = AIService;
