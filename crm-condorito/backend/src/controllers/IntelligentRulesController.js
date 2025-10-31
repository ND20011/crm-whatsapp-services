const { executeQuery } = require('../config/database-simple');
const IntelligentRulesService = require('../services/IntelligentRulesService');

/**
 * Controlador para gestión de reglas inteligentes del bot
 */
class IntelligentRulesController {

    /**
     * Obtener todas las reglas de un cliente
     * GET /api/intelligent-rules
     */
    static async getRules(req, res) {
        try {
            const clientId = req.user.id;
            
            const rules = await executeQuery(`
                SELECT 
                    id, name, description, is_active, priority,
                    trigger_keywords, match_type, ai_extraction_enabled,
                    action_type, tags_to_assign, expected_data_fields, action_config,
                    times_triggered, last_triggered_at, success_rate, created_at, updated_at
                FROM intelligent_bot_rules 
                WHERE client_id = ? 
                ORDER BY priority ASC, id ASC
            `, [clientId]);

            // Parsear campos JSON de forma segura
            const parsedRules = rules.map(rule => {
                try {
                    // MySQL ya parsea automáticamente los campos JSON, no necesitamos JSON.parse()
                    return {
                        ...rule,
                        trigger_keywords: Array.isArray(rule.trigger_keywords) ? rule.trigger_keywords : 
                                        (rule.trigger_keywords ? JSON.parse(rule.trigger_keywords) : []),
                        tags_to_assign: Array.isArray(rule.tags_to_assign) ? rule.tags_to_assign : 
                                      (rule.tags_to_assign ? JSON.parse(rule.tags_to_assign) : []),
                        expected_data_fields: (rule.expected_data_fields && typeof rule.expected_data_fields === 'object') ? 
                                            rule.expected_data_fields : 
                                            (rule.expected_data_fields ? JSON.parse(rule.expected_data_fields) : null),
                        action_config: (rule.action_config && typeof rule.action_config === 'object') ? 
                                     rule.action_config : 
                                     (rule.action_config ? JSON.parse(rule.action_config) : null)
                    };
                } catch (parseError) {
                    console.error(`❌ Error parsing JSON for rule ${rule.id}:`, parseError.message);
                    console.error('Problematic data:', {
                        trigger_keywords: rule.trigger_keywords,
                        tags_to_assign: rule.tags_to_assign,
                        expected_data_fields: rule.expected_data_fields,
                        action_config: rule.action_config
                    });
                    // Devolver valores por defecto si hay error de parsing
                    return {
                        ...rule,
                        trigger_keywords: [],
                        tags_to_assign: [],
                        expected_data_fields: null,
                        action_config: null
                    };
                }
            });

            res.json({
                success: true,
                data: parsedRules,
                total: parsedRules.length
            });

        } catch (error) {
            console.error('❌ Error getting intelligent rules:', error.message);
            res.status(500).json({
                success: false,
                message: 'Error al obtener las reglas inteligentes',
                error: error.message
            });
        }
    }

    /**
     * Obtener una regla específica
     * GET /api/intelligent-rules/:id
     */
    static async getRule(req, res) {
        try {
            const { id } = req.params;
            const clientId = req.user.id;

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
            
            // Parsear campos JSON de forma segura
            try {
                // MySQL ya parsea automáticamente los campos JSON, no necesitamos JSON.parse()
                const parsedRule = {
                    ...rule,
                    trigger_keywords: Array.isArray(rule.trigger_keywords) ? rule.trigger_keywords : 
                                    (rule.trigger_keywords ? JSON.parse(rule.trigger_keywords) : []),
                    tags_to_assign: Array.isArray(rule.tags_to_assign) ? rule.tags_to_assign : 
                                  (rule.tags_to_assign ? JSON.parse(rule.tags_to_assign) : []),
                    expected_data_fields: (rule.expected_data_fields && typeof rule.expected_data_fields === 'object') ? 
                                        rule.expected_data_fields : 
                                        (rule.expected_data_fields ? JSON.parse(rule.expected_data_fields) : null),
                    action_config: (rule.action_config && typeof rule.action_config === 'object') ? 
                                 rule.action_config : 
                                 (rule.action_config ? JSON.parse(rule.action_config) : null)
                };

                res.json({
                    success: true,
                    data: parsedRule
                });

            } catch (parseError) {
                console.error(`❌ Error parsing JSON for rule ${rule.id}:`, parseError.message);
                console.error('Problematic data:', {
                    trigger_keywords: rule.trigger_keywords,
                    tags_to_assign: rule.tags_to_assign,
                    expected_data_fields: rule.expected_data_fields,
                    action_config: rule.action_config
                });
                
                // Devolver valores por defecto si hay error de parsing
                const safeRule = {
                    ...rule,
                    trigger_keywords: [],
                    tags_to_assign: [],
                    expected_data_fields: null,
                    action_config: null
                };

                res.json({
                    success: true,
                    data: safeRule
                });
            }

        } catch (error) {
            console.error('❌ Error getting intelligent rule:', error.message);
            res.status(500).json({
                success: false,
                message: 'Error al obtener la regla inteligente',
                error: error.message
            });
        }
    }

    /**
     * Crear nueva regla
     * POST /api/intelligent-rules
     */
    static async createRule(req, res) {
        try {
            const clientId = req.user.id;
            const {
                name,
                description,
                is_active = true,
                priority = 1,
                trigger_keywords,
                match_type = 'any',
                ai_extraction_enabled = false,
                ai_extraction_prompt,
                expected_data_fields,
                action_type,
                action_config,
                tags_to_assign
            } = req.body;

            // Validaciones básicas
            if (!name || !trigger_keywords || !action_type) {
                return res.status(400).json({
                    success: false,
                    message: 'Faltan campos obligatorios: name, trigger_keywords, action_type'
                });
            }

            if (!Array.isArray(trigger_keywords) || trigger_keywords.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'trigger_keywords debe ser un array con al menos una palabra clave'
                });
            }

            const validActionTypes = ['assign_tags', 'escalate_human', 'call_api', 'ai_response', 'hybrid'];
            if (!validActionTypes.includes(action_type)) {
                return res.status(400).json({
                    success: false,
                    message: `action_type debe ser uno de: ${validActionTypes.join(', ')}`
                });
            }

            // Validar configuración específica según tipo de acción
            if (action_type === 'call_api' && (!action_config || !action_config.api_endpoint)) {
                return res.status(400).json({
                    success: false,
                    message: 'Para action_type "call_api" se requiere action_config.api_endpoint'
                });
            }

            if (action_type === 'assign_tags' && (!tags_to_assign || tags_to_assign.length === 0)) {
                return res.status(400).json({
                    success: false,
                    message: 'Para action_type "assign_tags" se requiere al menos una etiqueta en tags_to_assign'
                });
            }

            // Insertar nueva regla
            const result = await executeQuery(`
                INSERT INTO intelligent_bot_rules (
                    client_id, name, description, is_active, priority,
                    trigger_keywords, match_type, ai_extraction_enabled,
                    ai_extraction_prompt, expected_data_fields, action_type,
                    action_config, tags_to_assign
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                clientId, name, description, is_active, priority,
                JSON.stringify(trigger_keywords), match_type, ai_extraction_enabled,
                ai_extraction_prompt, expected_data_fields ? JSON.stringify(expected_data_fields) : null,
                action_type, action_config ? JSON.stringify(action_config) : null,
                tags_to_assign ? JSON.stringify(tags_to_assign) : null
            ]);

            console.log(`✅ Created intelligent rule: "${name}" (ID: ${result.insertId}) for client: ${clientId}`);

            res.status(201).json({
                success: true,
                message: 'Regla inteligente creada exitosamente',
                data: {
                    id: result.insertId,
                    name,
                    action_type,
                    is_active
                }
            });

        } catch (error) {
            console.error('❌ Error creating intelligent rule:', error.message);
            res.status(500).json({
                success: false,
                message: 'Error al crear la regla inteligente',
                error: error.message
            });
        }
    }

    /**
     * Actualizar regla existente
     * PUT /api/intelligent-rules/:id
     */
    static async updateRule(req, res) {
        try {
            const { id } = req.params;
            const clientId = req.user.id;
            const {
                name,
                description,
                is_active,
                priority,
                trigger_keywords,
                match_type,
                ai_extraction_enabled,
                ai_extraction_prompt,
                expected_data_fields,
                action_type,
                action_config,
                tags_to_assign
            } = req.body;

            // Verificar que la regla existe y pertenece al cliente
            const existingRules = await executeQuery(`
                SELECT id FROM intelligent_bot_rules 
                WHERE id = ? AND client_id = ?
            `, [id, clientId]);

            if (existingRules.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Regla no encontrada'
                });
            }

            // Validaciones si se proporcionan
            if (trigger_keywords && (!Array.isArray(trigger_keywords) || trigger_keywords.length === 0)) {
                return res.status(400).json({
                    success: false,
                    message: 'trigger_keywords debe ser un array con al menos una palabra clave'
                });
            }

            if (action_type) {
                const validActionTypes = ['assign_tags', 'escalate_human', 'call_api', 'ai_response', 'hybrid'];
                if (!validActionTypes.includes(action_type)) {
                    return res.status(400).json({
                        success: false,
                        message: `action_type debe ser uno de: ${validActionTypes.join(', ')}`
                    });
                }
            }

            // Construir query de actualización dinámicamente
            const updateFields = [];
            const updateValues = [];

            if (name !== undefined) {
                updateFields.push('name = ?');
                updateValues.push(name);
            }
            if (description !== undefined) {
                updateFields.push('description = ?');
                updateValues.push(description);
            }
            if (is_active !== undefined) {
                updateFields.push('is_active = ?');
                updateValues.push(is_active);
            }
            if (priority !== undefined) {
                updateFields.push('priority = ?');
                updateValues.push(priority);
            }
            if (trigger_keywords !== undefined) {
                updateFields.push('trigger_keywords = ?');
                updateValues.push(JSON.stringify(trigger_keywords));
            }
            if (match_type !== undefined) {
                updateFields.push('match_type = ?');
                updateValues.push(match_type);
            }
            if (ai_extraction_enabled !== undefined) {
                updateFields.push('ai_extraction_enabled = ?');
                updateValues.push(ai_extraction_enabled);
            }
            if (ai_extraction_prompt !== undefined) {
                updateFields.push('ai_extraction_prompt = ?');
                updateValues.push(ai_extraction_prompt);
            }
            if (expected_data_fields !== undefined) {
                updateFields.push('expected_data_fields = ?');
                updateValues.push(expected_data_fields ? JSON.stringify(expected_data_fields) : null);
            }
            if (action_type !== undefined) {
                updateFields.push('action_type = ?');
                updateValues.push(action_type);
            }
            if (action_config !== undefined) {
                updateFields.push('action_config = ?');
                updateValues.push(action_config ? JSON.stringify(action_config) : null);
            }
            if (tags_to_assign !== undefined) {
                updateFields.push('tags_to_assign = ?');
                updateValues.push(tags_to_assign ? JSON.stringify(tags_to_assign) : null);
            }

            if (updateFields.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No se proporcionaron campos para actualizar'
                });
            }

            // Agregar updated_at
            updateFields.push('updated_at = NOW()');
            updateValues.push(id, clientId);

            await executeQuery(`
                UPDATE intelligent_bot_rules 
                SET ${updateFields.join(', ')} 
                WHERE id = ? AND client_id = ?
            `, updateValues);

            console.log(`✅ Updated intelligent rule ID: ${id} for client: ${clientId}`);

            res.json({
                success: true,
                message: 'Regla inteligente actualizada exitosamente'
            });

        } catch (error) {
            console.error('❌ Error updating intelligent rule:', error.message);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar la regla inteligente',
                error: error.message
            });
        }
    }

    /**
     * Eliminar regla
     * DELETE /api/intelligent-rules/:id
     */
    static async deleteRule(req, res) {
        try {
            const { id } = req.params;
            const clientId = req.user.id;

            // Verificar que la regla existe y pertenece al cliente
            const existingRules = await executeQuery(`
                SELECT name FROM intelligent_bot_rules 
                WHERE id = ? AND client_id = ?
            `, [id, clientId]);

            if (existingRules.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Regla no encontrada'
                });
            }

            const ruleName = existingRules[0].name;

            // Eliminar regla
            await executeQuery(`
                DELETE FROM intelligent_bot_rules 
                WHERE id = ? AND client_id = ?
            `, [id, clientId]);

            console.log(`✅ Deleted intelligent rule: "${ruleName}" (ID: ${id}) for client: ${clientId}`);

            res.json({
                success: true,
                message: 'Regla inteligente eliminada exitosamente'
            });

        } catch (error) {
            console.error('❌ Error deleting intelligent rule:', error.message);
            res.status(500).json({
                success: false,
                message: 'Error al eliminar la regla inteligente',
                error: error.message
            });
        }
    }

    /**
     * Duplicar regla existente
     * POST /api/intelligent-rules/:id/duplicate
     */
    static async duplicateRule(req, res) {
        try {
            const { id } = req.params;
            const clientId = req.user.id;

            // Obtener regla original
            const originalRules = await executeQuery(`
                SELECT * FROM intelligent_bot_rules 
                WHERE id = ? AND client_id = ?
            `, [id, clientId]);

            if (originalRules.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Regla no encontrada'
                });
            }

            const original = originalRules[0];

            // Crear copia con nombre modificado
            const newName = `${original.name} (Copia)`;
            const newPriority = original.priority + 1;

            const result = await executeQuery(`
                INSERT INTO intelligent_bot_rules (
                    client_id, name, description, is_active, priority,
                    trigger_keywords, match_type, ai_extraction_enabled,
                    ai_extraction_prompt, expected_data_fields, action_type,
                    action_config, tags_to_assign
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                clientId, newName, original.description, false, // Crear inactiva por defecto
                newPriority, original.trigger_keywords, original.match_type,
                original.ai_extraction_enabled, original.ai_extraction_prompt,
                original.expected_data_fields, original.action_type,
                original.action_config, original.tags_to_assign
            ]);

            console.log(`✅ Duplicated intelligent rule: "${original.name}" → "${newName}" (ID: ${result.insertId})`);

            res.status(201).json({
                success: true,
                message: 'Regla duplicada exitosamente',
                data: {
                    id: result.insertId,
                    name: newName,
                    original_id: id
                }
            });

        } catch (error) {
            console.error('❌ Error duplicating intelligent rule:', error.message);
            res.status(500).json({
                success: false,
                message: 'Error al duplicar la regla inteligente',
                error: error.message
            });
        }
    }

    /**
     * Obtener estadísticas de reglas
     * GET /api/intelligent-rules/stats
     */
    static async getStats(req, res) {
        try {
            const clientId = req.user.id;

            const stats = await IntelligentRulesService.getRulesStats(clientId);

            // Estadísticas adicionales
            const topRules = await executeQuery(`
                SELECT id, name, times_triggered, success_rate, last_triggered_at
                FROM intelligent_bot_rules 
                WHERE client_id = ? AND times_triggered > 0
                ORDER BY times_triggered DESC 
                LIMIT 5
            `, [clientId]);

            const recentActivity = await executeQuery(`
                SELECT id, name, last_triggered_at, times_triggered
                FROM intelligent_bot_rules 
                WHERE client_id = ? AND last_triggered_at IS NOT NULL
                ORDER BY last_triggered_at DESC 
                LIMIT 10
            `, [clientId]);

            res.json({
                success: true,
                data: {
                    summary: stats,
                    topRules: topRules,
                    recentActivity: recentActivity
                }
            });

        } catch (error) {
            console.error('❌ Error getting intelligent rules stats:', error.message);
            res.status(500).json({
                success: false,
                message: 'Error al obtener estadísticas de reglas inteligentes',
                error: error.message
            });
        }
    }

    /**
     * Probar regla con mensaje de ejemplo
     * POST /api/intelligent-rules/:id/test
     */
    static async testRule(req, res) {
        try {
            const { id } = req.params;
            const { testMessage } = req.body;
            const clientId = req.user.id;

            if (!testMessage) {
                return res.status(400).json({
                    success: false,
                    message: 'Se requiere testMessage para probar la regla'
                });
            }

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

            // Simular evaluación de la regla
            // Manejar keywords que pueden estar ya parseadas por MySQL o como string
            let keywords;
            if (typeof rule.trigger_keywords === 'object' && Array.isArray(rule.trigger_keywords)) {
                keywords = rule.trigger_keywords;
            } else if (typeof rule.trigger_keywords === 'string') {
                keywords = JSON.parse(rule.trigger_keywords);
            } else {
                return res.status(500).json({
                    success: false,
                    message: 'Formato de palabras clave no válido',
                    error: `Tipo inesperado: ${typeof rule.trigger_keywords}`
                });
            }
            
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

            res.json({
                success: true,
                data: {
                    ruleId: id,
                    ruleName: rule.name,
                    testMessage: testMessage,
                    matches: matches,
                    matchedKeywords: matchedKeywords,
                    matchType: rule.match_type,
                    actionType: rule.action_type,
                    isActive: rule.is_active,
                    wouldTrigger: matches && rule.is_active
                }
            });

        } catch (error) {
            console.error('❌ Error testing intelligent rule:', error.message);
            res.status(500).json({
                success: false,
                message: 'Error al probar la regla inteligente',
                error: error.message
            });
        }
    }

    /**
     * Obtener estadísticas de las reglas inteligentes
     * GET /api/intelligent-rules/stats
     */
    static async getStats(req, res) {
        try {
            const clientId = req.user.id;

            // Obtener estadísticas generales
            const stats = await executeQuery(`
                SELECT 
                    COUNT(*) as total_rules,
                    COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_rules,
                    COUNT(CASE WHEN is_active = 0 THEN 1 END) as inactive_rules,
                    SUM(times_triggered) as total_triggers,
                    AVG(success_rate) as avg_success_rate,
                    MAX(last_triggered_at) as last_activity
                FROM intelligent_bot_rules 
                WHERE client_id = ?
            `, [clientId]);

            // Obtener reglas más activas
            const topRules = await executeQuery(`
                SELECT 
                    id, name, times_triggered, success_rate, last_triggered_at
                FROM intelligent_bot_rules 
                WHERE client_id = ? AND times_triggered > 0
                ORDER BY times_triggered DESC 
                LIMIT 5
            `, [clientId]);

            // Obtener distribución por tipo de acción
            const actionTypes = await executeQuery(`
                SELECT 
                    action_type,
                    COUNT(*) as count,
                    AVG(success_rate) as avg_success_rate
                FROM intelligent_bot_rules 
                WHERE client_id = ?
                GROUP BY action_type
                ORDER BY count DESC
            `, [clientId]);

            const result = {
                general: stats[0] || {
                    total_rules: 0,
                    active_rules: 0,
                    inactive_rules: 0,
                    total_triggers: 0,
                    avg_success_rate: 0,
                    last_activity: null
                },
                top_rules: topRules,
                action_distribution: actionTypes
            };

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('❌ Error getting intelligent rules stats:', error.message);
            res.status(500).json({
                success: false,
                message: 'Error al obtener estadísticas de reglas inteligentes',
                error: error.message
            });
        }
    }

    /**
     * Obtener configuración del sistema de reglas inteligentes
     * GET /api/intelligent-rules/config
     */
    static async getConfig(req, res) {
        try {
            const clientId = req.user.id;

            const config = await executeQuery(`
                SELECT intelligent_rules_enabled 
                FROM bot_configurations 
                WHERE client_id = ?
            `, [clientId]);

            if (config.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Configuración de bot no encontrada'
                });
            }

            res.json({
                success: true,
                data: {
                    intelligent_rules_enabled: config[0].intelligent_rules_enabled,
                    available_action_types: [
                        { value: 'assign_tags', label: 'Asignar Etiquetas', description: 'Aplica etiquetas automáticamente al contacto' },
                        { value: 'escalate_human', label: 'Derivar a Humano', description: 'Transfiere la conversación a un agente humano' },
                        { value: 'call_api', label: 'Llamar API', description: 'Consulta una API externa con datos extraídos' },
                        { value: 'ai_response', label: 'Respuesta IA', description: 'Genera respuesta personalizada con IA' },
                        { value: 'hybrid', label: 'Híbrido', description: 'Combina múltiples acciones' }
                    ],
                    available_match_types: [
                        { value: 'any', label: 'Cualquier palabra', description: 'Coincide si encuentra cualquiera de las palabras clave' },
                        { value: 'all', label: 'Todas las palabras', description: 'Coincide solo si encuentra todas las palabras clave' },
                        { value: 'exact_phrase', label: 'Frase exacta', description: 'Coincide con frases exactas' }
                    ]
                }
            });

        } catch (error) {
            console.error('❌ Error getting intelligent rules config:', error.message);
            res.status(500).json({
                success: false,
                message: 'Error al obtener configuración de reglas inteligentes',
                error: error.message
            });
        }
    }

    /**
     * Actualizar configuración del sistema de reglas inteligentes
     * PUT /api/intelligent-rules/config
     */
    static async updateConfig(req, res) {
        try {
            const clientId = req.user.id;
            const { intelligent_rules_enabled } = req.body;

            if (typeof intelligent_rules_enabled !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    message: 'intelligent_rules_enabled debe ser true o false'
                });
            }

            await executeQuery(`
                UPDATE bot_configurations 
                SET intelligent_rules_enabled = ? 
                WHERE client_id = ?
            `, [intelligent_rules_enabled, clientId]);

            console.log(`✅ Updated intelligent rules config for client ${clientId}: ${intelligent_rules_enabled ? 'enabled' : 'disabled'}`);

            res.json({
                success: true,
                message: `Sistema de reglas inteligentes ${intelligent_rules_enabled ? 'habilitado' : 'deshabilitado'} exitosamente`
            });

        } catch (error) {
            console.error('❌ Error updating intelligent rules config:', error.message);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar configuración de reglas inteligentes',
                error: error.message
            });
        }
    }
}

module.exports = IntelligentRulesController;
