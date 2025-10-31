-- ============================================================================
-- CREAR REGLAS DE PRUEBA para Testing
-- ============================================================================

USE crm_condorito_db;

-- Limpiar reglas existentes del cliente demo (opcional)
-- DELETE FROM intelligent_bot_rules WHERE client_id = 1;

-- Regla 1: Consulta de Pedido
INSERT INTO intelligent_bot_rules (
    client_id, name, description, is_active, priority,
    trigger_keywords, match_type, 
    ai_extraction_enabled, ai_extraction_prompt, expected_data_fields,
    action_type, action_config, tags_to_assign
) VALUES (
    1, 
    'Consulta de Pedido', 
    'Detecta consultas sobre estado de pedidos y extrae número de pedido',
    TRUE, 
    1,
    '["pedido", "orden", "seguimiento", "tracking", "estado"]',
    'any',
    TRUE,
    'Extrae el número de pedido del mensaje. Si menciona "pedido 12345" o "#12345", extrae "12345". Responde JSON: {"order_number": "12345", "confidence": 0.95}',
    '["order_number", "confidence"]',
    'call_api',
    '{"api_endpoint": "https://api.ejemplo.com/orders/{order_number}", "method": "GET", "response_template": "🚚 Tu pedido #{order_number} está {status}. Fecha estimada: {delivery_date}"}',
    '[25, 30]'
);

-- Regla 2: Reparación de Dispositivos
INSERT INTO intelligent_bot_rules (
    client_id, name, description, is_active, priority,
    trigger_keywords, match_type,
    ai_extraction_enabled, ai_extraction_prompt, expected_data_fields,
    action_type, action_config, tags_to_assign
) VALUES (
    1,
    'Solicitud de Reparación',
    'Detecta solicitudes de reparación de dispositivos',
    TRUE,
    2,
    '["reparar", "arreglar", "no funciona", "roto", "pantalla"]',
    'any',
    TRUE,
    'Extrae información del dispositivo y problema. Responde JSON: {"device": "iPhone 12", "problem": "pantalla rota", "urgency": "normal"}',
    '["device", "problem", "urgency"]',
    'assign_tags',
    '{"auto_response": "Recibimos tu solicitud de reparación para {device}. Problema: {problem}. Te contactaremos pronto."}',
    '[15, 20]'
);

-- Regla 3: Intención de Compra
INSERT INTO intelligent_bot_rules (
    client_id, name, description, is_active, priority,
    trigger_keywords, match_type,
    ai_extraction_enabled, ai_extraction_prompt, expected_data_fields,
    action_type, action_config, tags_to_assign
) VALUES (
    1,
    'Intención de Compra',
    'Detecta cuando el cliente quiere comprar algo',
    TRUE,
    3,
    '["quiero comprar", "me interesa", "precio", "cuánto cuesta", "cotización"]',
    'any',
    FALSE,
    NULL,
    NULL,
    'escalate_human',
    '{"escalation_message": "Te conecto con un vendedor para ayudarte con tu compra", "priority": "high"}',
    '[35]'
);

-- Regla 4: Respuesta IA Personalizada
INSERT INTO intelligent_bot_rules (
    client_id, name, description, is_active, priority,
    trigger_keywords, match_type,
    ai_extraction_enabled, ai_extraction_prompt, expected_data_fields,
    action_type, action_config, tags_to_assign
) VALUES (
    1,
    'Consulta General',
    'Respuesta personalizada con IA para consultas generales',
    TRUE,
    4,
    '["ayuda", "información", "consulta", "pregunta"]',
    'any',
    FALSE,
    NULL,
    NULL,
    'ai_response',
    '{"ai_response_prompt": "Eres un asistente de atención al cliente. Responde de manera amable y profesional a la consulta del usuario sobre: {mensaje_usuario}. Usa un tono cordial y proporciona información útil.", "ai_response_max_tokens": 300, "ai_response_temperature": "0.7"}',
    '[40]'
);

-- Regla 5: Acción Híbrida
INSERT INTO intelligent_bot_rules (
    client_id, name, description, is_active, priority,
    trigger_keywords, match_type,
    ai_extraction_enabled, ai_extraction_prompt, expected_data_fields,
    action_type, action_config, tags_to_assign
) VALUES (
    1,
    'Problema Técnico Complejo',
    'Combina etiquetado, IA y posible escalación',
    TRUE,
    5,
    '["problema", "error", "no funciona", "bug", "falla"]',
    'any',
    TRUE,
    'Analiza el problema técnico descrito. Responde JSON: {"problem_type": "software", "severity": "medium", "device": "smartphone"}',
    '["problem_type", "severity", "device"]',
    'hybrid',
    '{"hybrid_assign_tags": true, "hybrid_ai_response": true, "hybrid_call_api": false, "hybrid_ai_prompt": "Analiza este problema técnico y proporciona una solución paso a paso"}',
    '[45, 50]'
);

-- Verificar que se crearon correctamente
SELECT 
    id, name, is_active, priority, trigger_keywords, action_type
FROM intelligent_bot_rules 
WHERE client_id = 1 
ORDER BY priority;

SELECT '✅ Reglas de prueba creadas exitosamente' as status;
