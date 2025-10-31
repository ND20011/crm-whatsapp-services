// ============================================================================
// TEST: Endpoint de prueba de reglas inteligentes
// Descripción: Prueba el endpoint POST /api/intelligent-rules/:id/test
// ============================================================================

const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:3000';
const CLIENT_ID = 1; // Cliente demo

// Datos de prueba
const testCases = [
    {
        ruleId: 8, // Consulta de Pedido
        message: "Hola, ¿cuál es el estado de mi pedido 12345?",
        expectedMatch: true
    },
    {
        ruleId: 9, // Solicitud de Reparación
        message: "Se me rompió la pantalla del iPhone 12",
        expectedMatch: true
    },
    {
        ruleId: 10, // Intención de Compra
        message: "Me interesa comprar el Samsung Galaxy S23",
        expectedMatch: true
    },
    {
        ruleId: 11, // Consulta General
        message: "Necesito ayuda con mi cuenta",
        expectedMatch: true
    },
    {
        ruleId: 8, // Consulta de Pedido
        message: "Hola, ¿cómo están?",
        expectedMatch: false
    }
];

async function testRuleEndpoint() {
    console.log('🧪 Testing Intelligent Rules Endpoint...\n');

    for (const testCase of testCases) {
        try {
            console.log(`📝 Testing Rule ID ${testCase.ruleId}:`);
            console.log(`   Message: "${testCase.message}"`);
            console.log(`   Expected Match: ${testCase.expectedMatch}`);

            const response = await axios.post(
                `${BASE_URL}/api/intelligent-rules/${testCase.ruleId}/test`,
                {
                    testMessage: testCase.message
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        // Simular autenticación (en producción sería un JWT)
                        'Authorization': 'Bearer fake-token'
                    },
                    // Simular req.user.id
                    timeout: 5000
                }
            );

            if (response.data.success) {
                const result = response.data.data;
                console.log(`   ✅ Result:`);
                console.log(`      Rule: ${result.ruleName}`);
                console.log(`      Matches: ${result.matches}`);
                console.log(`      Would Trigger: ${result.wouldTrigger}`);
                console.log(`      Matched Keywords: [${result.matchedKeywords.join(', ')}]`);
                console.log(`      Action Type: ${result.actionType}`);
                
                // Verificar si el resultado coincide con lo esperado
                if (result.matches === testCase.expectedMatch) {
                    console.log(`   🎯 PASS: Expected ${testCase.expectedMatch}, got ${result.matches}`);
                } else {
                    console.log(`   ❌ FAIL: Expected ${testCase.expectedMatch}, got ${result.matches}`);
                }
            } else {
                console.log(`   ❌ API Error: ${response.data.message}`);
            }

        } catch (error) {
            if (error.response) {
                console.log(`   ❌ HTTP Error ${error.response.status}: ${error.response.data?.message || error.message}`);
            } else if (error.request) {
                console.log(`   ❌ Network Error: No response from server`);
            } else {
                console.log(`   ❌ Error: ${error.message}`);
            }
        }

        console.log(''); // Línea en blanco
    }

    console.log('✅ Test completed!');
}

// Función para probar una regla específica
async function testSpecificRule(ruleId, message) {
    try {
        console.log(`\n🎯 Testing Rule ${ruleId} with message: "${message}"`);
        
        const response = await axios.post(
            `${BASE_URL}/api/intelligent-rules/${ruleId}/test`,
            { testMessage: message },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer fake-token'
                },
                timeout: 5000
            }
        );

        if (response.data.success) {
            const result = response.data.data;
            console.log('\n📊 DETAILED RESULT:');
            console.log('='.repeat(50));
            console.log(`Rule ID: ${result.ruleId}`);
            console.log(`Rule Name: ${result.ruleName}`);
            console.log(`Test Message: "${result.testMessage}"`);
            console.log(`Matches: ${result.matches ? '✅ YES' : '❌ NO'}`);
            console.log(`Would Trigger: ${result.wouldTrigger ? '✅ YES' : '❌ NO'}`);
            console.log(`Match Type: ${result.matchType}`);
            console.log(`Action Type: ${result.actionType}`);
            console.log(`Is Active: ${result.isActive ? '✅ YES' : '❌ NO'}`);
            console.log(`Matched Keywords: [${result.matchedKeywords.join(', ')}]`);
            console.log('='.repeat(50));
        } else {
            console.log(`❌ Error: ${response.data.message}`);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Ejecutar tests
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length >= 2) {
        // Probar regla específica: node test_rule_endpoint.js 8 "mi pedido 12345"
        const ruleId = parseInt(args[0]);
        const message = args.slice(1).join(' ');
        testSpecificRule(ruleId, message);
    } else {
        // Ejecutar todos los tests
        testRuleEndpoint();
    }
}

module.exports = { testRuleEndpoint, testSpecificRule };
