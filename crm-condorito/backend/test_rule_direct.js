// ============================================================================
// TEST DIRECTO: Probar reglas sin servidor
// Descripción: Prueba las reglas directamente contra la base de datos
// ============================================================================

const { executeQuery } = require('./src/config/database-simple');

async function testRuleDirect(ruleId, testMessage, clientId = 1) {
    try {
        console.log(`\n🧪 Testing Rule ${ruleId} directly:`);
        console.log(`📝 Message: "${testMessage}"`);
        console.log(`👤 Client ID: ${clientId}`);
        console.log('='.repeat(50));

        // Obtener regla
        const rules = await executeQuery(`
            SELECT * FROM intelligent_bot_rules 
            WHERE id = ? AND client_id = ?
        `, [ruleId, clientId]);

        if (rules.length === 0) {
            console.log('❌ Regla no encontrada');
            return;
        }

        const rule = rules[0];
        console.log(`📋 Rule: ${rule.name}`);
        console.log(`🔄 Active: ${rule.is_active ? '✅ YES' : '❌ NO'}`);
        console.log(`🎯 Match Type: ${rule.match_type}`);
        console.log(`⚡ Action Type: ${rule.action_type}`);

        // Parsear keywords con manejo de errores
        let keywords;
        try {
            keywords = JSON.parse(rule.trigger_keywords);
            console.log(`🔑 Keywords: [${keywords.join(', ')}]`);
        } catch (parseError) {
            console.log(`❌ Error parsing keywords: ${parseError.message}`);
            console.log(`📄 Raw keywords: ${rule.trigger_keywords}`);
            return;
        }

        if (!Array.isArray(keywords)) {
            console.log('❌ Keywords no es un array válido');
            return;
        }

        // Evaluar regla
        const messageWords = testMessage.toLowerCase();
        let matches = false;
        let matchedKeywords = [];

        console.log(`\n🔍 Evaluating match type: ${rule.match_type}`);

        switch (rule.match_type) {
            case 'all':
                console.log('   📝 Checking if ALL keywords are present...');
                matches = keywords.every(keyword => {
                    const found = messageWords.includes(keyword.toLowerCase());
                    console.log(`      "${keyword}": ${found ? '✅' : '❌'}`);
                    if (found) matchedKeywords.push(keyword);
                    return found;
                });
                break;
            case 'exact_phrase':
                console.log('   📝 Checking for EXACT phrase matches...');
                matches = keywords.some(keyword => {
                    const found = messageWords.includes(keyword.toLowerCase());
                    console.log(`      "${keyword}": ${found ? '✅' : '❌'}`);
                    if (found) matchedKeywords.push(keyword);
                    return found;
                });
                break;
            case 'any':
            default:
                console.log('   📝 Checking if ANY keyword is present...');
                matches = keywords.some(keyword => {
                    const found = messageWords.includes(keyword.toLowerCase());
                    console.log(`      "${keyword}": ${found ? '✅' : '❌'}`);
                    if (found) matchedKeywords.push(keyword);
                    return found;
                });
                break;
        }

        // Mostrar resultado
        console.log(`\n📊 RESULT:`);
        console.log(`   Matches: ${matches ? '✅ YES' : '❌ NO'}`);
        console.log(`   Matched Keywords: [${matchedKeywords.join(', ')}]`);
        console.log(`   Would Trigger: ${matches && rule.is_active ? '✅ YES' : '❌ NO'}`);

        if (matches && rule.is_active) {
            console.log(`\n⚡ ACTION THAT WOULD BE EXECUTED:`);
            console.log(`   Type: ${rule.action_type}`);
            
            if (rule.tags_to_assign) {
                try {
                    const tags = JSON.parse(rule.tags_to_assign);
                    console.log(`   Auto Tags: [${tags.join(', ')}]`);
                } catch (e) {
                    console.log(`   Auto Tags: ${rule.tags_to_assign}`);
                }
            }
            
            if (rule.action_config) {
                try {
                    const config = JSON.parse(rule.action_config);
                    console.log(`   Config:`, config);
                } catch (e) {
                    console.log(`   Config: ${rule.action_config}`);
                }
            }
        }

        return {
            ruleId: parseInt(ruleId),
            ruleName: rule.name,
            testMessage: testMessage,
            matches: matches,
            matchedKeywords: matchedKeywords,
            matchType: rule.match_type,
            actionType: rule.action_type,
            isActive: Boolean(rule.is_active),
            wouldTrigger: matches && Boolean(rule.is_active)
        };

    } catch (error) {
        console.error('❌ Error testing rule:', error.message);
        return null;
    }
}

// Función para probar múltiples casos
async function runTestCases() {
    console.log('🚀 Running Test Cases...\n');

    const testCases = [
        { ruleId: 8, message: "¿Cuál es el estado de mi pedido 12345?", expected: true },
        { ruleId: 9, message: "Se me rompió la pantalla del iPhone", expected: true },
        { ruleId: 10, message: "Me interesa comprar un Samsung", expected: true },
        { ruleId: 11, message: "Necesito ayuda con mi cuenta", expected: true },
        { ruleId: 8, message: "Hola, ¿cómo están?", expected: false }
    ];

    for (const testCase of testCases) {
        const result = await testRuleDirect(testCase.ruleId, testCase.message);
        
        if (result) {
            const passed = result.matches === testCase.expected;
            console.log(`\n🎯 TEST ${passed ? 'PASSED' : 'FAILED'}: Expected ${testCase.expected}, got ${result.matches}`);
        }
        
        console.log('\n' + '='.repeat(80) + '\n');
    }

    console.log('✅ All tests completed!');
}

// Ejecutar
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length >= 2) {
        // Probar regla específica: node test_rule_direct.js 8 "mi pedido 12345"
        const ruleId = parseInt(args[0]);
        const message = args.slice(1).join(' ');
        testRuleDirect(ruleId, message).then(() => process.exit(0));
    } else {
        // Ejecutar todos los test cases
        runTestCases().then(() => process.exit(0));
    }
}

module.exports = { testRuleDirect };
