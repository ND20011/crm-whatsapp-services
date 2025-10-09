const { executeQuery, testConnection } = require('./src/config/database');

async function createMissingTables() {
    try {
        console.log('🔗 Probando conexión...');
        await testConnection();
        console.log('✅ Conexión exitosa');

        // Verificar qué tablas existen
        const existingTables = await executeQuery(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE()
        `);
        
        const existingTableNames = existingTables.map(t => t.table_name || t.TABLE_NAME);
        console.log('📋 Tablas existentes:', existingTableNames);

        // Tablas que necesitamos
        const requiredTables = [
            'clients', 'whatsapp_sessions', 'bot_configurations',
            'contacts', 'contact_tags', 'contact_tag_relations',
            'conversations', 'messages', 'message_templates', 'bulk_messages'
        ];

        const missingTables = requiredTables.filter(table => !existingTableNames.includes(table));
        console.log('❌ Tablas faltantes:', missingTables);

        if (missingTables.length === 0) {
            console.log('✅ Todas las tablas ya existen');
            return;
        }

        // Agregar campos faltantes a clients si existe
        if (existingTableNames.includes('clients')) {
            console.log('🔧 Verificando campos en tabla clients...');
            try {
                await executeQuery(`
                    ALTER TABLE clients 
                    ADD COLUMN IF NOT EXISTS monthly_bot_limit INT DEFAULT 2500 COMMENT 'Límite mensual de respuestas automáticas del bot',
                    ADD COLUMN IF NOT EXISTS current_bot_usage INT DEFAULT 0 COMMENT 'Uso actual del bot en el mes',
                    ADD COLUMN IF NOT EXISTS bot_usage_reset_date DATE DEFAULT (DATE_FORMAT(NOW(), '%Y-%m-01')) COMMENT 'Fecha de reset del contador mensual'
                `);
                console.log('✅ Campos de bot quota agregados a clients');
            } catch (err) {
                if (!err.message.includes('Duplicate column')) {
                    console.log('⚠️  Error agregando campos a clients:', err.message);
                }
            }
        }

        // Agregar campo faltante a bot_configurations si existe
        if (existingTableNames.includes('bot_configurations')) {
            console.log('🔧 Verificando campos en tabla bot_configurations...');
            try {
                await executeQuery(`
                    ALTER TABLE bot_configurations 
                    ADD COLUMN IF NOT EXISTS product_search_enabled BOOLEAN DEFAULT FALSE COMMENT 'Habilita búsqueda de productos (0=solo texto, 1=con productos)'
                `);
                console.log('✅ Campo product_search_enabled agregado a bot_configurations');
            } catch (err) {
                if (!err.message.includes('Duplicate column')) {
                    console.log('⚠️  Error agregando campo a bot_configurations:', err.message);
                }
            }
        }

        // Crear solo la tabla más importante que falta: bulk_messages
        if (missingTables.includes('bulk_messages')) {
            console.log('🚀 Creando tabla bulk_messages...');
            await executeQuery(`
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
                    INDEX idx_client_id (client_id),
                    INDEX idx_status (status),
                    INDEX idx_scheduled_at (scheduled_at),
                    INDEX idx_created_at (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('✅ Tabla bulk_messages creada');
        }

        // Crear contacts si falta
        if (missingTables.includes('contacts')) {
            console.log('🚀 Creando tabla contacts...');
            await executeQuery(`
                CREATE TABLE contacts (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    client_id INT NOT NULL,
                    phone_number VARCHAR(50) NOT NULL,
                    name VARCHAR(255) DEFAULT NULL,
                    custom_name VARCHAR(255) DEFAULT NULL,
                    profile_picture_url VARCHAR(500) DEFAULT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    last_seen TIMESTAMP NULL DEFAULT NULL,
                    comments TEXT DEFAULT NULL,
                    metadata JSON DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                    UNIQUE KEY unique_client_phone (client_id, phone_number),
                    INDEX idx_client_id (client_id),
                    INDEX idx_phone_number (phone_number),
                    INDEX idx_name (name),
                    INDEX idx_is_active (is_active)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('✅ Tabla contacts creada');
        }

        // Crear message_templates si falta
        if (missingTables.includes('message_templates')) {
            console.log('🚀 Creando tabla message_templates...');
            await executeQuery(`
                CREATE TABLE message_templates (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    client_id INT NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    content TEXT NOT NULL,
                    variables JSON DEFAULT NULL,
                    category VARCHAR(100) DEFAULT 'general',
                    is_active BOOLEAN DEFAULT TRUE,
                    usage_count INT DEFAULT 0,
                    last_used TIMESTAMP NULL DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                    INDEX idx_client_id (client_id),
                    INDEX idx_name (name),
                    INDEX idx_category (category),
                    INDEX idx_is_active (is_active)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('✅ Tabla message_templates creada');
        }

        console.log('🎉 ¡Migración completada exitosamente!');
        
    } catch (error) {
        console.error('❌ Error en migración:', error.message);
        process.exit(1);
    }
}

createMissingTables();
