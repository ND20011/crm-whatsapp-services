const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * 🧠 Script para crear tabla de configuraciones de AI
 * Permite a cada cliente configurar su propio prompt de negocio y parámetros de IA
 */

async function createAIConfigurationsTable() {
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

        // Crear tabla ai_configurations
        console.log('🔄 Creando tabla ai_configurations...');
        
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS ai_configurations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                client_id INT NOT NULL,
                enabled TINYINT(1) DEFAULT 1 COMMENT 'Si la IA está habilitada para este cliente',
                ai_mode ENUM('prompt_only', 'database_search') DEFAULT 'prompt_only' COMMENT 'Modo de operación de la IA',
                business_prompt TEXT COMMENT 'Prompt personalizado con información del negocio',
                max_tokens INT DEFAULT 500 COMMENT 'Máximo número de tokens en la respuesta',
                temperature DECIMAL(3,2) DEFAULT 0.70 COMMENT 'Creatividad de la respuesta (0.0 a 1.0)',
                max_history_messages INT DEFAULT 10 COMMENT 'Máximo de mensajes de historial a considerar',
                response_timeout INT DEFAULT 30000 COMMENT 'Timeout en milisegundos para respuesta',
                fallback_message TEXT COMMENT 'Mensaje por defecto si falla la IA',
                working_hours_enabled TINYINT(1) DEFAULT 1 COMMENT 'Si respeta horarios de trabajo',
                working_hours_start TIME DEFAULT '00:00' COMMENT 'Hora de inicio de atención',
                working_hours_end TIME DEFAULT '23:59' COMMENT 'Hora de fin de atención',
                working_days JSON COMMENT 'Días de la semana activos (0=domingo, 6=sábado)',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                UNIQUE KEY unique_client_ai_config (client_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Configuraciones de IA personalizadas por cliente';
        `;

        await connection.execute(createTableSQL);
        console.log('✅ Tabla ai_configurations creada correctamente');

        // Insertar configuración por defecto para clientes existentes
        console.log('🔄 Insertando configuraciones por defecto...');
        
        const insertDefaultConfigsSQL = `
            INSERT IGNORE INTO ai_configurations (
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
                working_days
            )
            SELECT 
                c.id,
                1,
                'prompt_only',
                'Sos un asistente que responde mensajes de WhatsApp de un negocio. Sé amable y profesional en todas tus respuestas.',
                500,
                0.70,
                10,
                30000,
                'Disculpa, no pude procesar tu mensaje en este momento. Por favor intenta de nuevo más tarde.',
                1,
                '00:00',
                '23:59',
                '[0,1,2,3,4,5,6]'
            FROM clients c
            WHERE NOT EXISTS (
                SELECT 1 FROM ai_configurations ac WHERE ac.client_id = c.id
            );
        `;

        const result = await connection.execute(insertDefaultConfigsSQL);
        console.log(`✅ Configuraciones por defecto insertadas: ${result[0].affectedRows} registros`);

        // Crear índices adicionales para optimización
        console.log('🔄 Creando índices adicionales...');
        
        const createIndexesSQL = [
            'CREATE INDEX idx_ai_config_enabled ON ai_configurations(enabled)',
            'CREATE INDEX idx_ai_config_mode ON ai_configurations(ai_mode)',
            'CREATE INDEX idx_ai_config_client_enabled ON ai_configurations(client_id, enabled)'
        ];

        for (const indexSQL of createIndexesSQL) {
            try {
                await connection.execute(indexSQL);
            } catch (indexError) {
                // Ignorar si el índice ya existe
                if (!indexError.message.includes('Duplicate key name')) {
                    console.warn(`⚠️ Warning creating index: ${indexError.message}`);
                }
            }
        }
        
        console.log('✅ Índices creados correctamente');

        // Verificar la estructura creada
        console.log('🔄 Verificando estructura de la tabla...');
        
        const [columns] = await connection.execute('DESCRIBE ai_configurations');
        console.log('📋 Columnas de ai_configurations:');
        columns.forEach(col => {
            console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
        });

        // Mostrar estadísticas
        const [stats] = await connection.execute(`
            SELECT 
                COUNT(*) as total_configs,
                SUM(enabled) as enabled_configs,
                COUNT(DISTINCT ai_mode) as different_modes
            FROM ai_configurations
        `);
        
        console.log('📊 Estadísticas:');
        console.log(`   - Total configuraciones: ${stats[0].total_configs}`);
        console.log(`   - Configuraciones habilitadas: ${stats[0].enabled_configs}`);
        console.log(`   - Modos diferentes: ${stats[0].different_modes}`);

        console.log('🎉 ¡Tabla ai_configurations creada exitosamente!');
        console.log('');
        console.log('📝 Próximos pasos:');
        console.log('   1. Crear endpoints para gestionar configuraciones');
        console.log('   2. Implementar interfaz en el frontend');
        console.log('   3. Probar el sistema con diferentes prompts');

    } catch (error) {
        console.error('❌ Error al crear la tabla ai_configurations:', error.message);
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
    createAIConfigurationsTable();
}

module.exports = createAIConfigurationsTable;
