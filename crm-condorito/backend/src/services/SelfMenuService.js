const whatsappService = require('./WhatsAppService');

/**
 * Servicio para manejar mensajes del cliente a sí mismo
 * Proporciona un menú de control del CRM desde WhatsApp
 */
class SelfMenuService {
    constructor() {
        // Marcadores para evitar bucles infinitos
        this.botMessages = new Set(); // IDs de mensajes enviados por el bot
        this.lastMenuTime = new Map(); // Último menú enviado por cliente
    }

    /**
     * Verificar si el mensaje es del cliente a sí mismo
     * @param {string} clientPhone - Número del cliente
     * @param {Object} message - Mensaje de WhatsApp
     * @returns {boolean} True si es mensaje a sí mismo
     */
    isSelfMessage(clientPhone, message) {
        // Limpiar números para comparación
        const cleanClientPhone = clientPhone.replace(/\D/g, '');
        const cleanFromPhone = message.from.replace(/\D/g, '').replace('@c.us', '');
        
        return cleanClientPhone === cleanFromPhone && message.fromMe;
    }

    /**
     * Verificar si el mensaje fue enviado por el bot (para evitar bucles)
     * @param {Object} message - Mensaje de WhatsApp
     * @returns {boolean} True si es mensaje del bot
     */
    isBotMessage(message) {
        const messageId = message.id._serialized;
        return this.botMessages.has(messageId) || 
               message.body?.startsWith('[CRM-BOT]') ||
               message.body?.includes('🤖');
    }

    /**
     * Marcar mensaje como enviado por el bot
     * @param {string} messageId - ID del mensaje
     */
    markAsBotMessage(messageId) {
        this.botMessages.add(messageId);
        // Limpiar mensajes antiguos (mantener solo los últimos 100)
        if (this.botMessages.size > 100) {
            const firstItem = this.botMessages.values().next().value;
            this.botMessages.delete(firstItem);
        }
    }

    /**
     * Procesar mensaje del cliente a sí mismo
     * @param {string} clientCode - Código del cliente
     * @param {string} clientPhone - Número del cliente
     * @param {Object} message - Mensaje de WhatsApp
     * @param {Object} clientStats - Estadísticas del cliente
     */
    async processSelfMessage(clientCode, clientPhone, message, clientStats = {}) {
        try {
            // Verificar que no sea mensaje del bot
            if (this.isBotMessage(message)) {
                console.log(`🤖 Ignoring bot message to avoid loop: ${message.body?.substring(0, 50)}`);
                return;
            }

            console.log(`📱 Processing self-message for ${clientCode}: ${message.body}`);

            const command = message.body?.trim().toLowerCase();
            let response = '';

            // Procesar comandos
            switch (command) {
                case '1':
                case 'estado':
                case 'status':
                    response = await this.getStatusInfo(clientCode, clientStats);
                    break;

                case '2':
                case 'conversaciones':
                case 'chats':
                    response = await this.getConversationsInfo(clientCode, clientStats);
                    break;

                case '3':
                case 'mensajes':
                case 'messages':
                    response = await this.getMessagesInfo(clientCode, clientStats);
                    break;

                case '4':
                case 'bot':
                case 'configuracion':
                    response = await this.getBotInfo(clientCode);
                    break;

                case '5':
                case 'ayuda':
                case 'help':
                    response = this.getHelpInfo();
                    break;

                case 'menu':
                case 'inicio':
                case 'start':
                default:
                    response = this.getMainMenu();
                    break;
            }

            // Enviar respuesta
            await this.sendBotResponse(clientCode, clientPhone, response);

        } catch (error) {
            console.error('❌ Error in SelfMenuService.processSelfMessage:', error.message);
            
            // Enviar mensaje de error
            const errorResponse = `❌ Error procesando comando.\n\nEnvía "menu" para ver las opciones disponibles.`;
            await this.sendBotResponse(clientCode, clientPhone, errorResponse);
        }
    }

    /**
     * Obtener menú principal
     * @returns {string} Menú principal
     */
    getMainMenu() {
        return `🤖 *CRM CONDORITO - MENÚ PRINCIPAL*

Selecciona una opción:

*1* - 📊 Estado del sistema
*2* - 💬 Conversaciones activas  
*3* - 📨 Estadísticas de mensajes
*4* - 🤖 Configuración del bot
*5* - ❓ Ayuda

Envía el *número* o *palabra clave* de la opción que deseas.

_Ejemplo: Envía "1" o "estado"_`;
    }

    /**
     * Obtener información del estado del sistema
     * @param {string} clientCode - Código del cliente
     * @param {Object} clientStats - Estadísticas del cliente
     * @returns {string} Información del estado
     */
    async getStatusInfo(clientCode, clientStats) {
        const now = new Date();
        const uptime = process.uptime();
        const uptimeHours = Math.floor(uptime / 3600);
        const uptimeMinutes = Math.floor((uptime % 3600) / 60);

        return `📊 *ESTADO DEL SISTEMA*

🟢 *Sistema:* Activo
⏰ *Tiempo activo:* ${uptimeHours}h ${uptimeMinutes}m
📱 *WhatsApp:* Conectado
🤖 *Bot:* Funcionando

📈 *Estadísticas:*
• Contactos: ${clientStats.totalContacts || 0}
• Conversaciones: ${clientStats.totalConversations || 0}
• Mensajes totales: ${clientStats.totalMessages || 0}
• Mensajes del bot: ${clientStats.botMessages || 0}

🕐 *Última actualización:* ${now.toLocaleString('es-AR')}

Envía "menu" para volver al menú principal.`;
    }

    /**
     * Obtener información de conversaciones
     * @param {string} clientCode - Código del cliente
     * @param {Object} clientStats - Estadísticas del cliente
     * @returns {string} Información de conversaciones
     */
    async getConversationsInfo(clientCode, clientStats) {
        return `💬 *CONVERSACIONES ACTIVAS*

📊 *Resumen:*
• Total de conversaciones: ${clientStats.totalConversations || 0}
• Mensajes no leídos: ${clientStats.unreadMessages || 0}
• Conversaciones activas hoy: ${clientStats.activeToday || 0}

🔥 *Actividad reciente:*
• Mensajes recibidos hoy: ${clientStats.receivedToday || 0}
• Mensajes enviados hoy: ${clientStats.sentToday || 0}
• Respuestas automáticas: ${clientStats.botMessages || 0}

💡 *Tip:* Usa el CRM web para ver detalles de cada conversación.

Envía "menu" para volver al menú principal.`;
    }

    /**
     * Obtener información de mensajes
     * @param {string} clientCode - Código del cliente
     * @param {Object} clientStats - Estadísticas del cliente
     * @returns {string} Información de mensajes
     */
    async getMessagesInfo(clientCode, clientStats) {
        const totalMessages = clientStats.totalMessages || 0;
        const botMessages = clientStats.botMessages || 0;
        const manualMessages = clientStats.manualMessages || 0;
        const receivedMessages = clientStats.receivedMessages || 0;

        return `📨 *ESTADÍSTICAS DE MENSAJES*

📊 *Totales:*
• Mensajes totales: ${totalMessages}
• Mensajes recibidos: ${receivedMessages}
• Mensajes enviados: ${manualMessages + botMessages}

🤖 *Desglose por tipo:*
• Mensajes manuales: ${manualMessages}
• Respuestas automáticas: ${botMessages}
• Mensajes de contactos: ${receivedMessages}

📈 *Rendimiento:*
• Tasa de respuesta automática: ${totalMessages > 0 ? Math.round((botMessages / totalMessages) * 100) : 0}%
• Promedio mensajes/conversación: ${clientStats.totalConversations > 0 ? Math.round(totalMessages / clientStats.totalConversations) : 0}

Envía "menu" para volver al menú principal.`;
    }

    /**
     * Obtener información del bot
     * @param {string} clientCode - Código del cliente
     * @returns {string} Información del bot
     */
    async getBotInfo(clientCode) {
        // Aquí podrías obtener la configuración real del bot desde la BD
        return `🤖 *CONFIGURACIÓN DEL BOT*

⚙️ *Estado actual:*
• Bot: 🟢 Activo
• Horario: 09:00 - 18:00
• Días: Lunes a Viernes
• IA: 🟢 Conectada

🎯 *Funciones activas:*
• Respuestas automáticas
• Análisis de mensajes
• Detección de intención
• Horarios de trabajo

⚠️ *Nota:* Si envías un mensaje manual a un contacto, el bot se desactiva automáticamente para esa conversación.

💡 *Tip:* Usa el CRM web para configurar horarios y personalizar respuestas.

Envía "menu" para volver al menú principal.`;
    }

    /**
     * Obtener información de ayuda
     * @returns {string} Información de ayuda
     */
    getHelpInfo() {
        return `❓ *AYUDA - CRM CONDORITO*

🎯 *¿Qué puedes hacer aquí?*
Este es tu centro de control personal del CRM. Puedes consultar estadísticas, estado del sistema y configuración sin necesidad de abrir el CRM web.

📱 *Comandos disponibles:*
• "menu" - Menú principal
• "estado" - Estado del sistema
• "conversaciones" - Info de chats
• "mensajes" - Estadísticas
• "bot" - Configuración del bot
• "ayuda" - Esta ayuda

🔄 *¿Cómo funciona?*
1. Envías un comando
2. El sistema te responde automáticamente
3. Puedes navegar por las opciones

⚠️ *Importante:*
• Solo tú puedes ver estos mensajes
• No afecta tus conversaciones con clientes
• Los comandos son case-insensitive

🌐 *CRM Web:* Para funciones avanzadas, usa la interfaz web del CRM.

Envía "menu" para volver al menú principal.`;
    }

    /**
     * Enviar respuesta del bot
     * @param {string} clientCode - Código del cliente
     * @param {string} clientPhone - Número del cliente
     * @param {string} message - Mensaje a enviar
     */
    async sendBotResponse(clientCode, clientPhone, message) {
        try {
            // Marcar mensaje como del bot antes de enviarlo
            const botMessage = `[CRM-BOT] ${message}`;
            
            // Enviar mensaje
            const result = await whatsappService.sendMessage(clientCode, clientPhone, botMessage, true);
            
            // Marcar el mensaje como del bot para evitar bucles
            if (result && result.messageId) {
                this.markAsBotMessage(result.messageId);
            }

            console.log(`🤖 Bot response sent to ${clientCode}: ${message ? message.substring(0, 50) : 'Empty message'}...`);
            
        } catch (error) {
            console.error('❌ Error sending bot response:', error.message);
        }
    }

    /**
     * Limpiar datos antiguos (llamar periódicamente)
     */
    cleanup() {
        // Limpiar mensajes del bot antiguos
        if (this.botMessages.size > 50) {
            const messagesToKeep = Array.from(this.botMessages).slice(-50);
            this.botMessages.clear();
            messagesToKeep.forEach(id => this.botMessages.add(id));
        }

        // Limpiar tiempos de menú antiguos (más de 1 hora)
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        for (const [clientCode, time] of this.lastMenuTime.entries()) {
            if (time < oneHourAgo) {
                this.lastMenuTime.delete(clientCode);
            }
        }
    }
}

// Crear instancia singleton
const selfMenuService = new SelfMenuService();

// Limpiar datos cada 30 minutos
setInterval(() => {
    selfMenuService.cleanup();
}, 30 * 60 * 1000);

module.exports = selfMenuService;


