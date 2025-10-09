// ============================================================================
// EJECUTAR MIGRACIÓN DE CAMPOS AUTO MESSAGE
// ============================================================================

const { executeQuery } = require('./src/config/database-simple');
const fs = require('fs');
const path = require('path');

async function runAutoMessageMigration() {
    try {
        console.log('🔄 Iniciando migración de campos auto message...');

        // Leer el archivo SQL
        const migrationPath = path.join(__dirname, 'migrations', 'add_auto_message_fields.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        // Statements individuales para ejecutar en orden
        const statements = [
            // 1. Campos para contact_tags
            "ALTER TABLE contact_tags ADD COLUMN has_auto_message BOOLEAN DEFAULT FALSE COMMENT 'Si la etiqueta tiene mensaje automático habilitado'",
            "ALTER TABLE contact_tags ADD COLUMN auto_message_template_id INT DEFAULT NULL COMMENT 'ID del template a usar (opcional)'",
            "ALTER TABLE contact_tags ADD COLUMN auto_message_delay_hours INT DEFAULT 24 COMMENT 'Horas de retraso para enviar el mensaje'",
            "ALTER TABLE contact_tags ADD COLUMN auto_message_content TEXT DEFAULT NULL COMMENT 'Contenido del mensaje si no usa template'",
            "ALTER TABLE contact_tags ADD COLUMN is_active_auto BOOLEAN DEFAULT TRUE COMMENT 'Si el mensaje automático está activo'",
            
            // 2. Foreign key
            "ALTER TABLE contact_tags ADD CONSTRAINT fk_auto_message_template FOREIGN KEY (auto_message_template_id) REFERENCES message_templates(id) ON DELETE SET NULL",
            
            // 3. Campos para scheduled_messages
            "ALTER TABLE scheduled_messages ADD COLUMN auto_generated BOOLEAN DEFAULT FALSE COMMENT 'Si el mensaje fue generado automáticamente'",
            "ALTER TABLE scheduled_messages ADD COLUMN source_tag_id INT DEFAULT NULL COMMENT 'ID de la etiqueta que generó el mensaje'",
            "ALTER TABLE scheduled_messages ADD COLUMN source_contact_id INT DEFAULT NULL COMMENT 'ID del contacto para el que se generó'",
            
            // 4. Índices
            "CREATE INDEX idx_contact_tags_auto_message ON contact_tags (client_id, has_auto_message)",
            "CREATE INDEX idx_scheduled_messages_auto ON scheduled_messages (auto_generated, source_tag_id, status)"
        ];

        console.log(`📄 Ejecutando ${statements.length} statements...`);

        // Ejecutar cada statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            try {
                console.log(`${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`);
                await executeQuery(statement);
                console.log(`✅ Statement ${i + 1} ejecutado correctamente`);
            } catch (error) {
                if (error.message.includes('Duplicate column name') || 
                    error.message.includes('Duplicate key name') ||
                    error.message.includes('already exists')) {
                    console.log(`⚠️  Statement ${i + 1} ya existía, saltando...`);
                } else {
                    console.error(`❌ Error en statement ${i + 1}:`, error.message);
                    console.error(`Statement completo: ${statement}`);
                    throw error;
                }
            }
        }

        // Verificar que los campos se agregaron correctamente
        console.log('\n🔍 Verificando campos agregados...');
        
        const contactTagsFields = await executeQuery(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'contact_tags' 
                AND COLUMN_NAME LIKE '%auto%'
        `);

        const scheduledMessagesFields = await executeQuery(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'scheduled_messages' 
                AND (COLUMN_NAME LIKE '%auto%' OR COLUMN_NAME LIKE '%source%')
        `);

        console.log('\n📊 Campos agregados a contact_tags:');
        console.table(contactTagsFields);

        console.log('\n📊 Campos agregados a scheduled_messages:');
        console.table(scheduledMessagesFields);

        console.log('\n🎉 ¡Migración completada exitosamente!');
        console.log('\n📋 Próximos pasos:');
        console.log('   1. Reiniciar el servidor backend');
        console.log('   2. Continuar con desarrollo del AutoMessageService');

    } catch (error) {
        console.error('❌ Error ejecutando migración:', error);
        process.exit(1);
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    runAutoMessageMigration()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('❌ Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { runAutoMessageMigration };
