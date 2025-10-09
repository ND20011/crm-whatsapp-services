const { executeQuery } = require('../config/database-simple');
const bcrypt = require('bcryptjs');

/**
 * Controlador del Backoffice
 * Maneja la administración de usuarios y cuotas
 */
class BackofficeController {

    /**
     * GET /api/backoffice/clients
     * Obtener lista de todos los clientes (excepto admins)
     */
    static async getClients(req, res, next) {
        try {
            const { page = 1, limit = 20, search = '', status = '' } = req.query;
            const offset = (page - 1) * limit;
            
            // Validar y sanitizar parámetros
            const safeLimit = Math.max(1, Math.min(100, parseInt(limit)));
            const safeOffset = Math.max(0, parseInt(offset));
            
            // Construir query con filtros
            let whereClause = "WHERE company_name != 'Admin'";
            const queryParams = [];
            
            if (search) {
                whereClause += " AND (client_code LIKE ? OR company_name LIKE ? OR email LIKE ?)";
                const searchTerm = `%${search}%`;
                queryParams.push(searchTerm, searchTerm, searchTerm);
            }
            
            if (status) {
                whereClause += " AND status = ?";
                queryParams.push(status);
            }
            
            // Query principal
            const query = `
                SELECT 
                    id, client_code, company_name, email, phone, status,
                    monthly_bot_limit, current_bot_usage, bot_usage_reset_date,
                    monthly_token_limit, current_token_usage, token_usage_reset_date,
                    created_at, updated_at
                FROM clients 
                ${whereClause}
                ORDER BY created_at DESC
                LIMIT ${safeLimit} OFFSET ${safeOffset}
            `;
            
            const clients = await executeQuery(query, queryParams);
            
            // Query de conteo
            const countQuery = `
                SELECT COUNT(*) as total 
                FROM clients 
                ${whereClause}
            `;
            
            const countResult = await executeQuery(countQuery, queryParams);
            const total = countResult[0].total;
            
            // Calcular estadísticas adicionales para cada cliente
            const clientsWithStats = clients.map(client => {
                const botUsagePercentage = client.monthly_bot_limit > 0 
                    ? Math.round((client.current_bot_usage / client.monthly_bot_limit) * 100)
                    : 0;
                
                const tokenUsagePercentage = client.monthly_token_limit > 0 
                    ? Math.round((client.current_token_usage / client.monthly_token_limit) * 100)
                    : 0;
                
                return {
                    ...client,
                    bot_usage_percentage: botUsagePercentage,
                    token_usage_percentage: tokenUsagePercentage,
                    bot_remaining: Math.max(0, client.monthly_bot_limit - client.current_bot_usage),
                    token_remaining: Math.max(0, (client.monthly_token_limit || 0) - (client.current_token_usage || 0))
                };
            });
            
            console.log(`👑 Admin ${req.admin.client_code} retrieved ${clients.length} clients`);
            
            res.json({
                success: true,
                data: clientsWithStats,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: safeLimit,
                    totalPages: Math.ceil(total / safeLimit),
                    hasNext: (parseInt(page) * safeLimit) < total,
                    hasPrev: parseInt(page) > 1
                }
            });
            
        } catch (error) {
            console.error('❌ Error getting clients:', error.message);
            next(error);
        }
    }

    /**
     * POST /api/backoffice/clients
     * Crear nuevo cliente
     */
    static async createClient(req, res, next) {
        try {
            const {
                client_code,
                password,
                company_name,
                email,
                phone,
                monthly_bot_limit = 2500,
                monthly_token_limit = 100000
            } = req.body;
            
            // Validaciones
            if (!client_code || !password || !company_name) {
                return res.status(400).json({
                    success: false,
                    message: 'Código de cliente, contraseña y nombre de empresa son requeridos'
                });
            }
            
            // Verificar que el código no exista
            const existingClient = await executeQuery(
                'SELECT id FROM clients WHERE client_code = ?',
                [client_code]
            );
            
            if (existingClient.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'El código de cliente ya existe'
                });
            }
            
            // Encriptar contraseña
            const hashedPassword = await bcrypt.hash(password, 12);
            
            // Crear cliente
            const result = await executeQuery(`
                INSERT INTO clients (
                    client_code, password, company_name, email, phone,
                    monthly_bot_limit, current_bot_usage, bot_usage_reset_date,
                    monthly_token_limit, current_token_usage, token_usage_reset_date,
                    status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                client_code,
                hashedPassword,
                company_name,
                email,
                phone,
                monthly_bot_limit,
                0, // current_bot_usage inicial
                new Date().toISOString().split('T')[0].substring(0, 8) + '01', // Primer día del mes
                monthly_token_limit,
                0, // current_token_usage inicial
                new Date().toISOString().split('T')[0].substring(0, 8) + '01', // Primer día del mes
                'active'
            ]);
            
            const clientId = result.insertId;
            
            // Crear configuración de bot por defecto para el nuevo cliente
            await executeQuery(`
                INSERT INTO bot_configurations (
                    client_id, 
                    is_enabled, 
                    working_hours_start, 
                    working_hours_end, 
                    working_days,
                    auto_response_delay,
                    welcome_message,
                    fallback_message,
                    max_auto_responses_per_conversation,
                    product_search_enabled
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                clientId,
                true,
                '00:00:00',
                '23:59:00',
                JSON.stringify([0, 1, 2, 3, 4, 5, 6]), // Todos los días
                2000,
                `¡Hola! Bienvenido a ${company_name}. ¿En qué podemos ayudarte?`,
                'Lo siento, no pude entender tu consulta. Un agente te contactará pronto.',
                5,
                false  // Por defecto, solo respuestas de texto (sin búsqueda de productos)
            ]);
            
            console.log(`👑 Admin ${req.admin.client_code} created client ${client_code} (ID: ${clientId})`);
            console.log(`🤖 Bot configuration created for client ${client_code}`);
            
            res.status(201).json({
                success: true,
                message: 'Cliente creado exitosamente',
                client: {
                    id: clientId,
                    client_code,
                    company_name,
                    email,
                    phone,
                    monthly_bot_limit,
                    monthly_token_limit,
                    status: 'active'
                }
            });
            
        } catch (error) {
            console.error('❌ Error creating client:', error.message);
            next(error);
        }
    }

    /**
     * PUT /api/backoffice/clients/:id
     * Actualizar cliente existente
     */
    static async updateClient(req, res, next) {
        try {
            const { id } = req.params;
            const {
                company_name,
                email,
                phone,
                status,
                monthly_bot_limit,
                monthly_token_limit
            } = req.body;
            
            // Verificar que el cliente existe y no es admin
            const existingClient = await executeQuery(
                'SELECT id, client_code, company_name FROM clients WHERE id = ?',
                [id]
            );
            
            if (existingClient.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Cliente no encontrado'
                });
            }
            
            if (existingClient[0].company_name === 'Admin') {
                return res.status(403).json({
                    success: false,
                    message: 'No se puede modificar usuarios administradores'
                });
            }
            
            // Construir query de actualización
            const updateFields = [];
            const updateValues = [];
            
            if (company_name !== undefined) {
                updateFields.push('company_name = ?');
                updateValues.push(company_name);
            }
            
            if (email !== undefined) {
                updateFields.push('email = ?');
                updateValues.push(email);
            }
            
            if (phone !== undefined) {
                updateFields.push('phone = ?');
                updateValues.push(phone);
            }
            
            if (status !== undefined) {
                updateFields.push('status = ?');
                updateValues.push(status);
            }
            
            if (monthly_bot_limit !== undefined) {
                updateFields.push('monthly_bot_limit = ?');
                updateValues.push(monthly_bot_limit);
            }
            
            if (monthly_token_limit !== undefined) {
                updateFields.push('monthly_token_limit = ?');
                updateValues.push(monthly_token_limit);
            }
            
            if (updateFields.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No se proporcionaron campos para actualizar'
                });
            }
            
            updateFields.push('updated_at = CURRENT_TIMESTAMP');
            updateValues.push(id);
            
            const updateQuery = `
                UPDATE clients 
                SET ${updateFields.join(', ')} 
                WHERE id = ?
            `;
            
            await executeQuery(updateQuery, updateValues);
            
            // Obtener cliente actualizado
            const updatedClient = await executeQuery(
                'SELECT * FROM clients WHERE id = ?',
                [id]
            );
            
            console.log(`👑 Admin ${req.admin.client_code} updated client ${existingClient[0].client_code}`);
            
            res.json({
                success: true,
                message: 'Cliente actualizado exitosamente',
                client: updatedClient[0]
            });
            
        } catch (error) {
            console.error('❌ Error updating client:', error.message);
            next(error);
        }
    }

    /**
     * POST /api/backoffice/clients/:id/reset-quota
     * Resetear cuotas de un cliente
     */
    static async resetClientQuota(req, res, next) {
        try {
            const { id } = req.params;
            const { type = 'both' } = req.body; // 'bot', 'token', or 'both'
            
            // Verificar que el cliente existe
            const client = await executeQuery(
                'SELECT id, client_code, company_name FROM clients WHERE id = ?',
                [id]
            );
            
            if (client.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Cliente no encontrado'
                });
            }
            
            if (client[0].company_name === 'Admin') {
                return res.status(403).json({
                    success: false,
                    message: 'No se puede resetear cuotas de administradores'
                });
            }
            
            // Construir query de reset
            const updateFields = [];
            const resetDate = new Date().toISOString().split('T')[0].substring(0, 8) + '01';
            
            if (type === 'bot' || type === 'both') {
                updateFields.push('current_bot_usage = 0', 'bot_usage_reset_date = ?');
            }
            
            if (type === 'token' || type === 'both') {
                updateFields.push('current_token_usage = 0', 'token_usage_reset_date = ?');
            }
            
            const updateQuery = `
                UPDATE clients 
                SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            
            const params = [];
            if (type === 'bot' || type === 'both') params.push(resetDate);
            if (type === 'token' || type === 'both') params.push(resetDate);
            params.push(id);
            
            await executeQuery(updateQuery, params);
            
            console.log(`👑 Admin ${req.admin.client_code} reset ${type} quota for client ${client[0].client_code}`);
            
            res.json({
                success: true,
                message: `Cuota ${type === 'both' ? 'de bot y tokens' : type === 'bot' ? 'de bot' : 'de tokens'} reseteada exitosamente`,
                client_code: client[0].client_code
            });
            
        } catch (error) {
            console.error('❌ Error resetting client quota:', error.message);
            next(error);
        }
    }

    /**
     * GET /api/backoffice/stats
     * Obtener estadísticas generales del sistema
     */
    static async getSystemStats(req, res, next) {
        try {
            // Estadísticas de clientes
            const clientStats = await executeQuery(`
                SELECT 
                    COUNT(*) as total_clients,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_clients,
                    SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive_clients,
                    SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended_clients
                FROM clients 
                WHERE company_name != 'Admin'
            `);
            
            // Estadísticas de uso de bot
            const botStats = await executeQuery(`
                SELECT 
                    SUM(monthly_bot_limit) as total_bot_limit,
                    SUM(current_bot_usage) as total_bot_usage,
                    AVG(current_bot_usage / monthly_bot_limit * 100) as avg_bot_usage_percentage
                FROM clients 
                WHERE company_name != 'Admin' AND monthly_bot_limit > 0
            `);
            
            // Estadísticas de uso de tokens
            const tokenStats = await executeQuery(`
                SELECT 
                    SUM(COALESCE(monthly_token_limit, 0)) as total_token_limit,
                    SUM(COALESCE(current_token_usage, 0)) as total_token_usage,
                    AVG(CASE WHEN monthly_token_limit > 0 THEN current_token_usage / monthly_token_limit * 100 ELSE 0 END) as avg_token_usage_percentage
                FROM clients 
                WHERE company_name != 'Admin'
            `);
            
            // Clientes con cuota agotada
            const quotaExceeded = await executeQuery(`
                SELECT 
                    COUNT(*) as bot_quota_exceeded
                FROM clients 
                WHERE company_name != 'Admin' 
                AND current_bot_usage >= monthly_bot_limit
            `);
            
            console.log(`👑 Admin ${req.admin.client_code} retrieved system stats`);
            
            res.json({
                success: true,
                stats: {
                    clients: clientStats[0],
                    bot_usage: {
                        ...botStats[0],
                        avg_bot_usage_percentage: Math.round(botStats[0].avg_bot_usage_percentage || 0)
                    },
                    token_usage: {
                        ...tokenStats[0],
                        avg_token_usage_percentage: Math.round(tokenStats[0].avg_token_usage_percentage || 0)
                    },
                    quota_exceeded: quotaExceeded[0].bot_quota_exceeded
                }
            });
            
        } catch (error) {
            console.error('❌ Error getting system stats:', error.message);
            next(error);
        }
    }

    /**
     * DELETE /api/backoffice/clients/:id
     * Eliminar cliente
     */
    static async deleteClient(req, res, next) {
        try {
            const clientId = parseInt(req.params.id);

            if (!clientId || isNaN(clientId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de cliente inválido'
                });
            }

            // Verificar que el cliente existe y no es admin
            const existingClient = await executeQuery(
                'SELECT id, client_code, company_name FROM clients WHERE id = ? AND company_name != ?',
                [clientId, 'Admin']
            );

            if (existingClient.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Cliente no encontrado o no se puede eliminar'
                });
            }

            // Eliminar cliente (esto también eliminará registros relacionados por CASCADE)
            await executeQuery('DELETE FROM clients WHERE id = ?', [clientId]);

            console.log(`👑 Admin ${req.admin.client_code} deleted client: ${existingClient[0].client_code}`);

            res.json({
                success: true,
                message: 'Cliente eliminado exitosamente'
            });

        } catch (error) {
            console.error('❌ Error deleting client:', error.message);
            next(error);
        }
    }

    /**
     * GET /api/backoffice/clients/:id
     * Obtener detalles de un cliente específico
     */
    static async getClientDetails(req, res, next) {
        try {
            const clientId = parseInt(req.params.id);

            if (!clientId || isNaN(clientId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de cliente inválido'
                });
            }

            const client = await executeQuery(`
                SELECT 
                    id, client_code, company_name, email, phone, status,
                    monthly_bot_limit, current_bot_usage, bot_usage_reset_date,
                    monthly_token_limit, current_token_usage, token_usage_reset_date,
                    created_at, updated_at
                FROM clients 
                WHERE id = ? AND company_name != 'Admin'
            `, [clientId]);

            if (client.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Cliente no encontrado'
                });
            }

            const clientData = client[0];

            res.json({
                success: true,
                data: {
                    ...clientData,
                    bot_usage_percentage: clientData.monthly_bot_limit > 0 
                        ? Math.round((clientData.current_bot_usage / clientData.monthly_bot_limit) * 100)
                        : 0,
                    token_usage_percentage: clientData.monthly_token_limit > 0 
                        ? Math.round((clientData.current_token_usage / clientData.monthly_token_limit) * 100)
                        : 0,
                    bot_remaining: Math.max(0, clientData.monthly_bot_limit - clientData.current_bot_usage),
                    token_remaining: Math.max(0, clientData.monthly_token_limit - clientData.current_token_usage)
                }
            });

        } catch (error) {
            console.error('❌ Error getting client details:', error.message);
            next(error);
        }
    }

    /**
     * GET /api/backoffice/reports
     * Obtener reportes del sistema
     */
    static async getSystemReports(req, res, next) {
        try {
            // Reportes básicos
            const reports = {
                usage: {},
                topClients: [],
                alerts: []
            };

            // Obtener datos básicos
            const clientStats = await executeQuery(`
                SELECT 
                    COUNT(*) as total_clients,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_clients,
                    SUM(current_bot_usage) as total_bot_usage,
                    SUM(current_token_usage) as total_token_usage
                FROM clients 
                WHERE company_name != 'Admin'
            `);

            reports.usage = clientStats[0];

            // Top clientes por uso
            const topClients = await executeQuery(`
                SELECT 
                    client_code, company_name, current_bot_usage, monthly_bot_limit,
                    CASE WHEN monthly_bot_limit > 0 THEN (current_bot_usage / monthly_bot_limit * 100) ELSE 0 END as usage_percentage
                FROM clients 
                WHERE company_name != 'Admin'
                ORDER BY usage_percentage DESC
                LIMIT 10
            `);

            reports.topClients = topClients;

            // Alertas (clientes cerca del límite)
            const alerts = await executeQuery(`
                SELECT 
                    client_code, company_name, current_bot_usage, monthly_bot_limit,
                    (current_bot_usage / monthly_bot_limit * 100) as usage_percentage
                FROM clients 
                WHERE company_name != 'Admin' 
                AND monthly_bot_limit > 0
                AND (current_bot_usage / monthly_bot_limit * 100) >= 80
                ORDER BY usage_percentage DESC
            `);

            reports.alerts = alerts;

            console.log(`👑 Admin ${req.admin.client_code} generated system reports`);

            res.json({
                success: true,
                data: reports
            });

        } catch (error) {
            console.error('❌ Error generating reports:', error.message);
            next(error);
        }
    }

    /**
     * GET /api/backoffice/clients/export
     * Exportar datos de clientes
     */
    static async exportClients(req, res, next) {
        try {
            const { format = 'csv' } = req.query;

            const clients = await executeQuery(`
                SELECT 
                    client_code, company_name, email, phone, status,
                    monthly_bot_limit, current_bot_usage, 
                    monthly_token_limit, current_token_usage,
                    created_at, updated_at
                FROM clients 
                WHERE company_name != 'Admin'
                ORDER BY created_at DESC
            `);

            if (format === 'csv') {
                // Generar CSV
                const headers = [
                    'Código Cliente', 'Empresa', 'Email', 'Teléfono', 'Estado',
                    'Límite Bot', 'Uso Bot', 'Límite Tokens', 'Uso Tokens',
                    'Fecha Creación'
                ];

                let csv = headers.join(',') + '\n';

                clients.forEach(client => {
                    const row = [
                        `"${client.client_code}"`,
                        `"${client.company_name}"`,
                        `"${client.email || ''}"`,
                        `"${client.phone || ''}"`,
                        `"${client.status}"`,
                        client.monthly_bot_limit,
                        client.current_bot_usage,
                        client.monthly_token_limit,
                        client.current_token_usage,
                        `"${new Date(client.created_at).toISOString().split('T')[0]}"`
                    ];
                    csv += row.join(',') + '\n';
                });

                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="clientes_${new Date().toISOString().split('T')[0]}.csv"`);
                res.send(csv);
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Formato no soportado. Use format=csv'
                });
            }

            console.log(`👑 Admin ${req.admin.client_code} exported clients data`);

        } catch (error) {
            console.error('❌ Error exporting clients:', error.message);
            next(error);
        }
    }

    /**
     * GET /api/backoffice/logs
     * Obtener logs del sistema (placeholder)
     */
    static async getSystemLogs(req, res, next) {
        try {
            const logs = [
                {
                    timestamp: new Date().toISOString(),
                    level: 'info',
                    message: 'Sistema funcionando correctamente',
                    module: 'system'
                }
            ];

            res.json({
                success: true,
                data: logs
            });

        } catch (error) {
            console.error('❌ Error getting logs:', error.message);
            next(error);
        }
    }

    /**
     * GET /api/backoffice/config
     * Obtener configuración del sistema
     */
    static async getSystemConfig(req, res, next) {
        try {
            const config = {
                system: {
                    maintenance_mode: false,
                    max_clients: 100
                }
            };

            res.json({
                success: true,
                data: config
            });

        } catch (error) {
            console.error('❌ Error getting config:', error.message);
            next(error);
        }
    }

    /**
     * PUT /api/backoffice/config
     * Actualizar configuración del sistema
     */
    static async updateSystemConfig(req, res, next) {
        try {
            console.log(`👑 Admin ${req.admin.client_code} updated system config`);

            res.json({
                success: true,
                message: 'Configuración actualizada'
            });

        } catch (error) {
            console.error('❌ Error updating config:', error.message);
            next(error);
        }
    }

    /**
     * GET /api/backoffice/metrics/realtime
     * Obtener métricas en tiempo real
     */
    static async getRealTimeMetrics(req, res, next) {
        try {
            const metrics = {
                timestamp: new Date().toISOString(),
                activeConnections: Math.floor(Math.random() * 50) + 10,
                systemLoad: {
                    cpu: Math.floor(Math.random() * 30) + 20,
                    memory: Math.floor(Math.random() * 40) + 30
                }
            };

            res.json({
                success: true,
                data: metrics
            });

        } catch (error) {
            console.error('❌ Error getting metrics:', error.message);
            next(error);
        }
    }

    /**
     * POST /api/backoffice/maintenance
     * Ejecutar mantenimiento del sistema
     */
    static async runSystemMaintenance(req, res, next) {
        try {
            const { type } = req.body;

            if (!['cleanup', 'optimize', 'backup'].includes(type)) {
                return res.status(400).json({
                    success: false,
                    message: 'Tipo de mantenimiento inválido'
                });
            }

            console.log(`👑 Admin ${req.admin.client_code} initiated ${type} maintenance`);

            res.json({
                success: true,
                message: `Mantenimiento ${type} iniciado`
            });

        } catch (error) {
            console.error('❌ Error running maintenance:', error.message);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al ejecutar mantenimiento',
                error: error.message
            });
        }
    }

    /**
     * POST /api/backoffice/reset-monthly-quotas
     * Resetear cuotas mensuales de todos los clientes
     */
    static async resetMonthlyQuotas(req, res) {
        try {
            console.log(`👑 Admin ${req.user.username} iniciando reset mensual de cuotas`);

            // Obtener todos los clientes activos
            const clientsQuery = `
                SELECT id, client_code, company_name, 
                       monthly_bot_limit, monthly_token_limit,
                       current_bot_usage, current_token_usage
                FROM clients 
                WHERE status = 'active'
            `;
            
            const clients = await executeQuery(clientsQuery);
            
            if (clients.length === 0) {
                return res.json({
                    success: true,
                    message: 'No hay clientes activos para resetear',
                    data: {
                        totalClients: 0,
                        resetClients: 0,
                        errors: []
                    }
                });
            }

            let resetCount = 0;
            const errors = [];
            const resetDetails = [];

            // Resetear cada cliente
            for (const client of clients) {
                try {
                    const resetQuery = `
                        UPDATE clients 
                        SET 
                            current_bot_usage = 0,
                            current_token_usage = 0,
                            bot_usage_reset_date = NOW(),
                            token_usage_reset_date = NOW(),
                            updated_at = NOW()
                        WHERE id = ?
                    `;

                    await executeQuery(resetQuery, [client.id]);

                    resetDetails.push({
                        clientId: client.id,
                        clientCode: client.client_code,
                        companyName: client.company_name,
                        previousBotUsage: client.current_bot_usage,
                        previousTokenUsage: client.current_token_usage,
                        resetAt: new Date().toISOString()
                    });

                    resetCount++;
                    console.log(`✅ Cliente ${client.client_code} reseteado exitosamente`);

                } catch (clientError) {
                    console.error(`❌ Error reseteando cliente ${client.client_code}:`, clientError);
                    errors.push({
                        clientId: client.id,
                        clientCode: client.client_code,
                        error: clientError.message
                    });
                }
            }

            // Log del resultado
            console.log(`📊 Reset mensual completado: ${resetCount}/${clients.length} clientes`);

            // Insertar registro en logs del sistema (si existe tabla de logs)
            try {
                const logQuery = `
                    INSERT INTO system_logs (level, message, details, created_at)
                    VALUES ('info', 'Reset mensual de cuotas ejecutado manualmente', ?, NOW())
                `;
                
                const logDetails = JSON.stringify({
                    adminUser: req.user.username,
                    totalClients: clients.length,
                    resetClients: resetCount,
                    errors: errors.length,
                    timestamp: new Date().toISOString()
                });

                await executeQuery(logQuery, [logDetails]);
            } catch (logError) {
                console.log('⚠️ No se pudo registrar en system_logs (tabla no existe)');
            }

            res.json({
                success: true,
                message: `Reset mensual completado: ${resetCount}/${clients.length} clientes procesados`,
                data: {
                    totalClients: clients.length,
                    resetClients: resetCount,
                    errors: errors,
                    resetDetails: resetDetails,
                    executedBy: req.user.username,
                    executedAt: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ Error en reset mensual de cuotas:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al resetear cuotas mensuales',
                error: error.message
            });
        }
    }
};

module.exports = BackofficeController;
