const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * 🔧 Script específico para corregir el JSON de working_days
 */

async function fixJSONWorkingDays() {
    let connection;
    
    try {
        console.log('🔄 Conectando a la base de datos...');
        
        const dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'crm_condorito',
            charset: 'utf8mb4'
        };

        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Conectado a la base de datos');

        // Obtener todas las configuraciones
        const [configs] = await connection.execute(`
            SELECT id, working_days FROM ai_configurations
        `);
        
        console.log(`📊 Configuraciones a revisar: ${configs.length}`);
        
        for (const config of configs) {
            console.log(`\n🔍 Revisando config ID ${config.id}:`);
            console.log(`   Raw working_days: "${config.working_days}"`);
            console.log(`   Type: ${typeof config.working_days}`);
            
            let isValid = false;
            try {
                if (config.working_days) {
                    const parsed = JSON.parse(config.working_days);
                    console.log(`   ✅ JSON válido:`, parsed);
                    isValid = true;
                }
            } catch (error) {
                console.log(`   ❌ JSON inválido: ${error.message}`);
            }
            
            if (!isValid) {
                const validJSON = '[0,1,2,3,4,5,6]';
                console.log(`   🔧 Actualizando a: ${validJSON}`);
                
                await connection.execute(`
                    UPDATE ai_configurations 
                    SET working_days = ? 
                    WHERE id = ?
                `, [validJSON, config.id]);
                
                console.log(`   ✅ Actualizado correctamente`);
            }
        }

        // Verificar resultados finales
        console.log('\n🔍 Verificación final...');
        const [finalConfigs] = await connection.execute(`
            SELECT id, working_days FROM ai_configurations
        `);
        
        let allValid = true;
        for (const config of finalConfigs) {
            try {
                const parsed = JSON.parse(config.working_days);
                console.log(`   ✅ Config ${config.id}: JSON válido - ${JSON.stringify(parsed)}`);
            } catch (error) {
                console.log(`   ❌ Config ${config.id}: JSON inválido - "${config.working_days}"`);
                allValid = false;
            }
        }
        
        if (allValid) {
            console.log('\n🎉 ¡Todos los JSON están válidos!');
        } else {
            console.log('\n⚠️ Algunos JSON siguen siendo inválidos');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Conexión cerrada');
        }
    }
}

fixJSONWorkingDays();
