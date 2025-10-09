const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * 🔧 Script para corregir problemas en la tabla ai_configurations
 * Limpia datos corruptos y establece configuraciones válidas
 */

async function fixAIConfigurations() {
    let connection;
    
    try {
        console.log('🔄 Conectando a la base de datos...');
        
        // Configuración de conexión
        const dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'crm_condorito',
            charset: 'utf8mb4'
        };

        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Conectado a la base de datos');

        // 1. Verificar datos actuales
        console.log('\n🔍 Verificando datos actuales...');
        const [currentData] = await connection.execute(`
            SELECT ac.*, c.client_code 
            FROM ai_configurations ac
            LEFT JOIN clients c ON ac.client_id = c.id
        `);
        
        console.log(`📊 Configuraciones encontradas: ${currentData.length}`);
        currentData.forEach(config => {
            console.log(`   - Cliente: ${config.client_code || 'NULL'} (ID: ${config.client_id})`);
            console.log(`     Working days: ${config.working_days}`);
            console.log(`     Business prompt: ${config.business_prompt ? 'Sí' : 'No'}`);
        });

        // 2. Limpiar configuraciones corruptas o huérfanas
        console.log('\n🧹 Limpiando configuraciones corruptas...');
        
        // Eliminar configuraciones sin cliente válido
        const [deleteResult] = await connection.execute(`
            DELETE ac FROM ai_configurations ac
            LEFT JOIN clients c ON ac.client_id = c.id
            WHERE c.id IS NULL
        `);
        console.log(`✅ Configuraciones huérfanas eliminadas: ${deleteResult.affectedRows}`);

        // 3. Corregir JSON inválido en working_days
        console.log('\n🔧 Corrigiendo working_days...');
        const [configsToFix] = await connection.execute(`
            SELECT id, working_days FROM ai_configurations
        `);
        
        for (const config of configsToFix) {
            let validWorkingDays = '[0,1,2,3,4,5,6]'; // Por defecto todos los días
            
            try {
                if (config.working_days) {
                    // Intentar parsear el JSON existente
                    JSON.parse(config.working_days);
                    console.log(`   ✅ working_days válido para config ID ${config.id}`);
                    continue; // Si es válido, no hacer nada
                }
            } catch (error) {
                console.log(`   🔧 Corrigiendo working_days inválido para config ID ${config.id}`);
            }
            
            // Actualizar con JSON válido
            await connection.execute(`
                UPDATE ai_configurations 
                SET working_days = ? 
                WHERE id = ?
            `, [validWorkingDays, config.id]);
        }

        // 4. Asegurar que todos los clientes activos tengan configuración
        console.log('\n📋 Asegurando configuraciones para todos los clientes...');
        
        const [clientsWithoutConfig] = await connection.execute(`
            SELECT c.id, c.client_code, c.company_name
            FROM clients c
            LEFT JOIN ai_configurations ac ON c.id = ac.client_id
            WHERE c.status = 'active' AND ac.id IS NULL
        `);
        
        console.log(`📊 Clientes sin configuración: ${clientsWithoutConfig.length}`);
        
        for (const client of clientsWithoutConfig) {
            console.log(`   🔧 Creando configuración para cliente: ${client.client_code}`);
            
            await connection.execute(`
                INSERT INTO ai_configurations (
                    client_id, 
                    enabled, 
                    ai_mode, 
                    business_prompt, 
                    max_tokens, 
                    temperature, 
                    max_history_messages, 
                    response_timeout, 
                    fallback_message, 
                    working_hours_enabled, 
                    working_hours_start, 
                    working_hours_end, 
                    working_days,
                    created_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `, [
                client.id,
                1, // enabled
                'prompt_only', // ai_mode
                `Sos un asistente que responde mensajes de WhatsApp de ${client.company_name}. Sé amable y profesional en todas tus respuestas.`, // business_prompt
                500, // max_tokens
                0.70, // temperature
                10, // max_history_messages
                30000, // response_timeout
                'Disculpa, no pude procesar tu mensaje en este momento. Por favor intenta de nuevo más tarde.', // fallback_message
                1, // working_hours_enabled
                '00:00', // working_hours_start
                '23:59', // working_hours_end
                '[0,1,2,3,4,5,6]' // working_days
            ]);
        }

        // 5. Verificar configuraciones finales
        console.log('\n🔍 Verificando configuraciones finales...');
        const [finalData] = await connection.execute(`
            SELECT 
                ac.id,
                c.client_code,
                c.company_name,
                ac.enabled,
                ac.ai_mode,
                LENGTH(ac.business_prompt) as prompt_length,
                ac.working_days
            FROM ai_configurations ac
            INNER JOIN clients c ON ac.client_id = c.id
            WHERE c.status = 'active'
            ORDER BY c.client_code
        `);
        
        console.log('\n📊 Configuraciones finales:');
        console.log('┌─────────────┬──────────────────────┬─────────┬─────────────┬──────────────┬──────────────┐');
        console.log('│ Cliente     │ Empresa              │ Activo  │ Modo        │ Prompt Chars │ Working Days │');
        console.log('├─────────────┼──────────────────────┼─────────┼─────────────┼──────────────┼──────────────┤');
        
        finalData.forEach(config => {
            const cliente = config.client_code.padEnd(11);
            const empresa = (config.company_name || '').substring(0, 18).padEnd(20);
            const activo = config.enabled ? '✅ Sí   ' : '❌ No   ';
            const modo = config.ai_mode.padEnd(11);
            const promptLen = String(config.prompt_length || 0).padStart(12);
            const workingDays = config.working_days ? '✅ Válido    ' : '❌ Inválido  ';
            
            console.log(`│ ${cliente} │ ${empresa} │ ${activo} │ ${modo} │ ${promptLen} │ ${workingDays} │`);
        });
        console.log('└─────────────┴──────────────────────┴─────────┴─────────────┴──────────────┴──────────────┘');

        // 6. Estadísticas finales
        const [stats] = await connection.execute(`
            SELECT 
                COUNT(*) as total_configs,
                SUM(enabled) as enabled_configs,
                COUNT(DISTINCT ai_mode) as different_modes,
                AVG(max_tokens) as avg_max_tokens,
                AVG(temperature) as avg_temperature
            FROM ai_configurations ac
            INNER JOIN clients c ON ac.client_id = c.id
            WHERE c.status = 'active'
        `);
        
        console.log('\n📈 Estadísticas finales:');
        console.log(`   - Total configuraciones: ${stats[0].total_configs}`);
        console.log(`   - Configuraciones habilitadas: ${stats[0].enabled_configs}`);
        console.log(`   - Modos diferentes: ${stats[0].different_modes}`);
        console.log(`   - Promedio max_tokens: ${Math.round(stats[0].avg_max_tokens)}`);
        console.log(`   - Promedio temperature: ${Number(stats[0].avg_temperature || 0).toFixed(2)}`);

        console.log('\n🎉 ¡Configuraciones de AI corregidas exitosamente!');
        console.log('\n📝 Próximos pasos:');
        console.log('   1. Probar endpoints de AI');
        console.log('   2. Verificar que las actualizaciones funcionen');
        console.log('   3. Implementar interfaz frontend');

    } catch (error) {
        console.error('❌ Error al corregir configuraciones de AI:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Conexión cerrada');
        }
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    fixAIConfigurations();
}

module.exports = fixAIConfigurations;
