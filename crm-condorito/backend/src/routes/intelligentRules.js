const express = require('express');
const router = express.Router();
const IntelligentRulesController = require('../controllers/IntelligentRulesController');
const { authenticateToken, requireActiveClient, logAccess } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticateToken);
router.use(requireActiveClient);
router.use(logAccess);

/**
 * @swagger
 * components:
 *   schemas:
 *     IntelligentRule:
 *       type: object
 *       required:
 *         - name
 *         - trigger_keywords
 *         - action_type
 *       properties:
 *         id:
 *           type: integer
 *           description: ID único de la regla
 *         name:
 *           type: string
 *           description: Nombre descriptivo de la regla
 *         description:
 *           type: string
 *           description: Descripción detallada de la regla
 *         is_active:
 *           type: boolean
 *           description: Si la regla está activa
 *         priority:
 *           type: integer
 *           description: Prioridad de evaluación (1 = mayor prioridad)
 *         trigger_keywords:
 *           type: array
 *           items:
 *             type: string
 *           description: Palabras clave que activan la regla
 *         match_type:
 *           type: string
 *           enum: [any, all, exact_phrase]
 *           description: Cómo deben coincidir las palabras clave
 *         ai_extraction_enabled:
 *           type: boolean
 *           description: Si debe usar IA para extraer datos
 *         ai_extraction_prompt:
 *           type: string
 *           description: Prompt específico para extracción de datos
 *         expected_data_fields:
 *           type: array
 *           items:
 *             type: string
 *           description: Campos que la IA debe extraer
 *         action_type:
 *           type: string
 *           enum: [assign_tags, escalate_human, call_api, ai_response, hybrid]
 *           description: Tipo de acción a realizar
 *         action_config:
 *           type: object
 *           description: Configuración específica de la acción
 *         tags_to_assign:
 *           type: array
 *           items:
 *             type: integer
 *           description: IDs de etiquetas a aplicar automáticamente
 *         times_triggered:
 *           type: integer
 *           description: Número de veces que se ha activado
 *         success_rate:
 *           type: number
 *           description: Porcentaje de activaciones exitosas
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/intelligent-rules:
 *   get:
 *     summary: Obtener todas las reglas inteligentes del cliente
 *     tags: [Intelligent Rules]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de reglas inteligentes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/IntelligentRule'
 *                 total:
 *                   type: integer
 */
router.get('/', IntelligentRulesController.getRules);

/**
 * @swagger
 * /api/intelligent-rules/stats:
 *   get:
 *     summary: Obtener estadísticas de las reglas inteligentes
 *     tags: [Intelligent Rules]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas de las reglas
 */
router.get('/stats', IntelligentRulesController.getStats);

/**
 * @swagger
 * /api/intelligent-rules/config:
 *   get:
 *     summary: Obtener configuración del sistema de reglas inteligentes
 *     tags: [Intelligent Rules]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuración del sistema
 */
router.get('/config', IntelligentRulesController.getConfig);

/**
 * @swagger
 * /api/intelligent-rules/config:
 *   put:
 *     summary: Actualizar configuración del sistema de reglas inteligentes
 *     tags: [Intelligent Rules]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - intelligent_rules_enabled
 *             properties:
 *               intelligent_rules_enabled:
 *                 type: boolean
 *                 description: Habilitar o deshabilitar el sistema de reglas inteligentes
 *     responses:
 *       200:
 *         description: Configuración actualizada exitosamente
 */
router.put('/config', IntelligentRulesController.updateConfig);

/**
 * @swagger
 * /api/intelligent-rules/{id}:
 *   get:
 *     summary: Obtener una regla específica
 *     tags: [Intelligent Rules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la regla
 *     responses:
 *       200:
 *         description: Regla encontrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/IntelligentRule'
 *       404:
 *         description: Regla no encontrada
 */
router.get('/:id', IntelligentRulesController.getRule);

/**
 * @swagger
 * /api/intelligent-rules:
 *   post:
 *     summary: Crear nueva regla inteligente
 *     tags: [Intelligent Rules]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - trigger_keywords
 *               - action_type
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Consulta de Pedido"
 *               description:
 *                 type: string
 *                 example: "Detecta consultas sobre estado de pedidos"
 *               is_active:
 *                 type: boolean
 *                 default: true
 *               priority:
 *                 type: integer
 *                 default: 1
 *               trigger_keywords:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["pedido", "orden", "seguimiento"]
 *               match_type:
 *                 type: string
 *                 enum: [any, all, exact_phrase]
 *                 default: any
 *               ai_extraction_enabled:
 *                 type: boolean
 *                 default: false
 *               ai_extraction_prompt:
 *                 type: string
 *                 example: "Extrae el número de pedido del mensaje"
 *               expected_data_fields:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["order_number"]
 *               action_type:
 *                 type: string
 *                 enum: [assign_tags, escalate_human, call_api, ai_response, hybrid]
 *                 example: "call_api"
 *               action_config:
 *                 type: object
 *                 example: {"api_endpoint": "https://api.ejemplo.com/orders/{order_number}"}
 *               tags_to_assign:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [25, 30]
 *     responses:
 *       201:
 *         description: Regla creada exitosamente
 *       400:
 *         description: Datos inválidos
 */
router.post('/', IntelligentRulesController.createRule);

/**
 * @swagger
 * /api/intelligent-rules/{id}:
 *   put:
 *     summary: Actualizar regla existente
 *     tags: [Intelligent Rules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *               priority:
 *                 type: integer
 *               trigger_keywords:
 *                 type: array
 *                 items:
 *                   type: string
 *               match_type:
 *                 type: string
 *                 enum: [any, all, exact_phrase]
 *               ai_extraction_enabled:
 *                 type: boolean
 *               ai_extraction_prompt:
 *                 type: string
 *               expected_data_fields:
 *                 type: array
 *                 items:
 *                   type: string
 *               action_type:
 *                 type: string
 *                 enum: [assign_tags, escalate_human, call_api, ai_response, hybrid]
 *               action_config:
 *                 type: object
 *               tags_to_assign:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Regla actualizada exitosamente
 *       404:
 *         description: Regla no encontrada
 */
router.put('/:id', IntelligentRulesController.updateRule);

/**
 * @swagger
 * /api/intelligent-rules/{id}:
 *   delete:
 *     summary: Eliminar regla
 *     tags: [Intelligent Rules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Regla eliminada exitosamente
 *       404:
 *         description: Regla no encontrada
 */
router.delete('/:id', IntelligentRulesController.deleteRule);

/**
 * @swagger
 * /api/intelligent-rules/{id}/duplicate:
 *   post:
 *     summary: Duplicar regla existente
 *     tags: [Intelligent Rules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Regla duplicada exitosamente
 *       404:
 *         description: Regla no encontrada
 */
router.post('/:id/duplicate', IntelligentRulesController.duplicateRule);

/**
 * @swagger
 * /api/intelligent-rules/stats:
 *   get:
 *     summary: Obtener estadísticas de reglas inteligentes
 *     tags: [Intelligent Rules]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas de reglas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total_rules:
 *                           type: integer
 *                         active_rules:
 *                           type: integer
 *                         total_triggers:
 *                           type: integer
 *                         avg_success_rate:
 *                           type: number
 *                     topRules:
 *                       type: array
 *                       items:
 *                         type: object
 *                     recentActivity:
 *                       type: array
 *                       items:
 *                         type: object
 */
router.get('/stats', IntelligentRulesController.getStats);

/**
 * @swagger
 * /api/intelligent-rules/{id}/test:
 *   post:
 *     summary: Probar regla con mensaje de ejemplo
 *     tags: [Intelligent Rules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - testMessage
 *             properties:
 *               testMessage:
 *                 type: string
 *                 example: "Hola, quiero saber el estado de mi pedido 12345"
 *     responses:
 *       200:
 *         description: Resultado de la prueba
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     ruleId:
 *                       type: integer
 *                     ruleName:
 *                       type: string
 *                     testMessage:
 *                       type: string
 *                     matches:
 *                       type: boolean
 *                     matchedKeywords:
 *                       type: array
 *                       items:
 *                         type: string
 *                     wouldTrigger:
 *                       type: boolean
 */
router.post('/:id/test', IntelligentRulesController.testRule);


module.exports = router;
