/**
 * 🔧 Script para agregar columnas de tracking de tokens a la tabla clients
 */

const { executeQuery } = require('./src/config/database-simple');

async function addTokenTrackingColumns() {
    try {
        console.log('🔄 Agregando columnas de tracking de tokens...');

        // Verificar si las columnas ya existen
        const columns = await executeQuery('DESCRIBE clients');
        const columnNames = columns.map(col => col.Field);
        
        console.log('📋 Columnas existentes:', columnNames);

        const newColumns = [
            'monthly_token_limit',
            'current_token_usage', 
            'token_usage_reset_date'
        ];

        const missingColumns = newColumns.filter(col => !columnNames.includes(col));

        if (missingColumns.length === 0) {
            console.log('✅ Todas las columnas de tokens ya existen');
            return;
        }

        console.log('⚡ Agregando columnas faltantes:', missingColumns);

        // Agregar monthly_token_limit
        if (missingColumns.includes('monthly_token_limit')) {
            await executeQuery(`
                ALTER TABLE clients 
                ADD COLUMN monthly_token_limit INT DEFAULT 100000 
                COMMENT 'Límite mensual de tokens de IA (input + output)'
            `);
            console.log('✅ Agregada columna: monthly_token_limit');
        }

        // Agregar current_token_usage
        if (missingColumns.includes('current_token_usage')) {
            await executeQuery(`
                ALTER TABLE clients 
                ADD COLUMN current_token_usage INT DEFAULT 0 
                COMMENT 'Uso actual de tokens en el mes'
            `);
            console.log('✅ Agregada columna: current_token_usage');
        }

        // Agregar token_usage_reset_date
        if (missingColumns.includes('token_usage_reset_date')) {
            await executeQuery(`
                ALTER TABLE clients 
                ADD COLUMN token_usage_reset_date DATE DEFAULT (DATE_FORMAT(NOW(), '%Y-%m-01')) 
                COMMENT 'Fecha de reset del contador mensual de tokens'
            `);
            console.log('✅ Agregada columna: token_usage_reset_date');
        }

        // Verificar que se agregaron correctamente
        const updatedColumns = await executeQuery('DESCRIBE clients');
        const updatedColumnNames = updatedColumns.map(col => col.Field);
        
        console.log('📊 Verificación - Nuevas columnas agregadas:');
        newColumns.forEach(col => {
            const exists = updatedColumnNames.includes(col);
            console.log(`   ${exists ? '✅' : '❌'} ${col}: ${exists ? 'Existe' : 'No existe'}`);
        });

        // Mostrar algunos clientes para verificar
        const clients = await executeQuery(`
            SELECT 
                client_code,
                monthly_bot_limit,
                current_bot_usage,
                monthly_token_limit,
                current_token_usage,
                token_usage_reset_date
            FROM clients 
            LIMIT 3
        `);

        console.log('\n📋 Muestra de clientes con nuevas columnas:');
        clients.forEach(client => {
            console.log(`   📊 ${client.client_code}:`);
            console.log(`      Bot: ${client.current_bot_usage}/${client.monthly_bot_limit} mensajes`);
            console.log(`      Tokens: ${client.current_token_usage}/${client.monthly_token_limit} tokens`);
            console.log(`      Reset: ${client.token_usage_reset_date}`);
        });

        console.log('\n🎉 Columnas de tracking de tokens agregadas exitosamente!');

    } catch (error) {
        console.error('❌ Error agregando columnas de tokens:', error.message);
        console.error('❌ Stack trace:', error.stack);
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    addTokenTrackingColumns().then(() => {
        console.log('✅ Script completado');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Error en script:', error);
        process.exit(1);
    });
}

module.exports = addTokenTrackingColumns;
