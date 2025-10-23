const webpush = require('web-push');
const { executeQuery } = require('../config/database-simple');
require('dotenv').config();

/**
 * Servicio para gestionar notificaciones push
 */
class PushNotificationService {
    constructor() {
        this.setupWebPush();
    }

    /**
     * Configurar web-push con claves VAPID
     */
    setupWebPush() {
        const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || 'BMAamp57IlLYBemgN583n2paRqIlGOnvZcJ9jKqnE_-1sXsZ-gxbz9gWrxEowGg-ql9B7Q5tE6snCR1mYdqF5AE';
        const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'Z3i8q-4cRc39vi0mb5eDmPQuVw6CLREv3leOJpDC7io';
        const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@crmcondorito.com';

        webpush.setVapidDetails(
            vapidSubject,
            vapidPublicKey,
            vapidPrivateKey
        );

        console.log('🔐 Web Push configurado con claves VAPID');
    }

    /**
     * Crear nueva suscripción
     */
    async createSubscription(subscriptionData) {
        try {
            console.log('🔔 PushNotificationService.createSubscription called with:', {
                client_id: subscriptionData.client_id,
                user_id: subscriptionData.user_id,
                endpoint: subscriptionData.endpoint ? 'present' : 'missing',
                p256dh: subscriptionData.p256dh ? 'present' : 'missing',
                auth: subscriptionData.auth ? 'present' : 'missing',
                user_agent: subscriptionData.user_agent ? 'present' : 'missing'
            });

            const query = `
                INSERT INTO push_subscriptions 
                (client_id, user_id, endpoint, p256dh_key, auth_key, user_agent) 
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                endpoint = VALUES(endpoint),
                p256dh_key = VALUES(p256dh_key),
                auth_key = VALUES(auth_key),
                user_agent = VALUES(user_agent),
                is_active = TRUE,
                updated_at = CURRENT_TIMESTAMP
            `;

            const params = [
                subscriptionData.client_id,
                subscriptionData.user_id,
                subscriptionData.endpoint,
                subscriptionData.p256dh,
                subscriptionData.auth,
                subscriptionData.user_agent || null
            ];

            const result = await executeQuery(query, params);
            console.log(`✅ Push subscription created for client ${subscriptionData.client_id}`);
            return { id: result.insertId, ...subscriptionData };
        } catch (error) {
            console.error('❌ Error creating push subscription:', error);
            throw error;
        }
    }

    /**
     * Eliminar suscripción
     */
    async removeSubscription(clientId, userId) {
        try {
            const query = `
                UPDATE push_subscriptions 
                SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
                WHERE client_id = ? AND user_id = ?
            `;
            
            const result = await executeQuery(query, [clientId, userId]);
            console.log(`✅ Push subscription removed for client ${clientId}, user ${userId}`);
            return result;
        } catch (error) {
            console.error('❌ Error removing push subscription:', error);
            throw error;
        }
    }

    /**
     * Obtener suscripción por cliente y usuario
     */
    async findByClientAndUser(clientId, userId) {
        try {
            const query = `
                SELECT * FROM push_subscriptions 
                WHERE client_id = ? AND user_id = ? AND is_active = TRUE
                LIMIT 1
            `;
            
            const results = await executeQuery(query, [clientId, userId]);
            return results.length > 0 ? results[0] : null;
        } catch (error) {
            console.error('❌ Error finding push subscription:', error);
            throw error;
        }
    }

    /**
     * Enviar notificación a un usuario específico
     */
    async sendToUser(clientId, userId, notification) {
        try {
            const subscription = await this.findByClientAndUser(clientId, userId);
            
            if (!subscription) {
                console.log(`⚠️ No push subscription found for client ${clientId}, user ${userId}`);
                return { success: false, reason: 'no_subscription' };
            }

            const webPushSubscription = {
                endpoint: subscription.endpoint,
                keys: {
                    p256dh: subscription.p256dh_key,
                    auth: subscription.auth_key
                }
            };

            const payload = JSON.stringify({
                title: notification.title,
                body: notification.body,
                icon: '/icon-192x192.png',
                badge: '/favicon.ico',
                tag: notification.tag || 'crm-notification',
                data: notification.data || {},
                timestamp: Date.now(),
                id: `${clientId}-${userId}-${Date.now()}`
            });

            const options = {
                TTL: 24 * 60 * 60, // 24 horas
                urgency: notification.urgency || 'normal' // low, normal, high
                // No necesitamos vapidDetails aquí porque ya se configuraron globalmente en setupWebPush()
            };

            const result = await webpush.sendNotification(webPushSubscription, payload, options);
            
            // Actualizar última vez usado
            await this.updateLastUsed(subscription.id);

            // Registrar notificación enviada
            await this.logNotification({
                subscription_id: subscription.id,
                client_id: clientId,
                notification_type: notification.type || 'message',
                title: notification.title,
                body: notification.body,
                data: notification.data,
                status: 'sent'
            });

            console.log(`📨 Push notification sent to client ${clientId}, user ${userId}`);
            return { success: true, result };
        } catch (error) {
            console.error('❌ Error sending push notification:', error);
            
            // Si es un error 410 (Gone), la suscripción ya no es válida
            if (error.statusCode === 410) {
                console.log(`🗑️ Subscription expired, deactivating for client ${clientId}, user ${userId}`);
                await this.removeSubscription(clientId, userId);
                return { success: false, reason: 'subscription_expired' };
            }

            // Registrar error
            const subscription = await this.findByClientAndUser(clientId, userId);
            if (subscription) {
                await this.logNotification({
                    subscription_id: subscription.id,
                    client_id: clientId,
                    notification_type: notification.type || 'message',
                    title: notification.title,
                    body: notification.body,
                    data: notification.data,
                    status: 'failed',
                    error_message: error.message
                });
            }

            return { success: false, error: error.message };
        }
    }

    /**
     * Actualizar última vez usado
     */
    async updateLastUsed(subscriptionId) {
        try {
            const query = `
                UPDATE push_subscriptions 
                SET last_used_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `;
            
            await executeQuery(query, [subscriptionId]);
        } catch (error) {
            console.error('❌ Error updating last used:', error);
        }
    }

    /**
     * Enviar notificación a todos los usuarios de un cliente
     */
    async sendToClient(clientId, notification) {
        try {
            const query = `
                SELECT * FROM push_subscriptions 
                WHERE client_id = ? AND is_active = TRUE
            `;
            
            const subscriptions = await executeQuery(query, [clientId]);
            
            if (subscriptions.length === 0) {
                console.log(`⚠️ No push subscriptions found for client ${clientId}`);
                return { success: false, reason: 'no_subscriptions' };
            }

            const results = await Promise.allSettled(
                subscriptions.map(subscription => 
                    this.sendToUser(clientId, subscription.user_id, notification)
                )
            );

            const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
            const failed = results.length - successful;

            console.log(`📊 Push notifications sent to client ${clientId}: ${successful} successful, ${failed} failed`);
            
            return {
                success: true,
                total: results.length,
                successful,
                failed,
                results
            };
        } catch (error) {
            console.error('❌ Error sending push notifications to client:', error);
            throw error;
        }
    }

    /**
     * Enviar notificación de nuevo mensaje
     */
    async sendNewMessageNotification(clientId, messageData) {
        const notification = {
            type: 'message',
            title: `Nuevo mensaje de ${messageData.contact_name || messageData.contact_phone}`,
            body: this.truncateMessage(messageData.content || 'Mensaje multimedia'),
            tag: `message-${messageData.conversation_id}`,
            urgency: 'high',
            data: {
                type: 'new_message',
                conversation_id: messageData.conversation_id,
                message_id: messageData.id,
                contact_phone: messageData.contact_phone,
                contact_name: messageData.contact_name,
                url: `/chat?conversation=${messageData.conversation_id}`
            }
        };

        return await this.sendToClient(clientId, notification);
    }

    /**
     * Enviar notificación de sistema
     */
    async sendSystemNotification(clientId, title, body, data = {}) {
        const notification = {
            type: 'system',
            title,
            body,
            tag: 'system-notification',
            urgency: 'normal',
            data: {
                type: 'system',
                ...data
            }
        };

        return await this.sendToClient(clientId, notification);
    }

    /**
     * Registrar notificación en el log
     */
    async logNotification(logData) {
        try {
            const query = `
                INSERT INTO push_notification_logs 
                (subscription_id, client_id, notification_type, title, body, data, status, error_message)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const params = [
                logData.subscription_id,
                logData.client_id,
                logData.notification_type,
                logData.title,
                logData.body,
                JSON.stringify(logData.data || {}),
                logData.status,
                logData.error_message || null
            ];

            await executeQuery(query, params);
        } catch (error) {
            console.error('❌ Error logging push notification:', error);
        }
    }

    /**
     * Obtener estadísticas de notificaciones
     */
    async getNotificationStats(clientId = null) {
        try {
            let query = `
                SELECT 
                    notification_type,
                    status,
                    COUNT(*) as count,
                    DATE(sent_at) as date
                FROM push_notification_logs
            `;
            
            let params = [];
            
            if (clientId) {
                query += ' WHERE client_id = ?';
                params.push(clientId);
            }
            
            query += `
                GROUP BY notification_type, status, DATE(sent_at)
                ORDER BY date DESC, notification_type, status
                LIMIT 100
            `;

            const results = await executeQuery(query, params);
            return results;
        } catch (error) {
            console.error('❌ Error getting notification stats:', error);
            throw error;
        }
    }

    /**
     * Limpiar logs antiguos (más de 30 días)
     */
    async cleanupLogs() {
        try {
            const query = `
                DELETE FROM push_notification_logs 
                WHERE sent_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
            `;
            
            const result = await executeQuery(query);
            console.log(`🧹 Cleaned up ${result.affectedRows} old notification logs`);
            return result.affectedRows;
        } catch (error) {
            console.error('❌ Error cleaning up notification logs:', error);
            throw error;
        }
    }

    /**
     * Truncar mensaje para notificación
     */
    truncateMessage(message, maxLength = 100) {
        if (!message || typeof message !== 'string') {
            return 'Nuevo mensaje';
        }
        
        return message.length > maxLength 
            ? message.substring(0, maxLength) + '...' 
            : message;
    }

    /**
     * Verificar configuración de VAPID
     */
    isConfigured() {
        return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
    }

    /**
     * Obtener clave pública VAPID
     */
    getPublicKey() {
        return process.env.VAPID_PUBLIC_KEY || 'BMAamp57IlLYBemgN583n2paRqIlGOnvZcJ9jKqnE_-1sXsZ-gxbz9gWrxEowGg-ql9B7Q5tE6snCR1mYdqF5AE';
    }
}

// Crear instancia singleton
const pushNotificationService = new PushNotificationService();

module.exports = pushNotificationService;