const AIService = require('../services/AIService');
const BotQuotaService = require('../services/BotQuotaService');
const AIConfigValidator = require('../validators/AIConfigValidator');

/**
 * 🧠 Controlador para gestionar configuraciones de IA por cliente
 */
class AIConfigController {

    /**
     * Obtener configuración de IA del cliente
     * GET /api/ai/config
     */
    static async getConfig(req, res) {
        try {
            // Obtener clientCode desde la estructura correcta
            const clientCode = req.user.clientCode || req.user.client?.client_code;
            console.log('🔍 AIConfigController.getConfig - INICIO');
            console.log('🔍 req.user completo:', JSON.stringify(req.user, null, 2));
            console.log('🔍 clientCode extraído:', clientCode);
            
            if (!clientCode) {
                console.log('❌ No clientCode found in req.user');
                return res.status(400).json({
                    success: false,
                    message: 'ClientCode no encontrado en el token'
                });
            }
            
            console.log('🔍 Llamando a AIService.getClientAIConfig con:', clientCode);
            const config = await AIService.getClientAIConfig(clientCode);
            console.log('🔍 Resultado de AIService.getClientAIConfig:', config ? 'Configuración obtenida' : 'No config');
            
            if (!config) {
                console.log('❌ AIService returned null/undefined config');
                return res.status(404).json({
                    success: false,
                    message: 'Configuración de IA no encontrada'
                });
            }

            console.log('✅ Returning config with business_prompt preview:', config.business_prompt?.substring(0, 50) + '...');
            console.log('✅ Config enabled:', config.enabled);
            console.log('✅ Config ai_mode:', config.ai_mode);
            
            res.json({
                success: true,
                data: config
            });

        } catch (error) {
            console.error('❌ Error getting AI config:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener la configuración de IA',
                error: error.message
            });
        }
    }

    /**
     * Actualizar configuración de IA del cliente
     * PUT /api/ai/config
     */
    static async updateConfig(req, res) {
        try {
            const clientCode = req.user.clientCode || req.user.client?.client_code;
            const config = req.body;

            // Validar configuración usando validador centralizado
            const validation = AIConfigValidator.validateConfig(config);
            
            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    message: 'Errores de validación en la configuración',
                    errors: validation.errors,
                    summary: validation.summary
                });
            }

            // Actualizar configuración
            const success = await AIService.updateClientAIConfig(clientCode, config);
            
            if (!success) {
                return res.status(500).json({
                    success: false,
                    message: 'Error al actualizar la configuración'
                });
            }

            // Obtener configuración actualizada
            const updatedConfig = await AIService.getClientAIConfig(clientCode);

            res.json({
                success: true,
                message: 'Configuración actualizada correctamente',
                data: updatedConfig
            });

        } catch (error) {
            console.error('❌ Error updating AI config:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar la configuración de IA',
                error: error.message
            });
        }
    }

    /**
     * Probar configuración de IA con un mensaje de prueba
     * POST /api/ai/test
     */
    static async testConfig(req, res) {
        try {
            const clientCode = req.user.clientCode || req.user.client?.client_code;
            const { message } = req.body;

            if (!message || message.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Mensaje de prueba requerido'
                });
            }

            // Verificar cuota disponible usando servicio centralizado
            const quotaCheck = await BotQuotaService.checkQuotaAvailable(clientCode);
            
            if (!quotaCheck.success || !quotaCheck.available) {
                return res.status(400).json({
                    success: false,
                    message: quotaCheck.message || 'Error verificando cuota',
                    quota: quotaCheck.success ? {
                        usage: quotaCheck.usage,
                        limit: quotaCheck.limit,
                        remaining: quotaCheck.remaining,
                        percentage: quotaCheck.percentage,
                        status: quotaCheck.status
                    } : undefined
                });
            }

            // Obtener respuesta de IA
            // Obtener respuesta de IA con información de tokens
            const aiResult = await AIService.getResponseWithTokens(clientCode, message, []);
            
            if (!aiResult.success) {
                return res.status(500).json({
                    success: false,
                    message: "No se pudo generar respuesta de prueba",
                    error: aiResult.error
                });
            }
            
            // Consumir cuota después del éxito usando servicio centralizado (incluyendo tokens)
            const tokensUsed = aiResult.tokens.total_tokens || 0;
            const updatedQuota = await BotQuotaService.checkAndConsumeQuota(clientCode, 1, tokensUsed);
            
            console.log("✅ Prueba de IA completada");
            console.log("📊 Cuota actualizada:", updatedQuota.usage, "/", updatedQuota.limit);
            console.log("🎯 Tokens actualizados:", updatedQuota.tokenUsage, "/", updatedQuota.tokenLimit);
            
            res.json({
                success: true,
                data: {
                    input_message: message,
                    ai_response: aiResult.response,
                    timestamp: new Date().toISOString(),
                    quotaUsed: updatedQuota.usage,
                    quotaLimit: updatedQuota.limit,
                    quotaRemaining: updatedQuota.remaining,
                    tokensUsed: updatedQuota.tokenUsage,
                    tokenLimit: updatedQuota.tokenLimit,
                    tokensRemaining: updatedQuota.tokensRemaining,
                    tokenDetails: aiResult.tokens
                }
            });

        } catch (error) {
            console.error('❌ Error testing AI config:', error);
            res.status(500).json({
                success: false,
                message: 'Error al probar la configuración de IA',
                error: error.message
            });
        }
    }

    /**
     * Obtener modos de IA disponibles
     * GET /api/ai/modes
     */
    static async getModes(req, res) {
        try {
            const modes = AIService.getAvailableModes();

            res.json({
                success: true,
                data: modes
            });

        } catch (error) {
            console.error('❌ Error getting AI modes:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener los modos de IA',
                error: error.message
            });
        }
    }

    /**
     * Health check del servicio de IA
     * GET /api/ai/health
     */
    static async healthCheck(req, res) {
        try {
            const health = await AIService.healthCheck();

            res.json({
                success: true,
                data: health
            });

        } catch (error) {
            console.error('❌ Error in AI health check:', error);
            res.status(500).json({
                success: false,
                message: 'Error en el health check de IA',
                error: error.message
            });
        }
    }

    /**
     * Obtener estadísticas de uso de IA
     * GET /api/ai/stats
     */
    static async getStats(req, res) {
        try {
            const clientCode = req.user.clientCode || req.user.client?.client_code;
            const { hours = 24 } = req.query;

            const stats = await AIService.getUsageStats(clientCode, { hours: parseInt(hours) });

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('❌ Error getting AI stats:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener estadísticas de IA',
                error: error.message
            });
        }
    }

    /**
     * Resetear configuración a valores por defecto
     * POST /api/ai/reset
     */
    static async resetConfig(req, res) {
        try {
            const clientCode = req.user.clientCode || req.user.client?.client_code;

            const defaultConfig = {
                enabled: true,
                ai_mode: 'prompt_only',
                business_prompt: 'Sos un asistente que responde mensajes de WhatsApp de un negocio. Sé amable y profesional en todas tus respuestas.',
                max_tokens: 500,
                temperature: 0.7,
                maxHistoryMessages: 10,
                responseTimeout: 30000,
                fallbackMessage: 'Disculpa, no pude procesar tu mensaje en este momento. Por favor intenta de nuevo más tarde.',
                workingHours: {
                    enabled: true,
                    start: '00:00',
                    end: '23:59',
                    days: [0, 1, 2, 3, 4, 5, 6]
                }
            };

            const success = await AIService.updateClientAIConfig(clientCode, defaultConfig);
            
            if (!success) {
                return res.status(500).json({
                    success: false,
                    message: 'Error al resetear la configuración'
                });
            }

            // Obtener configuración actualizada
            const updatedConfig = await AIService.getClientAIConfig(clientCode);

            res.json({
                success: true,
                message: 'Configuración reseteada a valores por defecto',
                data: updatedConfig
            });

        } catch (error) {
            console.error('❌ Error resetting AI config:', error);
            res.status(500).json({
                success: false,
                message: 'Error al resetear la configuración de IA',
                error: error.message
            });
        }
    }

    /**
     * Obtener información de límites y validaciones
     * GET /api/ai/limits
     */
    static async getLimits(req, res) {
        try {
            const limitsInfo = AIConfigValidator.getLimitsInfo();
            
            res.json({
                success: true,
                data: limitsInfo,
                message: 'Información de límites obtenida exitosamente'
            });
            
        } catch (error) {
            console.error('❌ Error getting AI limits:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener información de límites',
                error: error.message
            });
        }
    }

    /**
     * Generar respuesta sugerida basada en el contexto de la conversación
     * POST /api/ai/suggest-response
     */
    static async suggestResponse(req, res) {
        try {
            const clientCode = req.user.clientCode || req.user.client?.client_code;
            const { conversationHistory, lastMessage } = req.body;
            
            console.log('🧠 AIConfigController.suggestResponse - INICIO');
            console.log('🔍 clientCode:', clientCode);
            console.log('🔍 lastMessage:', lastMessage?.substring(0, 100) + '...');
            console.log('🔍 conversationHistory length:', conversationHistory?.length || 0);
            
            if (!clientCode) {
                return res.status(400).json({
                    success: false,
                    message: 'ClientCode no encontrado en el token'
                });
            }
            
            if (!lastMessage) {
                return res.status(400).json({
                    success: false,
                    message: 'Se requiere el último mensaje para generar una respuesta'
                });
            }
            
            // Obtener configuración de IA del cliente
            const config = await AIService.getClientAIConfig(clientCode);
            if (!config || !config.enabled) {
                return res.status(400).json({
                    success: false,
                    message: 'La IA no está habilitada para este cliente'
                });
            }

            // Verificar cuota disponible usando servicio centralizado
            const quotaCheck = await BotQuotaService.checkQuotaAvailable(clientCode);
            
            if (!quotaCheck.success || !quotaCheck.available) {
                return res.status(400).json({
                    success: false,
                    message: quotaCheck.message || 'Error verificando cuota',
                    quota: quotaCheck.success ? {
                        usage: quotaCheck.usage,
                        limit: quotaCheck.limit,
                        remaining: quotaCheck.remaining,
                        percentage: quotaCheck.percentage,
                        status: quotaCheck.status
                    } : undefined
                });
            }
            
            // Preparar el historial para la IA
            const history = conversationHistory || [];
            
            // Generar respuesta sugerida
            console.log('🧠 Llamando a AIService.getResponse con:', {
                clientCode,
                lastMessage: lastMessage.substring(0, 50) + '...',
                historyLength: history.length,
                productSearchEnabled: config.product_search_enabled ? 1 : 0
            });
            
            const suggestedResponse = await AIService.getResponse(
                clientCode, 
                lastMessage, 
                history, 
                config.product_search_enabled ? 1 : 0
            );
            
            console.log('🧠 AIService.getResponse devolvió:', {
                response: suggestedResponse?.substring(0, 100) + '...',
                isError: suggestedResponse?.includes('Disculpa, hubo un problema')
            });
            
            if (!suggestedResponse) {
                return res.status(500).json({
                    success: false,
                    message: 'No se pudo generar una respuesta sugerida'
                });
            }

            // Consumir cuota después del éxito usando servicio centralizado
            const updatedQuota = await BotQuotaService.checkAndConsumeQuota(clientCode, 1);

            console.log('✅ Respuesta sugerida generada:', suggestedResponse.substring(0, 100) + '...');
            console.log('📊 Cuota actualizada:', updatedQuota.usage, '/', updatedQuota.limit);
            
            res.json({
                success: true,
                data: {
                    suggestedResponse: suggestedResponse.trim(),
                    timestamp: new Date().toISOString(),
                    quotaUsed: updatedQuota.usage,
                    quotaLimit: updatedQuota.limit,
                    quotaRemaining: updatedQuota.remaining
                }
            });
            
        } catch (error) {
            console.error('❌ Error generating suggested response:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al generar respuesta sugerida'
            });
        }
    }

    /**
     * Analizar conversación completa con IA
     * POST /api/ai/analyze-conversation
     */
    static async analyzeConversation(req, res) {
        try {
            const clientCode = req.user.clientCode || req.user.client?.client_code;
            const { conversationHistory, question } = req.body;
            
            console.log('🧠 AIConfigController.analyzeConversation - INICIO');
            console.log('🔍 clientCode:', clientCode);
            console.log('🔍 question:', question?.substring(0, 100) + '...');
            console.log('🔍 conversationHistory length:', conversationHistory?.length || 0);
            
            if (!clientCode) {
                return res.status(400).json({
                    success: false,
                    message: 'ClientCode no encontrado en el token'
                });
            }
            
            if (!question || !conversationHistory) {
                return res.status(400).json({
                    success: false,
                    message: 'Se requiere la pregunta y el historial de conversación para el análisis'
                });
            }
            
            // Obtener configuración de IA del cliente
            const config = await AIService.getClientAIConfig(clientCode);
            if (!config || !config.enabled) {
                return res.status(400).json({
                    success: false,
                    message: 'La IA no está habilitada para este cliente'
                });
            }

            // Verificar cuota disponible usando servicio centralizado
            const quotaCheck = await BotQuotaService.checkQuotaAvailable(clientCode);
            
            if (!quotaCheck.success || !quotaCheck.available) {
                return res.status(400).json({
                    success: false,
                    message: quotaCheck.message || 'Error verificando cuota',
                    quota: quotaCheck.success ? {
                        usage: quotaCheck.usage,
                        limit: quotaCheck.limit,
                        remaining: quotaCheck.remaining,
                        percentage: quotaCheck.percentage,
                        status: quotaCheck.status
                    } : undefined
                });
            }

            // Preparar el historial para análisis
            const history = conversationHistory || [];
            
            // Crear prompt específico para análisis
            const analysisPrompt = `Analiza la siguiente conversación y responde la pregunta específica del usuario.

Conversación:
${history.map((msg, index) => 
    `${index + 1}. [${msg.sender_type === 'bot' ? 'Asistente' : 'Cliente'}] ${msg.content}`
).join('\n')}

Pregunta del usuario: ${question}

Por favor, proporciona un análisis detallado y útil basado en la conversación anterior.`;
            
            // Generar análisis usando IA
            const analysis = await AIService.getResponse(
                clientCode, 
                analysisPrompt, 
                [], // No usar historial adicional para análisis
                0   // No usar búsqueda de productos
            );
            
            if (!analysis) {
                return res.status(500).json({
                    success: false,
                    message: 'No se pudo generar el análisis'
                });
            }

            // Consumir cuota después del éxito usando servicio centralizado (análisis consume más tokens)
            const updatedQuota = await BotQuotaService.checkAndConsumeQuota(clientCode, 8);

            console.log('✅ Análisis de conversación generado');
            console.log('📊 Cuota actualizada:', updatedQuota.usage, '/', updatedQuota.limit);
            
            res.json({
                success: true,
                data: {
                    analysis: analysis.trim(),
                    timestamp: new Date().toISOString(),
                    quotaUsed: updatedQuota.usage,
                    quotaLimit: updatedQuota.limit,
                    quotaRemaining: updatedQuota.remaining
                }
            });
            
        } catch (error) {
            console.error('❌ Error analyzing conversation:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al analizar conversación'
            });
        }
    }
}

module.exports = AIConfigController;
