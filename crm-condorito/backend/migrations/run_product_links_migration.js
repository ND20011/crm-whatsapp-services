const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ============================================================================
// SCRIPT DE MIGRACIÓN: Product Links Fields
// ============================================================================

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'crm_condorito',
    password: process.env.DB_PASSWORD || 'CRM2024$ecure!',
    database: process.env.DB_NAME || 'crm_condorito_db',
    charset: 'utf8mb4',
    timezone: '-03:00',
    multipleStatements: true // Permitir múltiples statements
};

async function runMigration() {
    let connection;
    
    try {
        console.log('🔄 Iniciando migración de campos de product links...');
        console.log(`📡 Conectando a: ${dbConfig.host}:${dbConfig.port}`);
        console.log(`🗃️  Base de datos: ${dbConfig.database}`);
        
        // Crear conexión
        connection = await mysql.createConnection(dbConfig);
        
        // Verificar conexión
        await connection.ping();
        console.log('✅ Conexión establecida correctamente');
        
        // Leer el archivo de migración
        const migrationPath = path.join(__dirname, 'add_product_link_fields.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('📄 Archivo de migración cargado');
        
        // Ejecutar migración
        console.log('🔄 Ejecutando migración...');
        const statements = migrationSQL.split(';').filter(stmt => stmt.trim() && !stmt.trim().startsWith('--'));
        
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i].trim();
            if (statement) {
                console.log(`   Ejecutando statement ${i + 1}/${statements.length}...`);
                try {
                    await connection.execute(statement);
                } catch (error) {
                    if (error.code === 'ER_DUP_FIELDNAME') {
                        console.log(`   ⚠️  Campo ya existe, continuando...`);
                    } else {
                        throw error;
                    }
                }
            }
        }
        
        console.log('✅ Migración ejecutada exitosamente');
        
        // Verificar estructura de la tabla
        console.log('🔍 Verificando estructura de bot_configurations...');
        const [columns] = await connection.execute('DESCRIBE bot_configurations');
        
        const newFields = [
            'product_link_enabled',
            'product_link_template', 
            'product_link_id_field',
            'product_link_text',
            'permiso_producto'
        ];
        
        console.log('📋 Campos de product links:');
        for (const field of newFields) {
            const found = columns.find(col => col.Field === field);
            if (found) {
                console.log(`   ✅ ${field}: ${found.Type} (Default: ${found.Default})`);
            } else {
                console.log(`   ❌ ${field}: NO ENCONTRADO`);
            }
        }
        
        // Verificar datos de ejemplo
        console.log('🔍 Verificando registros existentes...');
        const [rows] = await connection.execute(`
            SELECT id, client_id, product_link_enabled, product_link_text 
            FROM bot_configurations 
            LIMIT 3
        `);
        
        console.log(`📊 Registros encontrados: ${rows.length}`);
        rows.forEach((row, i) => {
            console.log(`   ${i + 1}. Client ${row.client_id}: Links=${row.product_link_enabled}, Text="${row.product_link_text}"`);
        });
        
        console.log('');
        console.log('🎉 ¡Migración completada exitosamente!');
        console.log('');
        console.log('📋 Próximos pasos:');
        console.log('   1. Ir al frontend: Configuración → Búsqueda de Productos');
        console.log('   2. Habilitar "Incluir links en respuestas"');
        console.log('   3. Configurar template del link');
        console.log('   4. Probar búsqueda de productos');
        console.log('');
        
    } catch (error) {
        console.error('❌ Error ejecutando migración:', error.message);
        console.error('❌ Stack:', error.stack);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Conexión cerrada');
        }
    }
}

// Ejecutar migración
if (require.main === module) {
    runMigration();
}

module.exports = { runMigration };
