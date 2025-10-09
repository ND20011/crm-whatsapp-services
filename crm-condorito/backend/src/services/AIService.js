const axios = require('axios');

// 🚀 Sistema de logs optimizado para performance
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'INFO' : 'DEBUG');
const ENABLE_DEBUG = LOG_LEVEL === 'DEBUG' || LOG_LEVEL === 'TRACE';

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
const OPENAI_MODEL =  'gpt-4o-mini';

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
     * @returns {string} Prompt del sistema
     */
    static buildSystemPrompt(clientConfig) {
        const businessPrompt = clientConfig.business_prompt || 
            'Sos un asistente que responde mensajes de WhatsApp de un negocio.';
        
        const baseInstructions = `
${businessPrompt}

INSTRUCCIONES IMPORTANTES:
- Responde siempre en español
- Sé amable y profesional
- Mantén las respuestas concisas pero informativas
- Si no sabes algo específico del negocio, sugiere contactar directamente
- No inventes información que no esté en tu prompt de negocio
        `.trim();

        return baseInstructions;
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

        // Agregar historial de conversación (últimos 10 mensajes)
        const recentHistory = conversationHistory.slice(-10);
        
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
     * Obtener configuración de IA para un cliente
     * @param {string} clientCode - Código del cliente
     * @returns {Promise<Object>} Configuración de IA
     */
    static async getClientAIConfig(clientCode) {
        try {
            console.log('🔍 Getting AI config for clientCode:', clientCode);
            const { executeQuery } = require('../config/database-simple');

            // Buscar configuración personalizada del cliente
            const query = `
                SELECT 
                    ac.*,
                    c.id as client_id,
                    c.client_code
                FROM ai_configurations ac
                INNER JOIN clients c ON ac.client_id = c.id
                WHERE c.client_code = ?
            `;
            
            const results = await executeQuery(query, [clientCode]);
            console.log('🔍 Query results count:', results?.length, 'for clientCode:', clientCode);

            if (results && results.length > 0) {
                const config = results[0];
                console.log('✅ Found AI config for client:', clientCode, 'prompt preview:', config.business_prompt?.substring(0, 50) + '...');
                
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
                    }
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
     * @returns {Promise<Object>} Objeto con respuesta y tokens
     */
    static async getResponseWithTokens(clientCode, question, conversationHistory = [], permisoProducto = 0) {
        try {
            // 1. Obtener configuración del cliente
            const clientConfig = await this.getClientAIConfig(clientCode);
            if (!clientConfig || !clientConfig.enabled) {
                throw new Error('IA no habilitada para este cliente');
            }

            // 2. Construir prompt del sistema
            const systemPrompt = this.buildSystemPrompt(clientConfig);

            // 3. Construir mensajes para OpenAI
            const messages = this.buildConversationMessages(systemPrompt, conversationHistory, question);

            log.debug(`Sending ${messages.length} messages to OpenAI`);
            log.debug(`Question: ${question ? question.substring(0, 100) : 'No question'}...`);

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

        } catch (error) {
            console.error('❌ Error al obtener la respuesta de OpenAI con tokens:', error.message);
            
            return {
                response: 'Disculpa, hubo un problema al procesar tu mensaje. Por favor intenta de nuevo más tarde.',
                tokens: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = AIService;
