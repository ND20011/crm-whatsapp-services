const IntelligentRulesService = require('./src/services/IntelligentRulesService');
const { executeQuery } = require('./src/config/database-simple');

async function testTagsAssignment() {
    try {
        console.log('🏷️ Testing Tags Assignment with Real Contact...\n');

        // Obtener un contacto real de la base de datos
        const contacts = await executeQuery(`
            SELECT id, phone_number, name FROM contacts 
            WHERE client_id = 1 
            LIMIT 1
        `);

        if (contacts.length === 0) {
            console.log('❌ No contacts found in database');
            return;
        }

        const contact = contacts[0];
        console.log(`👤 Using contact: ${contact.name} (${contact.phone_number})`);

        // Simular conversación real
        const conversation = {
            id: 1,
            phone: contact.phone_number,
            client_id: 1,
            contact_id: contact.id  // ¡Importante!
        };

        // Simular configuración del bot
        const botConfig = {
            intelligent_rules_enabled: true,
            ai_enabled: true
        };

        // Verificar etiquetas antes
        const tagsBefore = await executeQuery(`
            SELECT ct.name 
            FROM contact_tag_relations ctr 
            JOIN contact_tags ct ON ctr.tag_id = ct.id 
            WHERE ctr.contact_id = ?
        `, [contact.id]);

        console.log(`🏷️ Tags before: ${tagsBefore.map(t => t.name).join(', ') || 'none'}`);

        // Probar regla que asigna etiquetas
        console.log('\n📝 Testing: "quiero comprar un iPhone"');
        
        const result = await IntelligentRulesService.processMessage({
            message: "quiero comprar un iPhone",
            conversation,
            clientId: 1,
            clientCode: 'demo',
            conversationHistory: [],
            botConfig
        });

        console.log(`✅ Rule result:`, {
            handled: result.handled,
            ruleName: result.ruleName || 'none',
            ruleId: result.ruleId || 'none'
        });

        // Verificar etiquetas después
        const tagsAfter = await executeQuery(`
            SELECT ct.name 
            FROM contact_tag_relations ctr 
            JOIN contact_tags ct ON ctr.tag_id = ct.id 
            WHERE ctr.contact_id = ?
        `, [contact.id]);

        console.log(`🏷️ Tags after: ${tagsAfter.map(t => t.name).join(', ') || 'none'}`);

        // Comparar
        const newTags = tagsAfter.filter(after => 
            !tagsBefore.some(before => before.name === after.name)
        );

        if (newTags.length > 0) {
            console.log(`🎉 NEW TAGS ASSIGNED: ${newTags.map(t => t.name).join(', ')}`);
        } else {
            console.log(`⚠️ No new tags were assigned`);
        }

    } catch (error) {
        console.error('❌ Test error:', error);
    } finally {
        process.exit(0);
    }
}

testTagsAssignment();
