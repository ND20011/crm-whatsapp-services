// ============================================================================
// EJECUTAR MIGRACIÓN PARA CORREGIR TIPO DECIMAL
// ============================================================================

const { executeQuery } = require('./src/config/database-simple');

async function runDecimalMigration() {
    try {
        console.log('🔄 Iniciando migración para corregir tipo decimal...');

        // 1. Verificar tipo actual
        console.log('📋 Verificando tipo actual de auto_message_delay_hours...');
        const currentType = await executeQuery(`
            SELECT 
                COLUMN_NAME,
                DATA_TYPE,
                COLUMN_TYPE,
                IS_NULLABLE,
                COLUMN_DEFAULT,
                COLUMN_COMMENT
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'contact_tags' 
              AND COLUMN_NAME = 'auto_message_delay_hours'
        `);

        if (currentType.length > 0) {
            console.log('📊 Tipo actual:', currentType[0]);
        }

        // 2. Cambiar tipo de dato
        console.log('🔧 Cambiando tipo de INT a DECIMAL(5,2)...');
        await executeQuery(`
            ALTER TABLE contact_tags 
            MODIFY COLUMN auto_message_delay_hours DECIMAL(5,2) DEFAULT 24.0 
            COMMENT 'Horas de retraso para enviar el mensaje (acepta decimales para minutos)'
        `);

        console.log('✅ Tipo de dato cambiado exitosamente');

        // 3. Verificar cambio
        console.log('🔍 Verificando cambio aplicado...');
        const newType = await executeQuery(`
            SELECT 
                COLUMN_NAME,
                DATA_TYPE,
                COLUMN_TYPE,
                IS_NULLABLE,
                COLUMN_DEFAULT,
                COLUMN_COMMENT
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'contact_tags' 
              AND COLUMN_NAME = 'auto_message_delay_hours'
        `);

        if (newType.length > 0) {
            console.log('📊 Nuevo tipo:', newType[0]);
        }

        // 4. Probar inserción de valor decimal
        console.log('🧪 Probando inserción de valor decimal...');
        const testResult = await executeQuery(`
            SELECT 
                id, 
                name, 
                auto_message_delay_hours,
                CAST(auto_message_delay_hours AS CHAR) as delay_as_string
            FROM contact_tags 
            WHERE auto_message_delay_hours IS NOT NULL 
            LIMIT 5
        `);

        console.log('📋 Valores actuales en la tabla:');
        testResult.forEach(row => {
            console.log(`   ID: ${row.id}, Etiqueta: ${row.name}, Delay: ${row.auto_message_delay_hours} (${row.delay_as_string})`);
        });

        console.log('✅ Migración completada exitosamente');
        console.log('🎯 Ahora puedes usar valores como 0.1, 0.5, 1.5, etc. para el delay');

    } catch (error) {
        console.error('❌ Error en migración:', error.message);
        console.error('📋 Stack:', error.stack);
        throw error;
    }
}

// Ejecutar migración
if (require.main === module) {
    runDecimalMigration()
        .then(() => {
            console.log('🎉 Migración completada');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Error fatal:', error.message);
            process.exit(1);
        });
}

module.exports = { runDecimalMigration };
