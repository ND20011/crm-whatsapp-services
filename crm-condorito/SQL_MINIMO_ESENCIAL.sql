-- ============================================================================
-- 🚀 SQL MÍNIMO ESENCIAL - CRM CONDORITO
-- ============================================================================
-- Ejecuta SOLO estos comandos en tu base de datos MySQL
-- ============================================================================

-- ✅ 1. AGREGAR CAMPOS DE BOT QUOTA A CLIENTS (si no existen)
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS monthly_bot_limit INT DEFAULT 2500 COMMENT 'Límite mensual de respuestas automáticas del bot',
ADD COLUMN IF NOT EXISTS current_bot_usage INT DEFAULT 0 COMMENT 'Uso actual del bot en el mes',
ADD COLUMN IF NOT EXISTS bot_usage_reset_date DATE DEFAULT (DATE_FORMAT(NOW(), '%Y-%m-01')) COMMENT 'Fecha de reset del contador mensual';

-- ✅ 2. AGREGAR CAMPO DE BÚSQUEDA DE PRODUCTOS A BOT_CONFIGURATIONS (si no existe)
ALTER TABLE bot_configurations 
ADD COLUMN IF NOT EXISTS product_search_enabled BOOLEAN DEFAULT FALSE COMMENT 'Habilita búsqueda de productos (0=solo texto, 1=con productos)';

-- ✅ 3. TABLA CONTACTS (NUEVA - ETAPA 3)
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ✅ 4. TABLA CONTACT_TAGS (NUEVA - ETAPA 3)
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ✅ 5. TABLA CONTACT_TAG_RELATIONS (NUEVA - ETAPA 3)
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ✅ 6. TABLA MESSAGE_TEMPLATES (NUEVA - ETAPA 4)
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ✅ 7. TABLA BULK_MESSAGES (NUEVA - ETAPA 4)
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 📊 DATOS DE PRUEBA MÍNIMOS
-- ============================================================================

-- Obtener ID del cliente demo existente
SET @client_id = (SELECT id FROM clients WHERE client_code = 'CLI001' LIMIT 1);

-- Crear etiquetas de ejemplo (solo si el cliente existe)
INSERT IGNORE INTO contact_tags (client_id, name, color, description) 
SELECT @client_id, 'VIP', '#FFD700', 'Clientes VIP con descuentos especiales'
WHERE @client_id IS NOT NULL;

INSERT IGNORE INTO contact_tags (client_id, name, color, description) 
SELECT @client_id, 'Potencial', '#28A745', 'Clientes potenciales'
WHERE @client_id IS NOT NULL;

-- Crear templates de ejemplo (solo si el cliente existe)
INSERT IGNORE INTO message_templates (client_id, name, content, variables, category, is_active) 
SELECT @client_id, 'Bienvenida', 'Hola {nombre}! Bienvenido a {empresa}. ¿En qué podemos ayudarte?', '["nombre", "empresa"]', 'saludo', TRUE
WHERE @client_id IS NOT NULL;

INSERT IGNORE INTO message_templates (client_id, name, content, variables, category, is_active) 
SELECT @client_id, 'Promoción', '🎉 ¡Oferta especial para {nombre}! {descuento}% de descuento en {producto}', '["nombre", "descuento", "producto"]', 'promocion', TRUE
WHERE @client_id IS NOT NULL;

-- Crear contactos de ejemplo (solo si el cliente existe)
INSERT IGNORE INTO contacts (client_id, phone_number, name, custom_name, comments) 
SELECT @client_id, '5491123456789', 'Juan Pérez', 'Juancito', 'Cliente VIP desde 2020'
WHERE @client_id IS NOT NULL;

INSERT IGNORE INTO contacts (client_id, phone_number, name, custom_name, comments) 
SELECT @client_id, '5491987654321', 'María García', 'Mari', 'Interesada en productos orgánicos'
WHERE @client_id IS NOT NULL;

-- ============================================================================
-- ✅ VERIFICACIÓN FINAL
-- ============================================================================

-- Mostrar resumen de tablas creadas
SELECT 
    'CONFIGURACIÓN MÍNIMA COMPLETADA' as status,
    COUNT(DISTINCT table_name) as nuevas_tablas_creadas
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
AND table_name IN ('contacts', 'contact_tags', 'contact_tag_relations', 'message_templates', 'bulk_messages');

-- Mostrar datos de prueba creados
SELECT 
    (SELECT COUNT(*) FROM contact_tags WHERE client_id = @client_id) as etiquetas_creadas,
    (SELECT COUNT(*) FROM message_templates WHERE client_id = @client_id) as templates_creados,
    (SELECT COUNT(*) FROM contacts WHERE client_id = @client_id) as contactos_creados;

-- Verificar configuración del bot
SELECT 
    client_code,
    monthly_bot_limit,
    current_bot_usage,
    (SELECT product_search_enabled FROM bot_configurations WHERE client_id = clients.id) as product_search_enabled
FROM clients 
WHERE client_code = 'CLI001';

SELECT '🎉 ¡LISTO PARA TESTING!' as mensaje;
