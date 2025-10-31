const IntelligentRulesService = require('./src/services/IntelligentRulesService');
const { executeQuery } = require('./src/config/database-simple');

async function testPreserveTags() {
    try {
        console.log('🏷️ Testing Tag Preservation...\n');

        // Obtener un contacto real
        const contacts = await executeQuery(`
            SELECT id, phone_number, name FROM contacts 
            WHERE client_id = 1 
            LIMIT 1
        `);

        if (contacts.length === 0) {
            console.log('❌ No contacts found');
            return;
        }

        const contact = contacts[0];
        console.log(`👤 Using contact: ${contact.name} (${contact.phone_number})`);

        // 1. Agregar algunas etiquetas manualmente primero
        console.log('\n📝 Step 1: Adding manual tags first...');
        await executeQuery(`
            INSERT IGNORE INTO contact_tag_relations (contact_id, tag_id, created_at) 
            VALUES (?, 26, NOW()), (?, 27, NOW())
        `, [contact.id, contact.id]);

        // Verificar etiquetas iniciales
        const initialTags = await executeQuery(`
            SELECT ct.id, ct.name 
            FROM contact_tag_relations ctr 
            JOIN contact_tags ct ON ctr.tag_id = ct.id 
            WHERE ctr.contact_id = ?
        `, [contact.id]);

        console.log(`🏷️ Initial tags: ${initialTags.map(t => `${t.name}(${t.id})`).join(', ')}`);

        // 2. Simular conversación
        const conversation = {
            id: 1,
            phone: contact.phone_number,
            client_id: 1,
            contact_id: contact.id
        };

        const botConfig = {
            intelligent_rules_enabled: true,
            ai_enabled: true
        };

        // 3. Activar regla que asigna etiqueta
        console.log('\n📝 Step 2: Triggering intelligent rule...');
        
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

        // 4. Verificar etiquetas finales
        const finalTags = await executeQuery(`
            SELECT ct.id, ct.name 
            FROM contact_tag_relations ctr 
            JOIN contact_tags ct ON ctr.tag_id = ct.id 
            WHERE ctr.contact_id = ?
        `, [contact.id]);

        console.log(`🏷️ Final tags: ${finalTags.map(t => `${t.name}(${t.id})`).join(', ')}`);

        // 5. Análisis de cambios
        const initialTagIds = initialTags.map(t => t.id);
        const finalTagIds = finalTags.map(t => t.id);
        
        const preservedTags = initialTags.filter(tag => finalTagIds.includes(tag.id));
        const newTags = finalTags.filter(tag => !initialTagIds.includes(tag.id));
        const removedTags = initialTags.filter(tag => !finalTagIds.includes(tag.id));

        console.log('\n📊 Analysis:');
        console.log(`✅ Preserved tags: ${preservedTags.map(t => t.name).join(', ') || 'none'}`);
        console.log(`➕ New tags: ${newTags.map(t => t.name).join(', ') || 'none'}`);
        console.log(`➖ Removed tags: ${removedTags.map(t => t.name).join(', ') || 'none'}`);

        // 6. Resultado
        if (removedTags.length === 0 && newTags.length > 0) {
            console.log('\n🎉 SUCCESS: Tags were preserved and new ones added!');
        } else if (removedTags.length > 0) {
            console.log('\n❌ FAILURE: Some existing tags were removed!');
        } else {
            console.log('\n⚠️ WARNING: No new tags were added');
        }

    } catch (error) {
        console.error('❌ Test error:', error);
    } finally {
        process.exit(0);
    }
}

testPreserveTags();
