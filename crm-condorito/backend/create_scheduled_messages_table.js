// ============================================================================
// CREAR TABLA DE MENSAJES PROGRAMADOS - CRM CONDORITO
// ============================================================================

const { executeQuery } = require('./src/config/database-simple');

async function createScheduledMessagesTable() {
    try {
        console.log('🗂️ Creando tabla scheduled_messages...');

        // Tabla principal de mensajes programados
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS scheduled_messages (
                id INT PRIMARY KEY AUTO_INCREMENT,
                client_id INT NOT NULL,
                
                -- CONFIGURACIÓN BÁSICA
                name VARCHAR(255) NOT NULL COMMENT 'Nombre descriptivo del mensaje programado',
                description TEXT DEFAULT NULL COMMENT 'Descripción opcional',
                
                -- TIPO DE ENVÍO
                send_type ENUM('individual', 'bulk_tags', 'bulk_all') NOT NULL COMMENT 'Tipo de envío',
                
                -- DESTINATARIOS
                recipient_phone VARCHAR(50) DEFAULT NULL COMMENT 'Teléfono individual (si send_type = individual)',
                recipient_contact_id INT DEFAULT NULL COMMENT 'ID del contacto individual',
                target_tag_ids JSON DEFAULT NULL COMMENT 'IDs de etiquetas para envío masivo',
                
                -- CONTENIDO DEL MENSAJE
                message_type ENUM('text', 'template') NOT NULL DEFAULT 'text',
                message_content TEXT DEFAULT NULL COMMENT 'Contenido del mensaje de texto',
                template_id INT DEFAULT NULL COMMENT 'ID del template a usar',
                template_variables JSON DEFAULT NULL COMMENT 'Variables para el template',
                
                -- PROGRAMACIÓN TEMPORAL
                scheduled_at DATETIME NOT NULL COMMENT 'Fecha y hora programada',
                timezone VARCHAR(50) DEFAULT 'America/Argentina/Buenos_Aires' COMMENT 'Zona horaria',
                
                -- RECURRENCIA
                is_recurring BOOLEAN DEFAULT FALSE COMMENT 'Si el mensaje es recurrente',
                recurrence_type ENUM('minutes', 'hours', 'days', 'weeks', 'months') DEFAULT NULL,
                recurrence_interval INT DEFAULT NULL COMMENT 'Intervalo de recurrencia',
                recurrence_end_date DATETIME DEFAULT NULL COMMENT 'Fecha de fin de recurrencia',
                max_executions INT DEFAULT NULL COMMENT 'Máximo número de ejecuciones',
                
                -- ESTADO Y CONTROL
                status ENUM('pending', 'active', 'paused', 'completed', 'cancelled', 'error') DEFAULT 'pending',
                is_active BOOLEAN DEFAULT TRUE COMMENT 'Si está activo',
                
                -- EJECUCIÓN
                next_execution DATETIME DEFAULT NULL COMMENT 'Próxima ejecución calculada',
                last_execution DATETIME DEFAULT NULL COMMENT 'Última ejecución',
                execution_count INT DEFAULT 0 COMMENT 'Número de ejecuciones realizadas',
                success_count INT DEFAULT 0 COMMENT 'Ejecuciones exitosas',
                error_count INT DEFAULT 0 COMMENT 'Ejecuciones con error',
                
                -- METADATOS
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                -- ÍNDICES Y RELACIONES
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                FOREIGN KEY (recipient_contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
                FOREIGN KEY (template_id) REFERENCES message_templates(id) ON DELETE SET NULL,
                
                INDEX idx_client_id (client_id),
                INDEX idx_status (status),
                INDEX idx_is_active (is_active),
                INDEX idx_scheduled_at (scheduled_at),
                INDEX idx_next_execution (next_execution),
                INDEX idx_send_type (send_type),
                INDEX idx_is_recurring (is_recurring),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('✅ Tabla scheduled_messages creada');

        // Tabla de historial de ejecuciones
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS scheduled_message_executions (
                id INT PRIMARY KEY AUTO_INCREMENT,
                scheduled_message_id INT NOT NULL,
                
                -- INFORMACIÓN DE EJECUCIÓN
                execution_date DATETIME NOT NULL,
                status ENUM('success', 'error', 'skipped') NOT NULL,
                
                -- RESULTADOS
                messages_sent INT DEFAULT 0 COMMENT 'Número de mensajes enviados',
                messages_failed INT DEFAULT 0 COMMENT 'Número de mensajes fallidos',
                recipients_processed INT DEFAULT 0 COMMENT 'Destinatarios procesados',
                
                -- DETALLES
                error_message TEXT DEFAULT NULL COMMENT 'Mensaje de error si falló',
                execution_time_ms INT DEFAULT NULL COMMENT 'Tiempo de ejecución en ms',
                details JSON DEFAULT NULL COMMENT 'Detalles adicionales de la ejecución',
                
                -- METADATOS
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (scheduled_message_id) REFERENCES scheduled_messages(id) ON DELETE CASCADE,
                INDEX idx_scheduled_message_id (scheduled_message_id),
                INDEX idx_execution_date (execution_date),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('✅ Tabla scheduled_message_executions creada');

        // Tabla de destinatarios específicos para mensajes programados
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS scheduled_message_recipients (
                id INT PRIMARY KEY AUTO_INCREMENT,
                scheduled_message_id INT NOT NULL,
                execution_id INT DEFAULT NULL,
                
                -- DESTINATARIO
                contact_id INT DEFAULT NULL,
                phone_number VARCHAR(50) NOT NULL,
                contact_name VARCHAR(255) DEFAULT NULL,
                
                -- ESTADO DE ENVÍO
                status ENUM('pending', 'sent', 'failed', 'skipped') DEFAULT 'pending',
                sent_at DATETIME DEFAULT NULL,
                message_id VARCHAR(255) DEFAULT NULL COMMENT 'ID del mensaje enviado por WhatsApp',
                error_message TEXT DEFAULT NULL,
                
                -- DATOS DEL MENSAJE PERSONALIZADO
                final_message_content TEXT DEFAULT NULL COMMENT 'Mensaje final después de procesar variables',
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (scheduled_message_id) REFERENCES scheduled_messages(id) ON DELETE CASCADE,
                FOREIGN KEY (execution_id) REFERENCES scheduled_message_executions(id) ON DELETE SET NULL,
                FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
                
                INDEX idx_scheduled_message_id (scheduled_message_id),
                INDEX idx_execution_id (execution_id),
                INDEX idx_contact_id (contact_id),
                INDEX idx_phone_number (phone_number),
                INDEX idx_status (status),
                INDEX idx_sent_at (sent_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('✅ Tabla scheduled_message_recipients creada');

        console.log('🎉 Sistema de mensajes programados creado exitosamente');
        console.log(`
📊 TABLAS CREADAS:
- scheduled_messages: Configuración de mensajes programados
- scheduled_message_executions: Historial de ejecuciones  
- scheduled_message_recipients: Destinatarios y estados de envío

🔧 FUNCIONALIDADES HABILITADAS:
✅ Mensajes individuales y masivos
✅ Recurrencia configurable
✅ Integración con templates
✅ Historial detallado
✅ Estados y monitoreo
✅ Soporte para zonas horarias
        `);

    } catch (error) {
        console.error('❌ Error creando tablas de mensajes programados:', error);
        throw error;
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    createScheduledMessagesTable()
        .then(() => {
            console.log('✅ Script completado');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Script falló:', error);
            process.exit(1);
        });
}

module.exports = { createScheduledMessagesTable };
