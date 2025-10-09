const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { logger, getMorganConfig } = require('./config/logger');
require('dotenv').config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:4200",
        methods: ["GET", "POST"]
    }
});

// ============================================================================
// MIDDLEWARES BÁSICOS
// ============================================================================

// Seguridad
app.use(helmet({
    contentSecurityPolicy: false, // Deshabilitado para permitir Socket.io
    crossOriginEmbedderPolicy: false
}));

// CORS
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:4200",
    credentials: true
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 500, // máximo 500 requests por ventana por IP
    message: {
        error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo en 15 minutos.'
    }
});
app.use('/api/', limiter);

// Logging centralizado
const morganConfig = getMorganConfig();
app.use(morgan(morganConfig.format, morganConfig.options));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================================
// STATIC FILE SERVING
// ============================================================================

// Servir archivos estáticos desde el directorio uploads
const path = require('path');
const uploadsPath = path.resolve(__dirname, '../uploads');

// CORS específico para archivos estáticos
app.use('/uploads', (req, res, next) => {
    // Headers CORS para archivos multimedia
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || "http://localhost:4200");
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Headers de seguridad para archivos
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN'); // Cambiar de DENY a SAMEORIGIN
    
    // Manejar preflight OPTIONS
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    next();
});

app.use('/uploads', express.static(uploadsPath, {
    maxAge: '1d', // Cache por 1 día
    etag: true,
    lastModified: true
}));

// Inicializar sistema de archivos
const fileStorageService = require('./services/FileStorageService');
logger.info('📁 Sistema de archivos inicializado');

// ============================================================================
// SOCKET.IO CONFIGURATION
// ============================================================================

// Hacer io accesible globalmente
app.set('socketio', io);

io.on('connection', (socket) => {
    logger.socket(`Cliente conectado: ${socket.id}`);
    
    socket.on('disconnect', () => {
        logger.socket(`Cliente desconectado: ${socket.id}`);
    });
    
    // Evento para unirse a room por clientCode
    socket.on('join_client_room', (clientCode) => {
        socket.join(`client_${clientCode}`);
        logger.socket(`${socket.id} → room: client_${clientCode}`);
    });
});

// ============================================================================
// ROUTES
// ============================================================================

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// API Routes (se configurarán en la siguiente tarea)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/scheduled-messages', require('./routes/scheduledMessages'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/files', require('./routes/files'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/backoffice', require('./routes/backoffice'));

// ============================================================================
// SCHEDULED MESSAGES PROCESSOR
// ============================================================================

// Inicializar procesador de mensajes programados
const scheduledMessageProcessor = require('./services/ScheduledMessageProcessor');
scheduledMessageProcessor.init();

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 Handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint no encontrado',
        path: req.originalUrl,
        method: req.method
    });
});

// Error Handler Global
app.use((err, req, res, next) => {
    console.error('❌ Error:', err);
    
    // Error de validación Joi
    if (err.isJoi) {
        return res.status(400).json({
            error: 'Datos de entrada inválidos',
            details: err.details.map(detail => detail.message)
        });
    }
    
    // Error de JWT
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'Token inválido'
        });
    }
    
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            error: 'Token expirado'
        });
    }
    
    // Error de base de datos
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
            error: 'Registro duplicado'
        });
    }
    
    // Error genérico
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' 
            ? 'Error interno del servidor' 
            : err.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    logger.startup('CRM CONDORITO BACKEND INICIADO');
    logger.info(`Servidor: http://localhost:${PORT}`);
    logger.info(`Socket.io: Habilitado`);
    logger.info(`Entorno: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Log Level: ${process.env.LOG_LEVEL || 'INFO'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.shutdown('SIGTERM recibido, cerrando servidor...');
    server.close(() => {
        logger.success('Servidor cerrado correctamente');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.shutdown('SIGINT recibido, cerrando servidor...');
    server.close(() => {
        logger.success('Servidor cerrado correctamente');
        process.exit(0);
    });
});

module.exports = { app, server, io };
