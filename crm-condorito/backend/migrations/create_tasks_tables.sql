-- ============================================================================
-- MIGRACIÓN: MÓDULO DE TAREAS Y RECORDATORIOS - CRM CONDORITO
-- ============================================================================
-- Fecha: ${new Date().toLocaleDateString('es-AR')}
-- Versión: 1.0
-- Descripción: Crear tablas para sistema de tareas, recordatorios y exportación Google Calendar
-- ============================================================================

-- ============================================================================
-- TABLA 1: tasks (Principal)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    
    -- INFORMACIÓN BÁSICA
    title VARCHAR(255) NOT NULL COMMENT 'Título de la tarea',
    description TEXT DEFAULT NULL COMMENT 'Descripción detallada',
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium' COMMENT 'Prioridad de la tarea',
    
    -- CATEGORIZACIÓN
    category ENUM('meeting', 'call', 'follow_up', 'reminder', 'task', 'other') DEFAULT 'task' COMMENT 'Categoría de la tarea',
    tags JSON DEFAULT NULL COMMENT 'Etiquetas personalizadas',
    
    -- FECHAS Y TIEMPO
    due_date DATETIME NOT NULL COMMENT 'Fecha y hora de vencimiento',
    reminder_datetime DATETIME DEFAULT NULL COMMENT 'Fecha y hora del recordatorio',
    estimated_duration INT DEFAULT NULL COMMENT 'Duración estimada en minutos',
    
    -- CONTACTO RELACIONADO
    related_contact_id INT DEFAULT NULL COMMENT 'ID del contacto relacionado',
    related_phone VARCHAR(50) DEFAULT NULL COMMENT 'Teléfono del contacto (backup)',
    
    -- ESTADO Y PROGRESO
    status ENUM('pending', 'in_progress', 'completed', 'cancelled', 'overdue') DEFAULT 'pending' COMMENT 'Estado actual',
    completion_percentage INT DEFAULT 0 COMMENT 'Porcentaje de completitud (0-100)',
    completed_at DATETIME DEFAULT NULL COMMENT 'Fecha y hora de completitud',
    
    -- RECURRENCIA SIMPLE
    is_recurring BOOLEAN DEFAULT FALSE COMMENT 'Si la tarea es recurrente',
    recurrence_pattern JSON DEFAULT NULL COMMENT 'Patrón de recurrencia (tipo, intervalo, fin)',
    parent_task_id INT DEFAULT NULL COMMENT 'ID de tarea padre si es recurrente',
    
    -- EXPORTACIÓN GOOGLE (SIMPLIFICADO)
    last_exported_to_google DATETIME DEFAULT NULL COMMENT 'Última vez exportada a Google',
    google_export_count INT DEFAULT 0 COMMENT 'Número de veces exportada',
    
    -- METADATOS
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de actualización',
    
    -- RELACIONES FORÁNEAS
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (related_contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    
    -- ÍNDICES OPTIMIZADOS
    INDEX idx_client_id (client_id),
    INDEX idx_due_date (due_date),
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_category (category),
    INDEX idx_reminder_datetime (reminder_datetime),
    INDEX idx_recurring (is_recurring),
    INDEX idx_parent_task (parent_task_id),
    INDEX idx_created_at (created_at),
    INDEX idx_completion (status, due_date),
    INDEX idx_client_status (client_id, status),
    INDEX idx_client_due (client_id, due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tabla principal de tareas y recordatorios';

-- ============================================================================
-- TABLA 2: task_reminders (Recordatorios)
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_reminders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    
    -- CONFIGURACIÓN DEL RECORDATORIO
    reminder_type ENUM('notification', 'whatsapp', 'email') NOT NULL COMMENT 'Tipo de recordatorio',
    reminder_phone VARCHAR(20) NULL COMMENT 'Teléfono específico para enviar el recordatorio (opcional)',
    reminder_datetime DATETIME NOT NULL COMMENT 'Fecha y hora del recordatorio',
    message_content TEXT DEFAULT NULL COMMENT 'Contenido personalizado del mensaje',
    
    -- ESTADO DEL RECORDATORIO
    status ENUM('pending', 'sent', 'failed') DEFAULT 'pending' COMMENT 'Estado del recordatorio',
    sent_at DATETIME DEFAULT NULL COMMENT 'Fecha y hora de envío',
    error_message TEXT DEFAULT NULL COMMENT 'Mensaje de error si falló',
    
    -- METADATOS
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación',
    
    -- RELACIONES FORÁNEAS
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    
    -- ÍNDICES OPTIMIZADOS
    INDEX idx_task_id (task_id),
    INDEX idx_reminder_datetime (reminder_datetime),
    INDEX idx_status (status),
    INDEX idx_type (reminder_type),
    INDEX idx_pending_reminders (status, reminder_datetime),
    INDEX idx_task_status (task_id, status),
    INDEX idx_task_reminders_phone (reminder_phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Recordatorios asociados a tareas';

-- ============================================================================
-- TABLA 3: google_calendar_tokens (Tokens OAuth - Simplificado)
-- ============================================================================
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    
    -- TOKENS DE GOOGLE OAUTH
    access_token TEXT DEFAULT NULL COMMENT 'Token de acceso de Google',
    refresh_token TEXT DEFAULT NULL COMMENT 'Token de refresh de Google',
    token_expires_at DATETIME DEFAULT NULL COMMENT 'Fecha de expiración del access token',
    
    -- ESTADO DE CONEXIÓN SIMPLE
    is_connected BOOLEAN DEFAULT FALSE COMMENT 'Si está conectado a Google Calendar',
    last_export_at DATETIME DEFAULT NULL COMMENT 'Última exportación realizada',
    total_exports INT DEFAULT 0 COMMENT 'Total de exportaciones realizadas',
    
    -- CONFIGURACIÓN
    calendar_id VARCHAR(255) DEFAULT 'primary' COMMENT 'ID del calendario de Google a usar',
    
    -- METADATOS
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de actualización',
    
    -- RELACIONES FORÁNEAS
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    
    -- ÍNDICES Y RESTRICCIONES
    UNIQUE KEY unique_client_google (client_id),
    INDEX idx_connected (is_connected),
    INDEX idx_expires (token_expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tokens OAuth para integración con Google Calendar';

-- ============================================================================
-- VERIFICACIÓN DE MIGRACIÓN
-- ============================================================================

-- Verificar que las tablas se crearon correctamente
SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    TABLE_COMMENT
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME IN ('tasks', 'task_reminders', 'google_calendar_tokens');

-- Verificar índices creados
SELECT 
    TABLE_NAME,
    INDEX_NAME,
    COLUMN_NAME,
    SEQ_IN_INDEX
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME IN ('tasks', 'task_reminders', 'google_calendar_tokens')
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- ============================================================================
-- SCRIPT DE ROLLBACK (PARA REVERSAR MIGRACIÓN)
-- ============================================================================

-- ROLLBACK: Ejecutar solo si necesitas reversar la migración
-- CUIDADO: Esto eliminará todas las tablas y datos
-- DROP TABLE IF EXISTS task_reminders;
-- DROP TABLE IF EXISTS google_calendar_tokens;  
-- DROP TABLE IF EXISTS tasks;

-- ============================================================================
-- FIN DE MIGRACIÓN
-- ============================================================================
