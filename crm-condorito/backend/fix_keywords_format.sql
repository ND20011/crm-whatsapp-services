-- ============================================================================
-- FIX: Convertir keywords de texto plano a JSON
-- Descripción: Arregla keywords que están como "palabra1,palabra2" a ["palabra1","palabra2"]
-- ============================================================================

USE crm_condorito_db;

-- 1. Verificar reglas con formato incorrecto
SELECT 'Reglas con keywords en formato incorrecto:' as info;
SELECT id, name, trigger_keywords 
FROM intelligent_bot_rules 
WHERE client_id = 1 
AND trigger_keywords NOT LIKE '[%'
AND trigger_keywords NOT LIKE '{%';

-- 2. Arreglar cada regla individualmente

-- Regla 8: Consulta de Pedido
UPDATE intelligent_bot_rules 
SET trigger_keywords = '["pedido", "orden", "seguimiento", "tracking", "estado"]'
WHERE id = 8 AND trigger_keywords = 'pedido,orden,seguimiento,tracking,estado';

-- Verificar si hay otras reglas con formato similar
UPDATE intelligent_bot_rules 
SET trigger_keywords = CONCAT('["', REPLACE(trigger_keywords, ',', '", "'), '"]')
WHERE client_id = 1 
AND trigger_keywords NOT LIKE '[%'
AND trigger_keywords NOT LIKE '{%'
AND trigger_keywords LIKE '%,%';

-- Para reglas con una sola palabra (sin comas)
UPDATE intelligent_bot_rules 
SET trigger_keywords = CONCAT('["', trigger_keywords, '"]')
WHERE client_id = 1 
AND trigger_keywords NOT LIKE '[%'
AND trigger_keywords NOT LIKE '{%'
AND trigger_keywords NOT LIKE '%,%'
AND LENGTH(trigger_keywords) > 0;

-- 3. Verificar que todo esté arreglado
SELECT 'Reglas después del arreglo:' as info;
SELECT id, name, trigger_keywords, is_active
FROM intelligent_bot_rules 
WHERE client_id = 1
ORDER BY id;

-- 4. Verificar que el JSON sea válido
SELECT 'Verificando JSON válido:' as info;
SELECT 
    id, 
    name,
    CASE 
        WHEN JSON_VALID(trigger_keywords) = 1 THEN '✅ Válido'
        ELSE '❌ Inválido'
    END as json_status,
    trigger_keywords
FROM intelligent_bot_rules 
WHERE client_id = 1
ORDER BY id;

SELECT '✅ Keywords convertidos a formato JSON' as status;
