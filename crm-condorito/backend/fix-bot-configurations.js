const { executeQuery } = require('./src/config/database-simple');

/**
 * Script para crear configuraciones de bot para clientes existentes que no las tienen
 */
async function fixMissingBotConfigurations() {
    console.log('🔧 Iniciando corrección de configuraciones de bot faltantes...');
    
    try {
        // Buscar clientes que no tienen configuración de bot
        const clientsWithoutBotConfig = await executeQuery(`
            SELECT c.id, c.client_code, c.company_name 
            FROM clients c 
            LEFT JOIN bot_configurations bc ON c.id = bc.client_id 
            WHERE bc.client_id IS NULL 
            AND c.company_name != 'Admin'
        `);
        
        console.log(`📋 Encontrados ${clientsWithoutBotConfig.length} clientes sin configuración de bot`);
        
        if (clientsWithoutBotConfig.length === 0) {
            console.log('✅ Todos los clientes ya tienen configuración de bot');
            return;
        }
        
        // Crear configuración para cada cliente
        for (const client of clientsWithoutBotConfig) {
            try {
                await executeQuery(`
                    INSERT INTO bot_configurations (
                        client_id, 
                        is_enabled, 
                        working_hours_start, 
                        working_hours_end, 
                        working_days,
                        auto_response_delay,
                        welcome_message,
                        fallback_message,
                        max_auto_responses_per_conversation,
                        product_search_enabled
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    client.id,
                    true,
                    '00:00:00',
                    '23:59:00',
                    JSON.stringify([0, 1, 2, 3, 4, 5, 6]), // Todos los días
                    2000,
                    `¡Hola! Bienvenido a ${client.company_name}. ¿En qué podemos ayudarte?`,
                    'Lo siento, no pude entender tu consulta. Un agente te contactará pronto.',
                    5,
                    false  // Por defecto, solo respuestas de texto
                ]);
                
                console.log(`✅ Configuración de bot creada para ${client.client_code} (${client.company_name})`);
                
            } catch (error) {
                console.error(`❌ Error creando configuración para ${client.client_code}:`, error.message);
            }
        }
        
        console.log('🎉 Corrección de configuraciones de bot completada');
        
        // Verificar que todo esté correcto
        const remainingClients = await executeQuery(`
            SELECT COUNT(*) as count
            FROM clients c 
            LEFT JOIN bot_configurations bc ON c.id = bc.client_id 
            WHERE bc.client_id IS NULL 
            AND c.company_name != 'Admin'
        `);
        
        if (remainingClients[0].count === 0) {
            console.log('✅ Verificación: Todos los clientes ahora tienen configuración de bot');
        } else {
            console.log(`⚠️ Advertencia: Aún quedan ${remainingClients[0].count} clientes sin configuración`);
        }
        
    } catch (error) {
        console.error('❌ Error en la corrección de configuraciones:', error.message);
    }
}

// Ejecutar el script
if (require.main === module) {
    fixMissingBotConfigurations()
        .then(() => {
            console.log('🏁 Script completado');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Error fatal:', error.message);
            process.exit(1);
        });
}

module.exports = { fixMissingBotConfigurations };
