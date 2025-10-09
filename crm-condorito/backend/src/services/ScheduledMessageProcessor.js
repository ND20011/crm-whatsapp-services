const cron = require('node-cron');
const ScheduledMessageService = require('./ScheduledMessageService');

// ============================================================================
// SCHEDULED MESSAGE PROCESSOR - CRON JOBS
// ============================================================================

class ScheduledMessageProcessor {
    constructor() {
        this.cronJobs = new Map();
        this.isProcessing = false;
        this.lastProcessTime = null;
        this.stats = {
            totalProcessed: 0,
            totalSuccess: 0,
            totalErrors: 0,
            lastReset: new Date()
        };
    }

    /**
     * Inicializar procesador de mensajes programados
     */
    init() {
        console.log('🕐 Inicializando procesador de mensajes programados...');

        // Procesar cada minuto
        this.scheduleMainProcessor();
        
        // Estadísticas diarias
        this.scheduleDailyCleanup();
        
        // Procesar inmediatamente al iniciar (para testing)
        setTimeout(() => {
            this.processMessages();
        }, 5000);

        console.log('✅ Procesador de mensajes programados iniciado');
    }

    /**
     * Programar procesador principal (cada minuto)
     */
    scheduleMainProcessor() {
        // Ejecutar cada minuto
        const mainJob = cron.schedule('* * * * *', async () => {
            await this.processMessages();
        }, {
            scheduled: true,
            timezone: 'America/Argentina/Buenos_Aires'
        });

        this.cronJobs.set('main_processor', mainJob);
        console.log('📅 Procesador principal programado: cada minuto');
    }

    /**
     * Programar limpieza diaria
     */
    scheduleDailyCleanup() {
        // Ejecutar a las 2:00 AM todos los días
        const cleanupJob = cron.schedule('0 2 * * *', async () => {
            await this.performDailyCleanup();
        }, {
            scheduled: true,
            timezone: 'America/Argentina/Buenos_Aires'
        });

        this.cronJobs.set('daily_cleanup', cleanupJob);
        console.log('📅 Limpieza diaria programada: 2:00 AM');
    }

    /**
     * Procesar mensajes programados
     */
    async processMessages() {
        // Evitar procesamiento concurrente
        if (this.isProcessing) {
            console.log('⚠️ Procesamiento ya en curso, saltando...');
            return;
        }

        this.isProcessing = true;
        this.lastProcessTime = new Date();

        try {
            console.log('🔄 Iniciando procesamiento de mensajes programados...');
            
            const result = await ScheduledMessageService.processScheduledMessages();
            
            // Actualizar estadísticas
            this.stats.totalProcessed += result.processed;
            this.stats.totalSuccess += result.success;
            this.stats.totalErrors += result.errors;

            if (result.processed > 0) {
                console.log(`📊 Procesamiento completado: ${result.processed} procesados, ${result.success} exitosos, ${result.errors} errores`);
            } else {
                console.log('ℹ️ No hay mensajes para procesar en este momento');
            }

        } catch (error) {
            console.error('❌ Error en procesamiento de mensajes programados:', error);
            this.stats.totalErrors++;
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Limpieza diaria
     */
    async performDailyCleanup() {
        try {
            console.log('🧹 Iniciando limpieza diaria...');

            // Limpiar registros de ejecución antiguos (más de 30 días)
            await this.cleanOldExecutionRecords();
            
            // Limpiar mensajes completados muy antiguos (más de 90 días)
            await this.cleanOldCompletedMessages();
            
            // Resetear estadísticas
            this.resetDailyStats();

            console.log('✅ Limpieza diaria completada');

        } catch (error) {
            console.error('❌ Error en limpieza diaria:', error);
        }
    }

    /**
     * Limpiar registros de ejecución antiguos
     */
    async cleanOldExecutionRecords() {
        try {
            const { executeQuery } = require('../config/database-simple');
            
            // Eliminar registros de ejecución más antiguos que 30 días
            const deleteExecutionsQuery = `
                DELETE FROM scheduled_message_executions 
                WHERE execution_date < DATE_SUB(NOW(), INTERVAL 30 DAY)
            `;
            
            const result = await executeQuery(deleteExecutionsQuery);
            
            if (result.affectedRows > 0) {
                console.log(`🗑️ Eliminados ${result.affectedRows} registros de ejecución antiguos`);
            }

            // Eliminar registros de destinatarios huérfanos
            const deleteOrphanRecipientsQuery = `
                DELETE smr FROM scheduled_message_recipients smr
                LEFT JOIN scheduled_message_executions sme ON smr.execution_id = sme.id
                WHERE sme.id IS NULL
            `;
            
            const recipientResult = await executeQuery(deleteOrphanRecipientsQuery);
            
            if (recipientResult.affectedRows > 0) {
                console.log(`🗑️ Eliminados ${recipientResult.affectedRows} registros de destinatarios huérfanos`);
            }

        } catch (error) {
            console.error('❌ Error limpiando registros antiguos:', error);
        }
    }

    /**
     * Limpiar mensajes completados muy antiguos
     */
    async cleanOldCompletedMessages() {
        try {
            const { executeQuery } = require('../config/database-simple');
            
            // Mover mensajes muy antiguos a estado "archived" en lugar de eliminarlos
            const archiveQuery = `
                UPDATE scheduled_messages 
                SET status = 'archived', is_active = false
                WHERE status = 'completed' 
                  AND last_execution < DATE_SUB(NOW(), INTERVAL 90 DAY)
                  AND status != 'archived'
            `;
            
            const result = await executeQuery(archiveQuery);
            
            if (result.affectedRows > 0) {
                console.log(`📦 Archivados ${result.affectedRows} mensajes completados antiguos`);
            }

        } catch (error) {
            console.error('❌ Error archivando mensajes antiguos:', error);
        }
    }

    /**
     * Resetear estadísticas diarias
     */
    resetDailyStats() {
        this.stats = {
            totalProcessed: 0,
            totalSuccess: 0,
            totalErrors: 0,
            lastReset: new Date()
        };
        console.log('📊 Estadísticas diarias reseteadas');
    }

    /**
     * Obtener estadísticas del procesador
     */
    getProcessorStats() {
        return {
            isProcessing: this.isProcessing,
            lastProcessTime: this.lastProcessTime,
            stats: this.stats,
            activeCronJobs: Array.from(this.cronJobs.keys()),
            uptime: this.getUptime()
        };
    }

    /**
     * Obtener tiempo de actividad
     */
    getUptime() {
        if (!this.stats.lastReset) {
            return 0;
        }
        return Math.floor((new Date() - this.stats.lastReset) / 1000);
    }

    /**
     * Parar todos los cron jobs
     */
    stop() {
        console.log('🛑 Deteniendo procesador de mensajes programados...');
        
        this.cronJobs.forEach((job, name) => {
            job.stop();
            console.log(`🛑 Cron job '${name}' detenido`);
        });
        
        this.cronJobs.clear();
        console.log('✅ Procesador de mensajes programados detenido');
    }

    /**
     * Reiniciar procesador
     */
    restart() {
        console.log('🔄 Reiniciando procesador de mensajes programados...');
        this.stop();
        setTimeout(() => {
            this.init();
        }, 1000);
    }

    /**
     * Procesar mensajes manualmente (para testing)
     */
    async manualProcess() {
        console.log('🔧 Procesamiento manual iniciado...');
        await this.processMessages();
        return this.getProcessorStats();
    }

    /**
     * Verificar salud del procesador
     */
    healthCheck() {
        const now = new Date();
        const timeSinceLastProcess = this.lastProcessTime ? 
            (now - this.lastProcessTime) / 1000 : null;

        const isHealthy = {
            status: 'healthy',
            issues: []
        };

        // Verificar si el procesador no ha corrido en más de 5 minutos
        if (timeSinceLastProcess && timeSinceLastProcess > 300) {
            isHealthy.status = 'warning';
            isHealthy.issues.push('Procesador no ha ejecutado en más de 5 minutos');
        }

        // Verificar si hay muchos errores
        const errorRate = this.stats.totalProcessed > 0 ? 
            (this.stats.totalErrors / this.stats.totalProcessed) : 0;
        
        if (errorRate > 0.5) {
            isHealthy.status = 'unhealthy';
            isHealthy.issues.push(`Tasa de errores alta: ${(errorRate * 100).toFixed(1)}%`);
        }

        // Verificar cron jobs activos
        if (this.cronJobs.size === 0) {
            isHealthy.status = 'unhealthy';
            isHealthy.issues.push('No hay cron jobs activos');
        }

        return {
            ...isHealthy,
            lastProcessTime: this.lastProcessTime,
            timeSinceLastProcess,
            stats: this.stats,
            activeCronJobs: this.cronJobs.size
        };
    }
}

// Instancia singleton
const scheduledMessageProcessor = new ScheduledMessageProcessor();

module.exports = scheduledMessageProcessor;
