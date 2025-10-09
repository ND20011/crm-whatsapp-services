// ============================================================================
// MIGRACIÓN DE TABLA SCHEDULED_MESSAGES
// ============================================================================

const { executeQuery } = require('./src/config/database-simple');

async function migrateScheduledMessages() {
    try {
        console.log('🔄 Iniciando migración de scheduled_messages...');
        
        // Verificar estructura actual
        const currentStructure = await executeQuery('DESCRIBE scheduled_messages');
        const existingColumns = currentStructure.map(col => col.Field);
        
        console.log('📋 Columnas existentes:', existingColumns);
        
        // Definir columnas a agregar
        const columnsToAdd = [
            {
                name: 'name',
                definition: 'VARCHAR(255) NOT NULL DEFAULT "Mensaje Programado"',
                comment: 'Nombre descriptivo del mensaje programado'
            },
            {
                name: 'description',
                definition: 'TEXT DEFAULT NULL',
                comment: 'Descripción opcional'
            },
            {
                name: 'send_type',
                definition: "ENUM('individual', 'bulk_tags', 'bulk_all') NOT NULL DEFAULT 'individual'",
                comment: 'Tipo de envío'
            },
            {
                name: 'recipient_phone',
                definition: 'VARCHAR(50) DEFAULT NULL',
                comment: 'Teléfono individual'
            },
            {
                name: 'recipient_contact_id',
                definition: 'INT DEFAULT NULL',
                comment: 'ID del contacto individual'
            },
            {
                name: 'target_tag_ids',
                definition: 'JSON DEFAULT NULL',
                comment: 'IDs de etiquetas para envío masivo'
            },
            {
                name: 'message_type',
                definition: "ENUM('text', 'template') NOT NULL DEFAULT 'text'",
                comment: 'Tipo de mensaje'
            },
            {
                name: 'message_content',
                definition: 'TEXT DEFAULT NULL',
                comment: 'Contenido del mensaje de texto'
            },
            {
                name: 'timezone',
                definition: "VARCHAR(50) DEFAULT 'America/Argentina/Buenos_Aires'",
                comment: 'Zona horaria'
            },
            {
                name: 'is_recurring',
                definition: 'BOOLEAN DEFAULT FALSE',
                comment: 'Si el mensaje es recurrente'
            },
            {
                name: 'recurrence_type',
                definition: "ENUM('minutes', 'hours', 'days', 'weeks', 'months') DEFAULT NULL",
                comment: 'Tipo de recurrencia'
            },
            {
                name: 'recurrence_interval',
                definition: 'INT DEFAULT NULL',
                comment: 'Intervalo de recurrencia'
            },
            {
                name: 'recurrence_end_date',
                definition: 'DATETIME DEFAULT NULL',
                comment: 'Fecha de fin de recurrencia'
            },
            {
                name: 'max_executions',
                definition: 'INT DEFAULT NULL',
                comment: 'Máximo número de ejecuciones'
            },
            {
                name: 'next_execution',
                definition: 'DATETIME DEFAULT NULL',
                comment: 'Próxima ejecución calculada'
            },
            {
                name: 'last_execution',
                definition: 'DATETIME DEFAULT NULL',
                comment: 'Última ejecución'
            },
            {
                name: 'execution_count',
                definition: 'INT DEFAULT 0',
                comment: 'Número de ejecuciones realizadas'
            },
            {
                name: 'success_count',
                definition: 'INT DEFAULT 0',
                comment: 'Ejecuciones exitosas'
            },
            {
                name: 'error_count',
                definition: 'INT DEFAULT 0',
                comment: 'Ejecuciones con error'
            },
            {
                name: 'template_variables',
                definition: 'JSON DEFAULT NULL',
                comment: 'Variables para el template'
            }
        ];

        // Actualizar enum de status para incluir más estados
        console.log('🔄 Actualizando enum de status...');
        await executeQuery(`
            ALTER TABLE scheduled_messages 
            MODIFY COLUMN status ENUM('pending', 'active', 'paused', 'completed', 'cancelled', 'error') DEFAULT 'pending'
        `);
        console.log('✅ Enum de status actualizado');

        // Agregar columnas faltantes
        for (const column of columnsToAdd) {
            if (!existingColumns.includes(column.name)) {
                console.log(`➕ Agregando columna: ${column.name}`);
                
                try {
                    await executeQuery(`
                        ALTER TABLE scheduled_messages 
                        ADD COLUMN ${column.name} ${column.definition} COMMENT '${column.comment}'
                    `);
                    console.log(`✅ Columna '${column.name}' agregada`);
                } catch (error) {
                    console.error(`❌ Error agregando '${column.name}':`, error.message);
                }
            } else {
                console.log(`ℹ️ Columna '${column.name}' ya existe`);
            }
        }

        // Agregar índices si no existen
        console.log('🔄 Agregando índices...');
        
        const indicesToAdd = [
            'ALTER TABLE scheduled_messages ADD INDEX idx_next_execution (next_execution)',
            'ALTER TABLE scheduled_messages ADD INDEX idx_send_type (send_type)',
            'ALTER TABLE scheduled_messages ADD INDEX idx_is_recurring (is_recurring)',
            'ALTER TABLE scheduled_messages ADD INDEX idx_message_type (message_type)',
            'ALTER TABLE scheduled_messages ADD FOREIGN KEY fk_recipient_contact (recipient_contact_id) REFERENCES contacts(id) ON DELETE SET NULL',
            'ALTER TABLE scheduled_messages ADD FOREIGN KEY fk_template (template_id) REFERENCES message_templates(id) ON DELETE SET NULL'
        ];

        for (const indexSQL of indicesToAdd) {
            try {
                await executeQuery(indexSQL);
                console.log('✅ Índice agregado');
            } catch (error) {
                if (error.message.includes('Duplicate key name') || error.message.includes('already exists')) {
                    console.log('ℹ️ Índice ya existe');
                } else {
                    console.log('⚠️ Error agregando índice:', error.message);
                }
            }
        }

        // Verificar estructura final
        console.log('\n📋 Verificando estructura final...');
        const finalStructure = await executeQuery('DESCRIBE scheduled_messages');
        console.log(`✅ Tabla migrada exitosamente con ${finalStructure.length} columnas`);
        
        // Migrar datos existentes si los hay
        const existingData = await executeQuery('SELECT COUNT(*) as count FROM scheduled_messages');
        if (existingData[0].count > 0) {
            console.log(`\n🔄 Migrando ${existingData[0].count} registros existentes...`);
            
            // Actualizar registros existentes con valores por defecto
            await executeQuery(`
                UPDATE scheduled_messages 
                SET 
                    name = COALESCE(name, CONCAT('Mensaje ', id)),
                    send_type = COALESCE(send_type, IF(is_bulk = 1, 'bulk_all', 'individual')),
                    message_type = COALESCE(message_type, 'text'),
                    message_content = COALESCE(message_content, content),
                    next_execution = COALESCE(next_execution, scheduled_at),
                    recipient_contact_id = COALESCE(recipient_contact_id, contact_id)
                WHERE name IS NULL OR send_type IS NULL OR message_type IS NULL
            `);
            
            console.log('✅ Datos existentes migrados');
        }

        console.log('\n🎉 Migración completada exitosamente!');
        
    } catch (error) {
        console.error('❌ Error en migración:', error);
        throw error;
    }
}

// Ejecutar migración
if (require.main === module) {
    migrateScheduledMessages()
        .then(() => {
            console.log('✅ Script completado');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Script falló:', error);
            process.exit(1);
        });
}

module.exports = { migrateScheduledMessages };
