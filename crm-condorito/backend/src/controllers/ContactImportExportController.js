const Contact = require('../entities/Contact');
const { executeQuery } = require('../config/database-simple');
const csv = require('csv-parser');
const fs = require('fs');
const { Readable } = require('stream');

// ============================================================================
// CONTACT IMPORT/EXPORT CONTROLLER - CRM CONDORITO
// ============================================================================

class ContactImportExportController {

    /**
     * POST /api/contacts/import
     * Importar contactos desde archivo CSV
     */
    static async importContacts(req, res, next) {
        try {
            const clientId = req.user.id;

            // Validar que se haya subido un archivo
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Archivo CSV es requerido'
                });
            }

            // Validar tipo de archivo
            if (req.file.mimetype !== 'text/csv' && !req.file.originalname.endsWith('.csv')) {
                return res.status(400).json({
                    success: false,
                    message: 'Solo se permiten archivos CSV'
                });
            }

            console.log(`📊 Starting contact import for client ${clientId}`);

            const results = {
                processed: 0,
                imported: 0,
                skipped: 0,
                errors: []
            };

            // Leer archivo CSV
            const csvData = [];
            
            await new Promise((resolve, reject) => {
                const stream = fs.createReadStream(req.file.path)
                    .pipe(csv({
                        headers: ['phone_number', 'name', 'custom_name', 'comments'],
                        skipEmptyLines: true
                    }));

                stream.on('data', (row) => {
                    csvData.push(row);
                });

                stream.on('end', resolve);
                stream.on('error', reject);
            });

            console.log(`📊 Found ${csvData.length} rows in CSV`);

            // Procesar cada fila
            for (let i = 0; i < csvData.length; i++) {
                const row = csvData[i];
                results.processed++;

                try {
                    // Validar datos mínimos requeridos
                    if (!row.phone_number || !row.phone_number.trim()) {
                        results.skipped++;
                        results.errors.push({
                            row: i + 1,
                            error: 'Número de teléfono requerido'
                        });
                        continue;
                    }

                    // Verificar si el contacto ya existe
                    const existingContact = await Contact.findByPhone(row.phone_number, clientId);
                    if (existingContact) {
                        results.skipped++;
                        results.errors.push({
                            row: i + 1,
                            phone: row.phone_number,
                            error: 'Contacto ya existe'
                        });
                        continue;
                    }

                    // Crear nuevo contacto
                    const contact = new Contact({
                        client_id: clientId,
                        phone_number: row.phone_number.trim(),
                        name: row.name ? row.name.trim() : null,
                        custom_name: row.custom_name ? row.custom_name.trim() : null,
                        comments: row.comments ? row.comments.trim() : null,
                        is_blocked: false
                    });

                    await contact.create();
                    results.imported++;

                    console.log(`✅ Imported contact ${i + 1}/${csvData.length}: ${row.phone_number}`);

                } catch (error) {
                    results.errors.push({
                        row: i + 1,
                        phone: row.phone_number,
                        error: error.message
                    });
                    console.error(`❌ Error importing contact row ${i + 1}:`, error.message);
                }
            }

            // Limpiar archivo temporal
            try {
                fs.unlinkSync(req.file.path);
            } catch (unlinkError) {
                console.log(`⚠️ Could not delete temporary file: ${unlinkError.message}`);
            }

            console.log(`📊 Import completed: ${results.imported}/${results.processed} contacts imported`);

            res.json({
                success: true,
                message: 'Importación completada',
                data: {
                    processed: results.processed,
                    imported: results.imported,
                    skipped: results.skipped,
                    errorCount: results.errors.length,
                    errors: results.errors.slice(0, 10) // Mostrar solo los primeros 10 errores
                }
            });

        } catch (error) {
            console.error('❌ Error in ContactImportExportController.importContacts:', error.message);
            
            // Limpiar archivo temporal en caso de error
            if (req.file && fs.existsSync(req.file.path)) {
                try {
                    fs.unlinkSync(req.file.path);
                } catch (unlinkError) {
                    console.log(`⚠️ Could not delete temporary file after error: ${unlinkError.message}`);
                }
            }

            next(error);
        }
    }

    /**
     * GET /api/contacts/export
     * Exportar contactos a archivo CSV
     */
    static async exportContacts(req, res, next) {
        try {
            const clientId = req.user.id;
            const { 
                format = 'csv',
                tagId = null,
                blocked = null,
                search = ''
            } = req.query;

            if (format !== 'csv') {
                return res.status(400).json({
                    success: false,
                    message: 'Solo se soporta formato CSV'
                });
            }

            console.log(`📊 Starting contact export for client ${clientId}`);

            // Obtener contactos con filtros
            const options = {
                page: 1,
                limit: 10000, // Máximo para exportación
                search,
                blocked: blocked !== null ? blocked === 'true' : null,
                tagId: tagId ? parseInt(tagId) : null,
                sortBy: 'created_at',
                sortOrder: 'ASC'
            };

            const result = await Contact.findAll(clientId, options);
            const contacts = result.contacts;

            if (contacts.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No se encontraron contactos para exportar'
                });
            }

            // Generar CSV
            const csvHeader = 'phone_number,name,custom_name,comments,is_blocked,created_at,tags\n';
            let csvContent = csvHeader;

            contacts.forEach(contact => {
                const tags = contact.tags ? contact.tags.map(tag => tag.name).join(';') : '';
                const row = [
                    `"${contact.phone_number || ''}"`,
                    `"${contact.name || ''}"`,
                    `"${contact.custom_name || ''}"`,
                    `"${(contact.comments || '').replace(/"/g, '""')}"`,
                    contact.is_blocked ? 'true' : 'false',
                    contact.created_at ? new Date(contact.created_at).toISOString() : '',
                    `"${tags}"`
                ].join(',');
                
                csvContent += row + '\n';
            });

            // Configurar headers para descarga
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `contacts_export_${timestamp}.csv`;

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf8'));

            console.log(`📊 Export completed: ${contacts.length} contacts exported`);

            res.send(csvContent);

        } catch (error) {
            console.error('❌ Error in ContactImportExportController.exportContacts:', error.message);
            next(error);
        }
    }

    /**
     * GET /api/contacts/export/template
     * Descargar plantilla CSV para importación
     */
    static async downloadTemplate(req, res, next) {
        try {
            const templateContent = `phone_number,name,custom_name,comments
5491123456789,Juan Pérez,Cliente VIP,Cliente frecuente desde 2020
5491987654321,María García,,Nueva cliente
5491555111222,Pedro López,Proveedor,Contacto comercial`;

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="contacts_import_template.csv"');
            res.setHeader('Content-Length', Buffer.byteLength(templateContent, 'utf8'));

            res.send(templateContent);

        } catch (error) {
            console.error('❌ Error in ContactImportExportController.downloadTemplate:', error.message);
            next(error);
        }
    }

    /**
     * POST /api/contacts/import/preview
     * Previsualizar archivo CSV antes de importar
     */
    static async previewImport(req, res, next) {
        try {
            // Validar que se haya subido un archivo
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Archivo CSV es requerido'
                });
            }

            // Validar tipo de archivo
            if (req.file.mimetype !== 'text/csv' && !req.file.originalname.endsWith('.csv')) {
                return res.status(400).json({
                    success: false,
                    message: 'Solo se permiten archivos CSV'
                });
            }

            const preview = {
                rows: [],
                totalRows: 0,
                validRows: 0,
                invalidRows: 0,
                errors: []
            };

            // Leer solo las primeras 10 filas para preview
            const csvData = [];
            let rowCount = 0;

            await new Promise((resolve, reject) => {
                const stream = fs.createReadStream(req.file.path)
                    .pipe(csv({
                        headers: ['phone_number', 'name', 'custom_name', 'comments'],
                        skipEmptyLines: true
                    }));

                stream.on('data', (row) => {
                    rowCount++;
                    if (csvData.length < 10) { // Solo las primeras 10 para preview
                        csvData.push(row);
                    }
                });

                stream.on('end', resolve);
                stream.on('error', reject);
            });

            preview.totalRows = rowCount;

            // Validar cada fila del preview
            for (let i = 0; i < csvData.length; i++) {
                const row = csvData[i];
                const rowPreview = {
                    row: i + 1,
                    data: row,
                    valid: true,
                    errors: []
                };

                // Validar número de teléfono
                if (!row.phone_number || !row.phone_number.trim()) {
                    rowPreview.valid = false;
                    rowPreview.errors.push('Número de teléfono requerido');
                }

                // Validar formato de teléfono básico
                if (row.phone_number && !/^\d+$/.test(row.phone_number.replace(/[^\d]/g, ''))) {
                    rowPreview.valid = false;
                    rowPreview.errors.push('Formato de teléfono inválido');
                }

                if (rowPreview.valid) {
                    preview.validRows++;
                } else {
                    preview.invalidRows++;
                }

                preview.rows.push(rowPreview);
            }

            // Estimar validez del archivo completo
            const estimatedValidRows = Math.round((preview.validRows / preview.rows.length) * preview.totalRows);
            const estimatedInvalidRows = preview.totalRows - estimatedValidRows;

            // Limpiar archivo temporal
            try {
                fs.unlinkSync(req.file.path);
            } catch (unlinkError) {
                console.log(`⚠️ Could not delete temporary file: ${unlinkError.message}`);
            }

            res.json({
                success: true,
                data: {
                    headers: ['phone_number', 'name', 'custom_name', 'comments'],
                    rows: preview.rows.map(row => [
                        row.data.phone_number || '',
                        row.data.name || '',
                        row.data.custom_name || '',
                        row.data.comments || ''
                    ]),
                    totalRows: preview.totalRows,
                    validRows: estimatedValidRows,
                    invalidRows: estimatedInvalidRows,
                    errors: preview.rows
                        .filter(row => !row.valid)
                        .map(row => `Fila ${row.row}: ${row.errors.join(', ')}`)
                }
            });

        } catch (error) {
            console.error('❌ Error in ContactImportExportController.previewImport:', error.message);
            
            // Limpiar archivo temporal en caso de error
            if (req.file && fs.existsSync(req.file.path)) {
                try {
                    fs.unlinkSync(req.file.path);
                } catch (unlinkError) {
                    console.log(`⚠️ Could not delete temporary file after error: ${unlinkError.message}`);
                }
            }

            next(error);
        }
    }
}

module.exports = ContactImportExportController;
