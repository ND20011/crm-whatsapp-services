const mysql = require('mysql2/promise');
require('dotenv').config();

// ============================================================================
// CONFIGURACIÓN SIMPLE DE BASE DE DATOS MYSQL
// ============================================================================

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'crm_condorito_db',
    charset: 'utf8mb4',
};

// Crear el pool de conexiones simple
const pool = mysql.createPool(dbConfig);

/**
 * Ejecutar una consulta SQL
 * @param {string} query - La consulta SQL
 * @param {Array} params - Parámetros para la consulta
 * @returns {Promise} Resultado de la consulta
 */
async function executeQuery(query, params = []) {
    try {
        const [results] = await pool.execute(query, params);
        return results;
    } catch (error) {
        console.error('❌ Database Error:', error.message);
        console.error('❌ Query:', query);
        console.error('❌ Params:', params);
        throw error;
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

module.exports = {
    pool,
    executeQuery,
    testConnection,
    dbConfig
};
