const IntelligentRulesService = require('./src/services/IntelligentRulesService');
const { executeQuery } = require('./src/config/database-simple');

async function testPreserveTags2() {
    try {
        console.log('🏷️ Testing Tag Preservation with Rule 9...\n');

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

        // 1. Limpiar etiquetas y agregar algunas específicas
        console.log('\n📝 Step 1: Setting up initial tags...');
        
        // Limpiar primero
        await executeQuery(`DELETE FROM contact_tag_relations WHERE contact_id = ?`, [contact.id]);
        
        // Agregar etiquetas iniciales (26, 27) - diferentes de las que asigna la regla 9 (15, 20)
        await executeQuery(`
            INSERT INTO contact_tag_relations (contact_id, tag_id, created_at) 
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

        // 3. Activar regla 9 que asigna etiquetas 15 y 20
        console.log('\n📝 Step 2: Triggering rule 9 (repair request)...');
        
        const result = await IntelligentRulesService.processMessage({
            message: "se me rompió la pantalla",
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
            ORDER BY ct.id
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

        // 7. Verificar que las etiquetas esperadas están presentes
        const expectedNewTagIds = [15, 20]; // Regla 9 debería asignar estas
        const hasExpectedTags = expectedNewTagIds.every(tagId => finalTagIds.includes(tagId));
        
        if (hasExpectedTags) {
            console.log('✅ Expected tags (15, 20) were added correctly');
        } else {
            console.log('❌ Expected tags (15, 20) were NOT added');
        }

    } catch (error) {
        console.error('❌ Test error:', error);
    } finally {
        process.exit(0);
    }
}

testPreserveTags2();
