-- ============================================================================
-- MIGRACIÓN: Agregar campos de links de productos a bot_configurations
-- Fecha: 2025-01-13
-- Descripción: Permite configurar links personalizados para productos encontrados
-- ============================================================================

-- Agregar campos de configuración de links de productos
ALTER TABLE bot_configurations 
ADD COLUMN product_link_enabled TINYINT(1) DEFAULT 0 COMMENT 'Habilitar links de productos en respuestas',
ADD COLUMN product_link_template VARCHAR(500) DEFAULT NULL COMMENT 'Template del link (ej: https://tienda.com/producto?id={PRODUCT_ID})',
ADD COLUMN product_link_id_field VARCHAR(50) DEFAULT 'id' COMMENT 'Campo del producto que contiene el ID para el link',
ADD COLUMN product_link_text VARCHAR(100) DEFAULT 'Ver producto' COMMENT 'Texto del link personalizable',
ADD COLUMN permiso_producto TINYINT(1) DEFAULT 0 COMMENT 'Permiso para búsqueda de productos (migrado desde campo existente)';

-- Comentarios explicativos
-- product_link_enabled: 0=deshabilitado, 1=habilitado
-- product_link_template: Ejemplos:
--   - Producto específico: https://brandshop.ar/tienda-Producto?id={PRODUCT_ID}
--   - Búsqueda general: https://brandshop.ar/tienda?b={SEARCH_TERM}
-- product_link_id_field: Campo del JSON de producto que contiene el ID (ej: 'id', 'product_id', 'sku')
-- product_link_text: Texto personalizable (ej: 'Ver producto', 'Comprar aquí', 'Más información')

-- Actualizar registros existentes con valores por defecto
UPDATE bot_configurations 
SET 
    product_link_enabled = 0,
    product_link_template = NULL,
    product_link_id_field = 'id',
    product_link_text = 'Ver producto',
    permiso_producto = COALESCE(permiso_producto, 0)
WHERE product_link_enabled IS NULL;

-- Verificar la estructura actualizada
DESCRIBE bot_configurations;
