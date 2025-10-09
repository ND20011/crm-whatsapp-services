const { executeQuery } = require('./src/config/database');

async function createPremiumTables() {
    try {
        console.log('🚀 CREANDO TABLAS PREMIUM - CRM CONDORITO\n');
        
        // 1. Crear tabla contacts
        console.log('📝 Creando tabla contacts...');
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS contacts (
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

        // 2. Crear tabla contact_tags
        console.log('📝 Creando tabla contact_tags...');
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS contact_tags (
                id INT PRIMARY KEY AUTO_INCREMENT,
                client_id INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                color VARCHAR(7) DEFAULT '#007bff',
                description TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                UNIQUE KEY unique_client_tag_name (client_id, name),
                INDEX idx_client_id (client_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Tabla contact_tags creada');

        // 3. Crear tabla contact_tag_relations
        console.log('📝 Creando tabla contact_tag_relations...');
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS contact_tag_relations (
                id INT PRIMARY KEY AUTO_INCREMENT,
                contact_id INT NOT NULL,
                tag_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES contact_tags(id) ON DELETE CASCADE,
                UNIQUE KEY unique_contact_tag (contact_id, tag_id),
                INDEX idx_contact_id (contact_id),
                INDEX idx_tag_id (tag_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Tabla contact_tag_relations creada');

        // 4. Crear tabla message_templates
        console.log('📝 Creando tabla message_templates...');
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS message_templates (
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

        // 5. Crear tabla bulk_messages
        console.log('📝 Creando tabla bulk_messages...');
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS bulk_messages (
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

        // 6. Insertar datos de prueba
        console.log('\n📊 Insertando datos de prueba...');
        
        // Obtener client_id de demo
        const client = await executeQuery('SELECT id FROM clients WHERE client_code = ?', ['demo']);
        if (client.length === 0) {
            throw new Error('Cliente demo no encontrado');
        }
        const clientId = client[0].id;
        console.log('🔍 Cliente demo ID:', clientId);

        // Insertar etiquetas de ejemplo
        await executeQuery(`
            INSERT IGNORE INTO contact_tags (client_id, name, color, description) VALUES
            (?, 'VIP', '#FFD700', 'Clientes VIP con descuentos especiales'),
            (?, 'Potencial', '#28A745', 'Clientes potenciales'),
            (?, 'Frecuente', '#007BFF', 'Clientes que compran frecuentemente')
        `, [clientId, clientId, clientId]);
        console.log('✅ Etiquetas de ejemplo creadas');

        // Insertar templates de ejemplo
        await executeQuery(`
            INSERT IGNORE INTO message_templates (client_id, name, content, variables, category, is_active) VALUES
            (?, 'Bienvenida', 'Hola {nombre}! Bienvenido a {empresa}. ¿En qué podemos ayudarte?', '["nombre", "empresa"]', 'saludo', TRUE),
            (?, 'Promoción', '🎉 ¡Oferta especial para {nombre}! {descuento}% de descuento en {producto}', '["nombre", "descuento", "producto"]', 'promocion', TRUE),
            (?, 'Despedida', 'Gracias por contactarnos, {nombre}. ¡Que tengas un buen día!', '["nombre"]', 'despedida', TRUE)
        `, [clientId, clientId, clientId]);
        console.log('✅ Templates de ejemplo creados');

        // Insertar contactos de ejemplo
        await executeQuery(`
            INSERT IGNORE INTO contacts (client_id, phone_number, name, custom_name, comments) VALUES
            (?, '5491123456789', 'Juan Pérez', 'Juancito', 'Cliente VIP desde 2020'),
            (?, '5491987654321', 'María García', 'Mari', 'Interesada en productos orgánicos'),
            (?, '5491555111222', 'Pedro López', 'Pedrito', 'Cliente frecuente')
        `, [clientId, clientId, clientId]);
        console.log('✅ Contactos de ejemplo creados');

        console.log('\n🎉 ¡FUNCIONALIDADES PREMIUM ACTIVADAS!');
        console.log('✅ 5 tablas premium creadas');
        console.log('✅ 3 etiquetas de ejemplo');
        console.log('✅ 3 templates de ejemplo');
        console.log('✅ 3 contactos de ejemplo');
        console.log('\n🚀 ¡Listo para testing!');
        
    } catch (error) {
        console.error('❌ Error creando tablas:', error.message);
        process.exit(1);
    }
}

createPremiumTables();
