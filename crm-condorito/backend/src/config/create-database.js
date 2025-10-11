const mysql = require('mysql2/promise');
require('dotenv').config();

// ============================================================================
// SCRIPT PARA CREAR BASE DE DATOS Y USUARIO INICIAL
// ============================================================================

/**
 * Crear conexión como root para configuración inicial
 */
async function createRootConnection() {
    // Usar variables de entorno si están disponibles, sino solicitar manualmente
    const rootConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: 'root', // Usuario root para crear BD y usuarios
        password: process.env.MYSQL_ROOT_PASSWORD || '', // Contraseña root
        multipleStatements: true
    };
    
    console.log(`🔌 Conectando a MySQL como root en ${rootConfig.host}:${rootConfig.port}`);
    
    try {
        const connection = await mysql.createConnection(rootConfig);
        console.log('✅ Conexión root establecida exitosamente');
        return connection;
    } catch (error) {
        console.error('❌ Error conectando como root:', error.message);
        console.log(`
⚠️  Asegúrate de que:
   1. MySQL está ejecutándose
   2. El usuario root tiene acceso
   3. La contraseña root es correcta
   
💡 Si no tienes contraseña root, intenta ejecutar:
   mysql -u root -p
        `);
        throw error;
    }
}

/**
 * Crear base de datos y usuario
 */
async function setupDatabase() {
    let connection;
    
    try {
        connection = await createRootConnection();
        
        const dbName = process.env.DB_NAME || 'crm_condorito_db';
        const dbUser = process.env.DB_USER || 'crm_condorito';
        const dbPassword = process.env.DB_PASSWORD || 'CRM2024$ecure!';
        
        console.log(`
🗃️  Configurando base de datos:
   - Nombre BD: ${dbName}
   - Usuario: ${dbUser}
   - Host: ${process.env.DB_HOST || 'localhost'}
        `);
        
        // 1. Crear base de datos
        console.log('📝 Creando base de datos...');
        await connection.execute(`
            CREATE DATABASE IF NOT EXISTS \`${dbName}\`
            CHARACTER SET utf8mb4
            COLLATE utf8mb4_unicode_ci;
        `);
        console.log(`✅ Base de datos '${dbName}' creada/verificada`);
        
        // 2. Crear usuario
        console.log('👤 Creando usuario...');
        await connection.execute(`
            CREATE USER IF NOT EXISTS '${dbUser}'@'localhost' 
            IDENTIFIED BY '${dbPassword}';
        `);
        console.log(`✅ Usuario '${dbUser}' creado/verificado`);
        
        // 3. Otorgar permisos
        console.log('🔐 Otorgando permisos...');
        await connection.execute(`
            GRANT ALL PRIVILEGES ON \`${dbName}\`.* 
            TO '${dbUser}'@'localhost';
        `);
        
        await connection.execute('FLUSH PRIVILEGES;');
        console.log(`✅ Permisos otorgados a '${dbUser}' sobre '${dbName}'`);
        
        // 4. Verificar conexión con nuevo usuario
        console.log('🔍 Verificando nueva conexión...');
        const testConnection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: dbUser,
            password: dbPassword,
            database: dbName
        });
        
        await testConnection.ping();
        await testConnection.end();
        console.log('✅ Conexión verificada exitosamente');
        
        console.log(`
🎉 ====================================
   BASE DE DATOS CONFIGURADA EXITOSAMENTE
🎉 ====================================
📊 Base de datos: ${dbName}
👤 Usuario: ${dbUser}
🔐 Host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}
⏰ Timestamp: ${new Date().toISOString()}
🎉 ====================================

💡 Próximo paso: ejecutar migraciones
   npm run migrate
   
   o manualmente:
   node src/config/migrate.js up
🎉 ====================================
        `);
        
        return true;
        
    } catch (error) {
        console.error(`
❌ ====================================
   ERROR CONFIGURANDO BASE DE DATOS
❌ ====================================
Error: ${error.message}

💡 Posibles soluciones:
   1. Verificar que MySQL esté ejecutándose
   2. Verificar credenciales de root
   3. Verificar permisos de MySQL
   4. Revisar firewall/red
❌ ====================================
        `);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

/**
 * Mostrar información de conexión
 */
async function showConnectionInfo() {
    console.log(`
📋 INFORMACIÓN DE CONEXIÓN ACTUAL:
==================================
Host: ${process.env.DB_HOST || 'localhost'}
Puerto: ${process.env.DB_PORT || 3306}
Usuario: ${process.env.DB_USER || 'crm_condorito'}
Base de datos: ${process.env.DB_NAME || 'crm_condorito_db'}
==================================
    `);
}

/**
 * Probar conexión con credenciales actuales
 */
async function testCurrentConnection() {
    try {
        console.log('🔍 Probando conexión con credenciales actuales...');
        
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'crm_condorito',
            password: process.env.DB_PASSWORD || 'CRM2024$ecure!',
            database: process.env.DB_NAME || 'crm_condorito_db'
        });
        
        await connection.ping();
        console.log('✅ Conexión exitosa con credenciales actuales');
        
        // Mostrar información de la BD
        const [rows] = await connection.execute('SELECT DATABASE() as db, USER() as user, VERSION() as version');
        console.log(`📊 Conectado a: ${rows[0].db}`);
        console.log(`👤 Como usuario: ${rows[0].user}`);
        console.log(`🔢 Versión MySQL: ${rows[0].version}`);
        
        await connection.end();
        return true;
        
    } catch (error) {
        console.error('❌ Error en conexión actual:', error.message);
        return false;
    }
}

// ============================================================================
// EJECUCIÓN CLI
// ============================================================================

if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    
    (async () => {
        try {
            switch (command) {
                case 'setup':
                    await setupDatabase();
                    break;
                    
                case 'test':
                    await testCurrentConnection();
                    break;
                    
                case 'info':
                    await showConnectionInfo();
                    break;
                    
                default:
                    console.log(`
📖 Uso del script de configuración de BD:

   node src/config/create-database.js setup    Crear BD y usuario
   node src/config/create-database.js test     Probar conexión actual
   node src/config/create-database.js info     Mostrar info de conexión
                    `);
            }
            
            process.exit(0);
            
        } catch (error) {
            console.error('❌ Error:', error.message);
            process.exit(1);
        }
    })();
}

module.exports = {
    setupDatabase,
    testCurrentConnection,
    showConnectionInfo
};
