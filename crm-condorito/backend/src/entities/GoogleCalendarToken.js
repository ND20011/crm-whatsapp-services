const { executeQuery } = require('../config/database-simple');
const Joi = require('joi');

// ============================================================================
// GOOGLE CALENDAR TOKEN ENTITY - CRM CONDORITO
// ============================================================================

class GoogleCalendarToken {
    constructor(data = {}) {
        this.id = data.id || null;
        this.client_id = data.client_id;
        
        // TOKENS DE GOOGLE OAUTH
        this.access_token = data.access_token || null;
        this.refresh_token = data.refresh_token || null;
        this.token_expires_at = data.token_expires_at || null;
        
        // ESTADO DE CONEXIÓN SIMPLE
        this.is_connected = data.is_connected || false;
        this.last_export_at = data.last_export_at || null;
        this.total_exports = data.total_exports || 0;
        
        // CONFIGURACIÓN
        this.calendar_id = data.calendar_id || 'primary';
        
        // METADATOS
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }

    /**
     * Crear o actualizar tokens de Google Calendar para un cliente
     */
    static async upsert(clientId, tokenData) {
        try {
            // Validar datos
            const validation = GoogleCalendarToken.validate({ client_id: clientId, ...tokenData });
            if (!validation.isValid) {
                throw new Error(`Datos inválidos: ${validation.errors.join(', ')}`);
            }

            // Verificar si ya existe un registro para este cliente
            const existing = await GoogleCalendarToken.findByClient(clientId);

            if (existing) {
                // Actualizar registro existente
                return await GoogleCalendarToken.update(clientId, tokenData);
            } else {
                // Crear nuevo registro
                return await GoogleCalendarToken.create(clientId, tokenData);
            }

        } catch (error) {
            console.error('❌ Error upserting Google Calendar tokens:', error.message);
            throw error;
        }
    }

    /**
     * Crear nuevos tokens de Google Calendar
     */
    static async create(clientId, tokenData) {
        try {
            const query = `
                INSERT INTO google_calendar_tokens (
                    client_id, access_token, refresh_token, token_expires_at,
                    is_connected, calendar_id
                ) VALUES (?, ?, ?, ?, ?, ?)
            `;

            const params = [
                clientId,
                tokenData.access_token,
                tokenData.refresh_token,
                tokenData.token_expires_at,
                true, // Se conectó exitosamente
                tokenData.calendar_id || 'primary'
            ];

            const result = await executeQuery(query, params);
            
            // Obtener el registro creado
            const createdToken = await GoogleCalendarToken.findByClient(clientId);
            
            console.log(`✅ Tokens de Google Calendar creados para cliente ${clientId}`);
            return createdToken;

        } catch (error) {
            console.error('❌ Error creating Google Calendar tokens:', error.message);
            throw error;
        }
    }

    /**
     * Actualizar tokens existentes
     */
    static async update(clientId, tokenData) {
        try {
            // Construir query dinámicamente
            const allowedFields = [
                'access_token', 'refresh_token', 'token_expires_at', 
                'is_connected', 'calendar_id', 'last_export_at', 'total_exports'
            ];

            const updateFields = [];
            const params = [];

            Object.keys(tokenData).forEach(field => {
                if (allowedFields.includes(field) && tokenData[field] !== undefined) {
                    updateFields.push(`${field} = ?`);
                    params.push(tokenData[field]);
                }
            });

            if (updateFields.length === 0) {
                throw new Error('No hay campos válidos para actualizar');
            }

            const query = `
                UPDATE google_calendar_tokens 
                SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
                WHERE client_id = ?
            `;

            params.push(clientId);

            const result = await executeQuery(query, params);

            if (result.affectedRows === 0) {
                throw new Error('No se encontraron tokens para actualizar');
            }

            // Retornar tokens actualizados
            const updatedToken = await GoogleCalendarToken.findByClient(clientId);
            console.log(`✅ Tokens de Google Calendar actualizados para cliente ${clientId}`);
            
            return updatedToken;

        } catch (error) {
            console.error('❌ Error updating Google Calendar tokens:', error.message);
            throw error;
        }
    }

    /**
     * Buscar tokens por cliente
     */
    static async findByClient(clientId) {
        try {
            const query = `
                SELECT * FROM google_calendar_tokens 
                WHERE client_id = ?
            `;

            const results = await executeQuery(query, [clientId]);
            
            if (results.length === 0) {
                return null;
            }

            return new GoogleCalendarToken(results[0]);

        } catch (error) {
            console.error('❌ Error finding Google Calendar tokens by client:', error.message);
            throw error;
        }
    }

    /**
     * Verificar si un cliente tiene tokens válidos
     */
    static async hasValidTokens(clientId) {
        try {
            const tokens = await GoogleCalendarToken.findByClient(clientId);
            
            if (!tokens || !tokens.is_connected) {
                return false;
            }

            // Verificar si el access token no ha expirado
            if (tokens.token_expires_at) {
                const expiresAt = new Date(tokens.token_expires_at);
                const now = new Date();
                
                // Si expira en menos de 5 minutos, considerarlo inválido
                const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
                
                if (expiresAt <= fiveMinutesFromNow) {
                    console.log(`⚠️ Access token para cliente ${clientId} está próximo a expirar`);
                    return false;
                }
            }

            return true;

        } catch (error) {
            console.error('❌ Error checking valid tokens:', error.message);
            return false;
        }
    }

    /**
     * Obtener tokens que necesitan refresh
     */
    static async getTokensNeedingRefresh() {
        try {
            const query = `
                SELECT * FROM google_calendar_tokens 
                WHERE is_connected = true
                  AND token_expires_at IS NOT NULL
                  AND token_expires_at <= DATE_ADD(NOW(), INTERVAL 10 MINUTE)
                  AND refresh_token IS NOT NULL
            `;

            const results = await executeQuery(query);
            
            return results.map(tokenData => new GoogleCalendarToken(tokenData));

        } catch (error) {
            console.error('❌ Error getting tokens needing refresh:', error.message);
            throw error;
        }
    }

    /**
     * Marcar como desconectado
     */
    static async disconnect(clientId) {
        try {
            const query = `
                UPDATE google_calendar_tokens 
                SET is_connected = false, 
                    access_token = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE client_id = ?
            `;

            const result = await executeQuery(query, [clientId]);

            if (result.affectedRows === 0) {
                throw new Error('No se encontraron tokens para desconectar');
            }

            console.log(`✅ Cliente ${clientId} desconectado de Google Calendar`);
            return true;

        } catch (error) {
            console.error('❌ Error disconnecting Google Calendar:', error.message);
            throw error;
        }
    }

    /**
     * Eliminar tokens de un cliente
     */
    static async delete(clientId) {
        try {
            const query = 'DELETE FROM google_calendar_tokens WHERE client_id = ?';
            const result = await executeQuery(query, [clientId]);

            if (result.affectedRows === 0) {
                throw new Error('No se encontraron tokens para eliminar');
            }

            console.log(`✅ Tokens de Google Calendar eliminados para cliente ${clientId}`);
            return true;

        } catch (error) {
            console.error('❌ Error deleting Google Calendar tokens:', error.message);
            throw error;
        }
    }

    /**
     * Incrementar contador de exportaciones
     */
    static async incrementExportCount(clientId) {
        try {
            const query = `
                UPDATE google_calendar_tokens 
                SET total_exports = total_exports + 1,
                    last_export_at = NOW(),
                    updated_at = CURRENT_TIMESTAMP
                WHERE client_id = ?
            `;

            const result = await executeQuery(query, [clientId]);

            if (result.affectedRows === 0) {
                throw new Error('No se encontraron tokens para actualizar contador');
            }

            return true;

        } catch (error) {
            console.error('❌ Error incrementing export count:', error.message);
            throw error;
        }
    }

    /**
     * Obtener estadísticas de uso de Google Calendar
     */
    static async getUsageStats() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_connected_clients,
                    SUM(total_exports) as total_exports_all_time,
                    AVG(total_exports) as avg_exports_per_client,
                    COUNT(CASE WHEN last_export_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as active_last_30_days,
                    COUNT(CASE WHEN last_export_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as active_last_7_days
                FROM google_calendar_tokens 
                WHERE is_connected = true
            `;

            const results = await executeQuery(query);
            return results[0];

        } catch (error) {
            console.error('❌ Error getting Google Calendar usage stats:', error.message);
            throw error;
        }
    }

    /**
     * Limpiar tokens desconectados antiguos
     */
    static async cleanupOldTokens(daysOld = 90) {
        try {
            const query = `
                DELETE FROM google_calendar_tokens 
                WHERE is_connected = false
                  AND updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)
            `;

            const result = await executeQuery(query, [daysOld]);
            
            if (result.affectedRows > 0) {
                console.log(`🧹 ${result.affectedRows} tokens antiguos desconectados eliminados`);
            }

            return result.affectedRows;

        } catch (error) {
            console.error('❌ Error cleaning up old tokens:', error.message);
            throw error;
        }
    }

    /**
     * Validar datos de tokens
     */
    static validate(data) {
        const schema = Joi.object({
            client_id: Joi.number().integer().positive().required(),
            access_token: Joi.string().allow(null),
            refresh_token: Joi.string().allow(null),
            token_expires_at: Joi.date().allow(null),
            is_connected: Joi.boolean(),
            calendar_id: Joi.string().max(255),
            last_export_at: Joi.date().allow(null),
            total_exports: Joi.number().integer().min(0)
        });

        const { error } = schema.validate(data);
        
        if (error) {
            return {
                isValid: false,
                errors: error.details.map(detail => detail.message)
            };
        }

        return { isValid: true, errors: [] };
    }

    /**
     * Verificar si el token está próximo a expirar
     */
    isTokenExpiringSoon(minutesThreshold = 10) {
        if (!this.token_expires_at) {
            return false;
        }

        const expiresAt = new Date(this.token_expires_at);
        const thresholdTime = new Date(Date.now() + minutesThreshold * 60 * 1000);

        return expiresAt <= thresholdTime;
    }

    /**
     * Verificar si el token ya expiró
     */
    isTokenExpired() {
        if (!this.token_expires_at) {
            return false;
        }

        const expiresAt = new Date(this.token_expires_at);
        const now = new Date();

        return expiresAt <= now;
    }

    /**
     * Convertir a JSON para API responses
     */
    toJSON() {
        return {
            id: this.id,
            client_id: this.client_id,
            // No exponer tokens por seguridad
            has_access_token: !!this.access_token,
            has_refresh_token: !!this.refresh_token,
            token_expires_at: this.token_expires_at,
            is_connected: this.is_connected,
            last_export_at: this.last_export_at,
            total_exports: this.total_exports,
            calendar_id: this.calendar_id,
            created_at: this.created_at,
            updated_at: this.updated_at,
            // Información adicional
            is_token_expired: this.isTokenExpired(),
            is_token_expiring_soon: this.isTokenExpiringSoon()
        };
    }

    /**
     * Convertir a JSON con tokens (solo para uso interno)
     */
    toJSONWithTokens() {
        return {
            ...this.toJSON(),
            access_token: this.access_token,
            refresh_token: this.refresh_token
        };
    }
}

module.exports = GoogleCalendarToken;
