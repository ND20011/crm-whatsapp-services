const { executeQuery } = require('../config/database-simple');
const ContactController = require('../controllers/ContactController');
const axios = require('axios');

/**
 * Servicio de Reglas Inteligentes para el Bot
 * Maneja la evaluación, selección y ejecución de reglas configurables
 */
class IntelligentRulesService {

    /**
     * MÉTODO PRINCIPAL: Procesar mensaje con reglas inteligentes
     * @param {Object} params - Parámetros del mensaje
     * @returns {Object} Resultado del procesamiento
     */
    static async processMessage({ message, conversation, clientId, clientCode, conversationHistory, botConfig }) {
        try {
            console.log(`🧠 Processing message with intelligent rules for client: ${clientCode}`);
            
            // Verificar si las reglas están habilitadas
            if (!botConfig.intelligent_rules_enabled) {
                console.log(`⚠️ Intelligent rules disabled for client: ${clientCode}`);
                return { handled: false, reason: 'rules_disabled' };
            }

            // PASO 2A: Filtrar reglas por palabras clave (SIN IA - rápido)
            const candidateRules = await this.getCandidateRules(message, clientId);
            
            if (candidateRules.length === 0) {
                console.log(`ℹ️ No candidate rules found for message: "${message.substring(0, 50)}..."`);
                return { handled: false, reason: 'no_matching_rules' };
            }

            // PASO 2B: Seleccionar mejor regla con IA (si hay múltiples candidatos)
            const ruleResult = await this.selectBestRule(message, candidateRules);
            
            if (!ruleResult.selectedRule) {
                console.log(`⚠️ No rule selected after AI evaluation`);
                return { handled: false, reason: 'no_rule_selected' };
            }

            const selectedRule = ruleResult.selectedRule;
            const extractedData = ruleResult.extractedData || {};

            console.log(`✅ Selected rule: "${selectedRule.name}" (ID: ${selectedRule.id})`);

            // PASO 3: Ejecutar acción de la regla
            const actionResult = await this.executeRuleAction(
                selectedRule, 
                extractedData, 
                conversation,
                clientCode
            );

            // Actualizar estadísticas de la regla
            await this.updateRuleStats(selectedRule.id, actionResult.success);

            // Determinar si la regla manejó completamente el mensaje
            const handled = actionResult.type === 'escalate_human' || 
                           (actionResult.type === 'call_api' && actionResult.success);

            return {
                handled: handled,
                ruleName: selectedRule.name,
                ruleId: selectedRule.id,
                actionResult: actionResult,
                extractedData: extractedData
            };

        } catch (error) {
            console.error('❌ Error in IntelligentRulesService.processMessage:', error.message);
            return { 
                handled: false, 
                error: error.message,
                reason: 'processing_error'
            };
        }
    }

    /**
     * PASO 2A: Obtener reglas candidatas por palabras clave (SIN IA)
     * @param {string} message - Mensaje del usuario
     * @param {number} clientId - ID del cliente
     * @returns {Array} Reglas candidatas
     */
    static async getCandidateRules(message, clientId) {
        try {
            // Obtener todas las reglas activas del cliente ordenadas por prioridad
            const rules = await executeQuery(`
                SELECT * FROM intelligent_bot_rules 
                WHERE client_id = ? AND is_active = TRUE 
                ORDER BY priority ASC, id ASC
            `, [clientId]);
            
            if (rules.length === 0) {
                console.log(`ℹ️ No active rules found for client: ${clientId}`);
                return [];
            }

            const messageWords = message.toLowerCase();
            
            // Filtrar reglas que coincidan con palabras clave
            const candidates = rules.filter(rule => {
                try {
                    const keywords = JSON.parse(rule.trigger_keywords);
                    
                    switch (rule.match_type) {
                        case 'all':
                            // Todas las palabras deben coincidir
                            return keywords.every(keyword => 
                                messageWords.includes(keyword.toLowerCase())
                            );
                        case 'exact_phrase':
                            // Alguna frase exacta debe coincidir
                            return keywords.some(keyword => 
                                messageWords.includes(keyword.toLowerCase())
                            );
                        case 'any':
                        default:
                            // Cualquier palabra debe coincidir
                            return keywords.some(keyword => 
                                messageWords.includes(keyword.toLowerCase())
                            );
                    }
                } catch (parseError) {
                    console.error(`❌ Error parsing keywords for rule ${rule.id}:`, parseError.message);
                    return false;
                }
            });
            
            console.log(`🎯 Found ${candidates.length} candidate rules from ${rules.length} total rules`);
            
            // Log de reglas candidatas para debugging
            candidates.forEach(rule => {
                console.log(`   - "${rule.name}" (Priority: ${rule.priority}, Action: ${rule.action_type})`);
            });
            
            return candidates;
            
        } catch (error) {
            console.error('❌ Error getting candidate rules:', error.message);
            return [];
        }
    }

    /**
     * PASO 2B: Seleccionar mejor regla con IA (solo si hay múltiples candidatos)
     * @param {string} message - Mensaje del usuario
     * @param {Array} candidateRules - Reglas candidatas
     * @returns {Object} Regla seleccionada y datos extraídos
     */
    static async selectBestRule(message, candidateRules) {
        try {
            if (candidateRules.length === 0) {
                return { selectedRule: null };
            }
            
            if (candidateRules.length === 1) {
                // Solo una regla candidata, procesarla directamente
                console.log(`✅ Single candidate rule: "${candidateRules[0].name}"`);
                
                const extractedData = await this.extractDataWithAI(
                    message, 
                    candidateRules[0]
                );
                
                return {
                    selectedRule: candidateRules[0],
                    extractedData: extractedData
                };
            }
            
            // Múltiples candidatos, que IA decida la mejor
            console.log(`🤔 Multiple candidates (${candidateRules.length}), using AI to select best rule`);
            
            const prompt = `Analiza este mensaje y determina cuál regla aplica mejor:

REGLAS CANDIDATAS:
${candidateRules.map((rule, i) => {
    const keywords = JSON.parse(rule.trigger_keywords);
    return `${i+1}. "${rule.name}": palabras clave [${keywords.join(', ')}] - Acción: ${rule.action_type}`;
}).join('\n')}

MENSAJE DEL USUARIO: "${message}"

¿Cuál regla aplica mejor? Considera:
- Qué palabras clave coinciden más específicamente
- Cuál acción sería más útil para el usuario
- El contexto general del mensaje

Responde SOLO JSON:
{
  "selected_rule_index": 1,
  "confidence": 0.95,
  "reason": "El mensaje menciona específicamente un pedido con número"
}`;

            const aiResponse = await this.callOpenAI(prompt, 150);
            const parsed = JSON.parse(aiResponse.trim());
            
            // Validar respuesta de IA
            if (parsed.confidence > 0.7 && 
                parsed.selected_rule_index >= 1 && 
                parsed.selected_rule_index <= candidateRules.length) {
                
                const selectedRule = candidateRules[parsed.selected_rule_index - 1];
                
                console.log(`✅ AI selected rule: "${selectedRule.name}" (confidence: ${parsed.confidence})`);
                console.log(`   Reason: ${parsed.reason}`);
                
                // Extraer datos específicos para la regla seleccionada
                const extractedData = await this.extractDataWithAI(message, selectedRule);
                
                return {
                    selectedRule: selectedRule,
                    extractedData: extractedData,
                    aiConfidence: parsed.confidence,
                    aiReason: parsed.reason
                };
            }
            
            console.log(`⚠️ AI confidence too low (${parsed.confidence}) or invalid selection`);
            return { selectedRule: null };
            
        } catch (error) {
            console.error('❌ Error selecting best rule:', error.message);
            
            // Fallback: usar la primera regla por prioridad
            if (candidateRules.length > 0) {
                console.log(`🔄 Fallback: using first rule by priority: "${candidateRules[0].name}"`);
                const extractedData = await this.extractDataWithAI(message, candidateRules[0]);
                return {
                    selectedRule: candidateRules[0],
                    extractedData: extractedData,
                    fallback: true
                };
            }
            
            return { selectedRule: null };
        }
    }

    /**
     * PASO 2C: Extraer datos específicos con IA
     * @param {string} message - Mensaje del usuario
     * @param {Object} rule - Regla seleccionada
     * @returns {Object} Datos extraídos
     */
    static async extractDataWithAI(message, rule) {
        try {
            if (!rule.ai_extraction_enabled || !rule.ai_extraction_prompt) {
                console.log(`ℹ️ AI extraction disabled for rule: "${rule.name}"`);
                return {};
            }
            
            console.log(`🧠 Extracting data with AI for rule: "${rule.name}"`);
            
            const prompt = `${rule.ai_extraction_prompt}

MENSAJE DEL USUARIO: "${message}"`;

            const aiResponse = await this.callOpenAI(prompt, 200);
            const extractedData = JSON.parse(aiResponse.trim());
            
            console.log(`✅ Extracted data:`, extractedData);
            
            // Validar que contiene los campos esperados
            if (rule.expected_data_fields) {
                const expectedFields = JSON.parse(rule.expected_data_fields);
                const missingFields = expectedFields.filter(field => 
                    !extractedData.hasOwnProperty(field)
                );
                
                if (missingFields.length > 0) {
                    console.warn(`⚠️ Missing expected fields: ${missingFields.join(', ')}`);
                }
            }
            
            return extractedData;
            
        } catch (error) {
            console.error('❌ Error extracting data with AI:', error.message);
            return {};
        }
    }

    /**
     * PASO 3: Ejecutar acción de la regla seleccionada
     * @param {Object} rule - Regla a ejecutar
     * @param {Object} extractedData - Datos extraídos por IA
     * @param {Object} conversation - Conversación actual
     * @param {string} clientCode - Código del cliente
     * @returns {Object} Resultado de la ejecución
     */
    static async executeRuleAction(rule, extractedData, conversation, clientCode) {
        try {
            console.log(`⚡ Executing action: ${rule.action_type} for rule: "${rule.name}"`);
            
            let actionResult = {};
            
            // Ejecutar acción principal según tipo
            switch (rule.action_type) {
                case 'call_api':
                    actionResult = await this.executeApiCall(rule, extractedData);
                    break;
                    
                case 'assign_tags':
                    actionResult = await this.executeTagAssignment(rule, conversation, extractedData);
                    break;
                    
                case 'escalate_human':
                    actionResult = await this.executeEscalation(rule, conversation);
                    break;
                    
                case 'ai_response':
                case 'hybrid':
                default:
                    actionResult = { type: rule.action_type, success: true };
                    break;
            }
            
            // Aplicar etiquetas adicionales si están configuradas
            if (rule.tags_to_assign) {
                try {
                    const additionalTags = JSON.parse(rule.tags_to_assign);
                    if (additionalTags.length > 0) {
                        await this.applyTagsToContact(conversation.contact_id, additionalTags);
                        console.log(`🏷️ Applied additional tags: ${additionalTags.join(', ')}`);
                        
                        // Agregar tags al resultado
                        actionResult.additionalTagsApplied = additionalTags;
                    }
                } catch (tagError) {
                    console.error('❌ Error applying additional tags:', tagError.message);
                }
            }
            
            return actionResult;
            
        } catch (error) {
            console.error('❌ Error executing rule action:', error.message);
            return { 
                type: 'error', 
                success: false, 
                error: error.message 
            };
        }
    }

    /**
     * Ejecutar llamada a API externa
     * @param {Object} rule - Regla con configuración de API
     * @param {Object} extractedData - Datos extraídos para usar en la API
     * @returns {Object} Resultado de la llamada
     */
    static async executeApiCall(rule, extractedData) {
        try {
            const config = JSON.parse(rule.action_config);
            let apiUrl = config.api_endpoint;
            
            console.log(`🌐 Preparing API call with extracted data:`, extractedData);
            
            // Reemplazar variables en la URL con datos extraídos
            Object.keys(extractedData).forEach(key => {
                const placeholder = `{${key}}`;
                if (apiUrl.includes(placeholder)) {
                    apiUrl = apiUrl.replace(placeholder, extractedData[key]);
                    console.log(`🔄 Replaced ${placeholder} with "${extractedData[key]}"`);
                }
            });
            
            console.log(`📡 Final API URL: ${apiUrl}`);
            
            // Preparar configuración de la llamada
            const requestConfig = {
                method: config.method || 'GET',
                url: apiUrl,
                headers: config.headers || {},
                timeout: config.timeout || 10000
            };
            
            // Agregar body si es POST/PUT
            if (config.method === 'POST' || config.method === 'PUT') {
                if (config.body_template) {
                    // Reemplazar variables en el body también
                    let bodyTemplate = JSON.stringify(config.body_template);
                    Object.keys(extractedData).forEach(key => {
                        bodyTemplate = bodyTemplate.replace(`{${key}}`, extractedData[key]);
                    });
                    requestConfig.data = JSON.parse(bodyTemplate);
                    console.log(`📝 Request body:`, requestConfig.data);
                }
            }
            
            // Ejecutar llamada a la API
            console.log(`📡 Making API call...`);
            const response = await axios(requestConfig);
            
            console.log(`✅ API call successful. Status: ${response.status}`);
            console.log(`📊 Response data:`, response.data);
            
            return {
                type: 'call_api',
                success: true,
                apiResponse: response.data,
                statusCode: response.status,
                extractedData: extractedData
            };
            
        } catch (error) {
            console.error('❌ API call failed:', error.message);
            
            // Clasificar tipo de error
            let errorType = 'unknown';
            let statusCode = null;
            
            if (error.code === 'ECONNREFUSED') errorType = 'connection_refused';
            else if (error.code === 'ETIMEDOUT') errorType = 'timeout';
            else if (error.response?.status === 404) errorType = 'not_found';
            else if (error.response?.status === 401) errorType = 'unauthorized';
            else if (error.response?.status === 500) errorType = 'server_error';
            
            if (error.response) {
                statusCode = error.response.status;
            }
            
            return {
                type: 'call_api',
                success: false,
                error: error.message,
                errorType: errorType,
                statusCode: statusCode,
                extractedData: extractedData
            };
        }
    }

    /**
     * Ejecutar asignación de etiquetas
     * @param {Object} rule - Regla con configuración de etiquetas
     * @param {Object} conversation - Conversación actual
     * @param {Object} extractedData - Datos extraídos
     * @returns {Object} Resultado de la asignación
     */
    static async executeTagAssignment(rule, conversation, extractedData = {}) {
        try {
            // Obtener etiquetas base de la regla
            const baseTags = JSON.parse(rule.tags_to_assign || '[]');
            let allTagsToApply = [...baseTags];
            
            // Procesar configuración adicional si existe
            let autoResponse = null;
            let shouldEscalate = false;
            
            if (rule.action_config) {
                const config = JSON.parse(rule.action_config);
                
                // Mensaje automático personalizado
                if (config.auto_response) {
                    autoResponse = config.auto_response;
                    
                    // Reemplazar variables en el mensaje
                    Object.keys(extractedData).forEach(key => {
                        autoResponse = autoResponse.replace(`{${key}}`, extractedData[key]);
                    });
                }
                
                // Etiquetas condicionales según datos extraídos
                if (config.conditional_tags && extractedData) {
                    Object.keys(config.conditional_tags).forEach(condition => {
                        // Ejemplo: si urgency === 'high', agregar tag de urgente
                        if (extractedData.urgency === 'high' && condition === 'urgent') {
                            allTagsToApply.push(config.conditional_tags[condition]);
                        }
                        // Agregar más condiciones según necesidades
                    });
                }
                
                // Escalación después de etiquetar
                if (config.escalate_after_tagging) {
                    shouldEscalate = true;
                }
            }
            
            // Aplicar todas las etiquetas
            if (allTagsToApply.length > 0) {
                await this.applyTagsToContact(conversation.contact_id, allTagsToApply);
                console.log(`🏷️ Applied ${allTagsToApply.length} tags: ${allTagsToApply.join(', ')}`);
            }
            
            return {
                type: 'assign_tags',
                success: true,
                tagsApplied: allTagsToApply,
                autoResponse: autoResponse,
                willEscalate: shouldEscalate,
                extractedData: extractedData
            };
            
        } catch (error) {
            console.error('❌ Error in executeTagAssignment:', error.message);
            return {
                type: 'assign_tags',
                success: false,
                error: error.message,
                tagsApplied: []
            };
        }
    }

    /**
     * Ejecutar escalación a humano
     * @param {Object} rule - Regla con configuración de escalación
     * @param {Object} conversation - Conversación actual
     * @returns {Object} Resultado de la escalación
     */
    static async executeEscalation(rule, conversation) {
        try {
            const config = JSON.parse(rule.action_config || '{}');
            const escalationMessage = config.escalation_message || 
                'Te estoy conectando con un agente humano que podrá ayudarte mejor.';
            
            // Desactivar bot para esta conversación
            await executeQuery(`
                UPDATE conversations 
                SET bot_enabled = FALSE 
                WHERE id = ?
            `, [conversation.id]);
            
            console.log(`👤 Escalated conversation ${conversation.id} to human`);
            console.log(`   Message: "${escalationMessage}"`);
            console.log(`   Priority: ${config.priority || 'normal'}`);
            
            return {
                type: 'escalate_human',
                success: true,
                escalationMessage: escalationMessage,
                priority: config.priority || 'normal'
            };
            
        } catch (error) {
            console.error('❌ Error escalating to human:', error.message);
            return {
                type: 'escalate_human',
                success: false,
                error: error.message,
                escalationMessage: 'Error en la escalación. Un agente te contactará pronto.'
            };
        }
    }

    /**
     * Aplicar etiquetas a un contacto usando el sistema existente
     * @param {number} contactId - ID del contacto
     * @param {Array} tagIds - Array de IDs de etiquetas
     * @returns {Promise} Resultado de la aplicación
     */
    static async applyTagsToContact(contactId, tagIds) {
        try {
            if (!Array.isArray(tagIds) || tagIds.length === 0) {
                return;
            }
            
            console.log(`🏷️ Applying tags ${tagIds.join(', ')} to contact ${contactId}`);
            
            // Usar el ContactController existente
            // Simular request object para reutilizar método existente
            const mockReq = {
                params: { id: contactId },
                body: { tagIds: tagIds },
                user: { id: 1 } // TODO: Obtener del contexto real
            };
            
            const mockRes = {
                json: (response) => {
                    if (response.success) {
                        console.log(`✅ Tags applied successfully to contact ${contactId}`);
                    } else {
                        console.error(`❌ Error applying tags: ${response.message}`);
                    }
                },
                status: (code) => ({ json: mockRes.json })
            };
            
            // Llamar al método existente
            await ContactController.addContactTags(mockReq, mockRes);
            
        } catch (error) {
            console.error('❌ Error in applyTagsToContact:', error.message);
            throw error;
        }
    }

    /**
     * Actualizar estadísticas de uso de regla
     * @param {number} ruleId - ID de la regla
     * @param {boolean} wasSuccessful - Si la ejecución fue exitosa
     */
    static async updateRuleStats(ruleId, wasSuccessful) {
        try {
            await executeQuery(`
                UPDATE intelligent_bot_rules 
                SET times_triggered = times_triggered + 1,
                    last_triggered_at = NOW()
                WHERE id = ?
            `, [ruleId]);
            
            console.log(`📊 Updated stats for rule ${ruleId}: triggered +1, success: ${wasSuccessful}`);
            
            // TODO: Implementar cálculo de success_rate basado en feedback
            
        } catch (error) {
            console.error('❌ Error updating rule stats:', error.message);
        }
    }

    /**
     * Llamada optimizada a OpenAI
     * @param {string} prompt - Prompt para la IA
     * @param {number} maxTokens - Máximo de tokens
     * @returns {string} Respuesta de la IA
     */
    static async callOpenAI(prompt, maxTokens = 200) {
        try {
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-3.5-turbo',
                messages: [
                    { 
                        role: 'system', 
                        content: 'Eres un asistente que responde SOLO en el formato JSON solicitado. No agregues explicaciones adicionales.' 
                    },
                    { role: 'user', content: prompt }
                ],
                max_tokens: maxTokens,
                temperature: 0.1, // Baja creatividad para respuestas precisas
                timeout: 15000
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            });
            
            return response.data.choices[0].message.content.trim();
            
        } catch (error) {
            console.error('❌ Error calling OpenAI:', error.message);
            throw new Error(`OpenAI API error: ${error.message}`);
        }
    }

    /**
     * Obtener todas las reglas activas de un cliente
     * @param {number} clientId - ID del cliente
     * @returns {Array} Reglas activas
     */
    static async getActiveRules(clientId) {
        try {
            const rules = await executeQuery(`
                SELECT * FROM intelligent_bot_rules 
                WHERE client_id = ? AND is_active = TRUE 
                ORDER BY priority ASC, id ASC
            `, [clientId]);
            
            return rules;
        } catch (error) {
            console.error('❌ Error getting active rules:', error.message);
            return [];
        }
    }

    /**
     * Obtener estadísticas de reglas para un cliente
     * @param {number} clientId - ID del cliente
     * @returns {Object} Estadísticas
     */
    static async getRulesStats(clientId) {
        try {
            const stats = await executeQuery(`
                SELECT 
                    COUNT(*) as total_rules,
                    COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_rules,
                    SUM(times_triggered) as total_triggers,
                    AVG(success_rate) as avg_success_rate
                FROM intelligent_bot_rules 
                WHERE client_id = ?
            `, [clientId]);
            
            return stats[0] || {};
        } catch (error) {
            console.error('❌ Error getting rules stats:', error.message);
            return {};
        }
    }
}

module.exports = IntelligentRulesService;
