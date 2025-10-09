-- ============================================================================
-- MIGRACIÓN: CORREGIR TIPO DE DATO PARA auto_message_delay_hours
-- Descripción: Cambiar de INT a DECIMAL(5,2) para permitir valores decimales como 0.1 horas (6 minutos)
-- Fecha: 2025-10-03
-- ============================================================================

-- Cambiar el tipo de dato de la columna auto_message_delay_hours
-- De INT a DECIMAL(5,2) para permitir hasta 999.99 horas con 2 decimales
ALTER TABLE contact_tags 
MODIFY COLUMN auto_message_delay_hours DECIMAL(5,2) DEFAULT 24.0 
COMMENT 'Horas de retraso para enviar el mensaje (acepta decimales para minutos)';

-- Verificar el cambio
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'contact_tags' 
  AND COLUMN_NAME = 'auto_message_delay_hours';
