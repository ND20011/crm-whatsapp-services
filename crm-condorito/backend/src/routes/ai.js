const express = require('express');
const router = express.Router();
const AIConfigController = require('../controllers/AIConfigController');
const { authenticateToken } = require('../middleware/auth');

/**
 * 🧠 Rutas para configuración de IA
 * Todas las rutas requieren autenticación
 */

// Middleware de autenticación para todas las rutas
router.use(authenticateToken);

/**
 * @route   GET /api/ai/debug
 * @desc    Debug endpoint temporal
 * @access  Private
 */
router.get('/debug', async (req, res) => {
    try {
        console.log('🔍 DEBUG ENDPOINT - req.user:', JSON.stringify(req.user, null, 2));
        const clientCode = req.user.clientCode || req.user.client?.client_code;
        console.log('🔍 DEBUG - clientCode:', clientCode);
        
        // Probar directamente el método
        const AIService = require('../services/AIService');
        const config = await AIService.getClientAIConfig(clientCode);
        
        res.json({
            success: true,
            debug: {
                user: req.user,
                clientCode: clientCode,
                configFound: !!config,
                promptPreview: config?.business_prompt?.substring(0, 100) + '...'
            },
            data: config
        });
    } catch (error) {
        console.error('❌ Debug error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

/**
 * @route   GET /api/ai/config
 * @desc    Obtener configuración de IA del cliente
 * @access  Private
 */
router.get('/config', AIConfigController.getConfig);

/**
 * @route   PUT /api/ai/config
 * @desc    Actualizar configuración de IA del cliente
 * @access  Private
 * @body    {
 *   enabled: boolean,
 *   ai_mode: string,
 *   business_prompt: string,
 *   max_tokens: number,
 *   temperature: number,
 *   maxHistoryMessages: number,
 *   responseTimeout: number,
 *   fallbackMessage: string,
 *   workingHours: {
 *     enabled: boolean,
 *     start: string,
 *     end: string,
 *     days: number[]
 *   }
 * }
 */
router.put('/config', AIConfigController.updateConfig);

/**
 * @route   POST /api/ai/test
 * @desc    Probar configuración de IA con un mensaje
 * @access  Private
 * @body    { message: string }
 */
router.post('/test', AIConfigController.testConfig);

/**
 * @route   GET /api/ai/limits
 * @desc    Obtener información de límites y validaciones
 * @access  Private
 */
router.get('/limits', AIConfigController.getLimits);

/**
 * @route   GET /api/ai/modes
 * @desc    Obtener modos de IA disponibles
 * @access  Private
 */
router.get('/modes', AIConfigController.getModes);

/**
 * @route   GET /api/ai/health
 * @desc    Health check del servicio de IA
 * @access  Private
 */
router.get('/health', AIConfigController.healthCheck);

/**
 * @route   GET /api/ai/stats
 * @desc    Obtener estadísticas de uso de IA
 * @access  Private
 * @query   { hours?: number } - Horas hacia atrás para estadísticas (default: 24)
 */
router.get('/stats', AIConfigController.getStats);

/**
 * @route   POST /api/ai/reset
 * @desc    Resetear configuración a valores por defecto
 * @access  Private
 */
router.post('/reset', AIConfigController.resetConfig);

/**
 * @route   POST /api/ai/suggest-response
 * @desc    Generar respuesta sugerida basada en el contexto de la conversación
 * @access  Private
 * @body    { 
 *   conversationHistory: Array<{content: string, sender_type: string}>,
 *   lastMessage: string 
 * }
 */
router.post('/suggest-response', AIConfigController.suggestResponse);

/**
 * @route   POST /api/ai/analyze-conversation
 * @desc    Analizar conversación completa con IA y responder preguntas específicas
 * @access  Private
 * @body    { 
 *   conversationHistory: Array<{content: string, sender_type: string, sent_at: string}>,
 *   question: string 
 * }
 */
router.post('/analyze-conversation', AIConfigController.analyzeConversation);

module.exports = router;
