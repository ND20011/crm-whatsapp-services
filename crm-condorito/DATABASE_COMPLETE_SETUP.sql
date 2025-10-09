-- ============================================================================
-- 🗄️ CONFIGURACIÓN COMPLETA DE BASE DE DATOS - CRM CONDORITO
-- ============================================================================
-- Ejecuta estos comandos SQL en tu base de datos MySQL
-- ============================================================================

-- 📋 TABLA: clients (con campos de bot quota)
CREATE TABLE IF NOT EXISTS clients (
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

-- 📱 TABLA: whatsapp_sessions
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
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
    INDEX idx_status (status),
    INDEX idx_phone_number (phone_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 🤖 TABLA: bot_configurations (con product_search_enabled)
CREATE TABLE IF NOT EXISTS bot_configurations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    working_hours_start TIME DEFAULT '00:00:00',
    working_hours_end TIME DEFAULT '23:59:00',
    working_days JSON DEFAULT '["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]',
    auto_response_delay INT DEFAULT 2000,
    welcome_message TEXT DEFAULT 'Hola! ¿En qué puedo ayudarte?',
    product_search_enabled BOOLEAN DEFAULT FALSE COMMENT 'Habilita búsqueda de productos (0=solo texto, 1=con productos)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    UNIQUE KEY unique_client_bot_config (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 👥 TABLA: contacts (NUEVA - ETAPA 3)
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
    INDEX idx_custom_name (custom_name),
    INDEX idx_is_active (is_active),
    INDEX idx_last_seen (last_seen),
    INDEX idx_created_at (created_at),
    FULLTEXT ft_search (name, custom_name, phone_number, comments)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 🏷️ TABLA: contact_tags (NUEVA - ETAPA 3)
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
    INDEX idx_client_id (client_id),
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 🔗 TABLA: contact_tag_relations (NUEVA - ETAPA 3)
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

-- 💬 TABLA: conversations
CREATE TABLE IF NOT EXISTS conversations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    contact_phone VARCHAR(50) NOT NULL,
    contact_name VARCHAR(255) DEFAULT NULL,
    last_message_id VARCHAR(255) DEFAULT NULL,
    last_message_content TEXT DEFAULT NULL,
    last_message_timestamp TIMESTAMP NULL DEFAULT NULL,
    last_message_from_me BOOLEAN DEFAULT FALSE,
    unread_count INT DEFAULT 0,
    is_group BOOLEAN DEFAULT FALSE,
    group_name VARCHAR(255) DEFAULT NULL,
    group_participants JSON DEFAULT NULL,
    status ENUM('active', 'archived', 'blocked') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    UNIQUE KEY unique_client_contact (client_id, contact_phone),
    INDEX idx_client_id (client_id),
    INDEX idx_contact_phone (contact_phone),
    INDEX idx_last_message_timestamp (last_message_timestamp),
    INDEX idx_status (status),
    INDEX idx_is_group (is_group)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 📨 TABLA: messages
CREATE TABLE IF NOT EXISTS messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    conversation_id INT NOT NULL,
    message_id VARCHAR(255) UNIQUE NOT NULL,
    whatsapp_message_id VARCHAR(255) DEFAULT NULL,
    sender_phone VARCHAR(50) NOT NULL,
    recipient_phone VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    message_type ENUM('text', 'image', 'audio', 'video', 'document', 'location', 'contact_card', 'sticker') DEFAULT 'text',
    media_url VARCHAR(500) DEFAULT NULL,
    media_filename VARCHAR(255) DEFAULT NULL,
    media_mimetype VARCHAR(100) DEFAULT NULL,
    media_size INT DEFAULT NULL,
    from_me BOOLEAN DEFAULT FALSE,
    is_bot_response BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivery_status ENUM('pending', 'sent', 'delivered', 'read', 'failed') DEFAULT 'pending',
    error_message TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    INDEX idx_client_id (client_id),
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_message_id (message_id),
    INDEX idx_whatsapp_message_id (whatsapp_message_id),
    INDEX idx_sender_phone (sender_phone),
    INDEX idx_recipient_phone (recipient_phone),
    INDEX idx_timestamp (timestamp),
    INDEX idx_from_me (from_me),
    INDEX idx_is_bot_response (is_bot_response),
    INDEX idx_delivery_status (delivery_status),
    INDEX idx_created_at (created_at),
    FULLTEXT ft_content (content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 📝 TABLA: message_templates (NUEVA - ETAPA 4)
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
    INDEX idx_is_active (is_active),
    INDEX idx_usage_count (usage_count),
    INDEX idx_last_used (last_used),
    INDEX idx_created_at (created_at),
    FULLTEXT ft_template_search (name, content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 📤 TABLA: bulk_messages (NUEVA - ETAPA 4)
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
    FOREIGN KEY (template_id) REFERENCES message_templates(id) ON DELETE SET NULL,
    INDEX idx_client_id (client_id),
    INDEX idx_status (status),
    INDEX idx_scheduled_at (scheduled_at),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 📅 TABLA: scheduled_messages
CREATE TABLE IF NOT EXISTS scheduled_messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    conversation_id INT NOT NULL,
    content TEXT NOT NULL,
    media_url VARCHAR(500) DEFAULT NULL,
    scheduled_at TIMESTAMP NOT NULL,
    status ENUM('pending', 'sent', 'failed', 'cancelled') DEFAULT 'pending',
    sent_at TIMESTAMP NULL DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    INDEX idx_client_id (client_id),
    INDEX idx_scheduled_at (scheduled_at),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 📊 TABLA: conversation_groups
CREATE TABLE IF NOT EXISTS conversation_groups (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    color VARCHAR(7) DEFAULT '#007bff',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    INDEX idx_client_id (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 🔗 TABLA: conversation_group_relations
CREATE TABLE IF NOT EXISTS conversation_group_relations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    group_id INT NOT NULL,
    conversation_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (group_id) REFERENCES conversation_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    UNIQUE KEY unique_group_conversation (group_id, conversation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 🤖 TABLA: ai_suggestions
CREATE TABLE IF NOT EXISTS ai_suggestions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    conversation_id INT NOT NULL,
    message_id INT DEFAULT NULL,
    suggestion_text TEXT NOT NULL,
    confidence_score DECIMAL(3,2) DEFAULT NULL,
    suggestion_type ENUM('response', 'action', 'info') DEFAULT 'response',
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    INDEX idx_client_id (client_id),
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_suggestion_type (suggestion_type),
    INDEX idx_is_used (is_used)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 📊 DATOS INICIALES - CLIENTE DEMO
-- ============================================================================

-- Insertar cliente demo
INSERT INTO clients (
    client_code, 
    password, 
    company_name, 
    email, 
    phone, 
    status,
    monthly_bot_limit,
    current_bot_usage,
    bot_usage_reset_date
) VALUES (
    'CLI001', 
    '$2b$10$8K1p/a9UOGVkltruLRwU.eP9KKNI2Q8b4pqKVe1wlMfLVhg5TuPtu', 
    'Empresa Demo CRM', 
    'demo@condorestudio.com.ar', 
    '+5491150239962', 
    'active',
    2500,
    0,
    DATE_FORMAT(NOW(), '%Y-%m-01')
) ON DUPLICATE KEY UPDATE 
    monthly_bot_limit = 2500,
    current_bot_usage = 0,
    bot_usage_reset_date = DATE_FORMAT(NOW(), '%Y-%m-01');

-- Obtener el ID del cliente demo
SET @client_id = (SELECT id FROM clients WHERE client_code = 'CLI001');

-- Configuración del bot para el cliente demo
INSERT INTO bot_configurations (
    client_id, 
    is_enabled, 
    working_hours_start, 
    working_hours_end, 
    working_days, 
    auto_response_delay, 
    welcome_message,
    product_search_enabled
) VALUES (
    @client_id, 
    TRUE, 
    '00:00:00', 
    '23:59:00', 
    '["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]', 
    2000, 
    'Hola! ¿En qué puedo ayudarte?',
    FALSE
) ON DUPLICATE KEY UPDATE 
    working_hours_start = '00:00:00',
    working_hours_end = '23:59:00',
    product_search_enabled = FALSE;

-- Crear etiquetas de ejemplo
INSERT INTO contact_tags (client_id, name, color, description) VALUES
(@client_id, 'VIP', '#FFD700', 'Clientes VIP con descuentos especiales'),
(@client_id, 'Potencial', '#28A745', 'Clientes potenciales'),
(@client_id, 'Frecuente', '#007BFF', 'Clientes que compran frecuentemente')
ON DUPLICATE KEY UPDATE 
    color = VALUES(color),
    description = VALUES(description);

-- Crear templates de ejemplo
INSERT INTO message_templates (client_id, name, content, variables, category, is_active) VALUES
(@client_id, 'Bienvenida', 'Hola {nombre}! Bienvenido a {empresa}. ¿En qué podemos ayudarte?', '["nombre", "empresa"]', 'saludo', TRUE),
(@client_id, 'Promoción', '🎉 ¡Oferta especial para {nombre}! {descuento}% de descuento en {producto}', '["nombre", "descuento", "producto"]', 'promocion', TRUE),
(@client_id, 'Despedida', 'Gracias por contactarnos, {nombre}. ¡Que tengas un buen día!', '["nombre"]', 'despedida', TRUE)
ON DUPLICATE KEY UPDATE 
    content = VALUES(content),
    variables = VALUES(variables);

-- ============================================================================
-- ✅ CONFIGURACIÓN COMPLETA
-- ============================================================================

SELECT 
    'BASE DE DATOS CONFIGURADA EXITOSAMENTE' as status,
    COUNT(DISTINCT table_name) as tablas_creadas
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
AND table_name IN (
    'clients', 'whatsapp_sessions', 'bot_configurations', 
    'contacts', 'contact_tags', 'contact_tag_relations',
    'conversations', 'messages', 'message_templates', 
    'bulk_messages', 'scheduled_messages', 
    'conversation_groups', 'conversation_group_relations', 
    'ai_suggestions'
);

-- Verificar cliente demo
SELECT 
    client_code,
    company_name,
    monthly_bot_limit,
    current_bot_usage,
    status
FROM clients 
WHERE client_code = 'CLI001';

-- Verificar configuración del bot
SELECT 
    is_enabled,
    working_hours_start,
    working_hours_end,
    product_search_enabled
FROM bot_configurations 
WHERE client_id = @client_id;
