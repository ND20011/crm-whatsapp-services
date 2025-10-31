// ============================================================================
// TEST: Sistema de Reglas Inteligentes
// Descripción: Prueba las reglas sin necesidad de WhatsApp conectado
// ============================================================================

const { executeQuery } = require('./src/config/database-simple');

class IntelligentRulesTest {
    
    /**
     * Simular el procesamiento de reglas inteligentes
     */
    static async testRulesProcessing(clientId, testMessage) {
        try {
            console.log(`\n🧠 Testing Intelligent Rules for Client: ${clientId}`);
            console.log(`📝 Test Message: "${testMessage}"`);
            console.log('=' .repeat(60));

            // PASO 1: Obtener reglas activas
            const rules = await this.getRules(clientId);
            console.log(`📋 Found ${rules.length} active rules`);

            if (rules.length === 0) {
                console.log('❌ No active rules found');
                return;
            }

            // PASO 2: Filtrar reglas por palabras clave
            const candidateRules = await this.getCandidateRules(testMessage, rules);
            console.log(`🎯 Found ${candidateRules.length} candidate rules`);

            if (candidateRules.length === 0) {
                console.log('ℹ️ No matching rules for this message');
                return;
            }

            // PASO 3: Mostrar reglas que coinciden
            for (const rule of candidateRules) {
                console.log(`\n✅ RULE MATCH: ${rule.name}`);
                console.log(`   ID: ${rule.id}`);
                console.log(`   Priority: ${rule.priority}`);
                console.log(`   Keywords: ${rule.trigger_keywords}`);
                console.log(`   Match Type: ${rule.match_type}`);
                console.log(`   Action Type: ${rule.action_type}`);
                console.log(`   AI Extraction: ${rule.ai_extraction_enabled ? 'YES' : 'NO'}`);
                
                if (rule.tags_to_assign) {
                    console.log(`   Auto Tags: ${rule.tags_to_assign}`);
                }
                
                if (rule.action_config) {
                    console.log(`   Action Config: ${rule.action_config}`);
                }
            }

            // PASO 4: Simular selección de mejor regla
            const selectedRule = candidateRules[0]; // Tomar la de mayor prioridad
            console.log(`\n🏆 SELECTED RULE: ${selectedRule.name}`);

            // PASO 5: Simular extracción de datos con IA (sin llamar a OpenAI)
            if (selectedRule.ai_extraction_enabled) {
                console.log(`\n🧠 AI EXTRACTION SIMULATION:`);
                console.log(`   Prompt: ${selectedRule.ai_extraction_prompt}`);
                console.log(`   Expected Fields: ${selectedRule.expected_data_fields}`);
                
                // Simular datos extraídos
                const mockExtractedData = this.simulateAIExtraction(testMessage, selectedRule);
                console.log(`   Simulated Extracted Data:`, mockExtractedData);
            }

            // PASO 6: Simular ejecución de acción
            console.log(`\n⚡ ACTION SIMULATION: ${selectedRule.action_type}`);
            await this.simulateActionExecution(selectedRule, testMessage);

            console.log('\n✅ Test completed successfully!');

        } catch (error) {
            console.error('❌ Error testing rules:', error.message);
        }
    }

    /**
     * Obtener reglas activas del cliente
     */
    static async getRules(clientId) {
        const query = `
            SELECT * FROM intelligent_bot_rules 
            WHERE client_id = ? AND is_active = TRUE 
            ORDER BY priority ASC
        `;
        return await executeQuery(query, [clientId]);
    }

    /**
     * Filtrar reglas por palabras clave
     */
    static async getCandidateRules(message, rules) {
        const messageWords = message.toLowerCase();
        const candidates = [];

        for (const rule of rules) {
            try {
                // Intentar parsear keywords
                let keywords;
                try {
                    keywords = JSON.parse(rule.trigger_keywords);
                } catch (parseError) {
                    console.log(`⚠️ Error parsing keywords for rule ${rule.id}: ${parseError.message}`);
                    console.log(`   Raw keywords: ${rule.trigger_keywords}`);
                    continue;
                }

                if (!Array.isArray(keywords)) {
                    console.log(`⚠️ Keywords not an array for rule ${rule.id}`);
                    continue;
                }

                // Verificar coincidencias
                let matches = false;
                switch (rule.match_type) {
                    case 'all':
                        matches = keywords.every(keyword => 
                            messageWords.includes(keyword.toLowerCase())
                        );
                        break;
                    case 'exact_phrase':
                        matches = keywords.some(keyword => 
                            messageWords.includes(keyword.toLowerCase())
                        );
                        break;
                    case 'any':
                    default:
                        matches = keywords.some(keyword => 
                            messageWords.includes(keyword.toLowerCase())
                        );
                        break;
                }

                if (matches) {
                    candidates.push(rule);
                }

            } catch (error) {
                console.log(`❌ Error processing rule ${rule.id}: ${error.message}`);
            }
        }

        return candidates;
    }

    /**
     * Simular extracción de datos con IA
     */
    static simulateAIExtraction(message, rule) {
        // Simular datos extraídos basados en el mensaje
        const mockData = {};
        
        if (message.toLowerCase().includes('pedido')) {
            mockData.order_number = '12345';
            mockData.confidence = 0.95;
        }
        
        if (message.toLowerCase().includes('reparar') || message.toLowerCase().includes('roto')) {
            mockData.device = 'iPhone 12';
            mockData.problem = 'pantalla rota';
            mockData.urgency = 'normal';
        }
        
        if (message.toLowerCase().includes('comprar') || message.toLowerCase().includes('precio')) {
            mockData.product_interest = 'Samsung Galaxy S23';
            mockData.intent = 'purchase';
        }

        return mockData;
    }

    /**
     * Simular ejecución de acción
     */
    static async simulateActionExecution(rule, message) {
        switch (rule.action_type) {
            case 'assign_tags':
                console.log('   📋 Would assign tags:', rule.tags_to_assign);
                if (rule.action_config) {
                    const config = JSON.parse(rule.action_config);
                    if (config.auto_response) {
                        console.log('   💬 Would send auto response:', config.auto_response);
                    }
                }
                break;

            case 'call_api':
                if (rule.action_config) {
                    const config = JSON.parse(rule.action_config);
                    console.log('   🌐 Would call API:', config.api_endpoint);
                    console.log('   📤 Method:', config.method || 'GET');
                    if (config.response_template) {
                        console.log('   📝 Response template:', config.response_template);
                    }
                }
                break;

            case 'escalate_human':
                console.log('   👤 Would escalate to human agent');
                if (rule.action_config) {
                    const config = JSON.parse(rule.action_config);
                    if (config.escalation_message) {
                        console.log('   💬 Escalation message:', config.escalation_message);
                    }
                    console.log('   ⚡ Priority:', config.priority || 'normal');
                }
                break;

            case 'ai_response':
                console.log('   🤖 Would generate AI response');
                if (rule.action_config) {
                    const config = JSON.parse(rule.action_config);
                    if (config.ai_response_prompt) {
                        console.log('   📝 AI Prompt:', config.ai_response_prompt);
                    }
                }
                break;

            case 'hybrid':
                console.log('   🔄 Would execute hybrid actions');
                if (rule.action_config) {
                    const config = JSON.parse(rule.action_config);
                    console.log('   📋 Hybrid config:', config);
                }
                break;

            default:
                console.log('   ❓ Unknown action type');
        }
    }

    /**
     * Mostrar todas las reglas del cliente
     */
    static async showAllRules(clientId) {
        try {
            console.log(`\n📋 All Rules for Client ${clientId}:`);
            console.log('=' .repeat(50));

            const rules = await executeQuery(`
                SELECT id, name, is_active, priority, trigger_keywords, 
                       match_type, action_type, ai_extraction_enabled,
                       tags_to_assign, created_at
                FROM intelligent_bot_rules 
                WHERE client_id = ? 
                ORDER BY priority ASC, id ASC
            `, [clientId]);

            if (rules.length === 0) {
                console.log('❌ No rules found for this client');
                return;
            }

            for (const rule of rules) {
                console.log(`\n📝 Rule #${rule.id}: ${rule.name}`);
                console.log(`   Status: ${rule.is_active ? '✅ Active' : '❌ Inactive'}`);
                console.log(`   Priority: ${rule.priority}`);
                console.log(`   Keywords: ${rule.trigger_keywords}`);
                console.log(`   Match Type: ${rule.match_type}`);
                console.log(`   Action: ${rule.action_type}`);
                console.log(`   AI Extraction: ${rule.ai_extraction_enabled ? 'YES' : 'NO'}`);
                console.log(`   Auto Tags: ${rule.tags_to_assign || 'None'}`);
                console.log(`   Created: ${rule.created_at}`);
            }

        } catch (error) {
            console.error('❌ Error showing rules:', error.message);
        }
    }
}

// ============================================================================
// EJECUTAR TESTS
// ============================================================================

async function runTests() {
    console.log('🚀 Starting Intelligent Rules Tests...\n');

    const clientId = 1; // Cliente demo

    // Test 1: Mostrar todas las reglas
    await IntelligentRulesTest.showAllRules(clientId);

    // Test 2: Probar diferentes mensajes
    const testMessages = [
        "Hola, ¿cuál es el estado de mi pedido 12345?",
        "Se me rompió la pantalla del iPhone 12",
        "Me interesa comprar el Samsung Galaxy S23",
        "Necesito ayuda con mi cuenta",
        "¿Tienen descuentos disponibles?"
    ];

    for (const message of testMessages) {
        await IntelligentRulesTest.testRulesProcessing(clientId, message);
        console.log('\n' + '='.repeat(80) + '\n');
    }

    console.log('✅ All tests completed!');
    process.exit(0);
}

// Ejecutar si se llama directamente
if (require.main === module) {
    runTests().catch(error => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
}

module.exports = IntelligentRulesTest;
