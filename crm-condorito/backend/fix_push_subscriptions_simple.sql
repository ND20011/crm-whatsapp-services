-- ============================================================================
-- FIX SIMPLE: Agregar columna user_id faltante en push_subscriptions
-- Descripción: Soluciona el error "Unknown column 'user_id' in 'where clause'"
-- Fecha: 2025-10-26
-- ============================================================================

-- Usar la base de datos correcta
USE crm_condorito_db;

-- 1. Verificar estructura actual de la tabla
SELECT 'Estructura actual de push_subscriptions:' as info;
DESCRIBE push_subscriptions;

-- 2. Agregar la columna user_id
ALTER TABLE push_subscriptions 
ADD COLUMN user_id INT NOT NULL DEFAULT 1 
COMMENT 'ID del usuario (por defecto 1 para compatibilidad)';

-- 3. Verificar que la columna se agregó correctamente
SELECT 'Estructura después del cambio:' as info;
DESCRIBE push_subscriptions;

-- 4. Verificar datos existentes
SELECT 
    COUNT(*) as total_subscriptions,
    COUNT(DISTINCT client_id) as unique_clients,
    COUNT(DISTINCT user_id) as unique_users
FROM push_subscriptions;

SELECT '✅ Fix completado exitosamente - Columna user_id agregada' as status;
