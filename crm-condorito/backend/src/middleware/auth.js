const AuthService = require('../services/AuthService');

// ============================================================================
// AUTH MIDDLEWARE - CRM CONDORITO
// ============================================================================

/**
 * Middleware para verificar autenticación JWT
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next function
 */
const authenticateToken = async (req, res, next) => {
    try {
        // Obtener token del header Authorization o cookies
        let token = req.header('Authorization');
        
        // Si no hay token en headers, intentar obtener de cookies
        if (!token && req.cookies && req.cookies.accessToken) {
            token = `Bearer ${req.cookies.accessToken}`;
        }
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token de acceso requerido',
                code: 'TOKEN_MISSING'
            });
        }
        
        // Verificar token
        const payload = await AuthService.verifyToken(token);
        
        // Agregar información del usuario al request
        req.user = payload;
        
        // Log de acceso (opcional)
        if (process.env.DEBUG_AUTH === 'true') {
            console.log(`🔐 Authenticated access: ${payload.clientCode} to ${req.method} ${req.path}`);
        }
        
        next();
        
    } catch (error) {
        console.error('❌ Auth middleware error:', error.message);
        
        // Errores específicos de JWT
        if (error.message.includes('Token expirado')) {
            return res.status(401).json({
                success: false,
                message: 'Token expirado',
                code: 'TOKEN_EXPIRED'
            });
        }
        
        if (error.message.includes('Token inválido')) {
            return res.status(401).json({
                success: false,
                message: 'Token inválido',
                code: 'TOKEN_INVALID'
            });
        }
        
        if (error.message.includes('Cliente no encontrado')) {
            return res.status(401).json({
                success: false,
                message: 'Cliente no encontrado',
                code: 'CLIENT_NOT_FOUND'
            });
        }
        
        if (error.message.includes('inactivo') || error.message.includes('suspendido')) {
            return res.status(403).json({
                success: false,
                message: 'Cuenta inactiva o suspendida',
                code: 'ACCOUNT_INACTIVE'
            });
        }
        
        // Error genérico
        return res.status(401).json({
            success: false,
            message: 'No autorizado',
            code: 'UNAUTHORIZED'
        });
    }
};

/**
 * Middleware opcional - continúa si hay token válido, pero no requiere autenticación
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next function
 */
const optionalAuth = async (req, res, next) => {
    try {
        let token = req.header('Authorization');
        
        if (!token && req.cookies && req.cookies.accessToken) {
            token = `Bearer ${req.cookies.accessToken}`;
        }
        
        if (token) {
            try {
                const payload = await AuthService.verifyToken(token);
                req.user = payload;
            } catch (error) {
                // Ignorar errores de token en auth opcional
                console.log('⚠️ Optional auth failed, continuing without user:', error.message);
            }
        }
        
        next();
        
    } catch (error) {
        // En auth opcional, siempre continuar
        next();
    }
};

/**
 * Middleware para verificar que el cliente está activo
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next function
 */
const requireActiveClient = (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Autenticación requerida',
                code: 'AUTH_REQUIRED'
            });
        }
        
        if (!req.user.client || req.user.client.status !== 'active') {
            return res.status(403).json({
                success: false,
                message: 'Cliente inactivo o suspendido',
                code: 'ACCOUNT_INACTIVE'
            });
        }
        
        next();
        
    } catch (error) {
        console.error('❌ Active client middleware error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Error verificando estado del cliente',
            code: 'SERVER_ERROR'
        });
    }
};

/**
 * Middleware para verificar permisos específicos (extensible para futuras funcionalidades)
 * @param {Array} requiredPermissions - Permisos requeridos
 * @returns {Function} Middleware function
 */
const requirePermissions = (requiredPermissions = []) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Autenticación requerida',
                    code: 'AUTH_REQUIRED'
                });
            }
            
            // Por ahora, todos los clientes activos tienen todos los permisos
            // Esta funcionalidad se puede expandir en el futuro
            const clientPermissions = ['read', 'write', 'delete', 'admin']; // Permisos por defecto
            
            const hasPermissions = requiredPermissions.every(permission => 
                clientPermissions.includes(permission)
            );
            
            if (!hasPermissions) {
                return res.status(403).json({
                    success: false,
                    message: 'Permisos insuficientes',
                    code: 'INSUFFICIENT_PERMISSIONS',
                    required: requiredPermissions,
                    current: clientPermissions
                });
            }
            
            next();
            
        } catch (error) {
            console.error('❌ Permissions middleware error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'Error verificando permisos',
                code: 'SERVER_ERROR'
            });
        }
    };
};

/**
 * Middleware para verificar que el cliente accede solo a sus propios recursos
 * @param {string} paramName - Nombre del parámetro que contiene el client_id/client_code
 * @returns {Function} Middleware function
 */
const requireOwnResource = (paramName = 'clientCode') => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Autenticación requerida',
                    code: 'AUTH_REQUIRED'
                });
            }
            
            const resourceClientCode = req.params[paramName] || req.body[paramName] || req.query[paramName];
            const userClientCode = req.user.clientCode;
            
            // Verificar que el cliente solo accede a sus propios recursos
            if (resourceClientCode && resourceClientCode !== userClientCode) {
                console.warn(`⚠️ Unauthorized resource access attempt: ${userClientCode} -> ${resourceClientCode}`);
                
                return res.status(403).json({
                    success: false,
                    message: 'No autorizado para acceder a este recurso',
                    code: 'RESOURCE_ACCESS_DENIED'
                });
            }
            
            next();
            
        } catch (error) {
            console.error('❌ Own resource middleware error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'Error verificando acceso al recurso',
                code: 'SERVER_ERROR'
            });
        }
    };
};

const { logger } = require('../config/logger');

/**
 * Middleware para logging de acceso autenticado (solo operaciones importantes)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next function
 */
const logAccess = (req, res, next) => {
    // Solo logear operaciones importantes (POST, PUT, DELETE)
    const isImportantOperation = ['POST', 'PUT', 'DELETE'].includes(req.method);
    
    if (req.user && isImportantOperation) {
        const operation = req.method === 'POST' ? '➕' : req.method === 'PUT' ? '✏️' : '🗑️';
        logger.api(`${operation} ${req.user.clientCode} | ${req.method} ${req.originalUrl}`);
    }
    next();
};

/**
 * Middleware para rate limiting por cliente autenticado
 * @param {Object} options - Opciones de rate limiting
 * @returns {Function} Middleware function
 */
const clientRateLimit = (options = {}) => {
    const {
        windowMs = 15 * 60 * 1000, // 15 minutos
        maxRequests = 100, // Máximo de requests por ventana
        message = 'Demasiadas solicitudes, intenta más tarde'
    } = options;
    
    // Almacén en memoria para tracking (en producción usar Redis)
    const clients = new Map();
    
    return (req, res, next) => {
        try {
            if (!req.user) {
                return next(); // Si no hay usuario, no aplicar rate limiting
            }
            
            const clientCode = req.user.clientCode;
            const now = Date.now();
            const windowStart = now - windowMs;
            
            // Obtener o crear registro del cliente
            if (!clients.has(clientCode)) {
                clients.set(clientCode, []);
            }
            
            const clientRequests = clients.get(clientCode);
            
            // Limpiar requests fuera de la ventana
            const validRequests = clientRequests.filter(timestamp => timestamp > windowStart);
            
            if (validRequests.length >= maxRequests) {
                return res.status(429).json({
                    success: false,
                    message,
                    code: 'RATE_LIMIT_EXCEEDED',
                    retryAfter: Math.ceil(windowMs / 1000)
                });
            }
            
            // Agregar request actual
            validRequests.push(now);
            clients.set(clientCode, validRequests);
            
            next();
            
        } catch (error) {
            console.error('❌ Rate limit middleware error:', error.message);
            next(); // Continuar en caso de error
        }
    };
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    authenticateToken,
    optionalAuth,
    requireActiveClient,
    requirePermissions,
    requireOwnResource,
    logAccess,
    clientRateLimit
};
