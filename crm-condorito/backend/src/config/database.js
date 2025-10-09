const mysql = require('mysql2/promise');
require('dotenv').config();

// ============================================================================
// CONFIGURACIÓN DE BASE DE DATOS MYSQL
// ============================================================================

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'crm_condorito',
    password: process.env.DB_PASSWORD || 'CRM2024$ecure!',
    database: process.env.DB_NAME || 'crm_condorito_db',
    charset: 'utf8mb4',
    timezone: '+00:00',
    
    // Configuración del Pool de Conexiones
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    queueLimit: 0,
    idleTimeout: 300000, // 5 minutos
    acquireTimeout: 60000,
    waitForConnections: true,
    
    // Configuraciones adicionales para estabilidad
    supportBigNumbers: true,
    bigNumberStrings: true,
    dateStrings: false,
    multipleStatements: false,
    flags: ['COMPRESS', 'PROTOCOL_41', 'TRANSACTIONS'],
    
    // SSL (opcional para producción)
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false
};

// Crear el pool de conexiones
const pool = mysql.createPool(dbConfig);

// ============================================================================
// FUNCIONES DE UTILIDAD
// ============================================================================

/**
 * Ejecutar una consulta SQL
 * @param {string} query - La consulta SQL
 * @param {Array} params - Parámetros para la consulta
 * @returns {Promise} Resultado de la consulta
 */
async function executeQuery(query, params = []) {
    let connection;
    try {
        connection = await pool.getConnection();
        
        if (process.env.DEBUG_DATABASE === 'true') {
            console.log('🗃️  SQL Query:', query);
            console.log('🗃️  SQL Params:', params);
        }
        
        const [results] = await connection.execute(query, params);
        
        if (process.env.DEBUG_DATABASE === 'true') {
            console.log('🗃️  SQL Results:', Array.isArray(results) ? `${results.length} rows` : 'Operation completed');
        }
        
        return results;
    } catch (error) {
        console.error('❌ Database Error:', error.message);
        console.error('❌ Query:', query);
        console.error('❌ Params:', params);
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

/**
 * Ejecutar múltiples consultas en una transacción
 * @param {Array} queries - Array de objetos {query, params}
 * @returns {Promise} Resultado de las consultas
 */
async function executeTransaction(queries) {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        
        const results = [];
        
        for (const { query, params = [] } of queries) {
            if (process.env.DEBUG_DATABASE === 'true') {
                console.log('🗃️  Transaction Query:', query);
                console.log('🗃️  Transaction Params:', params);
            }
            
            const [result] = await connection.execute(query, params);
            results.push(result);
        }
        
        await connection.commit();
        
        if (process.env.DEBUG_DATABASE === 'true') {
            console.log('✅ Transaction completed successfully');
        }
        
        return results;
    } catch (error) {
        if (connection) {
            await connection.rollback();
            console.log('🔄 Transaction rolled back due to error');
        }
        
        console.error('❌ Transaction Error:', error.message);
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

/**
 * Verificar la conexión a la base de datos
 * @returns {Promise<boolean>} True si la conexión es exitosa
 */
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        
        console.log('✅ Conexión a MySQL establecida correctamente');
        console.log(`📡 Servidor: ${dbConfig.host}:${dbConfig.port}`);
        console.log(`🗃️  Base de datos: ${dbConfig.database}`);
        console.log(`👤 Usuario: ${dbConfig.user}`);
        
        return true;
    } catch (error) {
        console.error('❌ Error conectando a MySQL:', error.message);
        return false;
    }
}

/**
 * Obtener estadísticas del pool de conexiones
 * @returns {Object} Estadísticas del pool
 */
function getPoolStats() {
    return {
        totalConnections: pool._allConnections.length,
        freeConnections: pool._freeConnections.length,
        acquiringConnections: pool._acquiringConnections.length,
        connectionLimit: pool.config.connectionLimit
    };
}

/**
 * Cerrar el pool de conexiones
 * @returns {Promise}
 */
async function closePool() {
    try {
        await pool.end();
        console.log('✅ Pool de conexiones MySQL cerrado correctamente');
    } catch (error) {
        console.error('❌ Error cerrando pool de conexiones:', error.message);
        throw error;
    }
}

/**
 * Escape de strings para prevenir SQL injection
 * @param {string} value - Valor a escapar
 * @returns {string} Valor escapado
 */
function escapeString(value) {
    return mysql.escape(value);
}

/**
 * Formatear fecha para MySQL
 * @param {Date} date - Fecha a formatear
 * @returns {string} Fecha formateada
 */
function formatDateForMySQL(date = new Date()) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

// ============================================================================
// FUNCIONES DE CONSULTA ESPECÍFICAS
// ============================================================================

/**
 * Verificar si una tabla existe
 * @param {string} tableName - Nombre de la tabla
 * @returns {Promise<boolean>} True si la tabla existe
 */
async function tableExists(tableName) {
    try {
        const query = `
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = ? AND table_name = ?
        `;
        const result = await executeQuery(query, [dbConfig.database, tableName]);
        return result[0].count > 0;
    } catch (error) {
        console.error(`❌ Error verificando tabla ${tableName}:`, error.message);
        return false;
    }
}

/**
 * Obtener información de la base de datos
 * @returns {Promise<Object>} Información de la BD
 */
async function getDatabaseInfo() {
    try {
        const queries = [
            'SELECT VERSION() as version',
            'SELECT DATABASE() as current_database',
            'SELECT USER() as current_user',
            'SELECT @@character_set_database as charset',
            'SELECT @@collation_database as collation'
        ];
        
        const results = {};
        
        for (const query of queries) {
            const result = await executeQuery(query);
            Object.assign(results, result[0]);
        }
        
        return results;
    } catch (error) {
        console.error('❌ Error obteniendo información de la BD:', error.message);
        throw error;
    }
}

// ============================================================================
// MANEJO DE EVENTOS DEL POOL
// ============================================================================

pool.on('connection', (connection) => {
    console.log('🔗 Nueva conexión establecida:', connection.threadId);
});

pool.on('error', (error) => {
    console.error('❌ Error en el pool de conexiones:', error.message);
    
    if (error.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('🔄 Intentando reconectar...');
        // El pool manejará automáticamente la reconexión
    }
});

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    pool,
    executeQuery,
    executeTransaction,
    testConnection,
    getPoolStats,
    closePool,
    escapeString,
    formatDateForMySQL,
    tableExists,
    getDatabaseInfo,
    dbConfig
};
