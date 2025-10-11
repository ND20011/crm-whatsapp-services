const { executeQuery } = require('./src/config/database');

async function diagnose() {
    try {
        console.log('🔍 DIAGNÓSTICO DE TABLAS - CRM CONDORITO\n');
        
        // Verificar todas las tablas existentes
        const allTables = await executeQuery('SHOW TABLES');
        const tableNames = allTables.map(t => Object.values(t)[0]);
        
        console.log('📋 TABLAS EXISTENTES:');
        tableNames.forEach(name => console.log('  ✅', name));
        
        console.log('\n🎯 VERIFICANDO TABLAS PREMIUM:');
        const premiumTables = ['contacts', 'contact_tags', 'contact_tag_relations', 'message_templates', 'bulk_messages'];
        
        const missingTables = [];
        for (const table of premiumTables) {
            const exists = tableNames.includes(table);
            console.log('  ' + (exists ? '✅' : '❌'), table, exists ? '(EXISTE)' : '(FALTA)');
            if (!exists) missingTables.push(table);
        }
        
        console.log('\n🔧 VERIFICANDO CAMPOS NUEVOS:');
        
        // Verificar campos en clients
        const clientFields = await executeQuery('DESCRIBE clients');
        const clientFieldNames = clientFields.map(f => f.Field);
        
        const requiredClientFields = ['monthly_bot_limit', 'current_bot_usage', 'bot_usage_reset_date'];
        const missingClientFields = [];
        requiredClientFields.forEach(field => {
            const exists = clientFieldNames.includes(field);
            console.log('  ' + (exists ? '✅' : '❌'), 'clients.' + field, exists ? '(EXISTE)' : '(FALTA)');
            if (!exists) missingClientFields.push(field);
        });
        
        // Verificar campos en bot_configurations
        const botFields = await executeQuery('DESCRIBE bot_configurations');
        const botFieldNames = botFields.map(f => f.Field);
        
        const productSearchExists = botFieldNames.includes('product_search_enabled');
        console.log('  ' + (productSearchExists ? '✅' : '❌'), 'bot_configurations.product_search_enabled', productSearchExists ? '(EXISTE)' : '(FALTA)');
        
        console.log('\n📊 RESUMEN FINAL:');
        console.log('  🗄️  Tablas faltantes:', missingTables.length, 'de', premiumTables.length);
        console.log('  🔧 Campos faltantes en clients:', missingClientFields.length);
        console.log('  🤖 Campo product_search_enabled:', productSearchExists ? 'OK' : 'FALTA');
        
        if (missingTables.length > 0) {
            console.log('\n🚀 TABLAS A CREAR:');
            missingTables.forEach(table => console.log('  📝', table));
        }
        
        if (missingTables.length === 0 && missingClientFields.length === 0 && productSearchExists) {
            console.log('\n🎉 ¡TODO ESTÁ LISTO! Todas las tablas y campos existen.');
        } else {
            console.log('\n⚡ SIGUIENTE PASO: Crear las tablas/campos faltantes');
        }
        
    } catch (error) {
        console.error('❌ Error en diagnóstico:', error.message);
    }
}

diagnose();
