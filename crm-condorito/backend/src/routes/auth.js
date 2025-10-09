const express = require('express');
const AuthController = require('../controllers/AuthController');
const { authenticateToken, logAccess, clientRateLimit } = require('../middleware/auth');

const router = express.Router();

// ============================================================================
// AUTH ROUTES - CRM CONDORITO
// ============================================================================

// Rate limiting específico para auth endpoints
const authRateLimit = clientRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    maxRequests: 10, // Máximo 10 intentos de login por 15 minutos
    message: 'Demasiados intentos de autenticación, intenta más tarde'
});

// ============================================================================
// PUBLIC ROUTES (No requieren autenticación)
// ============================================================================

/**
 * POST /api/auth/login
 * Iniciar sesión con client_code y password
 */
router.post('/login', authRateLimit, AuthController.login);

/**
 * POST /api/auth/refresh
 * Renovar tokens usando refresh token
 */
router.post('/refresh', authRateLimit, AuthController.refresh);

/**
 * POST /api/auth/validate-client-code
 * Validar disponibilidad de código de cliente
 */
router.post('/validate-client-code', AuthController.validateClientCode);

// ============================================================================
// PROTECTED ROUTES (Requieren autenticación)
// ============================================================================

/**
 * GET /api/auth/verify
 * Verificar validez del token actual
 */
router.get('/verify', authenticateToken, logAccess, AuthController.verify);

/**
 * POST /api/auth/logout
 * Cerrar sesión
 */
router.post('/logout', authenticateToken, logAccess, AuthController.logout);

/**
 * GET /api/auth/profile
 * Obtener perfil del cliente autenticado
 */
router.get('/profile', authenticateToken, logAccess, AuthController.getProfile);

/**
 * PUT /api/auth/profile
 * Actualizar perfil del cliente autenticado
 */
router.put('/profile', authenticateToken, logAccess, AuthController.updateProfile);

/**
 * POST /api/auth/change-password
 * Cambiar contraseña del cliente autenticado
 */
router.post('/change-password', authenticateToken, logAccess, authRateLimit, AuthController.changePassword);

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * GET /api/auth/health
 * Health check específico para el módulo de autenticación
 */
router.get('/health', (req, res) => {
    res.json({
        module: 'auth',
        status: 'OK',
        timestamp: new Date().toISOString(),
        endpoints: {
            public: [
                'POST /api/auth/login',
                'POST /api/auth/refresh',
                'POST /api/auth/validate-client-code'
            ],
            protected: [
                'GET /api/auth/verify',
                'POST /api/auth/logout',
                'GET /api/auth/profile',
                'PUT /api/auth/profile',
                'POST /api/auth/change-password'
            ]
        }
    });
});

module.exports = router;
