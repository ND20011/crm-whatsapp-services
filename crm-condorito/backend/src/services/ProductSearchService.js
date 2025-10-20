const axios = require('axios');
const crypto = require('crypto');
const { executeQuery } = require('../config/database-simple');

// ============================================================================
// PRODUCT SEARCH SERVICE - CRM CONDORITO V2
// ============================================================================

/**
 * Servicio para búsqueda de productos con cache y configuración flexible
 */
class ProductSearchService {
    
    /**
     * Buscar productos usando la configuración del cliente
     */
    static async searchProducts(clientId, clientConfig, searchTerm) {
        try {
            console.log(`🔍 Buscando productos para cliente ${clientId}: "${searchTerm}"`);

            // Validar configuración
            if (!this.validateProductConfig(clientConfig)) {
                throw new Error('Configuración de búsqueda de productos inválida');
            }

            // Normalizar término de búsqueda (limpieza básica, la IA ya entrega en singular)
            const normalizedTerm = this.normalizeSearchTerm(searchTerm);
            if (normalizedTerm !== searchTerm) {
                console.log(`🔄 Término normalizado: "${searchTerm}" → "${normalizedTerm}"`);
            }

            // Verificar cache primero (usar término normalizado)
            const cachedResult = await this.getCachedSearch(clientId, normalizedTerm, clientConfig);
            if (cachedResult) {
                console.log(`📦 Resultado desde cache para "${normalizedTerm}"`);
                return {
                    success: true,
                    products: cachedResult,
                    fromCache: true
                };
            }

            // Realizar búsqueda con reintentos (usar término normalizado)
            const products = await this.performProductSearchWithRetry(clientConfig, normalizedTerm);
            
            // Guardar en cache (usar término normalizado)
            await this.cacheSearchResult(clientId, normalizedTerm, products, clientConfig);
            
            console.log(`✅ Búsqueda completada: ${products.length} productos encontrados`);

            return {
                success: true,
                products: products,
                fromCache: false
            };

        } catch (error) {
            console.error('❌ Error en búsqueda de productos:', error.message);
            return {
                success: false,
                products: [],
                error: error.message,
                fromCache: false
            };
        }
    }

    /**
     * Normalizar término de búsqueda (limpieza básica)
     * Nota: La IA ya convierte a singular en el prompt, esto es solo limpieza
     */
    static normalizeSearchTerm(searchTerm) {
        if (!searchTerm || typeof searchTerm !== 'string') {
            return '';
        }

        // Limpiar y normalizar el término básicamente
        let normalized = searchTerm
            .toLowerCase()
            .trim()
            .replace(/[^\w\sáéíóúñü]/g, '') // Remover caracteres especiales excepto letras, números, espacios y acentos
            .replace(/\s+/g, ' '); // Normalizar espacios múltiples

        // Solo aplicar singularización como respaldo si la IA no lo hizo
        // (casos edge donde el prompt no funcionó correctamente)
        if (normalized.endsWith('s') && normalized.length > 3) {
            // Reglas básicas de respaldo solo para casos comunes
            const backupRules = [
                { pattern: /anillos$/i, replacement: 'anillo' },
                { pattern: /collares$/i, replacement: 'collar' },
                { pattern: /celulares$/i, replacement: 'celular' },
                { pattern: /zapatos$/i, replacement: 'zapato' },
                { pattern: /relojes$/i, replacement: 'reloj' }
            ];
            
            for (const rule of backupRules) {
                if (rule.pattern.test(normalized)) {
                    const original = normalized;
                    normalized = normalized.replace(rule.pattern, rule.replacement);
                    console.log(`🔧 Respaldo singularización: "${original}" → "${normalized}"`);
                    break;
                }
            }
        }

        return normalized;
    }

    /**
     * Realizar búsqueda con reintentos automáticos
     */
    static async performProductSearchWithRetry(config, searchTerm, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 Intento ${attempt}/${maxRetries} para búsqueda de productos`);
                
                // Modificar término de búsqueda en reintentos
                let currentTerm = searchTerm;
                if (attempt > 1) {
                    currentTerm = this.reformulateSearchTerm(searchTerm, attempt);
                    console.log(`🔄 Reformulando término: "${currentTerm}"`);
                }
                
                const products = await this.performProductSearch(config, currentTerm);
                
                if (products.length > 0) {
                    console.log(`✅ Búsqueda exitosa en intento ${attempt}`);
                    return products;
                }
                
                if (attempt === maxRetries) {
                    console.log(`⚠️ No se encontraron productos después de ${maxRetries} intentos`);
                    return [];
                }
                
            } catch (error) {
                lastError = error;
                console.error(`❌ Error en intento ${attempt}:`, error.message);
                
                if (attempt === maxRetries) {
                    throw lastError;
                }
                
                // Esperar antes del siguiente intento
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
        
        return [];
    }

    /**
     * Reformular término de búsqueda para reintentos
     */
    static reformulateSearchTerm(originalTerm, attempt) {
        // Primero normalizar el término original
        const normalizedTerm = this.normalizeSearchTerm(originalTerm);
        
        // Sinónimos y términos alternativos comunes
        const synonyms = {
            // Joyería
            'anillo': ['sortija', 'alianza', 'aro', 'joya'],
            'collar': ['cadena', 'gargantilla', 'choker'],
            'pulsera': ['brazalete', 'manilla', 'tobillera'],
            'arete': ['pendiente', 'zarcillo', 'aro'],
            'reloj': ['cronómetro', 'timepiece'],
            
            // Electrónicos
            'celular': ['móvil', 'teléfono', 'smartphone', 'phone'],
            'laptop': ['notebook', 'computadora', 'portátil'],
            'tablet': ['tableta', 'ipad'],
            'auricular': ['audífono', 'headphone', 'earphone'],
            'cargador': ['cable', 'adaptador'],
            
            // Ropa
            'zapato': ['calzado', 'shoe'],
            'zapatilla': ['tenis', 'sneaker', 'deportivo'],
            'camisa': ['blusa', 'shirt'],
            'pantalón': ['jean', 'pants'],
            'vestido': ['dress', 'túnica'],
            
            // Términos genéricos
            'producto': ['artículo', 'item', 'mercancía'],
            'accesorio': ['complemento', 'adorno']
        };
        
        // Generar alternativas basadas en sinónimos
        const alternatives = [];
        
        // Buscar sinónimos directos
        if (synonyms[normalizedTerm]) {
            alternatives.push(...synonyms[normalizedTerm]);
        }
        
        // Buscar palabras clave en el término
        for (const [key, values] of Object.entries(synonyms)) {
            if (normalizedTerm.includes(key) || key.includes(normalizedTerm)) {
                alternatives.push(...values);
            }
        }
        
        // Si no hay sinónimos específicos, generar variaciones
        if (alternatives.length === 0) {
            // Variaciones morfológicas
            alternatives.push(
                normalizedTerm.split(' ')[0], // Primera palabra si hay espacios
                normalizedTerm.replace(/[^a-zA-Z0-9\s]/g, '').trim() // Sin caracteres especiales
            );
        }
        
        // Agregar el término original normalizado al principio
        alternatives.unshift(normalizedTerm);
        
        // Remover duplicados y términos vacíos
        const uniqueAlternatives = [...new Set(alternatives)].filter(term => term && term.length > 2);
        
        console.log(`🔄 Alternativas para "${originalTerm}": ${uniqueAlternatives.join(', ')}`);
        
        // Retornar según el intento
        return uniqueAlternatives[attempt - 1] || normalizedTerm;
    }

    /**
     * Realizar la búsqueda HTTP al endpoint configurado
     */
    static async performProductSearch(config, searchTerm) {
        const {
            product_endpoint_url,
            product_endpoint_method,
            product_endpoint_body,
            product_endpoint_headers,
            product_search_param_name,
            product_response_path,
            product_max_results,
            product_timeout
        } = config;

        // Preparar headers
        let headers = { 'User-Agent': 'CRM-Condorito-Bot/2.0' };
        if (product_endpoint_headers) {
            try {
                const customHeaders = JSON.parse(product_endpoint_headers);
                headers = { ...headers, ...customHeaders };
            } catch (error) {
                console.warn('⚠️ Error parseando headers, usando defaults');
            }
        }

        // Preparar request
        let requestConfig = {
            method: product_endpoint_method || 'GET',
            url: product_endpoint_url,
            headers: headers,
            timeout: product_timeout || 8000,
            validateStatus: (status) => status < 500 // Aceptar 4xx como válidos
        };

        // Configurar parámetros según método
        if (product_endpoint_method === 'POST') {
            // POST request con body
            if (product_endpoint_body) {
                try {
                    let bodyTemplate = product_endpoint_body;
                    // Reemplazar placeholder con término de búsqueda
                    bodyTemplate = bodyTemplate.replace(/{SEARCH_TERM}/g, searchTerm);
                    requestConfig.data = JSON.parse(bodyTemplate);
                } catch (error) {
                    throw new Error(`Error en template del body: ${error.message}`);
                }
            } else {
                // Body por defecto para POST
                const paramName = product_search_param_name || 'search';
                requestConfig.data = { [paramName]: searchTerm };
            }
            
            if (!headers['Content-Type']) {
                requestConfig.headers['Content-Type'] = 'application/json';
            }
        } else {
            // GET request con query parameters
            const paramName = product_search_param_name || 'search';
            
            // Si la URL ya tiene el placeholder, reemplazarlo
            if (product_endpoint_url.includes('{SEARCH_TERM}')) {
                requestConfig.url = product_endpoint_url.replace(/{SEARCH_TERM}/g, encodeURIComponent(searchTerm));
            } else {
                // Agregar como query parameter
                requestConfig.params = { [paramName]: searchTerm };
            }
        }

        console.log(`🌐 Realizando ${requestConfig.method} a ${requestConfig.url}`);

        // Ejecutar request
        const response = await axios(requestConfig);

        if (response.status >= 400) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Procesar respuesta
        return this.processProductResponse(response.data, product_response_path, product_max_results);
    }

    /**
     * Procesar la respuesta del endpoint según la configuración
     */
    static processProductResponse(responseData, responsePath, maxResults) {
        try {
            let products = responseData;

            // Extraer productos según el path configurado
            if (responsePath && responsePath !== 'data') {
                const pathParts = responsePath.split('.');
                for (const part of pathParts) {
                    if (products && typeof products === 'object' && part in products) {
                        products = products[part];
                    } else {
                        console.warn(`⚠️ Path "${responsePath}" no encontrado en respuesta`);
                        products = responseData; // Fallback a respuesta completa
                        break;
                    }
                }
            }

            // Asegurar que tenemos un array
            if (!Array.isArray(products)) {
                if (typeof products === 'object' && products !== null) {
                    // Si es un objeto, intentar encontrar un array dentro
                    const arrayKeys = Object.keys(products).filter(key => Array.isArray(products[key]));
                    if (arrayKeys.length > 0) {
                        products = products[arrayKeys[0]];
                    } else {
                        // Convertir objeto único en array
                        products = [products];
                    }
                } else {
                    products = [];
                }
            }

            // Limitar resultados
            const limit = maxResults || 30;
            if (products.length > limit) {
                products = products.slice(0, limit);
                console.log(`📊 Limitando resultados a ${limit} productos`);
            }

            // Normalizar estructura de productos
            return products.map(product => this.normalizeProduct(product));

        } catch (error) {
            console.error('❌ Error procesando respuesta de productos:', error.message);
            return [];
        }
    }

    /**
     * Normalizar estructura del producto para IA
     */
    static normalizeProduct(product) {
        // Campos comunes que buscamos
        const fieldMappings = {
            id: ['id', 'product_id', 'sku', 'code', 'codigo'],
            name: ['name', 'title', 'nombre', 'producto', 'product_name', 'titulo'],
            description: ['description', 'descripcion', 'desc', 'details', 'detalle'],
            price: ['price', 'precio', 'cost', 'amount', 'value', 'costo', 'valor'],
            currency: ['currency', 'moneda', 'curr', 'symbol'],
            stock: ['stock', 'quantity', 'qty', 'available', 'disponible', 'cantidad'],
            category: ['category', 'categoria', 'type', 'tipo', 'cat'],
            brand: ['brand', 'marca', 'manufacturer', 'fabricante'],
            image: ['image', 'imagen', 'photo', 'picture', 'thumbnail', 'img'],
            url: ['url', 'link', 'enlace', 'href', 'permalink'],
            rating: ['rating', 'calificacion', 'score', 'stars', 'estrellas'],
            discount: ['discount', 'descuento', 'sale', 'oferta'],
            tags: ['tags', 'etiquetas', 'keywords', 'palabras_clave']
        };

        const normalized = {};

        // Mapear campos automáticamente
        for (const [targetField, possibleKeys] of Object.entries(fieldMappings)) {
            for (const key of possibleKeys) {
                if (product[key] !== undefined && product[key] !== null && product[key] !== '') {
                    normalized[targetField] = product[key];
                    break;
                }
            }
        }

        // Formatear precio si existe
        if (normalized.price) {
            normalized.price = this.formatPrice(normalized.price);
        }

        // Mantener datos originales como fallback
        normalized.original = product;

        return normalized;
    }

    /**
     * Formatear precio para mostrar
     */
    static formatPrice(price) {
        if (typeof price === 'number') {
            return price;
        }
        
        if (typeof price === 'string') {
            // Extraer número del string
            const numericPrice = parseFloat(price.replace(/[^0-9.,]/g, '').replace(',', '.'));
            return isNaN(numericPrice) ? price : numericPrice;
        }
        
        return price;
    }

    /**
     * Validar configuración de búsqueda de productos
     */
    static validateProductConfig(config) {
        if (!config) return false;
        
        const required = ['product_endpoint_url'];
        for (const field of required) {
            if (!config[field] || config[field].trim() === '') {
                console.error(`❌ Campo requerido faltante: ${field}`);
                return false;
            }
        }

        // Validar URL
        try {
            new URL(config.product_endpoint_url);
        } catch (error) {
            console.error('❌ URL inválida:', config.product_endpoint_url);
            return false;
        }

        // Validar método
        const validMethods = ['GET', 'POST'];
        if (config.product_endpoint_method && !validMethods.includes(config.product_endpoint_method)) {
            console.error('❌ Método HTTP inválido:', config.product_endpoint_method);
            return false;
        }

        // Validar rangos numéricos
        if (config.product_max_results && (config.product_max_results < 1 || config.product_max_results > 100)) {
            console.error('❌ product_max_results debe estar entre 1 y 100');
            return false;
        }

        if (config.product_cache_ttl && (config.product_cache_ttl < 60 || config.product_cache_ttl > 3600)) {
            console.error('❌ product_cache_ttl debe estar entre 60 y 3600 segundos');
            return false;
        }

        if (config.product_timeout && (config.product_timeout < 1000 || config.product_timeout > 30000)) {
            console.error('❌ product_timeout debe estar entre 1000 y 30000 ms');
            return false;
        }

        // Validar JSON si existe
        if (config.product_endpoint_headers) {
            try {
                JSON.parse(config.product_endpoint_headers);
            } catch (error) {
                console.error('❌ Headers JSON inválido:', error.message);
                return false;
            }
        }

        if (config.product_endpoint_body) {
            try {
                JSON.parse(config.product_endpoint_body);
            } catch (error) {
                console.error('❌ Body JSON inválido:', error.message);
                return false;
            }
        }

        return true;
    }

    /**
     * Generar hash para cache
     */
    static generateSearchHash(searchTerm, config) {
        const hashData = {
            term: searchTerm.toLowerCase().trim(),
            url: config.product_endpoint_url,
            method: config.product_endpoint_method,
            body: config.product_endpoint_body,
            headers: config.product_endpoint_headers
        };
        
        return crypto.createHash('sha256')
            .update(JSON.stringify(hashData))
            .digest('hex');
    }

    /**
     * Obtener resultado desde cache
     */
    static async getCachedSearch(clientId, searchTerm, config) {
        try {
            const searchHash = this.generateSearchHash(searchTerm, config);
            
            const query = `
                SELECT response_data, created_at 
                FROM product_search_cache 
                WHERE client_id = ? AND search_hash = ? AND expires_at > NOW()
                ORDER BY created_at DESC 
                LIMIT 1
            `;
            
            const results = await executeQuery(query, [clientId, searchHash]);
            
            if (results.length > 0) {
                return JSON.parse(results[0].response_data);
            }
            
            return null;
        } catch (error) {
            console.error('❌ Error obteniendo cache:', error.message);
            return null;
        }
    }

    /**
     * Guardar resultado en cache
     */
    static async cacheSearchResult(clientId, searchTerm, products, config) {
        try {
            if (!products || products.length === 0) {
                return; // No cachear resultados vacíos
            }

            const searchHash = this.generateSearchHash(searchTerm, config);
            const ttl = config.product_cache_ttl || 600; // 10 minutos por defecto
            
            const query = `
                INSERT INTO product_search_cache 
                (client_id, search_term, search_hash, response_data, expires_at) 
                VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
                ON DUPLICATE KEY UPDATE 
                response_data = VALUES(response_data),
                expires_at = VALUES(expires_at),
                created_at = NOW()
            `;
            
            await executeQuery(query, [
                clientId, 
                searchTerm.substring(0, 255), // Limitar longitud
                searchHash,
                JSON.stringify(products),
                ttl
            ]);
            
            console.log(`💾 Resultado cacheado por ${ttl} segundos`);
        } catch (error) {
            console.error('❌ Error guardando en cache:', error.message);
        }
    }

    /**
     * Limpiar cache expirado
     */
    static async cleanExpiredCache() {
        try {
            const query = 'DELETE FROM product_search_cache WHERE expires_at <= NOW()';
            const result = await executeQuery(query);
            
            if (result.affectedRows > 0) {
                console.log(`🧹 Cache limpiado: ${result.affectedRows} entradas eliminadas`);
            }
            
            return result.affectedRows;
        } catch (error) {
            console.error('❌ Error limpiando cache:', error.message);
            return 0;
        }
    }

    /**
     * Obtener estadísticas de cache
     */
    static async getCacheStats(clientId = null) {
        try {
            let query = `
                SELECT 
                    COUNT(*) as total_entries,
                    COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active_entries,
                    COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired_entries,
                    AVG(CHAR_LENGTH(response_data)) as avg_size
                FROM product_search_cache
            `;
            
            const params = [];
            if (clientId) {
                query += ' WHERE client_id = ?';
                params.push(clientId);
            }
            
            const results = await executeQuery(query, params);
            return results[0];
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas de cache:', error.message);
            return null;
        }
    }
}

module.exports = ProductSearchService;
