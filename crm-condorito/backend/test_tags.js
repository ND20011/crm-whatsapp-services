const { executeQuery } = require('./src/config/database-simple');

async function createTestData() {
    try {
        console.log('🚀 Creando datos de prueba para etiquetas...');
        
        // 1. Crear algunas etiquetas de prueba
        console.log('📝 Creando etiquetas...');
        
        const tags = [
            { name: 'Cliente VIP', color: '#007bff', description: 'Clientes importantes' },
            { name: 'Urgente', color: '#dc3545', description: 'Requiere atención inmediata' },
            { name: 'Prospecto', color: '#28a745', description: 'Cliente potencial' }
        ];
        
        for (const tag of tags) {
            try {
                const result = await executeQuery(`
                    INSERT INTO contact_tags (client_id, name, color, description)
                    VALUES (1, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE color = VALUES(color), description = VALUES(description)
                `, [tag.name, tag.color, tag.description]);
                console.log(`✅ Etiqueta "${tag.name}" creada/actualizada`);
            } catch (err) {
                console.log(`⚠️ Etiqueta "${tag.name}" ya existe o error:`, err.message);
            }
        }
        
        // 2. Obtener las conversaciones existentes
        console.log('\n📞 Obteniendo conversaciones...');
        const conversations = await executeQuery(`
            SELECT id, contact_phone, contact_name 
            FROM conversations 
            WHERE client_id = 1 
            LIMIT 3
        `);
        
        console.log(`Encontradas ${conversations.length} conversaciones`);
        
        // 3. Crear/actualizar contactos para las conversaciones
        console.log('\n👥 Creando contactos...');
        for (const conv of conversations) {
            try {
                // Crear contacto si no existe
                const contactResult = await executeQuery(`
                    INSERT INTO contacts (client_id, phone_number, name, comments)
                    VALUES (1, ?, ?, 'Contacto de prueba')
                    ON DUPLICATE KEY UPDATE 
                        name = COALESCE(VALUES(name), name),
                        updated_at = CURRENT_TIMESTAMP
                `, [conv.contact_phone, conv.contact_name || 'Sin nombre']);
                
                console.log(`✅ Contacto para ${conv.contact_phone} creado/actualizado`);
                
                // Obtener el ID del contacto
                const contact = await executeQuery(`
                    SELECT id FROM contacts 
                    WHERE client_id = 1 AND phone_number = ?
                `, [conv.contact_phone]);
                
                if (contact.length > 0) {
                    const contactId = contact[0].id;
                    
                    // Actualizar la conversación con el contact_id
                    await executeQuery(`
                        UPDATE conversations 
                        SET contact_id = ? 
                        WHERE id = ?
                    `, [contactId, conv.id]);
                    
                    console.log(`✅ Conversación ${conv.id} vinculada al contacto ${contactId}`);
                }
                
            } catch (err) {
                console.log(`⚠️ Error con contacto ${conv.contact_phone}:`, err.message);
            }
        }
        
        // 4. Asignar algunas etiquetas de prueba
        console.log('\n🏷️ Asignando etiquetas...');
        
        // Obtener IDs de etiquetas
        const tagIds = await executeQuery(`
            SELECT id, name FROM contact_tags WHERE client_id = 1
        `);
        
        // Obtener IDs de contactos
        const contactIds = await executeQuery(`
            SELECT id, phone_number FROM contacts WHERE client_id = 1 LIMIT 3
        `);
        
        // Asignar etiquetas aleatoriamente
        for (let i = 0; i < contactIds.length && i < tagIds.length; i++) {
            try {
                await executeQuery(`
                    INSERT INTO contact_tag_relations (contact_id, tag_id)
                    VALUES (?, ?)
                    ON DUPLICATE KEY UPDATE contact_id = contact_id
                `, [contactIds[i].id, tagIds[i].id]);
                
                console.log(`✅ Etiqueta "${tagIds[i].name}" asignada a ${contactIds[i].phone_number}`);
            } catch (err) {
                console.log(`⚠️ Error asignando etiqueta:`, err.message);
            }
        }
        
        console.log('\n🎉 Datos de prueba creados exitosamente!');
        
    } catch (error) {
        console.error('❌ Error creando datos de prueba:', error.message);
    }
}

createTestData().then(() => process.exit(0));
