-- ============================================================================
-- MIGRACIÓN: AGREGAR CAMPOS DE MENSAJE AUTOMÁTICO A ETIQUETAS
-- Descripción: Permite que las etiquetas tengan mensajes automáticos configurados
-- Fecha: 2025-10-03
-- ============================================================================

-- 1. Agregar campos a contact_tags para mensajes automáticos
ALTER TABLE contact_tags 
ADD COLUMN has_auto_message BOOLEAN DEFAULT FALSE COMMENT 'Si la etiqueta tiene mensaje automático habilitado';

ALTER TABLE contact_tags 
ADD COLUMN auto_message_template_id INT DEFAULT NULL COMMENT 'ID del template a usar (opcional)';

ALTER TABLE contact_tags 
ADD COLUMN auto_message_delay_hours INT DEFAULT 24 COMMENT 'Horas de retraso para enviar el mensaje';

ALTER TABLE contact_tags 
ADD COLUMN auto_message_content TEXT DEFAULT NULL COMMENT 'Contenido del mensaje si no usa template';

ALTER TABLE contact_tags 
ADD COLUMN is_active_auto BOOLEAN DEFAULT TRUE COMMENT 'Si el mensaje automático está activo';

-- 2. Agregar relación con message_templates
ALTER TABLE contact_tags 
ADD CONSTRAINT fk_auto_message_template 
FOREIGN KEY (auto_message_template_id) 
REFERENCES message_templates(id) ON DELETE SET NULL;

-- 3. Agregar campos a scheduled_messages para identificar origen automático
ALTER TABLE scheduled_messages 
ADD COLUMN auto_generated BOOLEAN DEFAULT FALSE COMMENT 'Si el mensaje fue generado automáticamente';

ALTER TABLE scheduled_messages 
ADD COLUMN source_tag_id INT DEFAULT NULL COMMENT 'ID de la etiqueta que generó el mensaje';

ALTER TABLE scheduled_messages 
ADD COLUMN source_contact_id INT DEFAULT NULL COMMENT 'ID del contacto para el que se generó';

-- 4. Agregar índices para optimizar consultas
CREATE INDEX idx_contact_tags_auto_message ON contact_tags (client_id, has_auto_message);

CREATE INDEX idx_scheduled_messages_auto ON scheduled_messages (auto_generated, source_tag_id, status);

-- Verificar estructura final
SELECT 
    'contact_tags' as tabla,
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'contact_tags' 
    AND COLUMN_NAME LIKE '%auto%'
UNION ALL
SELECT 
    'scheduled_messages' as tabla,
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'scheduled_messages' 
    AND COLUMN_NAME LIKE '%auto%' OR COLUMN_NAME LIKE '%source%';
