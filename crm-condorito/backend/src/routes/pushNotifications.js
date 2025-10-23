const express = require('express');
const router = express.Router();
const PushNotificationController = require('../controllers/PushNotificationController')
const { authenticateToken } = require('../middleware/auth');

// ============================================================================
// RUTAS DE NOTIFICACIONES PUSH
// ============================================================================

/**
 * @route   GET /api/push-notifications/vapid-public-key
 * @desc    Obtener clave pública VAPID
 * @access  Public
 */
router.get('/vapid-public-key', PushNotificationController.getVapidPublicKey);

/**
 * @route   POST /api/push-notifications/subscribe
 * @desc    Crear suscripción a notificaciones push
 * @access  Private
 */
router.post('/subscribe', authenticateToken, PushNotificationController.subscribe);

/**
 * @route   DELETE /api/push-notifications/unsubscribe
 * @desc    Eliminar suscripción a notificaciones push
 * @access  Private
 */
router.delete('/unsubscribe', authenticateToken, PushNotificationController.unsubscribe);

/**
 * @route   GET /api/push-notifications/subscription
 * @desc    Obtener estado de suscripción
 * @access  Private
 */
router.get('/subscription', authenticateToken, PushNotificationController.getSubscriptionStatus);

/**
 * @route   POST /api/push-notifications/test
 * @desc    Enviar notificación de prueba
 * @access  Private
 */
router.post('/test', authenticateToken, PushNotificationController.sendTestNotification);

/**
 * @route   GET /api/push-notifications/stats
 * @desc    Obtener estadísticas de notificaciones
 * @access  Private
 */
router.get('/stats', authenticateToken, PushNotificationController.getStats);

module.exports = router;