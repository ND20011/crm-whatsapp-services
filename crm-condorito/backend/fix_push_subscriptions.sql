-- ============================================================================
-- FIX: Agregar columna user_id faltante en push_subscriptions
-- Descripción: Soluciona el error "Unknown column 'user_id' in 'where clause'"
-- Fecha: 2025-10-26
-- ============================================================================

-- Usar la base de datos correcta
USE crm_condorito_db;

-- 1. Verificar estructura actual de la tabla
DESCRIBE push_subscriptions;

-- 2. Agregar la columna user_id (verificar si ya existe primero)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = 'crm_condorito_db' 
                   AND TABLE_NAME = 'push_subscriptions' 
                   AND COLUMN_NAME = 'user_id');

SET @sql = IF(@col_exists = 0, 
              'ALTER TABLE push_subscriptions ADD COLUMN user_id INT NOT NULL DEFAULT 1 COMMENT "ID del usuario (por defecto 1 para compatibilidad)"', 
              'SELECT "Columna user_id ya existe" as message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Crear índice para mejorar performance de las consultas
SET @index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                     WHERE TABLE_SCHEMA = 'crm_condorito_db' 
                     AND TABLE_NAME = 'push_subscriptions' 
                     AND INDEX_NAME = 'idx_client_user_active');

SET @sql = IF(@index_exists = 0, 
              'ALTER TABLE push_subscriptions ADD INDEX idx_client_user_active (client_id, user_id, is_active)', 
              'SELECT "Índice idx_client_user_active ya existe" as message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Verificar que la columna se agregó correctamente
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'push_subscriptions'
ORDER BY ORDINAL_POSITION;

-- 5. Verificar datos existentes
SELECT 
    COUNT(*) as total_subscriptions,
    COUNT(DISTINCT client_id) as unique_clients,
    COUNT(DISTINCT user_id) as unique_users
FROM push_subscriptions;

-- ============================================================================
-- OPCIONAL: Si quieres limpiar suscripciones duplicadas o inválidas
-- ============================================================================

-- Eliminar suscripciones duplicadas (mantener la más reciente)
DELETE p1 FROM push_subscriptions p1
INNER JOIN push_subscriptions p2 
WHERE p1.id < p2.id 
AND p1.client_id = p2.client_id 
AND p1.user_id = p2.user_id 
AND p1.endpoint = p2.endpoint;

-- Verificar resultado final
SELECT 'Fix completado exitosamente' as status;
