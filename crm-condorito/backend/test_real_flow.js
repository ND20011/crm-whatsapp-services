const IntelligentRulesService = require('./src/services/IntelligentRulesService');
const { executeQuery } = require('./src/config/database-simple');

async function testRealFlow() {
    try {
        console.log('🧪 Testing Real Intelligent Rules Flow...\n');

        // Simular configuración del bot
        const botConfig = {
            intelligent_rules_enabled: true,
            ai_enabled: true
        };

        // Simular conversación
        const conversation = {
            id: 1,
            phone: '5491150239962',
            client_id: 1
        };

        // Casos de prueba
        const testCases = [
            {
                message: "quiero comprar un iPhone",
                expected: "should match rule 7 or 10"
            },
            {
                message: "mi pedido 12345 no llegó",
                expected: "should match rule 8"
            },
            {
                message: "se me rompió la pantalla",
                expected: "should match rule 9"
            },
            {
                message: "hola como estas",
                expected: "should not match any rule"
            }
        ];

        for (const testCase of testCases) {
            console.log(`📝 Testing: "${testCase.message}"`);
            console.log(`🎯 Expected: ${testCase.expected}`);
            
            try {
                const result = await IntelligentRulesService.processMessage({
                    message: testCase.message,
                    conversation,
                    clientId: 1,
                    clientCode: 'demo',
                    conversationHistory: [],
                    botConfig
                });

                console.log(`✅ Result:`, {
                    handled: result.handled,
                    ruleName: result.ruleName || 'none',
                    ruleId: result.ruleId || 'none',
                    reason: result.reason || 'success'
                });

            } catch (error) {
                console.log(`❌ Error:`, error.message);
            }
            
            console.log('─'.repeat(50));
        }

    } catch (error) {
        console.error('❌ Test error:', error);
    } finally {
        process.exit(0);
    }
}

testRealFlow();
