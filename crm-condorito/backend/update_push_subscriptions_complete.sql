-- ============================================================================
-- UPDATE: Completar estructura de push_subscriptions
-- Descripción: Agregar columnas faltantes para coincidir con la estructura completa
-- Fecha: 2025-10-26
-- ============================================================================

USE crm_condorito_db;

-- 1. Verificar estructura actual
SELECT 'Estructura ACTUAL de push_subscriptions:' as info;
DESCRIBE push_subscriptions;

-- 2. Agregar columnas faltantes una por una

-- Agregar user_agent
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = 'crm_condorito_db' 
                   AND TABLE_NAME = 'push_subscriptions' 
                   AND COLUMN_NAME = 'user_agent');

SET @sql = IF(@col_exists = 0, 
              'ALTER TABLE push_subscriptions ADD COLUMN user_agent TEXT DEFAULT NULL COMMENT "User agent del navegador"', 
              'SELECT "Columna user_agent ya existe" as message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Agregar is_active
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = 'crm_condorito_db' 
                   AND TABLE_NAME = 'push_subscriptions' 
                   AND COLUMN_NAME = 'is_active');

SET @sql = IF(@col_exists = 0, 
              'ALTER TABLE push_subscriptions ADD COLUMN is_active TINYINT(1) DEFAULT 1 COMMENT "Si la suscripción está activa"', 
              'SELECT "Columna is_active ya existe" as message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Agregar last_used_at
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = 'crm_condorito_db' 
                   AND TABLE_NAME = 'push_subscriptions' 
                   AND COLUMN_NAME = 'last_used_at');

SET @sql = IF(@col_exists = 0, 
              'ALTER TABLE push_subscriptions ADD COLUMN last_used_at TIMESTAMP NULL DEFAULT NULL COMMENT "Última vez que se usó la suscripción"', 
              'SELECT "Columna last_used_at ya existe" as message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Modificar client_code para que coincida (agregar comentario si no lo tiene)
ALTER TABLE push_subscriptions 
MODIFY COLUMN client_code VARCHAR(50) DEFAULT NULL COMMENT 'Código del cliente para referencia rápida';

-- 3. Crear índices faltantes

-- Índice único para client_id y user_id
SET @index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                     WHERE TABLE_SCHEMA = 'crm_condorito_db' 
                     AND TABLE_NAME = 'push_subscriptions' 
                     AND INDEX_NAME = 'unique_client_user');

SET @sql = IF(@index_exists = 0, 
              'ALTER TABLE push_subscriptions ADD UNIQUE KEY unique_client_user (client_id, user_id)', 
              'SELECT "Índice unique_client_user ya existe" as message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Índice para user_id
SET @index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                     WHERE TABLE_SCHEMA = 'crm_condorito_db' 
                     AND TABLE_NAME = 'push_subscriptions' 
                     AND INDEX_NAME = 'idx_user_id');

SET @sql = IF(@index_exists = 0, 
              'ALTER TABLE push_subscriptions ADD KEY idx_user_id (user_id)', 
              'SELECT "Índice idx_user_id ya existe" as message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Índice para is_active
SET @index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                     WHERE TABLE_SCHEMA = 'crm_condorito_db' 
                     AND TABLE_NAME = 'push_subscriptions' 
                     AND INDEX_NAME = 'idx_is_active');

SET @sql = IF(@index_exists = 0, 
              'ALTER TABLE push_subscriptions ADD KEY idx_is_active (is_active)', 
              'SELECT "Índice idx_is_active ya existe" as message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Índice para client_code
SET @index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                     WHERE TABLE_SCHEMA = 'crm_condorito_db' 
                     AND TABLE_NAME = 'push_subscriptions' 
                     AND INDEX_NAME = 'idx_push_subscriptions_client_code');

SET @sql = IF(@index_exists = 0, 
              'ALTER TABLE push_subscriptions ADD KEY idx_push_subscriptions_client_code (client_code)', 
              'SELECT "Índice idx_push_subscriptions_client_code ya existe" as message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Índice adicional para is_active (por si acaso)
SET @index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                     WHERE TABLE_SCHEMA = 'crm_condorito_db' 
                     AND TABLE_NAME = 'push_subscriptions' 
                     AND INDEX_NAME = 'idx_push_subscriptions_is_active');

SET @sql = IF(@index_exists = 0, 
              'ALTER TABLE push_subscriptions ADD KEY idx_push_subscriptions_is_active (is_active)', 
              'SELECT "Índice idx_push_subscriptions_is_active ya existe" as message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Índice para last_used_at
SET @index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                     WHERE TABLE_SCHEMA = 'crm_condorito_db' 
                     AND TABLE_NAME = 'push_subscriptions' 
                     AND INDEX_NAME = 'idx_push_subscriptions_last_used');

SET @sql = IF(@index_exists = 0, 
              'ALTER TABLE push_subscriptions ADD KEY idx_push_subscriptions_last_used (last_used_at)', 
              'SELECT "Índice idx_push_subscriptions_last_used ya existe" as message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Verificar estructura final
SELECT 'Estructura FINAL de push_subscriptions:' as info;
DESCRIBE push_subscriptions;

-- 5. Mostrar todos los índices
SELECT 'Índices de la tabla:' as info;
SHOW INDEX FROM push_subscriptions;

-- 6. Verificar datos existentes
SELECT 
    COUNT(*) as total_subscriptions,
    COUNT(DISTINCT client_id) as unique_clients,
    COUNT(DISTINCT user_id) as unique_users,
    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_subscriptions,
    SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_subscriptions
FROM push_subscriptions;

SELECT '✅ Tabla push_subscriptions actualizada completamente' as status;
