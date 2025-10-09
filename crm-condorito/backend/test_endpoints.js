const express = require('express');
const { executeQuery } = require('./src/config/database');

const app = express();

// Test endpoint directo para templates
app.get('/test-templates', async (req, res) => {
    try {
        console.log('🧪 Testing templates endpoint...');
        
        // Query simple y directo
        const templates = await executeQuery('SELECT * FROM message_templates WHERE client_id = ? LIMIT 10', [1]);
        
        // Procesar variables JSON
        const processedTemplates = templates.map(template => {
            if (template.variables) {
                try {
                    template.variables = JSON.parse(template.variables);
                } catch (e) {
                    template.variables = [];
                }
            }
            return template;
        });
        
        res.json({
            success: true,
            message: '✅ Templates funcionando',
            count: templates.length,
            data: processedTemplates
        });
        
    } catch (error) {
        console.error('❌ Error en test templates:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Test endpoint directo para contactos
app.get('/test-contacts', async (req, res) => {
    try {
        console.log('🧪 Testing contacts endpoint...');
        
        const contacts = await executeQuery('SELECT * FROM contacts WHERE client_id = ? LIMIT 10', [1]);
        
        res.json({
            success: true,
            message: '✅ Contactos funcionando',
            count: contacts.length,
            data: contacts
        });
        
    } catch (error) {
        console.error('❌ Error en test contacts:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Test endpoint para etiquetas
app.get('/test-tags', async (req, res) => {
    try {
        console.log('🧪 Testing tags endpoint...');
        
        const tags = await executeQuery('SELECT * FROM contact_tags WHERE client_id = ? LIMIT 10', [1]);
        
        res.json({
            success: true,
            message: '✅ Etiquetas funcionando',
            count: tags.length,
            data: tags
        });
        
    } catch (error) {
        console.error('❌ Error en test tags:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.listen(3002, () => {
    console.log('🧪 Test endpoints running on http://localhost:3002');
    console.log('🎯 Endpoints disponibles:');
    console.log('   GET /test-templates');
    console.log('   GET /test-contacts');
    console.log('   GET /test-tags');
});

module.exports = app;
