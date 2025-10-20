const jwt = require('jsonwebtoken');
const Client = require('../entities/Client');
require('dotenv').config();

// ============================================================================
// AUTH SERVICE - CRM CONDORITO
// ============================================================================

class AuthService {
    
    /**
     * Autenticar cliente con credenciales
     * @param {string} clientCode - Código del cliente
     * @param {string} password - Contraseña
     * @returns {Promise<Object>} Resultado de autenticación
     */
    static async login(clientCode, password) {
        try {
            console.log(`🔐 Intento de login: ${clientCode}`);
            
            // Validar parámetros
            if (!clientCode || !password) {
                throw new Error('Código de cliente y contraseña son requeridos');
            }
            
            // Verificar credenciales
            const client = await Client.verifyCredentials(clientCode, password);
            
            if (!client) {
                console.log(`❌ Login fallido para: ${clientCode}`);
                throw new Error('Credenciales inválidas');
            }
            
            console.log(`✅ Login exitoso: ${clientCode} (${client.company_name})`);
            
            // Verificar si es administrador
            const isAdmin = client.company_name === 'Admin';
            
            // Generar tokens
            const accessToken = AuthService.generateAccessToken(client);
            const refreshToken = AuthService.generateRefreshToken(client);
            
            // Obtener estadísticas del cliente
            const stats = await client.getStats();
            
            return {
                success: true,
                message: 'Login exitoso',
                client: client.toJSON(),
                isAdmin,
                redirectTo: isAdmin ? '/backoffice' : '/dashboard',
                tokens: {
                    accessToken,
                    refreshToken,
                    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
                },
                stats
            };
            
        } catch (error) {
            console.error('❌ Error en AuthService.login:', error.message);
            throw error;
        }
    }
    
    /**
     * Generar token de acceso JWT
     * @param {Client} client - Cliente autenticado
     * @returns {string} Token JWT
     */
    static generateAccessToken(client) {
        try {
            const payload = {
                id: client.id,
                clientCode: client.client_code,
                companyName: client.company_name,
                status: client.status,
                type: 'access'
            };
            
            const options = {
                expiresIn: process.env.JWT_EXPIRES_IN || '24h',
                issuer: 'crm-condorito',
                audience: 'crm-client'
            };
            
            return jwt.sign(payload, process.env.JWT_SECRET, options);
            
        } catch (error) {
            console.error('❌ Error generando access token:', error.message);
            throw new Error('Error generando token de acceso');
        }
    }
    
    /**
     * Generar token de refresh JWT
     * @param {Client} client - Cliente autenticado
     * @returns {string} Refresh token JWT
     */
    static generateRefreshToken(client) {
        try {
            const payload = {
                id: client.id,
                clientCode: client.client_code,
                type: 'refresh'
            };
            
            const options = {
                expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
                issuer: 'crm-condorito',
                audience: 'crm-client'
            };
            
            return jwt.sign(payload, process.env.JWT_SECRET, options);
            
        } catch (error) {
            console.error('❌ Error generando refresh token:', error.message);
            throw new Error('Error generando token de refresh');
        }
    }
    
    /**
     * Verificar y decodificar token JWT
     * @param {string} token - Token JWT
     * @returns {Promise<Object>} Payload decodificado
     */
    static async verifyToken(token) {
        try {
            if (!token) {
                throw new Error('Token no proporcionado');
            }
            
            // Remover "Bearer " si está presente
            const cleanToken = token.replace(/^Bearer\s+/i, '');
            
            const payload = jwt.verify(cleanToken, process.env.JWT_SECRET, {
                issuer: 'crm-condorito',
                audience: 'crm-client'
            });
            
            // Verificar que el cliente aún existe y está activo
            const client = await Client.findById(payload.id);
            
            if (!client) {
                throw new Error('Cliente no encontrado');
            }
            
            if (client.status !== 'active') {
                throw new Error('Cliente inactivo o suspendido');
            }
            
            return {
                ...payload,
                client: client.toJSON()
            };
            
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Token expirado');
            }
            
            if (error.name === 'JsonWebTokenError') {
                throw new Error('Token inválido');
            }
            
            console.error('❌ Error verificando token:', error.message);
            throw error;
        }
    }
    
    /**
     * Renovar token usando refresh token
     * @param {string} refreshToken - Refresh token JWT
     * @returns {Promise<Object>} Nuevos tokens
     */
    static async refreshTokens(refreshToken) {
        try {
            console.log('🔄 Renovando tokens...');
            
            if (!refreshToken) {
                throw new Error('Refresh token no proporcionado');
            }
            
            // Verificar refresh token
            const payload = jwt.verify(refreshToken, process.env.JWT_SECRET, {
                issuer: 'crm-condorito',
                audience: 'crm-client'
            });
            
            if (payload.type !== 'refresh') {
                throw new Error('Token inválido para refresh');
            }
            
            // Obtener cliente actualizado
            const client = await Client.findById(payload.id);
            
            if (!client) {
                throw new Error('Cliente no encontrado');
            }
            
            if (client.status !== 'active') {
                throw new Error('Cliente inactivo o suspendido');
            }
            
            // Generar nuevos tokens
            const newAccessToken = AuthService.generateAccessToken(client);
            const newRefreshToken = AuthService.generateRefreshToken(client);
            
            console.log(`✅ Tokens renovados para: ${client.client_code}`);
            
            return {
                success: true,
                message: 'Tokens renovados exitosamente',
                client: client.toJSON(),
                tokens: {
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken,
                    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
                }
            };
            
        } catch (error) {
            console.error('❌ Error renovando tokens:', error.message);
            throw error;
        }
    }
    
    /**
     * Logout (invalidar tokens - simulado)
     * @param {string} clientCode - Código del cliente
     * @returns {Promise<Object>} Resultado de logout
     */
    static async logout(clientCode) {
        try {
            console.log(`🚪 Logout: ${clientCode}`);
            
            // En una implementación real, aquí se agregarían los tokens 
            // a una blacklist o se manejaría invalidación en Redis
            
            return {
                success: true,
                message: 'Logout exitoso'
            };
            
        } catch (error) {
            console.error('❌ Error en logout:', error.message);
            throw error;
        }
    }
    
    /**
     * Validar formato de client code
     * @param {string} clientCode - Código a validar
     * @returns {boolean} True si es válido
     */
    static validateClientCode(clientCode) {
        // Client code debe tener entre 3-50 caracteres, solo letras, números y guiones
        const regex = /^[A-Za-z0-9\-_]{3,50}$/;
        return regex.test(clientCode);
    }
    
    /**
     * Validar fortaleza de contraseña
     * @param {string} password - Contraseña a validar
     * @returns {Object} Resultado de validación
     */
    static validatePassword(password) {
        const errors = [];
       
        if (!password || password.length < 6) {
            errors.push('La contraseña debe tener al menos 6 caracteres');
        }
         /*
        if (!/[a-z]/.test(password)) {
            errors.push('La contraseña debe contener al menos una letra minúscula');
        }
        
        if (!/[A-Z]/.test(password)) {
            errors.push('La contraseña debe contener al menos una letra mayúscula');
        }
        
        if (!/[0-9]/.test(password)) {
            errors.push('La contraseña debe contener al menos un número');
        }
        
        if (password.length > 128) {
            errors.push('La contraseña no puede tener más de 128 caracteres');
        }
        */
        return {
            isValid: errors.length === 0,
            errors,
            strength: AuthService.calculatePasswordStrength(password)
        };
    }
    
    /**
     * Calcular fortaleza de contraseña
     * @param {string} password - Contraseña
     * @returns {string} Nivel de fortaleza
     */
    static calculatePasswordStrength(password) {
        let score = 0;
        
        if (!password) return 'very-weak';
        
        // Longitud
        if (password.length >= 8) score += 1;
        if (password.length >= 12) score += 1;
        if (password.length >= 16) score += 1;
        
        // Complejidad
        if (/[a-z]/.test(password)) score += 1;
        if (/[A-Z]/.test(password)) score += 1;
        if (/[0-9]/.test(password)) score += 1;
        if (/[^A-Za-z0-9]/.test(password)) score += 1;
        
        // Patrones
        if (!/(.)\1{2,}/.test(password)) score += 1; // No repeticiones
        if (!/012|123|234|345|456|567|678|789|890|abc|bcd|cde/.test(password.toLowerCase())) score += 1;
        
        if (score < 3) return 'weak';
        if (score < 6) return 'medium';
        if (score < 8) return 'strong';
        return 'very-strong';
    }
    
    /**
     * Generar client code único
     * @param {string} companyName - Nombre de la empresa
     * @returns {Promise<string>} Client code único
     */
    static async generateUniqueClientCode(companyName) {
        try {
            // Crear código base desde el nombre de la empresa
            let baseCode = companyName
                .replace(/[^a-zA-Z0-9]/g, '')
                .toUpperCase()
                .substring(0, 8);
            
            if (baseCode.length < 3) {
                baseCode = 'CLI' + baseCode;
            }
            
            // Verificar si ya existe
            let clientCode = baseCode;
            let counter = 1;
            
            while (await Client.findByClientCode(clientCode)) {
                clientCode = `${baseCode}${counter.toString().padStart(3, '0')}`;
                counter++;
                
                if (counter > 999) {
                    // Fallback a código random
                    clientCode = 'CLI' + Math.random().toString(36).substring(2, 8).toUpperCase();
                    break;
                }
            }
            
            return clientCode;
            
        } catch (error) {
            console.error('❌ Error generando client code:', error.message);
            throw error;
        }
    }
    
    /**
     * Obtener información del token sin verificar (para debugging)
     * @param {string} token - Token JWT
     * @returns {Object} Payload decodificado
     */
    static decodeToken(token) {
        try {
            const cleanToken = token.replace(/^Bearer\s+/i, '');
            return jwt.decode(cleanToken);
        } catch (error) {
            console.error('❌ Error decodificando token:', error.message);
            return null;
        }
    }
}

module.exports = AuthService;
