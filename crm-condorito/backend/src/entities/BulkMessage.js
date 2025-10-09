const { executeQuery } = require('../config/database-simple');

// ============================================================================
// BULK MESSAGE ENTITY - CRM CONDORITO
// ============================================================================

class BulkMessage {
    constructor(data = {}) {
        this.id = data.id || null;
        this.client_id = data.client_id || null;
        this.campaign_name = data.campaign_name || null;
        this.template_id = data.template_id || null;
        this.content = data.content || null;
        this.scheduled_at = data.scheduled_at || null;
        this.status = data.status || 'pending';
        this.contact_filter = data.contact_filter || {};
        this.selected_contacts = data.selected_contacts || [];
        this.total_contacts = data.total_contacts || 0;
        this.sent_count = data.sent_count || 0;
        this.failed_count = data.failed_count || 0;
        this.success_rate = data.success_rate || 0;
        this.started_at = data.started_at || null;
        this.completed_at = data.completed_at || null;
        this.error_message = data.error_message || null;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
    }

    /**
     * Crear nueva campaña de mensajes masivos
     */
    async create() {
        try {
            // Validar datos requeridos
            if (!this.client_id || !this.campaign_name || !this.content) {
                throw new Error('client_id, campaign_name y content son requeridos');
            }

            const query = `
                INSERT INTO bulk_messages (
                    client_id, campaign_name, template_id, content, scheduled_at,
                    status, contact_filter, selected_contacts, total_contacts
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
                this.client_id,
                this.campaign_name.trim(),
                this.template_id,
                this.content.trim(),
                this.scheduled_at,
                this.status,
                JSON.stringify(this.contact_filter || {}),
                JSON.stringify(this.selected_contacts || []),
                this.total_contacts || this.selected_contacts.length
            ];

            const result = await executeQuery(query, values);
            this.id = result.insertId;

            console.log(`✅ Bulk message campaign created with ID: ${this.id}`);
            return this;

        } catch (error) {
            console.error('❌ Error creating bulk message:', error.message);
            throw error;
        }
    }

    /**
     * Actualizar campaña existente
     */
    async update() {
        try {
            if (!this.id) {
                throw new Error('ID de la campaña es requerido para actualizar');
            }

            const query = `
                UPDATE bulk_messages SET 
                    campaign_name = COALESCE(?, campaign_name),
                    template_id = COALESCE(?, template_id),
                    content = COALESCE(?, content),
                    scheduled_at = COALESCE(?, scheduled_at),
                    status = COALESCE(?, status),
                    contact_filter = COALESCE(?, contact_filter),
                    selected_contacts = COALESCE(?, selected_contacts),
                    total_contacts = COALESCE(?, total_contacts),
                    sent_count = COALESCE(?, sent_count),
                    failed_count = COALESCE(?, failed_count),
                    success_rate = COALESCE(?, success_rate),
                    started_at = COALESCE(?, started_at),
                    completed_at = COALESCE(?, completed_at),
                    error_message = COALESCE(?, error_message),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND client_id = ?
            `;

            const values = [
                this.campaign_name ? this.campaign_name.trim() : null,
                this.template_id,
                this.content ? this.content.trim() : null,
                this.scheduled_at,
                this.status,
                this.contact_filter ? JSON.stringify(this.contact_filter) : null,
                this.selected_contacts ? JSON.stringify(this.selected_contacts) : null,
                this.total_contacts,
                this.sent_count,
                this.failed_count,
                this.success_rate,
                this.started_at,
                this.completed_at,
                this.error_message,
                this.id,
                this.client_id
            ];

            const result = await executeQuery(query, values);

            if (result.affectedRows === 0) {
                throw new Error('Campaña no encontrada o no autorizada');
            }

            console.log(`✅ Bulk message campaign updated: ${this.id}`);
            return this;

        } catch (error) {
            console.error('❌ Error updating bulk message:', error.message);
            throw error;
        }
    }

    /**
     * Eliminar campaña
     */
    async delete() {
        try {
            if (!this.id || !this.client_id) {
                throw new Error('ID de la campaña y client_id son requeridos');
            }

            // Solo permitir eliminar campañas que no están en progreso
            if (this.status === 'sending') {
                throw new Error('No se puede eliminar una campaña en progreso');
            }

            const query = 'DELETE FROM bulk_messages WHERE id = ? AND client_id = ?';
            const result = await executeQuery(query, [this.id, this.client_id]);

            if (result.affectedRows === 0) {
                throw new Error('Campaña no encontrada o no autorizada');
            }

            console.log(`✅ Bulk message campaign deleted: ${this.id}`);
            return true;

        } catch (error) {
            console.error('❌ Error deleting bulk message:', error.message);
            throw error;
        }
    }

    /**
     * Buscar campaña por ID
     */
    static async findById(id, clientId) {
        try {
            const query = `
                SELECT bm.*, mt.name as template_name
                FROM bulk_messages bm
                LEFT JOIN message_templates mt ON bm.template_id = mt.id
                WHERE bm.id = ? AND bm.client_id = ?
            `;

            const rows = await executeQuery(query, [id, clientId]);

            if (rows.length === 0) {
                return null;
            }

            const campaignData = rows[0];
            
            // Parsear campos JSON
            if (campaignData.contact_filter) {
                try {
                    campaignData.contact_filter = JSON.parse(campaignData.contact_filter);
                } catch (e) {
                    campaignData.contact_filter = {};
                }
            } else {
                campaignData.contact_filter = {};
            }

            if (campaignData.selected_contacts) {
                try {
                    campaignData.selected_contacts = JSON.parse(campaignData.selected_contacts);
                } catch (e) {
                    campaignData.selected_contacts = [];
                }
            } else {
                campaignData.selected_contacts = [];
            }

            return new BulkMessage(campaignData);

        } catch (error) {
            console.error('❌ Error finding bulk message by ID:', error.message);
            throw error;
        }
    }

    /**
     * Listar campañas con filtros y paginación
     */
    static async findAll(clientId, options = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                search = '',
                status = null,
                sortBy = 'created_at',
                sortOrder = 'DESC'
            } = options;

            const offset = (page - 1) * limit;
            
            let whereConditions = ['bm.client_id = ?'];
            let queryParams = [clientId];

            // Filtro de búsqueda
            if (search.trim()) {
                whereConditions.push('(bm.campaign_name LIKE ? OR bm.content LIKE ?)');
                const searchTerm = `%${search}%`;
                queryParams.push(searchTerm, searchTerm);
            }

            // Filtro de estado
            if (status) {
                whereConditions.push('bm.status = ?');
                queryParams.push(status);
            }

            // Construir query principal
            const query = `
                SELECT 
                    bm.*,
                    mt.name as template_name
                FROM bulk_messages bm
                LEFT JOIN message_templates mt ON bm.template_id = mt.id
                WHERE ${whereConditions.join(' AND ')}
                ORDER BY bm.${sortBy} ${sortOrder}
                LIMIT ? OFFSET ?
            `;

            queryParams.push(limit, offset);

            const rows = await executeQuery(query, queryParams);

            // Procesar campos JSON para cada campaña
            const campaigns = rows.map(row => {
                if (row.contact_filter) {
                    try {
                        row.contact_filter = JSON.parse(row.contact_filter);
                    } catch (e) {
                        row.contact_filter = {};
                    }
                } else {
                    row.contact_filter = {};
                }

                if (row.selected_contacts) {
                    try {
                        row.selected_contacts = JSON.parse(row.selected_contacts);
                    } catch (e) {
                        row.selected_contacts = [];
                    }
                } else {
                    row.selected_contacts = [];
                }

                return new BulkMessage(row);
            });

            // Contar total para paginación
            const countQuery = `
                SELECT COUNT(*) as total
                FROM bulk_messages bm
                WHERE ${whereConditions.join(' AND ')}
            `;
            
            const countParams = queryParams.slice(0, -2); // Remover LIMIT y OFFSET
            const countResult = await executeQuery(countQuery, countParams);
            const total = countResult[0].total;

            return {
                campaigns,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: parseInt(total),
                    pages: Math.ceil(total / limit)
                }
            };

        } catch (error) {
            console.error('❌ Error finding bulk messages:', error.message);
            throw error;
        }
    }

    /**
     * Obtener estadísticas de campañas
     */
    static async getStats(clientId) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_campaigns,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_campaigns,
                    SUM(CASE WHEN status = 'sending' THEN 1 ELSE 0 END) as active_campaigns,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_campaigns,
                    SUM(total_contacts) as total_contacts_reached,
                    SUM(sent_count) as total_messages_sent,
                    SUM(failed_count) as total_messages_failed,
                    AVG(success_rate) as avg_success_rate
                FROM bulk_messages 
                WHERE client_id = ?
            `;

            const stats = await executeQuery(query, [clientId]);

            // Estadísticas por estado en los últimos 30 días
            const monthlyQuery = `
                SELECT 
                    status,
                    COUNT(*) as count,
                    SUM(sent_count) as messages_sent
                FROM bulk_messages 
                WHERE client_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY status
            `;

            const monthlyStats = await executeQuery(monthlyQuery, [clientId]);

            return {
                total: stats[0],
                monthly: monthlyStats
            };

        } catch (error) {
            console.error('❌ Error getting bulk message stats:', error.message);
            throw error;
        }
    }

    /**
     * Actualizar progreso de envío
     */
    async updateProgress(sent, failed) {
        try {
            if (!this.id || !this.client_id) {
                throw new Error('ID de la campaña y client_id son requeridos');
            }

            this.sent_count = (this.sent_count || 0) + sent;
            this.failed_count = (this.failed_count || 0) + failed;
            
            const totalProcessed = this.sent_count + this.failed_count;
            this.success_rate = this.total_contacts > 0 ? 
                Math.round((this.sent_count / this.total_contacts) * 100) : 0;

            // Actualizar estado si se completó el envío
            if (totalProcessed >= this.total_contacts) {
                this.status = 'completed';
                this.completed_at = new Date().toISOString();
            }

            const query = `
                UPDATE bulk_messages SET 
                    sent_count = ?,
                    failed_count = ?,
                    success_rate = ?,
                    status = ?,
                    completed_at = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND client_id = ?
            `;

            await executeQuery(query, [
                this.sent_count,
                this.failed_count,
                this.success_rate,
                this.status,
                this.completed_at,
                this.id,
                this.client_id
            ]);

            console.log(`✅ Progress updated for campaign ${this.id}: ${this.sent_count}/${this.total_contacts} sent`);

        } catch (error) {
            console.error('❌ Error updating campaign progress:', error.message);
            throw error;
        }
    }

    /**
     * Marcar campaña como iniciada
     */
    async markAsStarted() {
        try {
            this.status = 'sending';
            this.started_at = new Date().toISOString();

            const query = `
                UPDATE bulk_messages SET 
                    status = ?,
                    started_at = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND client_id = ?
            `;

            await executeQuery(query, [
                this.status,
                this.started_at,
                this.id,
                this.client_id
            ]);

            console.log(`✅ Campaign ${this.id} marked as started`);

        } catch (error) {
            console.error('❌ Error marking campaign as started:', error.message);
            throw error;
        }
    }

    /**
     * Marcar campaña como fallida
     */
    async markAsFailed(errorMessage) {
        try {
            this.status = 'failed';
            this.error_message = errorMessage;
            this.completed_at = new Date().toISOString();

            const query = `
                UPDATE bulk_messages SET 
                    status = ?,
                    error_message = ?,
                    completed_at = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND client_id = ?
            `;

            await executeQuery(query, [
                this.status,
                this.error_message,
                this.completed_at,
                this.id,
                this.client_id
            ]);

            console.log(`❌ Campaign ${this.id} marked as failed: ${errorMessage}`);

        } catch (error) {
            console.error('❌ Error marking campaign as failed:', error.message);
            throw error;
        }
    }

    /**
     * Obtener estados válidos
     */
    static getValidStatuses() {
        return [
            { value: 'draft', label: 'Borrador', description: 'Campaña en preparación' },
            { value: 'scheduled', label: 'Programada', description: 'Programada para envío futuro' },
            { value: 'pending', label: 'Pendiente', description: 'Lista para envío inmediato' },
            { value: 'sending', label: 'Enviando', description: 'Envío en progreso' },
            { value: 'completed', label: 'Completada', description: 'Envío completado exitosamente' },
            { value: 'failed', label: 'Fallida', description: 'Envío falló' },
            { value: 'cancelled', label: 'Cancelada', description: 'Envío cancelado por el usuario' }
        ];
    }

    /**
     * Verificar si la campaña puede ser editada
     */
    canBeEdited() {
        return ['draft', 'scheduled', 'pending'].includes(this.status);
    }

    /**
     * Verificar si la campaña puede ser cancelada
     */
    canBeCancelled() {
        return ['scheduled', 'pending', 'sending'].includes(this.status);
    }

    /**
     * Verificar si la campaña puede ser eliminada
     */
    canBeDeleted() {
        return ['draft', 'completed', 'failed', 'cancelled'].includes(this.status);
    }
}

module.exports = BulkMessage;
