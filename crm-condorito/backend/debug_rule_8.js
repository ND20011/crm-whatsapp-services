const { executeQuery } = require('./src/config/database-simple');

async function debugRule8() {
    try {
        console.log('🔍 Debugging Rule 8...');
        
        // Obtener regla directamente
        const rules = await executeQuery(`
            SELECT id, name, trigger_keywords, 
                   HEX(trigger_keywords) as hex_keywords,
                   LENGTH(trigger_keywords) as length_keywords
            FROM intelligent_bot_rules 
            WHERE id = 8 AND client_id = 1
        `);

        if (rules.length === 0) {
            console.log('❌ No rule found');
            return;
        }

        const rule = rules[0];
        console.log('📋 Rule data:', {
            id: rule.id,
            name: rule.name,
            trigger_keywords: rule.trigger_keywords,
            hex_keywords: rule.hex_keywords,
            length_keywords: rule.length_keywords,
            type: typeof rule.trigger_keywords
        });

        // Intentar parsear
        try {
            const parsed = JSON.parse(rule.trigger_keywords);
            console.log('✅ JSON parsed successfully:', parsed);
        } catch (error) {
            console.log('❌ JSON parse error:', error.message);
            console.log('❌ First 10 chars:', rule.trigger_keywords.substring(0, 10));
            console.log('❌ Char codes:', Array.from(rule.trigger_keywords.substring(0, 10)).map(c => c.charCodeAt(0)));
        }

    } catch (error) {
        console.error('❌ Database error:', error);
    } finally {
        process.exit(0);
    }
}

debugRule8();
