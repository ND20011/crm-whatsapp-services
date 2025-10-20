const AuthService = require('../services/AuthService');
const Joi = require('joi');

// ============================================================================
// AUTH CONTROLLER - CRM CONDORITO
// ============================================================================

class AuthController {
    
    /**
     * Login endpoint - POST /api/auth/login
     */
    static async login(req, res, next) {
        try {
            // Validación de entrada
            const schema = Joi.object({
                client_code: Joi.string().required().min(3).max(50).messages({
                    'string.empty': 'El código de cliente es requerido',
                    'string.min': 'El código de cliente debe tener al menos 3 caracteres',
                    'string.max': 'El código de cliente no puede tener más de 50 caracteres'
                }),
                password: Joi.string().required().min(6).messages({
                    'string.empty': 'La contraseña es requerida',
                    'string.min': 'La contraseña debe tener al menos 6 caracteres'
                })
            });
            
            const { error, value } = schema.validate(req.body);
            
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: 'Datos de entrada inválidos',
                    errors: error.details.map(detail => detail.message)
                });
            }
            
            const { client_code, password } = value;
            
            // Registrar intento de login
            console.log(`🔐 Login attempt from IP: ${req.ip} for client: ${client_code}`);
            
            // Autenticar
            const result = await AuthService.login(client_code, password);
            
            // Configurar cookies para los tokens (opcional)
            if (process.env.NODE_ENV === 'production') {
                res.cookie('accessToken', result.tokens.accessToken, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'strict',
                    maxAge: 24 * 60 * 60 * 1000 // 24 horas
                });
                
                res.cookie('refreshToken', result.tokens.refreshToken, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'strict',
                    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
                });
            }
            
            res.status(200).json(result);
            
        } catch (error) {
            console.error('❌ Error in AuthController.login:', error.message);
            
            // Errores específicos de autenticación
            if (error.message.includes('Credenciales inválidas') || 
                error.message.includes('Cliente no encontrado')) {
                return res.status(401).json({
                    success: false,
                    message: 'Credenciales inválidas'
                });
            }
            
            if (error.message.includes('inactivo') || error.message.includes('suspendido')) {
                return res.status(403).json({
                    success: false,
                    message: 'Cuenta inactiva o suspendida'
                });
            }
            
            next(error);
        }
    }
    
    /**
     * Logout endpoint - POST /api/auth/logout
     */
    static async logout(req, res, next) {
        try {
            const clientCode = req.user?.clientCode;
            
            if (clientCode) {
                await AuthService.logout(clientCode);
                console.log(`🚪 Logout successful for: ${clientCode}`);
            }
            
            // Limpiar cookies
            res.clearCookie('accessToken');
            res.clearCookie('refreshToken');
            
            res.status(200).json({
                success: true,
                message: 'Logout exitoso'
            });
            
        } catch (error) {
            console.error('❌ Error in AuthController.logout:', error.message);
            next(error);
        }
    }
    
    /**
     * Verify token endpoint - GET /api/auth/verify
     */
    static async verify(req, res, next) {
        try {
            // El middleware de auth ya verificó el token
            // Solo devolvemos la información del usuario
            const client = req.user.client;
            
            // Obtener estadísticas actualizadas
            const Client = require('../entities/Client');
            const clientEntity = await Client.findById(client.id);
            
            if (!clientEntity) {
                return res.status(404).json({
                    success: false,
                    message: 'Cliente no encontrado'
                });
            }
            
            const stats = await clientEntity.getStats();
            
            res.status(200).json({
                success: true,
                message: 'Token válido',
                client: clientEntity.toJSON(),
                stats,
                tokenInfo: {
                    issuedAt: new Date(req.user.iat * 1000),
                    expiresAt: new Date(req.user.exp * 1000),
                    issuer: req.user.iss,
                    audience: req.user.aud
                }
            });
            
        } catch (error) {
            console.error('❌ Error in AuthController.verify:', error.message);
            next(error);
        }
    }
    
    /**
     * Refresh tokens endpoint - POST /api/auth/refresh
     */
    static async refresh(req, res, next) {
        try {
            // Validación de entrada
            const schema = Joi.object({
                refreshToken: Joi.string().required().messages({
                    'string.empty': 'Refresh token es requerido'
                })
            });
            
            const { error, value } = schema.validate(req.body);
            
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: 'Refresh token requerido',
                    errors: error.details.map(detail => detail.message)
                });
            }
            
            const { refreshToken } = value;
            
            // Renovar tokens
            const result = await AuthService.refreshTokens(refreshToken);
            
            // Configurar nuevas cookies
            if (process.env.NODE_ENV === 'production') {
                res.cookie('accessToken', result.tokens.accessToken, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'strict',
                    maxAge: 24 * 60 * 60 * 1000
                });
                
                res.cookie('refreshToken', result.tokens.refreshToken, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'strict',
                    maxAge: 7 * 24 * 60 * 60 * 1000
                });
            }
            
            res.status(200).json(result);
            
        } catch (error) {
            console.error('❌ Error in AuthController.refresh:', error.message);
            
            if (error.message.includes('expirado') || 
                error.message.includes('inválido') ||
                error.message.includes('no encontrado')) {
                return res.status(401).json({
                    success: false,
                    message: 'Refresh token inválido o expirado'
                });
            }
            
            next(error);
        }
    }
    
    /**
     * Change password endpoint - POST /api/auth/change-password
     */
    static async changePassword(req, res, next) {
        try {
            // Validación de entrada
            const schema = Joi.object({
                currentPassword: Joi.string().required().messages({
                    'string.empty': 'La contraseña actual es requerida'
                }),
                newPassword: Joi.string().required().min(6).messages({
                    'string.empty': 'La nueva contraseña es requerida',
                    'string.min': 'La nueva contraseña debe tener al menos 6 caracteres'
                }),
                confirmPassword: Joi.string().required().valid(Joi.ref('newPassword')).messages({
                    'string.empty': 'La confirmación de contraseña es requerida',
                    'any.only': 'Las contraseñas no coinciden'
                })
            });
            
            const { error, value } = schema.validate(req.body);
            
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: 'Datos de entrada inválidos',
                    errors: error.details.map(detail => detail.message)
                });
            }
            
            const { currentPassword, newPassword } = value;
            
            // Verificar contraseña actual
            const Client = require('../entities/Client');
            const client = await Client.verifyCredentials(req.user.clientCode, currentPassword);
            
            if (!client) {
                return res.status(401).json({
                    success: false,
                    message: 'Contraseña actual incorrecta'
                });
            }
            
            // Validar fortaleza de nueva contraseña
            const passwordValidation = AuthService.validatePassword(newPassword);
            
            if (!passwordValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: 'La nueva contraseña no cumple con los requisitos de seguridad',
                    errors: passwordValidation.errors,
                    strength: passwordValidation.strength
                });
            }
            
            // Cambiar contraseña
            await client.changePassword(newPassword);
            
            console.log(`🔐 Password changed for client: ${client.client_code}`);
            
            res.status(200).json({
                success: true,
                message: 'Contraseña cambiada exitosamente',
                passwordStrength: passwordValidation.strength
            });
            
        } catch (error) {
            console.error('❌ Error in AuthController.changePassword:', error.message);
            next(error);
        }
    }
    
    /**
     * Get client profile endpoint - GET /api/auth/profile
     */
    static async getProfile(req, res, next) {
        try {
            const Client = require('../entities/Client');
            const client = await Client.findById(req.user.id);
            
            if (!client) {
                return res.status(404).json({
                    success: false,
                    message: 'Cliente no encontrado'
                });
            }
            
            // Obtener información adicional
            const [stats, whatsappSession, botConfig] = await Promise.all([
                client.getStats(),
                client.getWhatsAppSession(),
                client.getBotConfiguration()
            ]);
            
            res.status(200).json({
                success: true,
                client: client.toJSON(),
                stats,
                whatsappSession: whatsappSession ? {
                    id: whatsappSession.id,
                    phone_number: whatsappSession.phone_number,
                    status: whatsappSession.status,
                    connected_at: whatsappSession.connected_at,
                    last_activity: whatsappSession.last_activity
                } : null,
                botConfig: botConfig ? {
                    is_enabled: botConfig.is_enabled,
                    working_hours_start: botConfig.working_hours_start,
                    working_hours_end: botConfig.working_hours_end,
                    working_days: (() => {
                        try {
                            return botConfig.working_days ? JSON.parse(botConfig.working_days) : [1,2,3,4,5];
                        } catch (e) {
                            console.warn('⚠️ Error parsing working_days, using default:', e.message);
                            return [1,2,3,4,5]; // Lunes a Viernes por defecto
                        }
                    })()
                } : null
            });
            
        } catch (error) {
            console.error('❌ Error in AuthController.getProfile:', error.message);
            next(error);
        }
    }
    
    /**
     * Update client profile endpoint - PUT /api/auth/profile
     */
    static async updateProfile(req, res, next) {
        try {
            // Validación de entrada
            const schema = Joi.object({
                company_name: Joi.string().min(2).max(255).messages({
                    'string.min': 'El nombre de la empresa debe tener al menos 2 caracteres',
                    'string.max': 'El nombre de la empresa no puede tener más de 255 caracteres'
                }),
                email: Joi.string().email().messages({
                    'string.email': 'El email no tiene un formato válido'
                }),
                phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).messages({
                    'string.pattern.base': 'El teléfono no tiene un formato válido'
                })
            });
            
            const { error, value } = schema.validate(req.body);
            
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: 'Datos de entrada inválidos',
                    errors: error.details.map(detail => detail.message)
                });
            }
            
            // Obtener cliente actual
            const Client = require('../entities/Client');
            const client = await Client.findById(req.user.id);
            
            if (!client) {
                return res.status(404).json({
                    success: false,
                    message: 'Cliente no encontrado'
                });
            }
            
            // Actualizar campos proporcionados
            if (value.company_name) client.company_name = value.company_name;
            if (value.email) client.email = value.email;
            if (value.phone) client.phone = value.phone;
            
            // Guardar cambios
            await client.save();
            
            console.log(`✅ Profile updated for client: ${client.client_code}`);
            
            res.status(200).json({
                success: true,
                message: 'Perfil actualizado exitosamente',
                client: client.toJSON()
            });
            
        } catch (error) {
            console.error('❌ Error in AuthController.updateProfile:', error.message);
            
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({
                    success: false,
                    message: 'El email ya está en uso por otro cliente'
                });
            }
            
            next(error);
        }
    }
    
    /**
     * Validate client code endpoint - POST /api/auth/validate-client-code
     */
    static async validateClientCode(req, res, next) {
        try {
            const schema = Joi.object({
                client_code: Joi.string().required().min(3).max(50)
            });
            
            const { error, value } = schema.validate(req.body);
            
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: 'Código de cliente inválido'
                });
            }
            
            const { client_code } = value;
            
            // Validar formato
            const isValidFormat = AuthService.validateClientCode(client_code);
            
            if (!isValidFormat) {
                return res.status(400).json({
                    success: false,
                    message: 'Formato de código de cliente inválido',
                    available: false
                });
            }
            
            // Verificar disponibilidad
            const Client = require('../entities/Client');
            const existingClient = await Client.findByClientCode(client_code);
            
            res.status(200).json({
                success: true,
                available: !existingClient,
                message: existingClient ? 'Código de cliente no disponible' : 'Código de cliente disponible'
            });
            
        } catch (error) {
            console.error('❌ Error in AuthController.validateClientCode:', error.message);
            next(error);
        }
    }
}

module.exports = AuthController;
