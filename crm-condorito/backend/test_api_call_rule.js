const IntelligentRulesService = require('./src/services/IntelligentRulesService');

async function testApiCallRule() {
    console.log('🧪 Testing API Call Rule with data extraction...\n');
    
    try {
        // Simular conversación con configuración del cliente
        const mockConversation = {
            id: 1,
            contact_id: 1,
            client_id: 1,
            phone: '5491127088255',
            client: {
                intelligent_rules_enabled: 1,
                client_code: 'demo'
            }
        };
        
        // Mensaje de prueba con número de pedido
        const testMessage = "Hola, quiero consultar el estado de mi pedido #12345";
        
        console.log(`📨 Test Message: "${testMessage}"`);
        console.log(`🔍 Processing with IntelligentRulesService...\n`);
        
        // Procesar mensaje con reglas inteligentes
        const result = await IntelligentRulesService.processMessage({
            message: testMessage,
            conversation: mockConversation,
            clientId: 1,
            clientCode: 'demo',
            conversationHistory: [],
            botConfig: {
                intelligent_rules_enabled: 1
            }
        });
        
        console.log('📋 RESULT:');
        console.log('='.repeat(50));
        console.log(JSON.stringify(result, null, 2));
        
        if (result.ruleApplied) {
            console.log('\n✅ Rule was applied successfully!');
            console.log(`🎯 Rule: ${result.appliedRule.name}`);
            console.log(`🔧 Action: ${result.appliedRule.action_type}`);
            
            if (result.extractedData) {
                console.log(`🧠 Extracted Data:`, result.extractedData);
            }
            
            if (result.actionResult) {
                console.log(`📡 Action Result:`, result.actionResult);
            }
        } else {
            console.log('\n❌ No rule was applied');
            console.log('Reason:', result.reason);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Ejecutar test
testApiCallRule();
