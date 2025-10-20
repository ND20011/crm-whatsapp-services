const cron = require('node-cron');
const TaskReminderService = require('./TaskReminderService');
const TaskService = require('./TaskService');

// ============================================================================
// TASK PROCESSOR - CRON JOBS PARA TAREAS Y RECORDATORIOS
// ============================================================================
function getBuenosAiresTime() {
    const currentTime = new Date().toLocaleString("en-US", {timeZone: "America/Argentina/Buenos_Aires"});
    return new Date(currentTime);
}


class TaskProcessor {
    constructor() {
        this.cronJobs = new Map();
        this.isProcessingReminders = false;
        this.isProcessingTasks = false;
        this.lastProcessTime = null;
        this.stats = {
            totalRemindersProcessed: 0,
            totalRemindersSuccess: 0,
            totalRemindersErrors: 0,
            totalTasksMarkedOverdue: 0,
            totalRecurringTasksGenerated: 0,
            lastReset: getBuenosAiresTime()
        };
    }

    /**
     * Inicializar procesador de tareas y recordatorios
     */
    init() {
        console.log('📋 Inicializando procesador de tareas y recordatorios...');

        // Procesar recordatorios cada minuto
        this.scheduleReminderProcessor();
        
        // Procesar tareas vencidas cada hora
        this.scheduleOverdueTasksProcessor();
        
        // Generar tareas recurrentes diariamente a las 6:00 AM
        this.scheduleRecurringTasksProcessor();
        
        // Limpieza semanal los domingos a las 2:00 AM
        this.scheduleWeeklyCleanup();
        
        // Procesar inmediatamente al iniciar (para testing)
        setTimeout(() => {
            this.processReminders();
        }, 10000); // 10 segundos después del inicio

        console.log('✅ Procesador de tareas y recordatorios iniciado');
    }

    /**
     * Programar procesador de recordatorios (cada minuto)
     */
    scheduleReminderProcessor() {
        // Ejecutar cada minuto
        const reminderJob = cron.schedule('* * * * *', async () => {
            await this.processReminders();
        }, {
            scheduled: true,
            timezone: 'America/Argentina/Buenos_Aires'
        });

        this.cronJobs.set('reminders', reminderJob);
        console.log('🔔 Procesador de recordatorios programado (cada minuto)');
    }

    /**
     * Programar procesador de tareas vencidas (cada hora)
     */
    scheduleOverdueTasksProcessor() {
        // Ejecutar cada hora en el minuto 5
        const overdueJob = cron.schedule('5 * * * *', async () => {
            await this.processOverdueTasks();
        }, {
            scheduled: true,
            timezone: 'America/Argentina/Buenos_Aires'
        });

        this.cronJobs.set('overdue', overdueJob);
        console.log('⏰ Procesador de tareas vencidas programado (cada hora)');
    }

    /**
     * Programar generador de tareas recurrentes (diario a las 6:00 AM)
     */
    scheduleRecurringTasksProcessor() {
        // Ejecutar todos los días a las 6:00 AM
        const recurringJob = cron.schedule('0 6 * * *', async () => {
            await this.processRecurringTasks();
        }, {
            scheduled: true,
            timezone: 'America/Argentina/Buenos_Aires'
        });

        this.cronJobs.set('recurring', recurringJob);
        console.log('🔄 Generador de tareas recurrentes programado (6:00 AM diario)');
    }

    /**
     * Programar limpieza semanal (domingos a las 2:00 AM)
     */
    scheduleWeeklyCleanup() {
        // Ejecutar domingos a las 2:00 AM
        const cleanupJob = cron.schedule('0 2 * * 0', async () => {
            await this.performWeeklyCleanup();
        }, {
            scheduled: true,
            timezone: 'America/Argentina/Buenos_Aires'
        });

        this.cronJobs.set('cleanup', cleanupJob);
        console.log('🧹 Limpieza semanal programada (domingos 2:00 AM)');
    }

    /**
     * Procesar recordatorios pendientes
     */
    async processReminders() {
        if (this.isProcessingReminders) {
            console.log('⚠️ Procesamiento de recordatorios ya en ejecución, saltando...');
            return;
        }

        this.isProcessingReminders = true;
        const startTime = Date.now();

        try {
            console.log('🔔 Iniciando procesamiento de recordatorios...');
            
            const result = await TaskReminderService.processTaskReminders();
            
            // Actualizar estadísticas
            this.stats.totalRemindersProcessed += result.processed;
            this.stats.totalRemindersSuccess += result.success;
            this.stats.totalRemindersErrors += result.errors;
            this.lastProcessTime = getBuenosAiresTime();

            const processingTime = Date.now() - startTime;
            
            if (result.processed > 0) {
                console.log(`✅ Recordatorios procesados: ${result.processed} total, ${result.success} exitosos, ${result.errors} errores (${processingTime}ms)`);
            } else {
                console.log(`ℹ️ Sin recordatorios para procesar (${processingTime}ms)`);
            }

        } catch (error) {
            console.error('❌ Error en procesamiento de recordatorios:', error.message);
            this.stats.totalRemindersErrors++;
        } finally {
            this.isProcessingReminders = false;
        }
    }

    /**
     * Procesar tareas vencidas
     */
    async processOverdueTasks() {
        if (this.isProcessingTasks) {
            console.log('⚠️ Procesamiento de tareas ya en ejecución, saltando...');
            return;
        }

        this.isProcessingTasks = true;
        const startTime = Date.now();

        try {
            console.log('⏰ Iniciando marcado de tareas vencidas...');
            
            const overdueCount = await TaskService.markOverdueTasks();
            
            // Actualizar estadísticas
            this.stats.totalTasksMarkedOverdue += overdueCount;

            const processingTime = Date.now() - startTime;
            
            if (overdueCount > 0) {
                console.log(`✅ Tareas marcadas como vencidas: ${overdueCount} (${processingTime}ms)`);
            } else {
                console.log(`ℹ️ Sin tareas vencidas para marcar (${processingTime}ms)`);
            }

        } catch (error) {
            console.error('❌ Error marcando tareas vencidas:', error.message);
        } finally {
            this.isProcessingTasks = false;
        }
    }

    /**
     * Procesar tareas recurrentes
     */
    async processRecurringTasks() {
        const startTime = Date.now();

        try {
            console.log('🔄 Iniciando generación de tareas recurrentes...');
            
            const generatedCount = await TaskService.generateRecurringTasks();
            
            // Actualizar estadísticas
            this.stats.totalRecurringTasksGenerated += generatedCount;

            const processingTime = Date.now() - startTime;
            
            if (generatedCount > 0) {
                console.log(`✅ Tareas recurrentes generadas: ${generatedCount} (${processingTime}ms)`);
            } else {
                console.log(`ℹ️ Sin tareas recurrentes para generar (${processingTime}ms)`);
            }

        } catch (error) {
            console.error('❌ Error generando tareas recurrentes:', error.message);
        }
    }

    /**
     * Realizar limpieza semanal
     */
    async performWeeklyCleanup() {
        const startTime = Date.now();

        try {
            console.log('🧹 Iniciando limpieza semanal...');
            
            // Limpiar recordatorios antiguos (30 días)
            const cleanedReminders = await TaskReminderService.cleanupOldReminders(30);
            
            // Resetear estadísticas
            const oldStats = { ...this.stats };
            this.stats = {
                totalRemindersProcessed: 0,
                totalRemindersSuccess: 0,
                totalRemindersErrors: 0,
                totalTasksMarkedOverdue: 0,
                totalRecurringTasksGenerated: 0,
                lastReset: getBuenosAiresTime()
            };

            const processingTime = Date.now() - startTime;
            
            console.log(`✅ Limpieza semanal completada:`);
            console.log(`   📧 Recordatorios eliminados: ${cleanedReminders}`);
            console.log(`   📊 Estadísticas de la semana:`);
            console.log(`      - Recordatorios procesados: ${oldStats.totalRemindersProcessed}`);
            console.log(`      - Recordatorios exitosos: ${oldStats.totalRemindersSuccess}`);
            console.log(`      - Tareas marcadas vencidas: ${oldStats.totalTasksMarkedOverdue}`);
            console.log(`      - Tareas recurrentes generadas: ${oldStats.totalRecurringTasksGenerated}`);
            console.log(`   ⏱️ Tiempo: ${processingTime}ms`);

        } catch (error) {
            console.error('❌ Error en limpieza semanal:', error.message);
        }
    }

    /**
     * Obtener estadísticas del procesador
     */
    getStats() {
        return {
            ...this.stats,
            isProcessingReminders: this.isProcessingReminders,
            isProcessingTasks: this.isProcessingTasks,
            lastProcessTime: this.lastProcessTime,
            uptime: Date.now() - this.stats.lastReset.getTime(),
            activeJobs: Array.from(this.cronJobs.keys())
        };
    }

    /**
     * Obtener estado de salud del procesador
     */
    getHealthStatus() {
        const now = Date.now();
        const timeSinceLastProcess = this.lastProcessTime ? now - this.lastProcessTime.getTime() : null;
        
        // Considerar no saludable si no ha procesado en más de 5 minutos
        const isHealthy = !timeSinceLastProcess || timeSinceLastProcess < 5 * 60 * 1000;
        
        return {
            healthy: isHealthy,
            lastProcessTime: this.lastProcessTime,
            timeSinceLastProcess: timeSinceLastProcess,
            isProcessingReminders: this.isProcessingReminders,
            isProcessingTasks: this.isProcessingTasks,
            activeJobs: this.cronJobs.size,
            stats: this.stats
        };
    }

    /**
     * Forzar procesamiento manual (para testing)
     */
    async forceProcess(type = 'all') {
        console.log(`🔧 Forzando procesamiento manual: ${type}`);
        
        const results = {};
        
        try {
            if (type === 'all' || type === 'reminders') {
                results.reminders = await this.processReminders();
            }
            
            if (type === 'all' || type === 'overdue') {
                results.overdue = await this.processOverdueTasks();
            }
            
            if (type === 'all' || type === 'recurring') {
                results.recurring = await this.processRecurringTasks();
            }
            
            if (type === 'cleanup') {
                results.cleanup = await this.performWeeklyCleanup();
            }
            
            console.log('✅ Procesamiento manual completado');
            return results;
            
        } catch (error) {
            console.error('❌ Error en procesamiento manual:', error.message);
            throw error;
        }
    }

    /**
     * Detener todos los cron jobs
     */
    stop() {
        console.log('🛑 Deteniendo procesador de tareas...');
        
        for (const [name, job] of this.cronJobs.entries()) {
            job.stop();
            console.log(`   ⏹️ Job '${name}' detenido`);
        }
        
        this.cronJobs.clear();
        console.log('✅ Procesador de tareas detenido');
    }

    /**
     * Reiniciar procesador
     */
    restart() {
        console.log('🔄 Reiniciando procesador de tareas...');
        this.stop();
        setTimeout(() => {
            this.init();
        }, 1000);
    }
}

// Instancia singleton
const taskProcessor = new TaskProcessor();

module.exports = taskProcessor;
