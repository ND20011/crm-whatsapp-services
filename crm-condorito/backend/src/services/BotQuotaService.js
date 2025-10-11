/**
 * 🤖 Servicio centralizado para manejo de cuotas del Bot de IA
 * 
 * Este servicio centraliza toda la lógica de:
 * - Verificación de cuotas disponibles (mensajes Y tokens)
 * - Incremento de uso
 * - Validación antes de usar IA
 * - Estadísticas de uso
 */

class BotQuotaService {
    
    /**
     * Verificar si el cliente tiene cuota disponible para usar IA (mensajes Y tokens)
     * @param {string} clientCode - Código del cliente
     * @returns {Promise<Object>} Estado de la cuota
     */
    static async checkQuotaAvailable(clientCode) {
        try {
            const { executeQuery } = require('../config/database-simple');
            
            console.log(`🔍 Verificando cuota disponible para cliente: ${clientCode}`);
            
            // Obtener datos del cliente (incluyendo tokens)
            const [client] = await executeQuery(
                `SELECT id, current_bot_usage, monthly_bot_limit, company_name,
                        current_token_usage, monthly_token_limit, token_usage_reset_date 
                 FROM clients WHERE client_code = ?`,
                [clientCode]
            );

            if (!client) {
                return {
                    success: false,
                    available: false,
                    error: 'Cliente no encontrado',
                    code: 'CLIENT_NOT_FOUND'
                };
            }

            // Verificar cuota de mensajes
            const currentUsage = client.current_bot_usage || 0;
            const monthlyLimit = client.monthly_bot_limit || 2500;
            const remaining = Math.max(0, monthlyLimit - currentUsage);
            const percentage = Math.round((currentUsage / monthlyLimit) * 100);
            const messagesAvailable = currentUsage < monthlyLimit;

            // Verificar cuota de tokens
            const currentTokenUsage = client.current_token_usage || 0;
            const monthlyTokenLimit = client.monthly_token_limit || 100000;
            const tokensRemaining = Math.max(0, monthlyTokenLimit - currentTokenUsage);
            const tokenPercentage = Math.round((currentTokenUsage / monthlyTokenLimit) * 100);
            const tokensAvailable = currentTokenUsage < monthlyTokenLimit;

            // Cuota disponible solo si AMBOS límites están OK
            const quotaAvailable = messagesAvailable && tokensAvailable;
            
            console.log(`📊 Cuota ${clientCode}:`);
            console.log(`   📨 Mensajes: ${currentUsage}/${monthlyLimit} (${percentage}%) - ${messagesAvailable ? 'OK' : 'EXCEDIDO'}`);
            console.log(`   🎯 Tokens: ${currentTokenUsage}/${monthlyTokenLimit} (${tokenPercentage}%) - ${tokensAvailable ? 'OK' : 'EXCEDIDO'}`);
            console.log(`   ✅ Estado final: ${quotaAvailable ? 'DISPONIBLE' : 'AGOTADA'}`);
            
            // Determinar mensaje apropiado
            let message = '';
            if (!messagesAvailable && !tokensAvailable) {
                message = 'Límites de mensajes y tokens excedidos';
            } else if (!messagesAvailable) {
                message = 'Límite de mensajes excedido';
            } else if (!tokensAvailable) {
                message = 'Límite de tokens excedido';
            } else {
                message = `Tienes ${remaining} mensajes y ${tokensRemaining} tokens disponibles este mes`;
            }
            
            return {
                success: true,
                available: quotaAvailable,
                clientId: client.id,
                clientCode: clientCode,
                companyName: client.company_name,
                // Datos de mensajes
                usage: currentUsage,
                limit: monthlyLimit,
                remaining: remaining,
                percentage: percentage,
                // Datos de tokens
                tokenUsage: currentTokenUsage,
                tokenLimit: monthlyTokenLimit,
                tokensRemaining: tokensRemaining,
                tokenPercentage: tokenPercentage,
                // Estado general
                status: quotaAvailable ? 'active' : 'exceeded',
                message: message,
                // Detalles por tipo
                limits: {
                    messages: {
                        current: currentUsage,
                        limit: monthlyLimit,
                        remaining: remaining,
                        percentage: percentage,
                        available: messagesAvailable
                    },
                    tokens: {
                        current: currentTokenUsage,
                        limit: monthlyTokenLimit,
                        remaining: tokensRemaining,
                        percentage: tokenPercentage,
                        available: tokensAvailable
                    }
                }
            };
            
        } catch (error) {
            console.error('❌ Error verificando cuota:', error.message);
            return {
                success: false,
                available: false,
                error: error.message,
                code: 'QUOTA_CHECK_ERROR'
            };
        }
    }

    /**
     * Verificar cuota Y incrementar uso si está disponible (operación atómica)
     * @param {string} clientCode - Código del cliente
     * @param {number} messagesToConsume - Cantidad de mensajes a consumir (default: 1)
     * @param {number} tokensToConsume - Cantidad de tokens a consumir (default: 0)
     * @returns {Promise<Object>} Resultado de la operación
     */
    static async checkAndConsumeQuota(clientCode, messagesToConsume = 1, tokensToConsume = 0) {
        try {
            const { executeQuery } = require('../config/database-simple');
            
            console.log(`🔄 Verificando y consumiendo cuota para ${clientCode}:`);
            console.log(`   📨 Mensajes: ${messagesToConsume}`);
            console.log(`   🎯 Tokens: ${tokensToConsume}`);
            
            // Verificar cuota disponible
            const quotaCheck = await this.checkQuotaAvailable(clientCode);
            
            if (!quotaCheck.success || !quotaCheck.available) {
                return {
                    success: false,
                    consumed: false,
                    ...quotaCheck
                };
            }

            // Si hay cuota disponible, incrementar uso
            await executeQuery(
                `UPDATE clients SET 
                    current_bot_usage = COALESCE(current_bot_usage, 0) + ?,
                    current_token_usage = COALESCE(current_token_usage, 0) + ?
                 WHERE client_code = ?`,
                [messagesToConsume, tokensToConsume, clientCode]
            );

            // Obtener estado actualizado
            const updatedQuota = await this.checkQuotaAvailable(clientCode);
            
            console.log(`✅ Cuota consumida exitosamente para ${clientCode}:`);
            console.log(`   📨 Mensajes: ${updatedQuota.usage}/${updatedQuota.limit}`);
            console.log(`   🎯 Tokens: ${updatedQuota.tokenUsage}/${updatedQuota.tokenLimit}`);
            
            return {
                success: true,
                consumed: true,
                messagesConsumed: messagesToConsume,
                tokensConsumed: tokensToConsume,
                ...updatedQuota
            };
            
        } catch (error) {
            console.error('❌ Error consumiendo cuota:', error.message);
            return {
                success: false,
                consumed: false,
                error: error.message,
                code: 'QUOTA_CONSUME_ERROR'
            };
        }
    }

    /**
     * Consumir solo tokens (para cuando ya se consumieron mensajes)
     * @param {string} clientCode - Código del cliente
     * @param {number} tokensToConsume - Cantidad de tokens a consumir
     * @returns {Promise<Object>} Resultado de la operación
     */
    static async consumeTokens(clientCode, tokensToConsume) {
        try {
            const { executeQuery } = require('../config/database-simple');
            
            console.log(`🎯 Consumiendo ${tokensToConsume} tokens para ${clientCode}`);
            
            // Verificar que el cliente existe y obtener estado actual
            const quotaCheck = await this.checkQuotaAvailable(clientCode);
            
            if (!quotaCheck.success) {
                return quotaCheck;
            }

            // Incrementar solo tokens
            await executeQuery(
                'UPDATE clients SET current_token_usage = COALESCE(current_token_usage, 0) + ? WHERE client_code = ?',
                [tokensToConsume, clientCode]
            );

            // Obtener estado actualizado
            const updatedQuota = await this.checkQuotaAvailable(clientCode);
            
            console.log(`✅ Tokens consumidos: ${updatedQuota.tokenUsage}/${updatedQuota.tokenLimit}`);
            
            return {
                success: true,
                consumed: true,
                tokensConsumed: tokensToConsume,
                ...updatedQuota
            };
            
        } catch (error) {
            console.error('❌ Error consumiendo tokens:', error.message);
            return {
                success: false,
                consumed: false,
                error: error.message,
                code: 'TOKEN_CONSUME_ERROR'
            };
        }
    }

    /**
     * Middleware para verificar cuota antes de endpoints de IA
     * @param {Object} req - Request object
     * @param {Object} res - Response object  
     * @param {Function} next - Next middleware
     */
    static async quotaMiddleware(req, res, next) {
        try {
            const clientCode = req.user.clientCode || req.user.client?.client_code;
            
            if (!clientCode) {
                return res.status(400).json({
                    success: false,
                    message: 'ClientCode no encontrado en el token'
                });
            }

            const quotaCheck = await BotQuotaService.checkQuotaAvailable(clientCode);
            
            if (!quotaCheck.success) {
                return res.status(500).json({
                    success: false,
                    message: quotaCheck.error || 'Error verificando cuota'
                });
            }

            if (!quotaCheck.available) {
                return res.status(400).json({
                    success: false,
                    message: quotaCheck.message,
                    quota: {
                        usage: quotaCheck.usage,
                        limit: quotaCheck.limit,
                        remaining: quotaCheck.remaining,
                        percentage: quotaCheck.percentage,
                        tokenUsage: quotaCheck.tokenUsage,
                        tokenLimit: quotaCheck.tokenLimit,
                        tokensRemaining: quotaCheck.tokensRemaining,
                        tokenPercentage: quotaCheck.tokenPercentage,
                        status: quotaCheck.status,
                        limits: quotaCheck.limits
                    }
                });
            }

            // Agregar datos de cuota al request para uso posterior
            req.quotaInfo = quotaCheck;
            next();
            
        } catch (error) {
            console.error('❌ Error en quota middleware:', error.message);
            res.status(500).json({
                success: false,
                message: 'Error interno verificando cuota'
            });
        }
    }

    /**
     * Consumir cuota después de usar IA exitosamente
     * @param {Object} req - Request object (debe tener req.quotaInfo)
     * @param {number} messagesUsed - Mensajes consumidos (default: 1)
     * @param {number} tokensUsed - Tokens consumidos (default: 0)
     * @returns {Promise<Object>} Estado actualizado de cuota
     */
    static async consumeQuotaAfterSuccess(req, messagesUsed = 1, tokensUsed = 0) {
        try {
            const clientCode = req.user.clientCode || req.user.client?.client_code;
            const clientId = req.quotaInfo?.clientId;
            
            if (!clientId) {
                throw new Error('clientId no encontrado en quotaInfo');
            }

            const { executeQuery } = require('../config/database-simple');
            
            // Incrementar uso
            await executeQuery(
                `UPDATE clients SET 
                    current_bot_usage = COALESCE(current_bot_usage, 0) + ?,
                    current_token_usage = COALESCE(current_token_usage, 0) + ?
                 WHERE id = ?`,
                [messagesUsed, tokensUsed, clientId]
            );

            // Obtener estado actualizado
            const updatedQuota = await this.checkQuotaAvailable(clientCode);
            
            console.log(`📊 Cuota actualizada para ${clientCode}:`);
            console.log(`   📨 Mensajes: ${updatedQuota.usage}/${updatedQuota.limit}`);
            console.log(`   🎯 Tokens: ${updatedQuota.tokenUsage}/${updatedQuota.tokenLimit}`);
            
            return updatedQuota;
            
        } catch (error) {
            console.error('❌ Error consumiendo cuota después del éxito:', error.message);
            throw error;
        }
    }

    /**
     * Obtener estadísticas detalladas de uso de cuota
     * @param {string} clientCode - Código del cliente
     * @returns {Promise<Object>} Estadísticas completas
     */
    static async getDetailedStats(clientCode) {
        try {
            const { executeQuery } = require('../config/database-simple');
            
            // Datos básicos de cuota
            const quotaInfo = await this.checkQuotaAvailable(clientCode);
            
            if (!quotaInfo.success) {
                return quotaInfo;
            }

            // Estadísticas adicionales de uso mensual
            const [monthlyStats] = await executeQuery(`
                SELECT 
                    COUNT(m.id) as total_ai_messages_this_month,
                    AVG(CHAR_LENGTH(m.content)) as avg_message_length,
                    COUNT(DISTINCT c.id) as conversations_with_ai,
                    MIN(m.sent_at) as first_ai_message_this_month,
                    MAX(m.sent_at) as last_ai_message_this_month
                FROM messages m
                INNER JOIN conversations c ON m.conversation_id = c.id
                INNER JOIN clients cl ON c.client_id = cl.id
                WHERE cl.client_code = ? 
                    AND m.is_from_bot = 1 
                    AND YEAR(m.sent_at) = YEAR(NOW())
                    AND MONTH(m.sent_at) = MONTH(NOW())
            `, [clientCode]);

            return {
                ...quotaInfo,
                monthlyStats: {
                    totalMessages: monthlyStats?.total_ai_messages_this_month || 0,
                    avgMessageLength: Math.round(monthlyStats?.avg_message_length || 0),
                    conversationsWithAI: monthlyStats?.conversations_with_ai || 0,
                    firstMessage: monthlyStats?.first_ai_message_this_month,
                    lastMessage: monthlyStats?.last_ai_message_this_month
                }
            };
            
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas detalladas:', error.message);
            return {
                success: false,
                error: error.message,
                code: 'STATS_ERROR'
            };
        }
    }

    /**
     * Reset manual de cuota (solo para testing/admin)
     * @param {string} clientCode - Código del cliente
     * @returns {Promise<Object>} Resultado del reset
     */
    static async resetQuota(clientCode) {
        try {
            const { executeQuery } = require('../config/database-simple');
            
            console.log(`🔄 RESET MANUAL de cuota para cliente: ${clientCode}`);
            
            const resetDate = new Date().toISOString().split('T')[0];
            
            await executeQuery(
                `UPDATE clients SET 
                    current_bot_usage = 0, 
                    current_token_usage = 0,
                    bot_usage_reset_date = ?, 
                    token_usage_reset_date = ?
                 WHERE client_code = ?`,
                [resetDate, resetDate, clientCode]
            );

            const updatedQuota = await this.checkQuotaAvailable(clientCode);
            
            console.log(`✅ Reset completado para ${clientCode}:`);
            console.log(`   📨 Mensajes: ${updatedQuota.usage}/${updatedQuota.limit}`);
            console.log(`   🎯 Tokens: ${updatedQuota.tokenUsage}/${updatedQuota.tokenLimit}`);
            
            return {
                success: true,
                message: 'Cuota reseteada exitosamente',
                ...updatedQuota
            };
            
        } catch (error) {
            console.error('❌ Error reseteando cuota:', error.message);
            return {
                success: false,
                error: error.message,
                code: 'RESET_ERROR'
            };
        }
    }
}

module.exports = BotQuotaService;
