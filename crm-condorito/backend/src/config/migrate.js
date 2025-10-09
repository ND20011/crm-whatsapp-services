const { executeQuery, testConnection, tableExists, getDatabaseInfo } = require('./database');
require('dotenv').config();

// ============================================================================
// SCRIPT DE MIGRACIÓN - CRM CONDORITO
// ============================================================================

/**
 * Definición de todas las tablas del sistema
 */
const tables = [
    {
        name: 'clients',
        sql: `
            CREATE TABLE clients (
                id INT PRIMARY KEY AUTO_INCREMENT,
                client_code VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                company_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) DEFAULT NULL,
                phone VARCHAR(50) DEFAULT NULL,
                status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
                monthly_bot_limit INT DEFAULT 2500 COMMENT 'Límite mensual de respuestas automáticas del bot',
                current_bot_usage INT DEFAULT 0 COMMENT 'Uso actual del bot en el mes',
                bot_usage_reset_date DATE DEFAULT (DATE_FORMAT(NOW(), '%Y-%m-01')) COMMENT 'Fecha de reset del contador mensual',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_client_code (client_code),
                INDEX idx_status (status),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `
    },
    {
        name: 'whatsapp_sessions',
        sql: `
            CREATE TABLE whatsapp_sessions (
                id INT PRIMARY KEY AUTO_INCREMENT,
                client_id INT NOT NULL,
                phone_number VARCHAR(50) DEFAULT NULL,
                session_data JSON DEFAULT NULL,
                qr_code TEXT DEFAULT NULL,
                status ENUM('connecting', 'connected', 'disconnected', 'error') DEFAULT 'disconnected',
                connected_at TIMESTAMP NULL DEFAULT NULL,
                disconnected_at TIMESTAMP NULL DEFAULT NULL,
                last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                retry_count INT DEFAULT 0,
                error_message TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                INDEX idx_client_id (client_id),
                INDEX idx_phone_number (phone_number),
                INDEX idx_status (status),
                INDEX idx_last_activity (last_activity)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `
    },
    {
        name: 'contacts',
        sql: `
            CREATE TABLE contacts (
                id INT PRIMARY KEY AUTO_INCREMENT,
                client_id INT NOT NULL,
                phone_number VARCHAR(50) NOT NULL,
                name VARCHAR(255) DEFAULT NULL,
                custom_name VARCHAR(255) DEFAULT NULL,
                profile_pic_url TEXT DEFAULT NULL,
                comments TEXT DEFAULT NULL,
                is_blocked BOOLEAN DEFAULT FALSE,
                last_message_at TIMESTAMP NULL DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                UNIQUE KEY unique_client_phone (client_id, phone_number),
                INDEX idx_client_id (client_id),
                INDEX idx_phone_number (phone_number),
                INDEX idx_is_blocked (is_blocked),
                INDEX idx_last_message_at (last_message_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `
    },
    {
        name: 'contact_tags',
        sql: `
            CREATE TABLE contact_tags (
                id INT PRIMARY KEY AUTO_INCREMENT,
                client_id INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                color VARCHAR(7) DEFAULT '#007bff',
                description TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                UNIQUE KEY unique_client_tag (client_id, name),
                INDEX idx_client_id (client_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `
    },
    {
        name: 'contact_tag_relations',
        sql: `
            CREATE TABLE contact_tag_relations (
                contact_id INT NOT NULL,
                tag_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                PRIMARY KEY (contact_id, tag_id),
                FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES contact_tags(id) ON DELETE CASCADE,
                INDEX idx_contact_id (contact_id),
                INDEX idx_tag_id (tag_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `
    },
    {
        name: 'conversations',
        sql: `
            CREATE TABLE conversations (
                id INT PRIMARY KEY AUTO_INCREMENT,
                client_id INT NOT NULL,
                contact_id INT NOT NULL,
                last_message_at TIMESTAMP NULL DEFAULT NULL,
                unread_count INT DEFAULT 0,
                is_bot_disabled BOOLEAN DEFAULT FALSE,
                is_archived BOOLEAN DEFAULT FALSE,
                is_pinned BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
                UNIQUE KEY unique_client_contact (client_id, contact_id),
                INDEX idx_client_id (client_id),
                INDEX idx_contact_id (contact_id),
                INDEX idx_last_message_at (last_message_at),
                INDEX idx_unread_count (unread_count),
                INDEX idx_is_bot_disabled (is_bot_disabled),
                INDEX idx_is_archived (is_archived)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `
    },
    {
        name: 'messages',
        sql: `
            CREATE TABLE messages (
                id INT PRIMARY KEY AUTO_INCREMENT,
                conversation_id INT NOT NULL,
                message_id VARCHAR(255) UNIQUE NOT NULL,
                sender_type ENUM('contact', 'client', 'bot') NOT NULL,
                message_type ENUM('text', 'image', 'document', 'audio', 'video', 'sticker', 'location', 'contact_card') DEFAULT 'text',
                content TEXT DEFAULT NULL,
                media_url TEXT DEFAULT NULL,
                file_name VARCHAR(255) DEFAULT NULL,
                file_size INT DEFAULT NULL,
                mime_type VARCHAR(100) DEFAULT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                from_me BOOLEAN NOT NULL,
                is_from_bot BOOLEAN DEFAULT FALSE,
                quoted_message_id VARCHAR(255) DEFAULT NULL,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                delivered_at TIMESTAMP NULL DEFAULT NULL,
                read_at TIMESTAMP NULL DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
                INDEX idx_conversation_id (conversation_id),
                INDEX idx_message_id (message_id),
                INDEX idx_sender_type (sender_type),
                INDEX idx_message_type (message_type),
                INDEX idx_is_read (is_read),
                INDEX idx_from_me (from_me),
                INDEX idx_is_from_bot (is_from_bot),
                INDEX idx_sent_at (sent_at),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `
    },
    {
        name: 'message_templates',
        sql: `
            CREATE TABLE message_templates (
                id INT PRIMARY KEY AUTO_INCREMENT,
                client_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                variables JSON DEFAULT NULL,
                category VARCHAR(100) DEFAULT 'general',
                is_active BOOLEAN DEFAULT TRUE,
                usage_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                UNIQUE KEY unique_client_template (client_id, name),
                INDEX idx_client_id (client_id),
                INDEX idx_category (category),
                INDEX idx_is_active (is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `
    },
    {
        name: 'scheduled_messages',
        sql: `
            CREATE TABLE scheduled_messages (
                id INT PRIMARY KEY AUTO_INCREMENT,
                client_id INT NOT NULL,
                contact_id INT DEFAULT NULL,
                template_id INT DEFAULT NULL,
                content TEXT NOT NULL,
                scheduled_at TIMESTAMP NOT NULL,
                sent_at TIMESTAMP NULL DEFAULT NULL,
                status ENUM('pending', 'sent', 'failed', 'cancelled') DEFAULT 'pending',
                is_bulk BOOLEAN DEFAULT FALSE,
                bulk_contacts JSON DEFAULT NULL,
                error_message TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
                FOREIGN KEY (template_id) REFERENCES message_templates(id) ON DELETE SET NULL,
                INDEX idx_client_id (client_id),
                INDEX idx_contact_id (contact_id),
                INDEX idx_scheduled_at (scheduled_at),
                INDEX idx_status (status),
                INDEX idx_is_bulk (is_bulk)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `
    },
    {
        name: 'bot_configurations',
        sql: `
            CREATE TABLE bot_configurations (
                id INT PRIMARY KEY AUTO_INCREMENT,
                client_id INT NOT NULL,
                is_enabled BOOLEAN DEFAULT TRUE,
                working_hours_start TIME DEFAULT '00:00:00',
                working_hours_end TIME DEFAULT '23:59:00',
                working_days JSON DEFAULT '[0,1,2,3,4,5,6]',
                auto_response_delay INT DEFAULT 2000,
                custom_instructions TEXT DEFAULT NULL,
                welcome_message TEXT DEFAULT NULL,
                fallback_message TEXT DEFAULT 'Lo siento, no pude entender tu consulta. Un agente te contactará pronto.',
                max_auto_responses_per_conversation INT DEFAULT 5,
                product_search_enabled BOOLEAN DEFAULT FALSE COMMENT 'Habilita búsqueda de productos (0=solo texto, 1=con productos)',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                UNIQUE KEY unique_client_bot_config (client_id),
                INDEX idx_client_id (client_id),
                INDEX idx_is_enabled (is_enabled)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `
    },
    {
        name: 'conversation_groups',
        sql: `
            CREATE TABLE conversation_groups (
                id INT PRIMARY KEY AUTO_INCREMENT,
                client_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                color VARCHAR(7) DEFAULT '#007bff',
                description TEXT DEFAULT NULL,
                sort_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                UNIQUE KEY unique_client_group (client_id, name),
                INDEX idx_client_id (client_id),
                INDEX idx_sort_order (sort_order)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `
    },
    {
        name: 'conversation_group_relations',
        sql: `
            CREATE TABLE conversation_group_relations (
                conversation_id INT NOT NULL,
                group_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                PRIMARY KEY (conversation_id, group_id),
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
                FOREIGN KEY (group_id) REFERENCES conversation_groups(id) ON DELETE CASCADE,
                INDEX idx_conversation_id (conversation_id),
                INDEX idx_group_id (group_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `
    },
    {
        name: 'bulk_messages',
        sql: `
            CREATE TABLE bulk_messages (
                id INT PRIMARY KEY AUTO_INCREMENT,
                client_id INT NOT NULL,
                campaign_name VARCHAR(255) NOT NULL,
                template_id INT DEFAULT NULL,
                content TEXT NOT NULL,
                scheduled_at TIMESTAMP NULL DEFAULT NULL,
                status ENUM('draft', 'scheduled', 'pending', 'sending', 'completed', 'failed', 'cancelled') DEFAULT 'draft',
                contact_filter JSON DEFAULT NULL,
                selected_contacts JSON DEFAULT NULL,
                total_contacts INT DEFAULT 0,
                sent_count INT DEFAULT 0,
                failed_count INT DEFAULT 0,
                success_rate DECIMAL(5,2) DEFAULT 0.00,
                started_at TIMESTAMP NULL DEFAULT NULL,
                completed_at TIMESTAMP NULL DEFAULT NULL,
                error_message TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                FOREIGN KEY (template_id) REFERENCES message_templates(id) ON DELETE SET NULL,
                INDEX idx_client_id (client_id),
                INDEX idx_status (status),
                INDEX idx_scheduled_at (scheduled_at),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `
    },
    {
        name: 'ai_suggestions',
        sql: `
            CREATE TABLE ai_suggestions (
                id INT PRIMARY KEY AUTO_INCREMENT,
                conversation_id INT NOT NULL,
                suggested_message TEXT NOT NULL,
                confidence_score DECIMAL(3,2) DEFAULT 0.00,
                context_data JSON DEFAULT NULL,
                used BOOLEAN DEFAULT FALSE,
                used_at TIMESTAMP NULL DEFAULT NULL,
                feedback ENUM('positive', 'negative', 'neutral') DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
                INDEX idx_conversation_id (conversation_id),
                INDEX idx_confidence_score (confidence_score),
                INDEX idx_used (used),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `
    }
];

// ============================================================================
// FUNCIONES DE MIGRACIÓN
// ============================================================================

/**
 * Crear una tabla específica
 * @param {Object} table - Definición de la tabla
 * @returns {Promise<boolean>} True si se creó exitosamente
 */
async function createTable(table) {
    try {
        console.log(`📝 Creando tabla: ${table.name}`);
        
        // Verificar si la tabla ya existe
        const exists = await tableExists(table.name);
        if (exists) {
            console.log(`⚠️  Tabla ${table.name} ya existe, saltando...`);
            return true;
        }
        
        // Crear la tabla
        await executeQuery(table.sql);
        console.log(`✅ Tabla ${table.name} creada exitosamente`);
        return true;
        
    } catch (error) {
        console.error(`❌ Error creando tabla ${table.name}:`, error.message);
        throw error;
    }
}

/**
 * Eliminar una tabla específica
 * @param {string} tableName - Nombre de la tabla
 * @returns {Promise<boolean>} True si se eliminó exitosamente
 */
async function dropTable(tableName) {
    try {
        console.log(`🗑️  Eliminando tabla: ${tableName}`);
        
        const exists = await tableExists(tableName);
        if (!exists) {
            console.log(`⚠️  Tabla ${tableName} no existe, saltando...`);
            return true;
        }
        
        await executeQuery(`DROP TABLE ${tableName}`);
        console.log(`✅ Tabla ${tableName} eliminada exitosamente`);
        return true;
        
    } catch (error) {
        console.error(`❌ Error eliminando tabla ${tableName}:`, error.message);
        throw error;
    }
}

/**
 * Ejecutar migración completa
 * @param {boolean} force - Forzar recreación de tablas existentes
 * @returns {Promise<boolean>} True si la migración fue exitosa
 */
async function runMigration(force = false) {
    console.log(`
🚀 ====================================
   INICIANDO MIGRACIÓN DE BASE DE DATOS
🚀 ====================================
    `);
    
    try {
        // Verificar conexión
        const connected = await testConnection();
        if (!connected) {
            throw new Error('No se pudo conectar a la base de datos');
        }
        
        // Mostrar información de la BD
        const dbInfo = await getDatabaseInfo();
        console.log('📊 Información de la base de datos:');
        console.log(`   - Versión MySQL: ${dbInfo.version}`);
        console.log(`   - Base de datos: ${dbInfo.current_database}`);
        console.log(`   - Usuario: ${dbInfo.current_user}`);
        console.log(`   - Charset: ${dbInfo.charset}`);
        console.log(`   - Collation: ${dbInfo.collation}`);
        console.log('');
        
        // Si force=true, eliminar tablas en orden inverso
        if (force) {
            console.log('🔄 Modo FORCE activado - Eliminando tablas existentes...');
            const reversedTables = [...tables].reverse();
            
            for (const table of reversedTables) {
                await dropTable(table.name);
            }
            console.log('');
        }
        
        // Crear tablas en orden
        console.log('📝 Creando tablas...');
        let createdCount = 0;
        let skippedCount = 0;
        
        for (const table of tables) {
            const exists = await tableExists(table.name);
            if (exists && !force) {
                console.log(`⚠️  Tabla ${table.name} ya existe, saltando...`);
                skippedCount++;
            } else {
                await createTable(table);
                createdCount++;
            }
        }
        
        console.log(`
✅ ====================================
   MIGRACIÓN COMPLETADA EXITOSAMENTE
✅ ====================================
📊 Tablas creadas: ${createdCount}
⚠️  Tablas existentes: ${skippedCount}
📈 Total de tablas: ${tables.length}
⏰ Timestamp: ${new Date().toISOString()}
✅ ====================================
        `);
        
        return true;
        
    } catch (error) {
        console.error(`
❌ ====================================
   ERROR EN LA MIGRACIÓN
❌ ====================================
Error: ${error.message}
❌ ====================================
        `);
        throw error;
    }
}

/**
 * Mostrar el estado de las tablas
 * @returns {Promise<void>}
 */
async function showTableStatus() {
    console.log('📊 Estado de las tablas:');
    console.log('========================');
    
    for (const table of tables) {
        const exists = await tableExists(table.name);
        const status = exists ? '✅ Existe' : '❌ No existe';
        console.log(`${table.name.padEnd(25)} ${status}`);
    }
    
    console.log('========================');
}

// ============================================================================
// EJECUCIÓN CLI
// ============================================================================

// Si se ejecuta directamente desde línea de comandos
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    const force = args.includes('--force');
    
    (async () => {
        try {
            switch (command) {
                case 'up':
                    await runMigration(force);
                    break;
                    
                case 'down':
                    console.log('🗑️  Eliminando todas las tablas...');
                    const reversedTables = [...tables].reverse();
                    for (const table of reversedTables) {
                        await dropTable(table.name);
                    }
                    console.log('✅ Todas las tablas eliminadas');
                    break;
                    
                case 'status':
                    await showTableStatus();
                    break;
                    
                case 'reset':
                    await runMigration(true);
                    break;
                    
                default:
                    console.log(`
📖 Uso del script de migración:

   node src/config/migrate.js up [--force]     Crear tablas
   node src/config/migrate.js down             Eliminar todas las tablas
   node src/config/migrate.js reset            Eliminar y recrear todas las tablas
   node src/config/migrate.js status           Mostrar estado de las tablas
                    `);
            }
            
            process.exit(0);
            
        } catch (error) {
            console.error('❌ Error en migración:', error.message);
            process.exit(1);
        }
    })();
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    tables,
    createTable,
    dropTable,
    runMigration,
    showTableStatus
};
