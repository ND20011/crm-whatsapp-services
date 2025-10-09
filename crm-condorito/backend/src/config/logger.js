/**
 * Sistema de Logging Centralizado - CRM Condorito
 * 
 * Niveles de log:
 * - SILENT: Sin logs
 * - ERROR: Solo errores críticos
 * - WARN: Errores y advertencias
 * - INFO: Información importante (default producción)
 * - DEBUG: Información detallada (default desarrollo)
 * - TRACE: Todo (muy verboso)
 */

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_TEST = process.env.NODE_ENV === 'test';
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'INFO' : 'DEBUG');

// Mapeo de niveles
const LOG_LEVELS = {
    SILENT: 0,
    ERROR: 1,
    WARN: 2,
    INFO: 3,
    DEBUG: 4,
    TRACE: 5
};

const CURRENT_LEVEL = LOG_LEVELS[LOG_LEVEL] || LOG_LEVELS.INFO;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Verifica si un nivel de log está habilitado
 */
const isEnabled = (level) => {
    if (IS_TEST) return false; // Sin logs en tests
    return LOG_LEVELS[level] <= CURRENT_LEVEL;
};

/**
 * Formatea el timestamp
 */
const getTimestamp = () => {
    return new Date().toISOString().substring(11, 23); // HH:mm:ss.SSS
};

/**
 * Formatea el mensaje con timestamp (solo en TRACE)
 */
const formatMessage = (emoji, message, data = '') => {
    const timestamp = CURRENT_LEVEL >= LOG_LEVELS.TRACE ? `[${getTimestamp()}] ` : '';
    const dataStr = data ? ` ${typeof data === 'object' ? JSON.stringify(data) : data}` : '';
    return `${timestamp}${emoji} ${message}${dataStr}`;
};

// ============================================================================
// LOGGER PRINCIPAL
// ============================================================================

const logger = {
    // Logs críticos (siempre se muestran excepto en SILENT)
    error: (message, data) => {
        if (isEnabled('ERROR')) {
            console.error(formatMessage('❌', message, data));
        }
    },
    
    warn: (message, data) => {
        if (isEnabled('WARN')) {
            console.warn(formatMessage('⚠️', message, data));
        }
    },
    
    // Logs informativos importantes
    info: (message, data) => {
        if (isEnabled('INFO')) {
            console.log(formatMessage('ℹ️', message, data));
        }
    },
    
    success: (message, data) => {
        if (isEnabled('INFO')) {
            console.log(formatMessage('✅', message, data));
        }
    },
    
    // Logs de debug (solo en desarrollo)
    debug: (message, data) => {
        if (isEnabled('DEBUG')) {
            console.log(formatMessage('🔍', message, data));
        }
    },
    
    trace: (message, data) => {
        if (isEnabled('TRACE')) {
            console.log(formatMessage('📝', message, data));
        }
    },
    
    // Logs específicos por categoría
    auth: (message, data) => {
        if (isEnabled('INFO')) {
            console.log(formatMessage('🔐', message, data));
        }
    },
    
    api: (message, data) => {
        if (isEnabled('DEBUG')) {
            console.log(formatMessage('📡', message, data));
        }
    },
    
    db: (message, data) => {
        if (isEnabled('DEBUG')) {
            console.log(formatMessage('💾', message, data));
        }
    },
    
    socket: (message, data) => {
        if (isEnabled('DEBUG')) {
            console.log(formatMessage('🔌', message, data));
        }
    },
    
    whatsapp: (message, data) => {
        if (isEnabled('INFO')) {
            console.log(formatMessage('📱', message, data));
        }
    },
    
    message: (message, data) => {
        if (isEnabled('DEBUG')) {
            console.log(formatMessage('📨', message, data));
        }
    },
    
    bot: (message, data) => {
        if (isEnabled('INFO')) {
            console.log(formatMessage('🤖', message, data));
        }
    },
    
    ai: (message, data) => {
        if (isEnabled('INFO')) {
            console.log(formatMessage('🧠', message, data));
        }
    },
    
    // Métodos de utilidad
    startup: (message, data) => {
        if (isEnabled('INFO')) {
            console.log(formatMessage('🚀', message, data));
        }
    },
    
    shutdown: (message, data) => {
        if (isEnabled('INFO')) {
            console.log(formatMessage('🛑', message, data));
        }
    }
};

// ============================================================================
// CONFIGURACIÓN DE MORGAN
// ============================================================================

const getMorganConfig = () => {
    if (IS_PRODUCTION) {
        // En producción, solo errores
        return {
            format: 'combined',
            options: {
                skip: (req, res) => res.statusCode < 400
            }
        };
    } else if (CURRENT_LEVEL >= LOG_LEVELS.DEBUG) {
        // En debug, formato detallado
        return {
            format: 'dev',
            options: {}
        };
    } else {
        // En desarrollo normal, formato corto sin GETs exitosos
        return {
            format: 'short',
            options: {
                skip: (req, res) => req.method === 'GET' && res.statusCode < 400
            }
        };
    }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    logger,
    isEnabled,
    LOG_LEVEL,
    CURRENT_LEVEL,
    getMorganConfig,
    
    // Alias para compatibilidad
    log: logger
};
