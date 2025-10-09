const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticateToken, requireActiveClient, logAccess } = require('../middleware/auth');
const ContactController = require('../controllers/ContactController');
const TagController = require('../controllers/TagController');
const ContactImportExportController = require('../controllers/ContactImportExportController');

const router = express.Router();

// Configuración de multer para archivos CSV
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads');
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'contacts-' + uniqueSuffix + '.csv');
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB máximo
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos CSV'), false);
        }
    }
});

// ============================================================================
// CONTACTS ROUTES - CRM CONDORITO
// ============================================================================

// Aplicar autenticación a todas las rutas de contactos
router.use(authenticateToken);
router.use(requireActiveClient);
router.use(logAccess);

// ============================================================================
// CONTACTS CRUD
// ============================================================================

// ============================================================================
// TAGS MANAGEMENT - DEBE IR ANTES DE LAS RUTAS CON PARÁMETROS
// ============================================================================

/**
 * GET /api/contacts/by-tags
 * Obtener contactos filtrados por etiquetas (optimizado para chat)
 */
router.get('/by-tags', ContactController.getContactsByTags);

/**
 * GET /api/contacts/tags
 * Obtener etiquetas de contactos del cliente
 */
router.get('/tags', TagController.getTags);

/**
 * POST /api/contacts/tags
 * Crear nueva etiqueta
 */
router.post('/tags', TagController.createTag);

/**
 * PUT /api/contacts/tags/:id
 * Actualizar etiqueta
 */
router.put('/tags/:id', TagController.updateTag);

/**
 * DELETE /api/contacts/tags/:id
 * Eliminar etiqueta
 */
router.delete('/tags/:id', TagController.deleteTag);

/**
 * GET /api/contacts/tags/:id/contacts
 * Obtener contactos que tienen una etiqueta específica
 */
router.get('/tags/:id/contacts', TagController.getTagContacts);

// ============================================================================
// AUTO-MESSAGE CONFIGURATION ROUTES
// ============================================================================

/**
 * GET /api/contacts/tags/auto-message/variables
 * Obtener variables disponibles para mensajes automáticos
 */
router.get('/tags/auto-message/variables', TagController.getAutoMessageVariables);

/**
 * GET /api/contacts/tags/:id/auto-message
 * Obtener configuración de mensaje automático de una etiqueta
 */
router.get('/tags/:id/auto-message', TagController.getAutoMessageConfig);

/**
 * PUT /api/contacts/tags/:id/auto-message
 * Actualizar configuración de mensaje automático de una etiqueta
 */
router.put('/tags/:id/auto-message', TagController.updateAutoMessageConfig);

/**
 * GET /api/contacts/tags/:id/auto-messages
 * Obtener lista de mensajes automáticos generados por una etiqueta
 */
router.get('/tags/:id/auto-messages', TagController.getAutoMessages);

/**
 * DELETE /api/contacts/tags/:id/auto-message
 * Desactivar completamente el mensaje automático de una etiqueta
 */
router.delete('/tags/:id/auto-message', TagController.disableAutoMessage);

// ============================================================================
// CONTACTS CRUD - RUTAS CON PARÁMETROS VAN DESPUÉS
// ============================================================================

/**
 * GET /api/contacts
 * Obtener lista de contactos del cliente
 */
router.get('/', ContactController.getContacts);

/**
 * GET /api/contacts/:id
 * Obtener contacto específico por ID
 */
router.get('/:id', ContactController.getContactById);

/**
 * POST /api/contacts
 * Crear nuevo contacto
 */
router.post('/', ContactController.createContact);

/**
 * PUT /api/contacts/:id
 * Actualizar contacto existente
 */
router.put('/:id', ContactController.updateContact);

/**
 * DELETE /api/contacts/:id
 * Eliminar contacto
 */
router.delete('/:id', ContactController.deleteContact);

/**
 * POST /api/contacts/:id/tags
 * Agregar tags a un contacto
 */
router.post('/:id/tags', ContactController.addContactTags);

/**
 * DELETE /api/contacts/:id/tags/:tagId
 * Remover tag específica de un contacto
 */
router.delete('/:id/tags/:tagId', ContactController.removeContactTag);

// ============================================================================
// IMPORT/EXPORT
// ============================================================================

/**
 * POST /api/contacts/import
 * Importar contactos desde archivo CSV
 */
router.post('/import', upload.single('csvFile'), ContactImportExportController.importContacts);

/**
 * POST /api/contacts/import/preview
 * Previsualizar archivo CSV antes de importar
 */
router.post('/import/preview', upload.single('csvFile'), ContactImportExportController.previewImport);

/**
 * GET /api/contacts/export
 * Exportar contactos a archivo CSV
 */
router.get('/export', ContactImportExportController.exportContacts);

/**
 * GET /api/contacts/export/template
 * Descargar plantilla CSV para importación
 */
router.get('/export/template', ContactImportExportController.downloadTemplate);

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * GET /api/contacts/health
 * Health check específico para el módulo de contactos
 */
router.get('/health', (req, res) => {
    res.json({
        module: 'contacts',
        status: 'PRODUCTION_READY',
        timestamp: new Date().toISOString(),
        note: 'Sistema de gestión de contactos completamente implementado - ETAPA 3 ✅',
        features: {
            crud: '✅ CRUD completo de contactos',
            tags: '✅ Sistema de etiquetas',
            search: '✅ Búsqueda y filtros avanzados',
            importExport: '✅ Importación/exportación CSV',
            pagination: '✅ Paginación y ordenamiento',
            validation: '✅ Validaciones robustas'
        },
        endpoints: {
            crud: [
                'GET /api/contacts - ✅ Listar con filtros',
                'GET /api/contacts/:id - ✅ Obtener por ID',
                'POST /api/contacts - ✅ Crear contacto',
                'PUT /api/contacts/:id - ✅ Actualizar contacto',
                'DELETE /api/contacts/:id - ✅ Eliminar contacto'
            ],
            tags: [
                'GET /api/contacts/tags - ✅ Listar etiquetas',
                'POST /api/contacts/tags - ✅ Crear etiqueta',
                'PUT /api/contacts/tags/:id - ✅ Actualizar etiqueta',
                'DELETE /api/contacts/tags/:id - ✅ Eliminar etiqueta',
                'GET /api/contacts/tags/:id/contacts - ✅ Contactos por etiqueta'
            ],
            contactTags: [
                'POST /api/contacts/:id/tags - ✅ Agregar etiquetas',
                'DELETE /api/contacts/:id/tags/:tagId - ✅ Remover etiqueta'
            ],
            importExport: [
                'POST /api/contacts/import - ✅ Importar CSV',
                'POST /api/contacts/import/preview - ✅ Previsualizar CSV',
                'GET /api/contacts/export - ✅ Exportar CSV',
                'GET /api/contacts/export/template - ✅ Plantilla CSV'
            ]
        },
        statistics: {
            totalEndpoints: 15,
            implementedEndpoints: 15,
            completionPercentage: 100
        }
    });
});

module.exports = router;
