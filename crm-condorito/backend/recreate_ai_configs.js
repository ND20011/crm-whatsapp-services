const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * 🔧 Script para recrear completamente las configuraciones de AI
 * Elimina y recrea las configuraciones con datos limpios
 */

async function recreateAIConfigs() {
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

        // 1. Obtener clientes activos
        console.log('\n🔍 Obteniendo clientes activos...');
        const [clients] = await connection.execute(`
            SELECT id, client_code, company_name 
            FROM clients 
            WHERE status = 'active'
            ORDER BY client_code
        `);
        
        console.log(`📊 Clientes activos encontrados: ${clients.length}`);
        clients.forEach(client => {
            console.log(`   - ${client.client_code}: ${client.company_name}`);
        });

        // 2. Eliminar configuraciones existentes
        console.log('\n🗑️ Eliminando configuraciones existentes...');
        const [deleteResult] = await connection.execute(`
            DELETE FROM ai_configurations
        `);
        console.log(`✅ Configuraciones eliminadas: ${deleteResult.affectedRows}`);

        // 3. Crear configuraciones limpias para cada cliente
        console.log('\n🔧 Creando configuraciones limpias...');
        
        for (const client of clients) {
            console.log(`   📝 Creando config para: ${client.client_code}`);
            
            const businessPrompt = `Sos un asistente que responde mensajes de WhatsApp de ${client.company_name}. 

INSTRUCCIONES:
- Siempre sé amable y profesional
- Proporciona información útil sobre el negocio
- Si no sabes algo específico, sugiere contactar directamente
- Mantén las respuestas concisas pero informativas`;

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
                client.id,                          // client_id
                1,                                  // enabled
                'prompt_only',                      // ai_mode
                businessPrompt,                     // business_prompt
                500,                                // max_tokens
                0.7,                                // temperature
                10,                                 // max_history_messages
                30000,                              // response_timeout
                'Disculpa, no pude procesar tu mensaje en este momento. Por favor intenta de nuevo más tarde.', // fallback_message
                1,                                  // working_hours_enabled
                '00:00',                            // working_hours_start
                '23:59',                            // working_hours_end
                JSON.stringify([0,1,2,3,4,5,6]),    // working_days (JSON válido)
            ]);
            
            console.log(`   ✅ Config creada para: ${client.client_code}`);
        }

        // 4. Verificar configuraciones creadas
        console.log('\n🔍 Verificando configuraciones creadas...');
        const [newConfigs] = await connection.execute(`
            SELECT 
                ac.id,
                c.client_code,
                c.company_name,
                ac.enabled,
                ac.ai_mode,
                LENGTH(ac.business_prompt) as prompt_length,
                ac.max_tokens,
                ac.temperature,
                ac.working_days
            FROM ai_configurations ac
            INNER JOIN clients c ON ac.client_id = c.id
            ORDER BY c.client_code
        `);
        
        console.log('\n📊 Configuraciones creadas:');
        console.log('┌─────────────┬──────────────────────┬─────────┬─────────────┬──────────────┬────────────┬─────────────┬──────────────┐');
        console.log('│ Cliente     │ Empresa              │ Activo  │ Modo        │ Prompt Chars │ Max Tokens │ Temperature │ Working Days │');
        console.log('├─────────────┼──────────────────────┼─────────┼─────────────┼──────────────┼────────────┼─────────────┼──────────────┤');
        
        let allValid = true;
        for (const config of newConfigs) {
            const cliente = config.client_code.padEnd(11);
            const empresa = (config.company_name || '').substring(0, 18).padEnd(20);
            const activo = config.enabled ? '✅ Sí   ' : '❌ No   ';
            const modo = config.ai_mode.padEnd(11);
            const promptLen = String(config.prompt_length || 0).padStart(12);
            const maxTokens = String(config.max_tokens).padStart(8);
            const temperature = Number(config.temperature || 0.7).toFixed(1).padStart(9);
            
            // Verificar JSON
            let workingDaysStatus;
            try {
                const parsed = JSON.parse(config.working_days);
                workingDaysStatus = '✅ Válido    ';
            } catch (error) {
                workingDaysStatus = '❌ Inválido  ';
                allValid = false;
            }
            
            console.log(`│ ${cliente} │ ${empresa} │ ${activo} │ ${modo} │ ${promptLen} │ ${maxTokens} │ ${temperature} │ ${workingDaysStatus} │`);
        }
        console.log('└─────────────┴──────────────────────┴─────────┴─────────────┴──────────────┴────────────┴─────────────┴──────────────┘');

        if (allValid) {
            console.log('\n🎉 ¡Todas las configuraciones son válidas!');
        } else {
            console.log('\n⚠️ Algunas configuraciones tienen problemas');
        }

        // 5. Estadísticas finales
        const [stats] = await connection.execute(`
            SELECT 
                COUNT(*) as total_configs,
                SUM(enabled) as enabled_configs
            FROM ai_configurations
        `);
        
        console.log('\n📈 Estadísticas:');
        console.log(`   - Total configuraciones: ${stats[0].total_configs}`);
        console.log(`   - Configuraciones habilitadas: ${stats[0].enabled_configs}`);

        console.log('\n🎉 ¡Configuraciones de AI recreadas exitosamente!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Conexión cerrada');
        }
    }
}

recreateAIConfigs();
