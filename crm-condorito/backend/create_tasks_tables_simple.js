// ============================================================================
// SCRIPT DE MIGRACIÓN SIMPLIFICADO - MÓDULO TAREAS Y RECORDATORIOS
// ============================================================================

const { executeQuery, testConnection } = require('./src/config/database-simple');

async function createTasksTables() {
    try {
        console.log('🚀 INICIANDO MIGRACIÓN - MÓDULO TAREAS Y RECORDATORIOS\n');
        
        // 1. Verificar conexión a la base de datos
        console.log('🔍 Verificando conexión a la base de datos...');
        await testConnection();
        console.log('✅ Conexión a la base de datos exitosa\n');
        
        // 2. Crear tabla tasks
        console.log('📊 Creando tabla tasks...');
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS tasks (
                id INT PRIMARY KEY AUTO_INCREMENT,
                client_id INT NOT NULL,
                
                -- INFORMACIÓN BÁSICA
                title VARCHAR(255) NOT NULL COMMENT 'Título de la tarea',
                description TEXT DEFAULT NULL COMMENT 'Descripción detallada',
                priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium' COMMENT 'Prioridad de la tarea',
                
                -- CATEGORIZACIÓN
                category ENUM('meeting', 'call', 'follow_up', 'reminder', 'task', 'other') DEFAULT 'task' COMMENT 'Categoría de la tarea',
                tags JSON DEFAULT NULL COMMENT 'Etiquetas personalizadas',
                
                -- FECHAS Y TIEMPO
                due_date DATETIME NOT NULL COMMENT 'Fecha y hora de vencimiento',
                reminder_datetime DATETIME DEFAULT NULL COMMENT 'Fecha y hora del recordatorio',
                estimated_duration INT DEFAULT NULL COMMENT 'Duración estimada en minutos',
                
                -- CONTACTO RELACIONADO
                related_contact_id INT DEFAULT NULL COMMENT 'ID del contacto relacionado',
                related_phone VARCHAR(50) DEFAULT NULL COMMENT 'Teléfono del contacto (backup)',
                
                -- ESTADO Y PROGRESO
                status ENUM('pending', 'in_progress', 'completed', 'cancelled', 'overdue') DEFAULT 'pending' COMMENT 'Estado actual',
                completion_percentage INT DEFAULT 0 COMMENT 'Porcentaje de completitud (0-100)',
                completed_at DATETIME DEFAULT NULL COMMENT 'Fecha y hora de completitud',
                
                -- RECURRENCIA SIMPLE
                is_recurring BOOLEAN DEFAULT FALSE COMMENT 'Si la tarea es recurrente',
                recurrence_pattern JSON DEFAULT NULL COMMENT 'Patrón de recurrencia (tipo, intervalo, fin)',
                parent_task_id INT DEFAULT NULL COMMENT 'ID de tarea padre si es recurrente',
                
                -- EXPORTACIÓN GOOGLE (SIMPLIFICADO)
                last_exported_to_google DATETIME DEFAULT NULL COMMENT 'Última vez exportada a Google',
                google_export_count INT DEFAULT 0 COMMENT 'Número de veces exportada',
                
                -- METADATOS
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de actualización',
                
                -- RELACIONES FORÁNEAS
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                FOREIGN KEY (related_contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
                FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                
                -- ÍNDICES OPTIMIZADOS
                INDEX idx_client_id (client_id),
                INDEX idx_due_date (due_date),
                INDEX idx_status (status),
                INDEX idx_priority (priority),
                INDEX idx_category (category),
                INDEX idx_reminder_datetime (reminder_datetime),
                INDEX idx_recurring (is_recurring),
                INDEX idx_parent_task (parent_task_id),
                INDEX idx_created_at (created_at),
                INDEX idx_completion (status, due_date),
                INDEX idx_client_status (client_id, status),
                INDEX idx_client_due (client_id, due_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            COMMENT='Tabla principal de tareas y recordatorios'
        `);
        console.log('✅ Tabla tasks creada correctamente');
        
        // 3. Crear tabla task_reminders
        console.log('📊 Creando tabla task_reminders...');
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS task_reminders (
                id INT PRIMARY KEY AUTO_INCREMENT,
                task_id INT NOT NULL,
                
                -- CONFIGURACIÓN DEL RECORDATORIO
                reminder_type ENUM('notification', 'whatsapp', 'email') NOT NULL COMMENT 'Tipo de recordatorio',
                reminder_phone VARCHAR(20) NULL COMMENT 'Teléfono específico para enviar el recordatorio (opcional)',
                reminder_datetime DATETIME NOT NULL COMMENT 'Fecha y hora del recordatorio',
                message_content TEXT DEFAULT NULL COMMENT 'Contenido personalizado del mensaje',
                
                -- ESTADO DEL RECORDATORIO
                status ENUM('pending', 'sent', 'failed') DEFAULT 'pending' COMMENT 'Estado del recordatorio',
                sent_at DATETIME DEFAULT NULL COMMENT 'Fecha y hora de envío',
                error_message TEXT DEFAULT NULL COMMENT 'Mensaje de error si falló',
                
                -- METADATOS
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación',
                
                -- RELACIONES FORÁNEAS
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                
                -- ÍNDICES OPTIMIZADOS
                INDEX idx_task_id (task_id),
                INDEX idx_reminder_datetime (reminder_datetime),
                INDEX idx_status (status),
                INDEX idx_type (reminder_type),
                INDEX idx_pending_reminders (status, reminder_datetime),
                INDEX idx_task_status (task_id, status),
                INDEX idx_task_reminders_phone (reminder_phone)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            COMMENT='Recordatorios asociados a tareas'
        `);
        console.log('✅ Tabla task_reminders creada correctamente');
        
        // 4. Crear tabla google_calendar_tokens
        console.log('📊 Creando tabla google_calendar_tokens...');
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS google_calendar_tokens (
                id INT PRIMARY KEY AUTO_INCREMENT,
                client_id INT NOT NULL,
                
                -- TOKENS DE GOOGLE OAUTH
                access_token TEXT DEFAULT NULL COMMENT 'Token de acceso de Google',
                refresh_token TEXT DEFAULT NULL COMMENT 'Token de refresh de Google',
                token_expires_at DATETIME DEFAULT NULL COMMENT 'Fecha de expiración del access token',
                
                -- ESTADO DE CONEXIÓN SIMPLE
                is_connected BOOLEAN DEFAULT FALSE COMMENT 'Si está conectado a Google Calendar',
                last_export_at DATETIME DEFAULT NULL COMMENT 'Última exportación realizada',
                total_exports INT DEFAULT 0 COMMENT 'Total de exportaciones realizadas',
                
                -- CONFIGURACIÓN
                calendar_id VARCHAR(255) DEFAULT 'primary' COMMENT 'ID del calendario de Google a usar',
                
                -- METADATOS
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de actualización',
                
                -- RELACIONES FORÁNEAS
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                
                -- ÍNDICES Y RESTRICCIONES
                UNIQUE KEY unique_client_google (client_id),
                INDEX idx_connected (is_connected),
                INDEX idx_expires (token_expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            COMMENT='Tokens OAuth para integración con Google Calendar'
        `);
        console.log('✅ Tabla google_calendar_tokens creada correctamente');
        
        // 5. Verificar que las tablas se crearon correctamente
        console.log('\n🔍 Verificando tablas creadas...');
        const createdTables = await verifyTablesCreated();
        
        if (createdTables.length === 3) {
            console.log('✅ Todas las tablas fueron creadas exitosamente:');
            createdTables.forEach(table => {
                console.log(`   ✅ ${table.TABLE_NAME} - ${table.TABLE_COMMENT}`);
            });
        } else {
            console.log('⚠️  Problema: Se esperaban 3 tablas, se encontraron:', createdTables.length);
        }
        
        // 6. Verificar índices
        console.log('\n🔍 Verificando índices creados...');
        const indexes = await verifyIndexesCreated();
        console.log(`✅ Se crearon ${indexes.length} índices en total`);
        
        // 7. Ejecutar verificaciones de integridad
        console.log('\n🔍 Verificando integridad referencial...');
        await verifyReferentialIntegrity();
        console.log('✅ Integridad referencial verificada');
        
        console.log('\n🎉 ¡MIGRACIÓN COMPLETADA EXITOSAMENTE!');
        console.log('📋 Próximos pasos:');
        console.log('   1. Integrar rutas en app.js');
        console.log('   2. Inicializar TaskProcessor en app.js');
        console.log('   3. Agregar navegación en el frontend');
        console.log('   4. Probar endpoints desde el frontend');
        
        return {
            success: true,
            tablesCreated: createdTables.length,
            indexesCreated: indexes.length
        };
        
    } catch (error) {
        console.error('\n❌ ERROR EN LA MIGRACIÓN:', error.message);
        console.error('📋 Para reversar la migración, ejecuta:');
        console.error('   DROP TABLE IF EXISTS task_reminders;');
        console.error('   DROP TABLE IF EXISTS google_calendar_tokens;');
        console.error('   DROP TABLE IF EXISTS tasks;');
        
        throw error;
    }
}

/**
 * Verificar que las tablas se crearon correctamente
 */
async function verifyTablesCreated() {
    try {
        const query = `
            SELECT 
                TABLE_NAME,
                TABLE_ROWS,
                TABLE_COMMENT
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME IN ('tasks', 'task_reminders', 'google_calendar_tokens')
            ORDER BY TABLE_NAME
        `;
        
        const results = await executeQuery(query);
        return results;
        
    } catch (error) {
        console.error('Error verificando tablas creadas:', error.message);
        return [];
    }
}

/**
 * Verificar que los índices se crearon correctamente
 */
async function verifyIndexesCreated() {
    try {
        const query = `
            SELECT 
                TABLE_NAME,
                INDEX_NAME,
                COLUMN_NAME,
                SEQ_IN_INDEX,
                NON_UNIQUE
            FROM INFORMATION_SCHEMA.STATISTICS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME IN ('tasks', 'task_reminders', 'google_calendar_tokens')
              AND INDEX_NAME != 'PRIMARY'
            ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
        `;
        
        const results = await executeQuery(query);
        return results;
        
    } catch (error) {
        console.error('Error verificando índices:', error.message);
        return [];
    }
}

/**
 * Verificar integridad referencial
 */
async function verifyReferentialIntegrity() {
    try {
        // Verificar que las tablas referenciadas existen
        const requiredTables = ['clients', 'contacts'];
        
        for (const tableName of requiredTables) {
            const query = `
                SELECT COUNT(*) as count 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = DATABASE() 
                  AND TABLE_NAME = ?
            `;
            
            const result = await executeQuery(query, [tableName]);
            
            if (result[0].count === 0) {
                throw new Error(`Tabla requerida '${tableName}' no existe`);
            }
        }
        
        console.log('   ✅ Todas las tablas referenciadas existen');
        
        // Verificar foreign keys
        const fkQuery = `
            SELECT 
                TABLE_NAME,
                COLUMN_NAME,
                REFERENCED_TABLE_NAME,
                REFERENCED_COLUMN_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME IN ('tasks', 'task_reminders', 'google_calendar_tokens')
              AND REFERENCED_TABLE_NAME IS NOT NULL
        `;
        
        const foreignKeys = await executeQuery(fkQuery);
        console.log(`   ✅ Se verificaron ${foreignKeys.length} foreign keys`);
        
        return true;
        
    } catch (error) {
        console.error('Error verificando integridad referencial:', error.message);
        throw error;
    }
}

// ============================================================================
// EJECUCIÓN
// ============================================================================

if (require.main === module) {
    createTasksTables()
        .then(result => {
            console.log('\n✅ Migración exitosa:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Error en migración:', error.message);
            process.exit(1);
        });
}

module.exports = {
    createTasksTables,
    verifyTablesCreated,
    verifyIndexesCreated,
    verifyReferentialIntegrity
};
