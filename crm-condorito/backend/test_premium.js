const express = require('express');
const { executeQuery } = require('./src/config/database');

const app = express();

// Test endpoint para verificar funcionalidades premium
app.get('/test-premium', async (req, res) => {
    try {
        console.log('🧪 Testing funcionalidades premium...');
        
        // Test 1: Templates
        const templates = await executeQuery('SELECT * FROM message_templates WHERE client_id = 1 LIMIT 5');
        console.log('✅ Templates:', templates.length);
        
        // Test 2: Contactos 
        const contacts = await executeQuery('SELECT * FROM contacts WHERE client_id = 1 LIMIT 5');
        console.log('✅ Contactos:', contacts.length);
        
        // Test 3: Etiquetas
        const tags = await executeQuery('SELECT * FROM contact_tags WHERE client_id = 1 LIMIT 5');
        console.log('✅ Etiquetas:', tags.length);
        
        // Test 4: Bulk messages table
        const bulkCount = await executeQuery('SELECT COUNT(*) as total FROM bulk_messages');
        console.log('✅ Tabla bulk_messages existe:', bulkCount[0].total >= 0);
        
        res.json({
            success: true,
            message: '🎉 ¡Funcionalidades Premium Activas!',
            data: {
                templates: templates.length,
                contacts: contacts.length,
                tags: tags.length,
                bulk_messages_table: 'exists',
                templates_sample: templates.slice(0, 2),
                contacts_sample: contacts.slice(0, 2),
                tags_sample: tags.slice(0, 3)
            }
        });
        
    } catch (error) {
        console.error('❌ Error en test:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.listen(3001, () => {
    console.log('🧪 Test server running on http://localhost:3001/test-premium');
});

// Auto-test
setTimeout(async () => {
    try {
        const response = await fetch('http://localhost:3001/test-premium');
        const result = await response.json();
        console.log('\n🎯 RESULTADO DEL TEST:');
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('❌ Error en auto-test:', error.message);
        process.exit(1);
    }
}, 1000);
