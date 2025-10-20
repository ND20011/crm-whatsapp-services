const { executeQuery } = require('../config/database-simple');
const Client = require('../entities/Client');
const WhatsAppSession = require('../entities/WhatsAppSession');

// Importar el servicio de WhatsApp
const whatsappService = require('../services/WhatsAppService');

/**
 * Controlador de Administración
 * Endpoints exclusivos para usuarios administradores
 */
class AdminController {

    /**
     * Reconectar todas las sesiones de WhatsApp de todos los clientes
     * POST /api/admin/reconnect-all-whatsapp
     */
    static async reconnectAllWhatsApp(req, res, next) {
        const startTime = Date.now();
        
        try {
            console.log('🔧 [ADMIN] Starting mass WhatsApp reconnection...');
            console.log(`👤 Initiated by admin: ${req.admin.client_code}`);

            // 1. Obtener todos los clientes activos (excepto admin)
            const clientsQuery = `
                SELECT id, client_code, company_name, status 
                FROM clients 
                WHERE status = 'active' AND company_name != 'Admin'
                ORDER BY client_code
            `;
            
            const clients = await executeQuery(clientsQuery, []);
            console.log(`📊 Found ${clients.length} active clients to reconnect`);

            if (clients.length === 0) {
                return res.json({
                    success: true,
                    message: 'No hay clientes activos para reconectar',
                    summary: {
                        total_clients: 0,
                        processed: 0,
                        successful: 0,
                        failed: 0,
                        skipped: 0
                    },
                    details: [],
                    execution_time_ms: Date.now() - startTime
                });
            }

            // 2. Obtener instancia de Socket.io para eventos en tiempo real
            const socketIo = req.app.get('socketio');

            // 3. Variables para tracking
            const results = {
                total_clients: clients.length,
                processed: 0,
                successful: 0,
                failed: 0,
                skipped: 0,
                details: []
            };

            // 4. Procesar cada cliente de forma síncrona
            for (const client of clients) {
                const clientStartTime = Date.now();
                let clientResult = {
                    client_id: client.id,
                    client_code: client.client_code,
                    company_name: client.company_name,
                    status: 'pending',
                    message: '',
                    execution_time_ms: 0,
                    error: null
                };

                try {
                    console.log(`🔄 Processing client: ${client.client_code} (${client.company_name})`);
                    
                    // Verificar si ya está conectado
                    const currentStatus = whatsappService.getClientStatus(client.client_code);
                    
                    if (currentStatus.connected) {
                        console.log(`✅ Client ${client.client_code} already connected, skipping`);
                        clientResult.status = 'skipped';
                        clientResult.message = 'Cliente ya conectado';
                        results.skipped++;
                    } else {
                        // Intentar crear/reconectar cliente
                        console.log(`🔌 Attempting to connect client: ${client.client_code}`);
                        
                        const connectionResult = await whatsappService.createClient(
                            client.client_code, 
                            client.id, 
                            socketIo
                        );

                        if (connectionResult.success) {
                            console.log(`✅ Successfully connected client: ${client.client_code}`);
                            clientResult.status = 'success';
                            clientResult.message = connectionResult.message || 'Conectado exitosamente';
                            results.successful++;
                        } else {
                            console.log(`❌ Failed to connect client: ${client.client_code}`);
                            clientResult.status = 'failed';
                            clientResult.message = connectionResult.message || 'Error desconocido';
                            clientResult.error = connectionResult.error;
                            results.failed++;
                        }
                    }

                } catch (error) {
                    console.error(`❌ Error processing client ${client.client_code}:`, error.message);
                    clientResult.status = 'failed';
                    clientResult.message = 'Error durante la conexión';
                    clientResult.error = error.message;
                    results.failed++;
                }

                // Calcular tiempo de ejecución para este cliente
                clientResult.execution_time_ms = Date.now() - clientStartTime;
                results.details.push(clientResult);
                results.processed++;

                console.log(`📊 Client ${client.client_code} processed in ${clientResult.execution_time_ms}ms - Status: ${clientResult.status}`);
            }

            // 5. Calcular tiempo total de ejecución
            const totalExecutionTime = Date.now() - startTime;

            // 6. Log final
            console.log('🎯 [ADMIN] Mass WhatsApp reconnection completed:');
            console.log(`📊 Total: ${results.total_clients}, Successful: ${results.successful}, Failed: ${results.failed}, Skipped: ${results.skipped}`);
            console.log(`⏱️ Total execution time: ${totalExecutionTime}ms`);

            // 7. Respuesta final
            res.json({
                success: true,
                message: `Proceso de reconexión completado. ${results.successful} exitosos, ${results.failed} fallidos, ${results.skipped} omitidos de ${results.total_clients} clientes.`,
                summary: {
                    ...results,
                    execution_time_ms: totalExecutionTime
                },
                details: results.details
            });

        } catch (error) {
            console.error('❌ [ADMIN] Error in mass WhatsApp reconnection:', error.message);
            
            const executionTime = Date.now() - startTime;
            
            res.status(500).json({
                success: false,
                message: 'Error durante el proceso de reconexión masiva',
                error: error.message,
                execution_time_ms: executionTime
            });
        }
    }

    /**
     * Obtener estado de todas las conexiones de WhatsApp
     * GET /api/admin/whatsapp-status
     */
    static async getAllWhatsAppStatus(req, res, next) {
        try {
            console.log('📊 [ADMIN] Getting all WhatsApp status...');
            console.log(`👤 Requested by admin: ${req.admin.client_code}`);

            // 1. Obtener todos los clientes activos (excepto admin)
            const clientsQuery = `
                SELECT id, client_code, company_name, status 
                FROM clients 
                WHERE status = 'active' AND company_name != 'Admin'
                ORDER BY client_code
            `;
            
            const clients = await executeQuery(clientsQuery, []);

            // 2. Obtener estado de cada cliente
            const statusList = [];
            let connectedCount = 0;
            let disconnectedCount = 0;

            for (const client of clients) {
                const whatsappStatus = whatsappService.getClientStatus(client.client_code);
                
                const clientStatus = {
                    client_id: client.id,
                    client_code: client.client_code,
                    company_name: client.company_name,
                    whatsapp_connected: whatsappStatus.connected,
                    whatsapp_status: whatsappStatus.status,
                    phone_number: whatsappStatus.phoneNumber || null,
                    last_activity: whatsappStatus.lastActivity || null,
                    has_qr: whatsappStatus.hasQR || false
                };

                if (whatsappStatus.connected) {
                    connectedCount++;
                } else {
                    disconnectedCount++;
                }

                statusList.push(clientStatus);
            }

            // 3. Respuesta
            res.json({
                success: true,
                message: `Estado de WhatsApp para ${clients.length} clientes`,
                summary: {
                    total_clients: clients.length,
                    connected: connectedCount,
                    disconnected: disconnectedCount
                },
                clients: statusList
            });

        } catch (error) {
            console.error('❌ [ADMIN] Error getting WhatsApp status:', error.message);
            
            res.status(500).json({
                success: false,
                message: 'Error obteniendo estado de WhatsApp',
                error: error.message
            });
        }
    }

    /**
     * Desconectar todas las sesiones de WhatsApp
     * POST /api/admin/disconnect-all-whatsapp
     */
    static async disconnectAllWhatsApp(req, res, next) {
        try {
            console.log('🔌 [ADMIN] Disconnecting all WhatsApp sessions...');
            console.log(`👤 Initiated by admin: ${req.admin.client_code}`);

            // Limpiar todos los clientes del servicio
            await whatsappService.cleanup();

            console.log('✅ [ADMIN] All WhatsApp sessions disconnected');

            res.json({
                success: true,
                message: 'Todas las sesiones de WhatsApp han sido desconectadas'
            });

        } catch (error) {
            console.error('❌ [ADMIN] Error disconnecting all WhatsApp:', error.message);
            
            res.status(500).json({
                success: false,
                message: 'Error desconectando sesiones de WhatsApp',
                error: error.message
            });
        }
    }

    /**
     * Obtener estadísticas generales del sistema
     * GET /api/admin/system-stats
     */
    static async getSystemStats(req, res, next) {
        try {
            console.log('📈 [ADMIN] Getting system statistics...');

            // Consultas para estadísticas
            const queries = {
                total_clients: `SELECT COUNT(*) as count FROM clients WHERE company_name != 'Admin'`,
                active_clients: `SELECT COUNT(*) as count FROM clients WHERE status = 'active' AND company_name != 'Admin'`,
                total_contacts: `SELECT COUNT(*) as count FROM contacts`,
                total_messages: `SELECT COUNT(*) as count FROM messages WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
                total_templates: `SELECT COUNT(*) as count FROM message_templates`,
                scheduled_messages: `SELECT COUNT(*) as count FROM scheduled_messages WHERE status = 'pending'`
            };

            const stats = {};

            // Ejecutar todas las consultas
            for (const [key, query] of Object.entries(queries)) {
                try {
                    const result = await executeQuery(query, []);
                    stats[key] = result[0].count;
                } catch (error) {
                    console.error(`Error getting ${key}:`, error.message);
                    stats[key] = 0;
                }
            }

            // Obtener estado de WhatsApp
            const clientsQuery = `SELECT client_code FROM clients WHERE status = 'active' AND company_name != 'Admin'`;
            const clients = await executeQuery(clientsQuery, []);
            
            let whatsapp_connected = 0;
            for (const client of clients) {
                const status = whatsappService.getClientStatus(client.client_code);
                if (status.connected) {
                    whatsapp_connected++;
                }
            }

            stats.whatsapp_connected = whatsapp_connected;
            stats.whatsapp_disconnected = clients.length - whatsapp_connected;

            res.json({
                success: true,
                message: 'Estadísticas del sistema obtenidas',
                stats,
                generated_at: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ [ADMIN] Error getting system stats:', error.message);
            
            res.status(500).json({
                success: false,
                message: 'Error obteniendo estadísticas del sistema',
                error: error.message
            });
        }
    }
}

module.exports = AdminController;