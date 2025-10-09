/**
 * 🧠 Validador centralizado para configuraciones de IA
 * 
 * Este validador centraliza toda la lógica de validación de:
 * - business_prompt (límites de caracteres)
 * - max_tokens (rangos válidos)
 * - temperature (rangos válidos)
 * - Otros parámetros de configuración de IA
 */

class AIConfigValidator {
    
    // 📏 Constantes de límites
    static LIMITS = {
        BUSINESS_PROMPT: {
            MIN_LENGTH: 10,
            MAX_LENGTH: 8000  // Aumentado de 2000 a 8000
        },
        MAX_TOKENS: {
            MIN: 50,
            MAX: 2000
        },
        TEMPERATURE: {
            MIN: 0.0,
            MAX: 1.0
        },
        MAX_HISTORY_MESSAGES: {
            MIN: 1,
            MAX: 50
        },
        RESPONSE_TIMEOUT: {
            MIN: 5000,   // 5 segundos
            MAX: 60000   // 60 segundos
        },
        FALLBACK_MESSAGE: {
            MAX_LENGTH: 500
        }
    };

    // 🎯 Modos de IA válidos
    static VALID_AI_MODES = ['prompt_only', 'database_search'];

    /**
     * Validar configuración completa de IA
     * @param {Object} config - Configuración a validar
     * @returns {Object} Resultado de validación
     */
    static validateConfig(config) {
        const errors = [];

        // Validar business_prompt
        const promptValidation = this.validateBusinessPrompt(config.business_prompt);
        if (!promptValidation.valid) {
            errors.push(...promptValidation.errors);
        }

        // Validar max_tokens
        const tokensValidation = this.validateMaxTokens(config.max_tokens);
        if (!tokensValidation.valid) {
            errors.push(...tokensValidation.errors);
        }

        // Validar temperature
        const temperatureValidation = this.validateTemperature(config.temperature);
        if (!temperatureValidation.valid) {
            errors.push(...temperatureValidation.errors);
        }

        // Validar ai_mode
        const modeValidation = this.validateAIMode(config.ai_mode);
        if (!modeValidation.valid) {
            errors.push(...modeValidation.errors);
        }

        // Validar otros campos opcionales
        if (config.maxHistoryMessages !== undefined) {
            const historyValidation = this.validateMaxHistoryMessages(config.maxHistoryMessages);
            if (!historyValidation.valid) {
                errors.push(...historyValidation.errors);
            }
        }

        if (config.responseTimeout !== undefined) {
            const timeoutValidation = this.validateResponseTimeout(config.responseTimeout);
            if (!timeoutValidation.valid) {
                errors.push(...timeoutValidation.errors);
            }
        }

        if (config.fallbackMessage !== undefined) {
            const fallbackValidation = this.validateFallbackMessage(config.fallbackMessage);
            if (!fallbackValidation.valid) {
                errors.push(...fallbackValidation.errors);
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            summary: errors.length === 0 ? 'Configuración válida' : `${errors.length} errores encontrados`
        };
    }

    /**
     * Validar business_prompt
     * @param {string} prompt - Prompt a validar
     * @returns {Object} Resultado de validación
     */
    static validateBusinessPrompt(prompt) {
        const errors = [];

        if (!prompt || typeof prompt !== 'string') {
            errors.push('El prompt del negocio es requerido y debe ser un texto');
            return { valid: false, errors };
        }

        const trimmedPrompt = prompt.trim();
        
        if (trimmedPrompt.length === 0) {
            errors.push('El prompt del negocio no puede estar vacío');
        }

        if (trimmedPrompt.length < this.LIMITS.BUSINESS_PROMPT.MIN_LENGTH) {
            errors.push(`El prompt del negocio debe tener al menos ${this.LIMITS.BUSINESS_PROMPT.MIN_LENGTH} caracteres`);
        }

        if (trimmedPrompt.length > this.LIMITS.BUSINESS_PROMPT.MAX_LENGTH) {
            errors.push(`El prompt del negocio no puede exceder ${this.LIMITS.BUSINESS_PROMPT.MAX_LENGTH} caracteres (actual: ${trimmedPrompt.length})`);
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            length: trimmedPrompt.length,
            charactersRemaining: this.LIMITS.BUSINESS_PROMPT.MAX_LENGTH - trimmedPrompt.length
        };
    }

    /**
     * Validar max_tokens
     * @param {number} maxTokens - Tokens máximos a validar
     * @returns {Object} Resultado de validación
     */
    static validateMaxTokens(maxTokens) {
        const errors = [];

        if (maxTokens === undefined || maxTokens === null) {
            // max_tokens es opcional, usar valor por defecto
            return { valid: true, errors: [], value: 500 };
        }

        const tokens = parseInt(maxTokens);
        
        if (isNaN(tokens)) {
            errors.push('max_tokens debe ser un número válido');
            return { valid: false, errors };
        }

        if (tokens < this.LIMITS.MAX_TOKENS.MIN) {
            errors.push(`max_tokens debe ser al menos ${this.LIMITS.MAX_TOKENS.MIN}`);
        }

        if (tokens > this.LIMITS.MAX_TOKENS.MAX) {
            errors.push(`max_tokens no puede exceder ${this.LIMITS.MAX_TOKENS.MAX}`);
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            value: tokens
        };
    }

    /**
     * Validar temperature
     * @param {number} temperature - Temperatura a validar
     * @returns {Object} Resultado de validación
     */
    static validateTemperature(temperature) {
        const errors = [];

        if (temperature === undefined || temperature === null) {
            // temperature es opcional, usar valor por defecto
            return { valid: true, errors: [], value: 0.7 };
        }

        const temp = parseFloat(temperature);
        
        if (isNaN(temp)) {
            errors.push('temperature debe ser un número válido');
            return { valid: false, errors };
        }

        if (temp < this.LIMITS.TEMPERATURE.MIN) {
            errors.push(`temperature debe ser al menos ${this.LIMITS.TEMPERATURE.MIN}`);
        }

        if (temp > this.LIMITS.TEMPERATURE.MAX) {
            errors.push(`temperature no puede exceder ${this.LIMITS.TEMPERATURE.MAX}`);
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            value: temp
        };
    }

    /**
     * Validar ai_mode
     * @param {string} mode - Modo de IA a validar
     * @returns {Object} Resultado de validación
     */
    static validateAIMode(mode) {
        const errors = [];

        if (!mode) {
            errors.push('ai_mode es requerido');
            return { valid: false, errors };
        }

        if (!this.VALID_AI_MODES.includes(mode)) {
            errors.push(`ai_mode debe ser uno de: ${this.VALID_AI_MODES.join(', ')}`);
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            value: mode
        };
    }

    /**
     * Validar maxHistoryMessages
     * @param {number} maxHistory - Máximo de mensajes de historial
     * @returns {Object} Resultado de validación
     */
    static validateMaxHistoryMessages(maxHistory) {
        const errors = [];
        const history = parseInt(maxHistory);
        
        if (isNaN(history)) {
            errors.push('maxHistoryMessages debe ser un número válido');
            return { valid: false, errors };
        }

        if (history < this.LIMITS.MAX_HISTORY_MESSAGES.MIN) {
            errors.push(`maxHistoryMessages debe ser al menos ${this.LIMITS.MAX_HISTORY_MESSAGES.MIN}`);
        }

        if (history > this.LIMITS.MAX_HISTORY_MESSAGES.MAX) {
            errors.push(`maxHistoryMessages no puede exceder ${this.LIMITS.MAX_HISTORY_MESSAGES.MAX}`);
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            value: history
        };
    }

    /**
     * Validar responseTimeout
     * @param {number} timeout - Timeout de respuesta en ms
     * @returns {Object} Resultado de validación
     */
    static validateResponseTimeout(timeout) {
        const errors = [];
        const timeoutMs = parseInt(timeout);
        
        if (isNaN(timeoutMs)) {
            errors.push('responseTimeout debe ser un número válido');
            return { valid: false, errors };
        }

        if (timeoutMs < this.LIMITS.RESPONSE_TIMEOUT.MIN) {
            errors.push(`responseTimeout debe ser al menos ${this.LIMITS.RESPONSE_TIMEOUT.MIN}ms`);
        }

        if (timeoutMs > this.LIMITS.RESPONSE_TIMEOUT.MAX) {
            errors.push(`responseTimeout no puede exceder ${this.LIMITS.RESPONSE_TIMEOUT.MAX}ms`);
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            value: timeoutMs
        };
    }

    /**
     * Validar fallbackMessage
     * @param {string} message - Mensaje de fallback
     * @returns {Object} Resultado de validación
     */
    static validateFallbackMessage(message) {
        const errors = [];

        if (!message || typeof message !== 'string') {
            errors.push('fallbackMessage debe ser un texto válido');
            return { valid: false, errors };
        }

        if (message.trim().length === 0) {
            errors.push('fallbackMessage no puede estar vacío');
        }

        if (message.length > this.LIMITS.FALLBACK_MESSAGE.MAX_LENGTH) {
            errors.push(`fallbackMessage no puede exceder ${this.LIMITS.FALLBACK_MESSAGE.MAX_LENGTH} caracteres`);
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            value: message.trim()
        };
    }

    /**
     * Obtener información de límites para el frontend
     * @returns {Object} Información de límites
     */
    static getLimitsInfo() {
        return {
            businessPrompt: {
                minLength: this.LIMITS.BUSINESS_PROMPT.MIN_LENGTH,
                maxLength: this.LIMITS.BUSINESS_PROMPT.MAX_LENGTH
            },
            maxTokens: {
                min: this.LIMITS.MAX_TOKENS.MIN,
                max: this.LIMITS.MAX_TOKENS.MAX,
                default: 500
            },
            temperature: {
                min: this.LIMITS.TEMPERATURE.MIN,
                max: this.LIMITS.TEMPERATURE.MAX,
                default: 0.7
            },
            maxHistoryMessages: {
                min: this.LIMITS.MAX_HISTORY_MESSAGES.MIN,
                max: this.LIMITS.MAX_HISTORY_MESSAGES.MAX,
                default: 10
            },
            responseTimeout: {
                min: this.LIMITS.RESPONSE_TIMEOUT.MIN,
                max: this.LIMITS.RESPONSE_TIMEOUT.MAX,
                default: 30000
            },
            fallbackMessage: {
                maxLength: this.LIMITS.FALLBACK_MESSAGE.MAX_LENGTH
            },
            validAIModes: this.VALID_AI_MODES
        };
    }

    /**
     * Middleware Express para validar configuración de IA
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     * @param {Function} next - Next middleware
     */
    static validationMiddleware(req, res, next) {
        const validation = AIConfigValidator.validateConfig(req.body);
        
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message: 'Errores de validación en la configuración',
                errors: validation.errors,
                summary: validation.summary
            });
        }

        // Agregar datos validados al request
        req.validatedConfig = req.body;
        next();
    }
}

module.exports = AIConfigValidator;
