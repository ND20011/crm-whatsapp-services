-- ============================================================================
-- FIX: JSON malformado en trigger_keywords
-- Descripción: Arregla el error "Unexpected token q in JSON at position 0"
-- ============================================================================

USE crm_condorito_db;

-- 1. Verificar reglas con JSON malformado
SELECT 'Reglas con JSON malformado:' as info;
SELECT id, name, trigger_keywords 
FROM intelligent_bot_rules 
WHERE client_id = 1;

-- 2. Arreglar reglas con JSON malformado (las que empiezan con 'q' u otros caracteres)
UPDATE intelligent_bot_rules 
SET trigger_keywords = '["quiero comprar", "me interesa", "precio", "comprar"]'
WHERE id = 7 AND trigger_keywords LIKE 'q%';

-- 3. Verificar y arreglar otras reglas si es necesario
UPDATE intelligent_bot_rules 
SET trigger_keywords = '["pedido", "orden", "seguimiento", "tracking", "estado"]'
WHERE trigger_keywords NOT LIKE '[%' AND trigger_keywords NOT LIKE '{%' AND id IN (1, 8);

UPDATE intelligent_bot_rules 
SET trigger_keywords = '["reparar", "arreglar", "no funciona", "roto", "pantalla"]'
WHERE trigger_keywords NOT LIKE '[%' AND trigger_keywords NOT LIKE '{%' AND id = 9;

UPDATE intelligent_bot_rules 
SET trigger_keywords = '["quiero comprar", "me interesa", "precio", "cuánto cuesta", "cotización"]'
WHERE trigger_keywords NOT LIKE '[%' AND trigger_keywords NOT LIKE '{%' AND id = 10;

UPDATE intelligent_bot_rules 
SET trigger_keywords = '["ayuda", "información", "consulta", "pregunta"]'
WHERE trigger_keywords NOT LIKE '[%' AND trigger_keywords NOT LIKE '{%' AND id = 11;

UPDATE intelligent_bot_rules 
SET trigger_keywords = '["problema", "error", "no funciona", "bug", "falla"]'
WHERE trigger_keywords NOT LIKE '[%' AND trigger_keywords NOT LIKE '{%' AND id = 12;

-- 4. Verificar que todo esté arreglado
SELECT 'Reglas después del arreglo:' as info;
SELECT id, name, trigger_keywords, is_active
FROM intelligent_bot_rules 
WHERE client_id = 1
ORDER BY id;

-- 5. Probar que el JSON sea válido
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

SELECT '✅ JSON malformado arreglado' as status;
