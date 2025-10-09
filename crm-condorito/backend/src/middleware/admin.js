const jwt = require('jsonwebtoken');
const { executeQuery } = require('../config/database-simple');

/**
 * Middleware para verificar permisos de administrador
 * Solo permite acceso a usuarios con company_name = 'Admin'
 */
const requireAdmin = async (req, res, next) => {
    try {
        // Verificar que el usuario esté autenticado
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado'
            });
        }

        // Verificar que el usuario sea administrador
        const query = `
            SELECT id, client_code, company_name, email, status
            FROM clients 
            WHERE id = ? AND company_name = 'Admin' AND status = 'active'
        `;
        
        const adminUser = await executeQuery(query, [req.user.id]);
        
        if (adminUser.length === 0) {
            console.log(`🚫 Access denied for user ${req.user.client_code} - Not admin`);
            return res.status(403).json({
                success: false,
                message: 'Acceso denegado. Se requieren permisos de administrador.'
            });
        }

        // Agregar información del admin al request
        req.admin = adminUser[0];
        
        console.log(`👑 Admin access granted for ${req.admin.client_code}`);
        next();
        
    } catch (error) {
        console.error('❌ Error in admin middleware:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

/**
 * Verificar si un usuario es administrador (sin bloquear la request)
 */
const isAdmin = async (req, res, next) => {
    try {
        if (req.user && req.user.id) {
            const query = `
                SELECT id, client_code, company_name
                FROM clients 
                WHERE id = ? AND company_name = 'Admin' AND status = 'active'
            `;
            
            const adminUser = await executeQuery(query, [req.user.id]);
            req.isAdmin = adminUser.length > 0;
            
            if (req.isAdmin) {
                req.admin = adminUser[0];
            }
        } else {
            req.isAdmin = false;
        }
        
        next();
        
    } catch (error) {
        console.error('❌ Error checking admin status:', error.message);
        req.isAdmin = false;
        next();
    }
};

module.exports = {
    requireAdmin,
    isAdmin
};
