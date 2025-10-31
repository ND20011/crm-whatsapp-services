-- ============================================================================
-- VERIFICAR: Estado actual de la tabla push_subscriptions
-- ============================================================================

USE crm_condorito_db;

-- Verificar estructura completa
SELECT 'Estructura actual de push_subscriptions:' as info;
DESCRIBE push_subscriptions;

-- Verificar datos existentes
SELECT 
    COUNT(*) as total_subscriptions,
    COUNT(DISTINCT client_id) as unique_clients,
    COUNT(DISTINCT user_id) as unique_users
FROM push_subscriptions;

-- Mostrar algunos registros de ejemplo
SELECT 'Registros de ejemplo:' as info;
SELECT id, client_id, user_id, client_code, created_at 
FROM push_subscriptions 
LIMIT 3;

SELECT '✅ Verificación completada - La columna user_id ya existe' as status;
