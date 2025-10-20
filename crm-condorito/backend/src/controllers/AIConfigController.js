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

    // ============================================================================
    // MÉTODOS PARA CONFIGURACIÓN DE BÚSQUEDA DE PRODUCTOS
    // ============================================================================

    /**
     * Obtener configuración de búsqueda de productos
     * GET /api/ai/product-search-config
     */
    static async getProductSearchConfig(req, res) {
        try {
            const clientCode = req.user.clientCode || req.user.client?.client_code;
            console.log('🛒 AIConfigController.getProductSearchConfig - INICIO');
            console.log('🔍 clientCode:', clientCode);
            
            if (!clientCode) {
                return res.status(400).json({
                    success: false,
                    message: 'ClientCode no encontrado en el token'
                });
            }
            
            // Usar el nuevo método específico para configuración de productos
            const productConfig = await AIService.getClientProductSearchConfig(clientCode);
            
            if (!productConfig) {
                return res.status(404).json({
                    success: false,
                    message: 'Configuración de búsqueda de productos no encontrada'
                });
            }

            console.log('✅ Configuración de productos obtenida exitosamente');
            
            res.json({
                success: true,
                data: productConfig
            });

        } catch (error) {
            console.error('❌ Error getting product search config:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Actualizar configuración de búsqueda de productos
     * PUT /api/ai/product-search-config
     */
    static async updateProductSearchConfig(req, res) {
        try {
            const clientCode = req.user.clientCode || req.user.client?.client_code;
            const productConfig = req.body;

            console.log('🛒 AIConfigController.updateProductSearchConfig - INICIO');
            console.log('🔍 clientCode:', clientCode);
            console.log('🛒 productConfig:', JSON.stringify(productConfig, null, 2));

            if (!clientCode) {
                return res.status(400).json({
                    success: false,
                    message: 'ClientCode no encontrado en el token'
                });
            }

            // Validar configuración de productos
            const validation = AIConfigController.validateProductSearchConfig(productConfig);
            
            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    message: 'Errores de validación en la configuración de productos',
                    errors: validation.errors
                });
            }

            // Obtener configuración actual completa
            const currentConfig = await AIService.getClientAIConfig(clientCode);
            
            if (!currentConfig) {
                return res.status(404).json({
                    success: false,
                    message: 'Configuración de IA no encontrada'
                });
            }

            // Actualizar solo los campos de productos en bot_configurations
            const { executeQuery } = require('../config/database-simple');
            
            // Obtener client_id
            const clientQuery = 'SELECT id FROM clients WHERE client_code = ?';
            const clientResults = await executeQuery(clientQuery, [clientCode]);
            
            if (!clientResults || clientResults.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Cliente no encontrado'
                });
            }
            
            const clientId = clientResults[0].id;
            
            // Actualizar configuración de productos en bot_configurations
            const updateQuery = `
                UPDATE bot_configurations 
                SET 
                    product_search_enabled = ?,
                    product_endpoint_url = ?,
                    product_endpoint_method = ?,
                    product_endpoint_body = ?,
                    product_endpoint_headers = ?,
                    product_search_param_name = ?,
                    product_response_path = ?,
                    product_max_results = ?,
                    product_cache_ttl = ?,
                    product_timeout = ?,
                    product_link_enabled = ?,
                    product_link_template = ?,
                    product_link_id_field = ?,
                    product_link_text = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE client_id = ?
            `;
            
            const updateParams = [
                productConfig.product_search_enabled ? 1 : 0,
                productConfig.product_endpoint_url || '',
                productConfig.product_endpoint_method || 'GET',
                productConfig.product_endpoint_body || '',
                productConfig.product_endpoint_headers || '',
                productConfig.product_search_param_name || 'search',
                productConfig.product_response_path || 'data',
                productConfig.product_max_results || 30,
                productConfig.product_cache_ttl || 600,
                productConfig.product_timeout || 8000,
                productConfig.product_link_enabled ? 1 : 0,
                productConfig.product_link_template || '',
                productConfig.product_link_id_field || 'id',
                productConfig.product_link_text || 'Ver producto',
                clientId
            ];
            
            await executeQuery(updateQuery, updateParams);
            
            // Obtener configuración actualizada
            const finalConfig = await AIService.getClientAIConfig(clientCode);

            console.log('✅ Configuración de productos actualizada');
            
            res.json({
                success: true,
                message: 'Configuración de búsqueda de productos actualizada correctamente',
                data: {
                    product_search_enabled: finalConfig.product_search_enabled,
                    product_endpoint_url: finalConfig.product_endpoint_url,
                    product_endpoint_method: finalConfig.product_endpoint_method,
                    product_endpoint_body: finalConfig.product_endpoint_body,
                    product_endpoint_headers: finalConfig.product_endpoint_headers,
                    product_search_param_name: finalConfig.product_search_param_name,
                    product_response_path: finalConfig.product_response_path,
                    product_max_results: finalConfig.product_max_results,
                    product_cache_ttl: finalConfig.product_cache_ttl,
                    product_timeout: finalConfig.product_timeout,
                    product_link_enabled: finalConfig.product_link_enabled,
                    product_link_template: finalConfig.product_link_template,
                    product_link_id_field: finalConfig.product_link_id_field,
                    product_link_text: finalConfig.product_link_text
                }
            });

        } catch (error) {
            console.error('❌ Error updating product search config:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar la configuración de búsqueda de productos',
                error: error.message
            });
        }
    }

    /**
     * Probar configuración de búsqueda de productos
     * POST /api/ai/test-product-search
     */
    static async testProductSearch(req, res) {
        try {
            const clientCode = req.user.clientCode || req.user.client?.client_code;
            const { searchTerm, testConfig } = req.body;

            console.log('🧪 AIConfigController.testProductSearch - INICIO');
            console.log('🔍 clientCode:', clientCode);
            console.log('🔍 searchTerm:', searchTerm);

            if (!clientCode) {
                return res.status(400).json({
                    success: false,
                    message: 'ClientCode no encontrado en el token'
                });
            }

            if (!searchTerm || searchTerm.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'Se requiere un término de búsqueda para la prueba'
                });
            }

            let configToTest;
            
            if (testConfig) {
                // Usar configuración de prueba proporcionada
                configToTest = testConfig;
                console.log('🧪 Usando configuración de prueba proporcionada');
            } else {
                // Usar configuración actual del cliente
                const currentConfig = await AIService.getClientAIConfig(clientCode);
                if (!currentConfig) {
                    return res.status(404).json({
                        success: false,
                        message: 'Configuración de IA no encontrada'
                    });
                }
                configToTest = currentConfig;
                console.log('🧪 Usando configuración actual del cliente');
            }

            // Validar configuración antes de probar
            const validation = AIConfigController.validateProductSearchConfig(configToTest);
            
            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    message: 'La configuración de productos no es válida para la prueba',
                    errors: validation.errors
                });
            }

            // Realizar búsqueda de prueba
            const ProductSearchService = require('../services/ProductSearchService');
            
            const startTime = Date.now();
            const searchResult = await ProductSearchService.searchProducts(
                configToTest.client_id || 1, // ID temporal para pruebas
                configToTest,
                searchTerm
            );
            const endTime = Date.now();
            const responseTime = endTime - startTime;

            console.log('🧪 Resultado de prueba:', {
                success: searchResult.success,
                productsCount: searchResult.products?.length || 0,
                responseTime: responseTime + 'ms',
                fromCache: searchResult.fromCache
            });

            res.json({
                success: true,
                message: 'Prueba de búsqueda de productos completada',
                data: {
                    searchTerm: searchTerm,
                    searchResult: searchResult,
                    responseTime: responseTime,
                    timestamp: new Date().toISOString(),
                    configUsed: {
                        product_endpoint_url: configToTest.product_endpoint_url,
                        product_endpoint_method: configToTest.product_endpoint_method,
                        product_search_param_name: configToTest.product_search_param_name,
                        product_response_path: configToTest.product_response_path,
                        product_max_results: configToTest.product_max_results,
                        product_timeout: configToTest.product_timeout
                    }
                }
            });

        } catch (error) {
            console.error('❌ Error testing product search:', error);
            res.status(500).json({
                success: false,
                message: 'Error al probar la búsqueda de productos',
                error: error.message
            });
        }
    }

    /**
     * Obtener estadísticas del cache de productos
     * GET /api/ai/product-search-stats
     */
    static async getProductSearchStats(req, res) {
        try {
            const clientCode = req.user.clientCode || req.user.client?.client_code;
            
            console.log('📊 AIConfigController.getProductSearchStats - INICIO');
            console.log('🔍 clientCode:', clientCode);

            if (!clientCode) {
                return res.status(400).json({
                    success: false,
                    message: 'ClientCode no encontrado en el token'
                });
            }

            // Obtener client_id
            const { executeQuery } = require('../config/database-simple');
            const clientQuery = 'SELECT id FROM clients WHERE client_code = ?';
            const clientResults = await executeQuery(clientQuery, [clientCode]);
            
            if (!clientResults || clientResults.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Cliente no encontrado'
                });
            }
            
            const clientId = clientResults[0].id;

            // Obtener estadísticas del cache
            const ProductSearchService = require('../services/ProductSearchService');
            const cacheStats = await ProductSearchService.getCacheStats(clientId);
            
            // Obtener configuración actual
            const config = await AIService.getClientAIConfig(clientCode);

            console.log('📊 Estadísticas obtenidas:', cacheStats);

            res.json({
                success: true,
                data: {
                    cache: cacheStats,
                    config: {
                        product_search_enabled: config?.product_search_enabled || false,
                        product_cache_ttl: config?.product_cache_ttl || 600,
                        product_max_results: config?.product_max_results || 30
                    },
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ Error getting product search stats:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener estadísticas de búsqueda de productos',
                error: error.message
            });
        }
    }

    /**
     * Limpiar cache de productos
     * DELETE /api/ai/product-search-cache
     */
    static async clearProductSearchCache(req, res) {
        try {
            const clientCode = req.user.clientCode || req.user.client?.client_code;
            
            console.log('🧹 AIConfigController.clearProductSearchCache - INICIO');
            console.log('🔍 clientCode:', clientCode);

            if (!clientCode) {
                return res.status(400).json({
                    success: false,
                    message: 'ClientCode no encontrado en el token'
                });
            }

            // Obtener client_id
            const { executeQuery } = require('../config/database-simple');
            const clientQuery = 'SELECT id FROM clients WHERE client_code = ?';
            const clientResults = await executeQuery(clientQuery, [clientCode]);
            
            if (!clientResults || clientResults.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Cliente no encontrado'
                });
            }
            
            const clientId = clientResults[0].id;

            // Limpiar cache del cliente
            const deleteQuery = 'DELETE FROM product_search_cache WHERE client_id = ?';
            const result = await executeQuery(deleteQuery, [clientId]);

            console.log('🧹 Cache limpiado:', result.affectedRows, 'entradas eliminadas');

            res.json({
                success: true,
                message: 'Cache de búsqueda de productos limpiado correctamente',
                data: {
                    entriesDeleted: result.affectedRows,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ Error clearing product search cache:', error);
            res.status(500).json({
                success: false,
                message: 'Error al limpiar el cache de búsqueda de productos',
                error: error.message
            });
        }
    }

    /**
     * Validar configuración de búsqueda de productos
     */
    static validateProductSearchConfig(config) {
        const errors = [];

        // Si está habilitada, validar campos requeridos
        if (config.product_search_enabled) {
            if (!config.product_endpoint_url || config.product_endpoint_url.trim() === '') {
                errors.push('La URL del endpoint es requerida cuando la búsqueda está habilitada');
            } else {
                // Validar formato de URL
                try {
                    new URL(config.product_endpoint_url);
                } catch (e) {
                    errors.push('La URL del endpoint no tiene un formato válido');
                }
            }

            // Validar método HTTP
            const validMethods = ['GET', 'POST'];
            if (config.product_endpoint_method && !validMethods.includes(config.product_endpoint_method)) {
                errors.push('El método HTTP debe ser GET o POST');
            }

            // Validar JSON si existe
            if (config.product_endpoint_headers) {
                try {
                    JSON.parse(config.product_endpoint_headers);
                } catch (e) {
                    errors.push('Los headers deben estar en formato JSON válido');
                }
            }

            if (config.product_endpoint_body) {
                try {
                    JSON.parse(config.product_endpoint_body);
                } catch (e) {
                    errors.push('El body debe estar en formato JSON válido');
                }
            }

            // Validar valores numéricos
            if (config.product_max_results && 
                (isNaN(config.product_max_results) || config.product_max_results < 1 || config.product_max_results > 100)) {
                errors.push('El máximo de resultados debe ser un número entre 1 y 100');
            }

            if (config.product_cache_ttl && 
                (isNaN(config.product_cache_ttl) || config.product_cache_ttl < 60 || config.product_cache_ttl > 3600)) {
                errors.push('El TTL del cache debe ser un número entre 60 y 3600 segundos');
            }

            if (config.product_timeout && 
                (isNaN(config.product_timeout) || config.product_timeout < 1000 || config.product_timeout > 30000)) {
                errors.push('El timeout debe ser un número entre 1000 y 30000 milisegundos');
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
}

module.exports = AIConfigController;
