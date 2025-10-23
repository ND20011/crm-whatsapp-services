const PushNotificationService = require('../services/PushNotificationService');
const { executeQuery } = require('../config/database-simple');

/**
 * Controlador para gestionar notificaciones push
 */
class PushNotificationController {

    /**
     * Obtener clave pública VAPID - GET /api/push-notifications/vapid-public-key
     */
    static async getVapidPublicKey(req, res, next) {
        try {
            const publicKey = PushNotificationService.getPublicKey();
            
            res.json({
                success: true,
                publicKey: publicKey,
                configured: PushNotificationService.isConfigured()
            });
        } catch (error) {
            console.error('❌ Error getting VAPID public key:', error);
            res.status(500).json({
                success: false,
                message: 'Error obteniendo clave pública VAPID',
                error: error.message
            });
        }
    }

    /**
     * Crear suscripción push - POST /api/push-notifications/subscribe
     */
    static async subscribe(req, res, next) {
        try {
            // Extraer datos del usuario autenticado
            const clientId = req.user.clientId || req.user.id;
            const userId = req.user.id;
            const clientCode = req.user.clientCode;
            
            console.log('🔔 Subscribe request from:', { clientId, userId, clientCode });
            
            const { endpoint, keys } = req.body;

            // Validar que los datos requeridos estén presentes
            if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
                return res.status(400).json({
                    success: false,
                    message: 'Datos de suscripción incompletos'
                });
            }

            // Validar que tenemos los datos del usuario
            if (!clientId || !userId) {
                console.error('❌ Missing user data:', { clientId, userId, user: req.user });
                return res.status(400).json({
                    success: false,
                    message: 'Datos de usuario incompletos'
                });
            }

            // Crear suscripción en la base de datos
            const subscription = await PushNotificationService.createSubscription({
                client_id: clientId,
                user_id: userId,
                endpoint: endpoint,
                p256dh: keys.p256dh,
                auth: keys.auth,
                user_agent: req.get('User-Agent') || 'Unknown'
            });

            console.log(`✅ Push subscription created for client ${clientId}, user ${userId}`);

            res.json({
                success: true,
                message: 'Suscripción a notificaciones push creada exitosamente',
                subscription: {
                    id: subscription.id,
                    client_id: subscription.client_id,
                    user_id: subscription.user_id,
                    endpoint: subscription.endpoint.substring(0, 50) + '...',
                    created_at: new Date().toISOString(),
                    status: 'active'
                }
            });

        } catch (error) {
            console.error('❌ Error creating push subscription:', error);
            res.status(500).json({
                success: false,
                message: 'Error creando suscripción push',
                error: error.message
            });
        }
    }

    /**
     * Eliminar suscripción push - DELETE /api/push-notifications/unsubscribe
     */
    static async unsubscribe(req, res, next) {
        try {
            const clientId = req.user.clientId || req.user.id;
            const userId = req.user.id;

            const result = await PushNotificationService.removeSubscription(clientId, userId);

            if (result.affectedRows > 0) {
                console.log(`✅ Push subscription removed for client ${clientId}, user ${userId}`);
                res.json({
                    success: true,
                    message: 'Suscripción a notificaciones push eliminada exitosamente'
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: 'Suscripción no encontrada'
                });
            }
        } catch (error) {
            console.error('❌ Error removing push subscription:', error);
            res.status(500).json({
                success: false,
                message: 'Error eliminando suscripción push',
                error: error.message
            });
        }
    }

    /**
     * Obtener estado de suscripción - GET /api/push-notifications/subscription
     */
    static async getSubscriptionStatus(req, res, next) {
        try {
            const clientId = req.user.clientId || req.user.id;
            const userId = req.user.id;

            const subscription = await PushNotificationService.findByClientAndUser(clientId, userId);

            res.json({
                success: true,
                subscribed: !!subscription,
                subscription: subscription ? {
                    id: subscription.id,
                    client_id: subscription.client_id,
                    user_id: subscription.user_id,
                    is_active: subscription.is_active,
                    created_at: subscription.created_at,
                    last_used_at: subscription.last_used_at
                } : null
            });
        } catch (error) {
            console.error('❌ Error getting subscription status:', error);
            res.status(500).json({
                success: false,
                message: 'Error obteniendo estado de suscripción',
                error: error.message
            });
        }
    }

    /**
     * Enviar notificación de prueba - POST /api/push-notifications/test
     */
    static async sendTestNotification(req, res, next) {
        try {
            const clientId = req.user.clientId || req.user.id;
            const userId = req.user.id;
            const { title, body } = req.body;

            console.log('🔔 Sending test notification to user:', userId);

            const notification = {
                type: 'system',
                title: title || 'Notificación de Prueba',
                body: body || 'Esta es una notificación de prueba del CRM Condorito',
                urgency: 'normal',
                data: {
                    type: 'test',
                    timestamp: Date.now()
                }
            };

            const result = await PushNotificationService.sendToUser(clientId, userId, notification);

            if (result.success) {
                console.log('✅ Test notification sent successfully');
                res.json({
                    success: true,
                    message: 'Notificación de prueba enviada exitosamente',
                    details: {
                        clientId,
                        userId,
                        notification,
                        timestamp: new Date().toISOString(),
                        status: 'sent'
                    }
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: 'No se pudo enviar la notificación de prueba',
                    reason: result.reason,
                    error: result.error
                });
            }

        } catch (error) {
            console.error('❌ Error sending test notification:', error);
            res.status(500).json({
                success: false,
                message: 'Error enviando notificación de prueba',
                error: error.message
            });
        }
    }

    /**
     * Obtener estadísticas de notificaciones - GET /api/push-notifications/stats
     */
    static async getStats(req, res, next) {
        try {
            const clientId = req.user.clientId || req.user.id;

            // Obtener estadísticas de suscripciones del cliente
            const subscriptionsQuery = `
                SELECT 
                    COUNT(*) as total_subscriptions,
                    COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_subscriptions,
                    COUNT(CASE WHEN is_active = FALSE THEN 1 END) as inactive_subscriptions
                FROM push_subscriptions 
                WHERE client_id = ?
            `;
            
            const subscriptionStats = await executeQuery(subscriptionsQuery, [clientId]);
            
            // Obtener estadísticas de notificaciones
            const notificationStats = await PushNotificationService.getNotificationStats(clientId);

            // Obtener suscripciones del cliente
            const clientSubscriptionsQuery = `
                SELECT id, user_id, is_active, created_at, last_used_at
                FROM push_subscriptions 
                WHERE client_id = ?
                ORDER BY created_at DESC
            `;
            
            const clientSubscriptions = await executeQuery(clientSubscriptionsQuery, [clientId]);

            res.json({
                success: true,
                stats: {
                    subscriptions: subscriptionStats[0] || {
                        total_subscriptions: 0,
                        active_subscriptions: 0,
                        inactive_subscriptions: 0
                    },
                    notifications: notificationStats,
                    client_subscriptions: clientSubscriptions.length,
                    client_subscriptions_data: clientSubscriptions
                }
            });
        } catch (error) {
            console.error('❌ Error getting push notification stats:', error);
            res.status(500).json({
                success: false,
                message: 'Error obteniendo estadísticas de notificaciones',
                error: error.message
            });
        }
    }
}

module.exports = PushNotificationController;