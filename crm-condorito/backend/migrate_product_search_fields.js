// ============================================================================
// MIGRACIÓN: CAMPOS BÚSQUEDA DE PRODUCTOS COMPLETA - CRM CONDORITO V2
// ============================================================================

const { executeQuery, testConnection } = require('./src/config/database-simple');

async function addProductSearchFields() {
    try {
        console.log('🤖 INICIANDO MIGRACIÓN - CAMPOS BÚSQUEDA DE PRODUCTOS\n');
        
        // 1. Verificar conexión a la base de datos
        console.log('🔍 Verificando conexión a la base de datos...');
        await testConnection();
        console.log('✅ Conexión a la base de datos exitosa\n');
        
        // 2. Verificar si la tabla bot_configurations existe
        console.log('🔍 Verificando tabla bot_configurations...');
        const tableExists = await executeQuery(`
            SELECT COUNT(*) as count 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'bot_configurations'
        `);
        
        if (tableExists[0].count === 0) {
            throw new Error('La tabla bot_configurations no existe. Ejecuta primero la migración principal.');
        }
        console.log('✅ Tabla bot_configurations existe');
        
        // 3. Verificar campos existentes
        console.log('\n🔍 Verificando campos existentes...');
        const existingFields = await executeQuery(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'bot_configurations' 
            AND COLUMN_NAME LIKE 'product_%'
        `);
        
        const existingFieldNames = existingFields.map(field => field.COLUMN_NAME);
        console.log(`📋 Campos existentes: ${existingFieldNames.length} encontrados`);
        existingFieldNames.forEach(field => console.log(`   - ${field}`));
        
        // 4. Definir campos requeridos
        const requiredFields = [
            'product_search_enabled',
            'product_endpoint_url',
            'product_endpoint_method', 
            'product_endpoint_body',
            'product_endpoint_headers',
            'product_search_param_name',
            'product_response_path',
            'product_max_results',
            'product_cache_ttl',
            'product_timeout'
        ];
        
        const missingFields = requiredFields.filter(field => !existingFieldNames.includes(field));
        
        if (missingFields.length === 0) {
            console.log('\n✅ Todos los campos ya existen, verificando tabla de cache...');
        } else {
            console.log(`\n📝 Agregando ${missingFields.length} campos faltantes:`);
            missingFields.forEach(field => console.log(`   - ${field}`));
            
            // 5. Agregar campos faltantes
            const fieldDefinitions = {
                'product_endpoint_url': 'VARCHAR(500) NULL COMMENT "URL del endpoint para búsqueda de productos"',
                'product_endpoint_method': 'ENUM("GET", "POST") DEFAULT "GET" COMMENT "Método HTTP para el endpoint"',
                'product_endpoint_body': 'TEXT NULL COMMENT "Template del body en JSON para requests POST"',
                'product_endpoint_headers': 'TEXT NULL COMMENT "Headers adicionales en JSON (auth, content-type, etc)"',
                'product_search_param_name': 'VARCHAR(100) DEFAULT "search" COMMENT "Nombre del parámetro de búsqueda"',
                'product_response_path': 'VARCHAR(200) DEFAULT "data" COMMENT "JSONPath para extraer productos de la respuesta"',
                'product_max_results': 'INT DEFAULT 30 COMMENT "Máximo número de productos a procesar"',
                'product_cache_ttl': 'INT DEFAULT 600 COMMENT "TTL del cache en segundos (default: 10 min)"',
                'product_timeout': 'INT DEFAULT 8000 COMMENT "Timeout del request en milisegundos"'
            };
            
            for (const field of missingFields) {
                if (field === 'product_search_enabled') continue; // Ya existe
                
                try {
                    const definition = fieldDefinitions[field];
                    if (!definition) continue;
                    
                    console.log(`   🔧 Agregando ${field}...`);
                    await executeQuery(`ALTER TABLE bot_configurations ADD COLUMN ${field} ${definition}`);
                    console.log(`   ✅ ${field} agregado correctamente`);
                } catch (error) {
                    if (error.message.includes('Duplicate column name')) {
                        console.log(`   ⚠️  ${field} ya existe, omitiendo`);
                    } else {
                        throw error;
                    }
                }
            }
        }
        
        // 6. Crear tabla de cache si no existe
        console.log('\n📊 Creando tabla product_search_cache...');
        try {
            await executeQuery(`
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
                COMMENT='Cache de búsquedas de productos'
            `);
            console.log('✅ Tabla product_search_cache creada correctamente');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('⚠️  Tabla product_search_cache ya existe');
            } else {
                throw error;
            }
        }
        
        // 7. Crear índice optimizado
        console.log('\n📈 Creando índice optimizado...');
        try {
            await executeQuery(`
                CREATE INDEX idx_bot_config_product_search 
                ON bot_configurations (product_search_enabled, client_id)
            `);
            console.log('✅ Índice idx_bot_config_product_search creado');
        } catch (error) {
            if (error.message.includes('Duplicate key name')) {
                console.log('⚠️  Índice ya existe, omitiendo');
            } else {
                console.log(`⚠️  Error creando índice: ${error.message}`);
            }
        }
        
        // 8. Verificación final
        console.log('\n🔍 Verificación final...');
        const finalFields = await executeQuery(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'bot_configurations' 
            AND COLUMN_NAME LIKE 'product_%'
            ORDER BY COLUMN_NAME
        `);
        
        console.log(`✅ Campos de búsqueda de productos: ${finalFields.length} total`);
        finalFields.forEach((field, index) => {
            console.log(`   ${index + 1}. ${field.COLUMN_NAME} (${field.DATA_TYPE}) - ${field.COLUMN_COMMENT || 'Sin comentario'}`);
        });
        
        // Verificar tabla de cache
        const cacheTableExists = await executeQuery(`
            SELECT COUNT(*) as count 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'product_search_cache'
        `);
        
        console.log(`✅ Tabla product_search_cache: ${cacheTableExists[0].count > 0 ? 'EXISTE' : 'NO EXISTE'}`);
        
        console.log('\n🎉 ¡MIGRACIÓN COMPLETADA EXITOSAMENTE!');
        console.log('📋 Próximos pasos:');
        console.log('   1. Migrar ProductSearchService.js');
        console.log('   2. Actualizar AIService.js');
        console.log('   3. Agregar endpoints de configuración');
        console.log('   4. Probar funcionalidad completa');
        
        return {
            success: true,
            fieldsAdded: missingFields.length,
            totalFields: finalFields.length,
            cacheTableExists: cacheTableExists[0].count > 0
        };
        
    } catch (error) {
        console.error('\n❌ ERROR EN LA MIGRACIÓN:', error.message);
        console.error('📋 Revisa la configuración de base de datos y vuelve a intentar');
        throw error;
    }
}

// ============================================================================
// EJECUCIÓN
// ============================================================================

if (require.main === module) {
    addProductSearchFields()
        .then(result => {
            console.log('\n✅ Migración exitosa:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Error en migración:', error.message);
            process.exit(1);
        });
}

module.exports = { addProductSearchFields };
