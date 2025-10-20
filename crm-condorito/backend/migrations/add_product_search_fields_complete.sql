-- ============================================================================
-- MIGRACIÓN: CAMPOS ADICIONALES BÚSQUEDA DE PRODUCTOS - CRM CONDORITO V2
-- ============================================================================

-- Verificar si los campos ya existen antes de agregarlos
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_NAME = 'bot_configurations' 
     AND COLUMN_NAME = 'product_endpoint_url') = 0,
    'ALTER TABLE bot_configurations ADD COLUMN product_endpoint_url VARCHAR(500) NULL COMMENT "URL del endpoint para búsqueda de productos"',
    'SELECT "Campo product_endpoint_url ya existe" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_NAME = 'bot_configurations' 
     AND COLUMN_NAME = 'product_endpoint_method') = 0,
    'ALTER TABLE bot_configurations ADD COLUMN product_endpoint_method ENUM("GET", "POST") DEFAULT "GET" COMMENT "Método HTTP para el endpoint"',
    'SELECT "Campo product_endpoint_method ya existe" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_NAME = 'bot_configurations' 
     AND COLUMN_NAME = 'product_endpoint_body') = 0,
    'ALTER TABLE bot_configurations ADD COLUMN product_endpoint_body TEXT NULL COMMENT "Template del body en JSON para requests POST"',
    'SELECT "Campo product_endpoint_body ya existe" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_NAME = 'bot_configurations' 
     AND COLUMN_NAME = 'product_endpoint_headers') = 0,
    'ALTER TABLE bot_configurations ADD COLUMN product_endpoint_headers TEXT NULL COMMENT "Headers adicionales en JSON (auth, content-type, etc)"',
    'SELECT "Campo product_endpoint_headers ya existe" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_NAME = 'bot_configurations' 
     AND COLUMN_NAME = 'product_search_param_name') = 0,
    'ALTER TABLE bot_configurations ADD COLUMN product_search_param_name VARCHAR(100) DEFAULT "search" COMMENT "Nombre del parámetro de búsqueda"',
    'SELECT "Campo product_search_param_name ya existe" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_NAME = 'bot_configurations' 
     AND COLUMN_NAME = 'product_response_path') = 0,
    'ALTER TABLE bot_configurations ADD COLUMN product_response_path VARCHAR(200) DEFAULT "data" COMMENT "JSONPath para extraer productos de la respuesta"',
    'SELECT "Campo product_response_path ya existe" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_NAME = 'bot_configurations' 
     AND COLUMN_NAME = 'product_max_results') = 0,
    'ALTER TABLE bot_configurations ADD COLUMN product_max_results INT DEFAULT 30 COMMENT "Máximo número de productos a procesar"',
    'SELECT "Campo product_max_results ya existe" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_NAME = 'bot_configurations' 
     AND COLUMN_NAME = 'product_cache_ttl') = 0,
    'ALTER TABLE bot_configurations ADD COLUMN product_cache_ttl INT DEFAULT 600 COMMENT "TTL del cache en segundos (default: 10 min)"',
    'SELECT "Campo product_cache_ttl ya existe" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_NAME = 'bot_configurations' 
     AND COLUMN_NAME = 'product_timeout') = 0,
    'ALTER TABLE bot_configurations ADD COLUMN product_timeout INT DEFAULT 8000 COMMENT "Timeout del request en milisegundos"',
    'SELECT "Campo product_timeout ya existe" as message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Crear tabla para cache de búsquedas de productos (si no existe)
CREATE TABLE IF NOT EXISTS product_search_cache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    search_term VARCHAR(255) NOT NULL,
    search_hash VARCHAR(64) NOT NULL,
    response_data TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    
    INDEX idx_client_search (client_id, search_hash),
    INDEX idx_expires (expires_at),
    
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Cache de búsquedas de productos';

-- Crear índice para optimizar consultas de búsqueda de productos (si no existe)
CREATE INDEX IF NOT EXISTS idx_bot_config_product_search 
ON bot_configurations (product_search_enabled, client_id);

-- Verificación final
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'bot_configurations' 
AND COLUMN_NAME LIKE 'product_%'
ORDER BY COLUMN_NAME;
