const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/database-simple');

/**
 * Endpoint de prueba para reglas inteligentes SIN autenticación
 * Solo para desarrollo y testing
 * POST /api/test/intelligent-rules/:id
 */
router.post('/intelligent-rules/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { testMessage, clientId = 1 } = req.body; // clientId por defecto = 1 (demo)

        if (!testMessage) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere testMessage para probar la regla'
            });
        }

        console.log(`🧪 Testing rule ${id} with message: "${testMessage}"`);

        // Obtener regla
        const rules = await executeQuery(`
            SELECT * FROM intelligent_bot_rules 
            WHERE id = ? AND client_id = ?
        `, [id, clientId]);

        if (rules.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Regla no encontrada'
            });
        }

        const rule = rules[0];

        // Debug: mostrar el contenido exacto
        console.log(`📋 Rule data:`, {
            id: rule.id,
            name: rule.name,
            trigger_keywords: rule.trigger_keywords,
            trigger_keywords_type: typeof rule.trigger_keywords,
            is_array: Array.isArray(rule.trigger_keywords)
        });

        // Parsear keywords con manejo de errores
        let keywords;
        
        // Si ya es un objeto (MySQL auto-parseó el JSON), usarlo directamente
        if (typeof rule.trigger_keywords === 'object' && Array.isArray(rule.trigger_keywords)) {
            keywords = rule.trigger_keywords;
            console.log(`✅ Keywords already parsed by MySQL:`, keywords);
        } else if (typeof rule.trigger_keywords === 'string') {
            // Si es string, parsear manualmente
            try {
                keywords = JSON.parse(rule.trigger_keywords);
                console.log(`✅ Keywords parsed manually:`, keywords);
            } catch (parseError) {
                console.error(`❌ Error parsing keywords for rule ${id}:`, parseError.message);
                console.error(`❌ Raw keywords:`, rule.trigger_keywords);
                return res.status(500).json({
                    success: false,
                    message: 'Error en formato de palabras clave de la regla',
                    error: `JSON malformado: ${parseError.message}`
                });
            }
        } else {
            console.error(`❌ Unexpected keywords type:`, typeof rule.trigger_keywords);
            return res.status(500).json({
                success: false,
                message: 'Formato de palabras clave no válido',
                error: `Tipo inesperado: ${typeof rule.trigger_keywords}`
            });
        }

        if (!Array.isArray(keywords)) {
            return res.status(500).json({
                success: false,
                message: 'Las palabras clave deben ser un array',
                error: 'trigger_keywords no es un array válido'
            });
        }

        // Simular evaluación de la regla
        const messageWords = testMessage.toLowerCase();
        let matches = false;
        let matchedKeywords = [];

        switch (rule.match_type) {
            case 'all':
                matches = keywords.every(keyword => {
                    const found = messageWords.includes(keyword.toLowerCase());
                    if (found) matchedKeywords.push(keyword);
                    return found;
                });
                break;
            case 'exact_phrase':
                matches = keywords.some(keyword => {
                    const found = messageWords.includes(keyword.toLowerCase());
                    if (found) matchedKeywords.push(keyword);
                    return found;
                });
                break;
            case 'any':
            default:
                matches = keywords.some(keyword => {
                    const found = messageWords.includes(keyword.toLowerCase());
                    if (found) matchedKeywords.push(keyword);
                    return found;
                });
                break;
        }

        const result = {
            ruleId: parseInt(id),
            ruleName: rule.name,
            testMessage: testMessage,
            matches: matches,
            matchedKeywords: matchedKeywords,
            matchType: rule.match_type,
            actionType: rule.action_type,
            isActive: Boolean(rule.is_active),
            wouldTrigger: matches && Boolean(rule.is_active)
        };

        console.log(`✅ Test result:`, result);

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('❌ Error testing intelligent rule:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error al probar la regla inteligente',
            error: error.message
        });
    }
});

/**
 * Listar todas las reglas para testing
 * GET /api/test/intelligent-rules
 */
router.get('/intelligent-rules', async (req, res) => {
    try {
        const { clientId = 1 } = req.query;

        const rules = await executeQuery(`
            SELECT id, name, description, is_active, priority, 
                   trigger_keywords, match_type, action_type,
                   tags_to_assign, times_triggered, success_rate,
                   created_at, updated_at
            FROM intelligent_bot_rules 
            WHERE client_id = ?
            ORDER BY priority ASC, id ASC
        `, [clientId]);

        // Normalizar datos
        const normalizedRules = rules.map(rule => ({
            ...rule,
            is_active: Boolean(rule.is_active),
            trigger_keywords: (() => {
                try {
                    return JSON.parse(rule.trigger_keywords);
                } catch (e) {
                    console.warn(`Warning: Invalid JSON in rule ${rule.id}`);
                    return [];
                }
            })(),
            tags_to_assign: (() => {
                try {
                    return rule.tags_to_assign ? JSON.parse(rule.tags_to_assign) : [];
                } catch (e) {
                    return [];
                }
            })(),
            success_rate: parseFloat(rule.success_rate) || 0
        }));

        res.json({
            success: true,
            data: normalizedRules,
            total: normalizedRules.length
        });

    } catch (error) {
        console.error('❌ Error listing rules for testing:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error al obtener reglas para testing',
            error: error.message
        });
    }
});

module.exports = router;
