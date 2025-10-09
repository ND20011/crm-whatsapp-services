const whatsappService = require('../services/WhatsAppService');
const WhatsAppSession = require('../entities/WhatsAppSession');
const Client = require('../entities/Client');

/**
 * Controlador de WhatsApp - Maneja endpoints relacionados con WhatsApp
 */
class WhatsAppController {

    /**
     * Obtener QR code para conectar WhatsApp - GET /api/whatsapp/qr/:clientCode
     */
    static async getQRCode(req, res, next) {
        try {
            const { clientCode } = req.params;
            
            // Verificar que el clientCode coincida con el usuario autenticado
            if (req.user.clientCode !== clientCode) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para acceder a este cliente'
                });
            }

            console.log(`📱 QR request for client: ${clientCode}`);

            // Obtener QR code del servicio
            const qrData = whatsappService.getQRCode(clientCode);
            
            if (!qrData) {
                return res.status(404).json({
                    success: false,
                    message: 'QR code no disponible. Inicia la conexión primero.',
                    hasQR: false
                });
            }

            // Verificar que el QR no sea muy antiguo (5 minutos)
            const qrAge = Date.now() - qrData.timestamp.getTime();
            const maxAge = 5 * 60 * 1000; // 5 minutos

            if (qrAge > maxAge) {
                return res.status(410).json({
                    success: false,
                    message: 'QR code expirado. Solicita uno nuevo.',
                    hasQR: false,
                    expired: true
                });
            }

            // Extraer el base64 del data URL
            const base64Data = qrData.qrImage.replace(/^data:image\/png;base64,/, '');
            const imageBuffer = Buffer.from(base64Data, 'base64');
            
            // Devolver la imagen directamente
            res.set({
                'Content-Type': 'image/png',
                'Content-Length': imageBuffer.length,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            
            res.send(imageBuffer);

        } catch (error) {
            console.error('❌ Error in WhatsAppController.getQRCode:', error.message);
            next(error);
        }
    }

    /**
     * Obtener QR code como JSON - GET /api/whatsapp/qr-json/:clientCode
     */
    static async getQRCodeJSON(req, res, next) {
        try {
            const { clientCode } = req.params;
            
            // Verificar que el clientCode coincida con el usuario autenticado
            if (req.user.clientCode !== clientCode) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para acceder a este cliente'
                });
            }

            console.log(`📱 QR JSON request for client: ${clientCode}`);

            // Obtener QR code del servicio
            const qrData = whatsappService.getQRCode(clientCode);
            
            if (!qrData) {
                return res.status(404).json({
                    success: false,
                    message: 'QR code no disponible. Inicia la conexión primero.',
                    hasQR: false
                });
            }

            // Verificar que el QR no sea muy antiguo (5 minutos)
            const qrAge = Date.now() - qrData.timestamp.getTime();
            const maxAge = 5 * 60 * 1000; // 5 minutos

            if (qrAge > maxAge) {
                return res.status(410).json({
                    success: false,
                    message: 'QR code expirado. Solicita uno nuevo.',
                    hasQR: false,
                    expired: true
                });
            }

            res.status(200).json({
                success: true,
                qrCode: qrData.qrImage,
                timestamp: qrData.timestamp,
                expiresIn: Math.max(0, maxAge - qrAge)
            });

        } catch (error) {
            console.error('❌ Error in WhatsAppController.getQRCodeJSON:', error.message);
            next(error);
        }
    }

    /**
     * Conectar cliente de WhatsApp - POST /api/whatsapp/connect
     */
    static async connect(req, res, next) {
        const ENDPOINT_TIMEOUT = 65000; // 65 segundos (5 segundos más que el timeout interno)
        let timeoutId = null;
        
        try {
            const clientCode = req.user.clientCode;
            const clientId = req.user.id;

            console.log(`🔌 Connect request for client: ${clientCode}`);

            // Configurar timeout para el endpoint completo
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    reject(new Error('Timeout: El endpoint de conexión tardó demasiado en responder'));
                }, ENDPOINT_TIMEOUT);
            });

            // Verificar estado actual del cliente
            const currentStatus = whatsappService.getClientStatus(clientCode);
            
            if (currentStatus.connected) {
                clearTimeout(timeoutId);
                return res.status(200).json({
                    success: true,
                    message: 'Cliente ya está conectado',
                    status: 'connected',
                    phoneNumber: currentStatus.phoneNumber,
                    clientInfo: currentStatus.clientInfo
                });
            }

            // Obtener instancia de Socket.io desde app.js
            const socketIo = req.app.get('socketio');

            // Crear/inicializar cliente de WhatsApp con timeout
            const createClientPromise = whatsappService.createClient(clientCode, clientId, socketIo);
            
            // Esperar el resultado o timeout
            const result = await Promise.race([createClientPromise, timeoutPromise]);
            
            // Limpiar timeout si llegamos aquí
            clearTimeout(timeoutId);

            // Determinar si hay QR disponible
            const qrData = whatsappService.getQRCode(clientCode);
            const hasQR = !!qrData;

            res.status(200).json({
                success: true,
                message: result.message,
                status: result.status,
                phoneNumber: result.phone || null,
                hasQR: hasQR,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Error in WhatsAppController.connect:', error.message);
            
            // Limpiar timeout
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            
            // Determinar tipo de error y código de estado apropiado
            let statusCode = 500;
            let errorMessage = 'Error al conectar WhatsApp';
            
            if (error.message.includes('Timeout')) {
                statusCode = 408; // Request Timeout
                errorMessage = 'La conexión tardó demasiado tiempo. Inténtalo nuevamente.';
            } else if (error.message.includes('Authentication failed')) {
                statusCode = 401; // Unauthorized
                errorMessage = 'Error de autenticación de WhatsApp. Verifica tu sesión.';
            } else if (error.message.includes('already exists')) {
                statusCode = 409; // Conflict
                errorMessage = 'Ya existe una conexión activa para este cliente.';
            }
            
            // Actualizar estado de error en BD
            try {
                const session = await WhatsAppSession.findByClientId(req.user.id);
                if (session) {
                    await session.updateStatus('error', { 
                        error_message: error.message,
                        error_type: error.message.includes('Timeout') ? 'timeout' : 'connection_error',
                        timestamp: new Date()
                    });
                }
            } catch (dbError) {
                console.error('❌ Error updating session status:', dbError.message);
            }

            res.status(statusCode).json({
                success: false,
                message: errorMessage,
                error: error.message,
                errorType: error.message.includes('Timeout') ? 'timeout' : 'connection_error',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Forzar limpieza completa de sesión - POST /api/whatsapp/force-cleanup
     */
    static async forceCleanup(req, res, next) {
        try {
            const clientCode = req.user.clientCode;
            
            console.log(`🧹 Force cleanup request for client: ${clientCode}`);
            
            // Realizar limpieza completa con timeout de 15 segundos
            const cleanupPromise = whatsappService.forceCleanupSession(clientCode);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Force cleanup timeout after 15 seconds')), 15000)
            );
            
            await Promise.race([cleanupPromise, timeoutPromise]);
            
            console.log(`✅ Force cleanup completed successfully for: ${clientCode}`);
            
            res.status(200).json({
                success: true,
                message: 'Sesión limpiada completamente',
                clientCode: clientCode,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error(`❌ Error in force cleanup for ${req.user?.clientCode}:`, error.message);
            res.status(500).json({
                success: false,
                message: 'Error al limpiar la sesión',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Desconectar cliente de WhatsApp - POST /api/whatsapp/disconnect
     */
    static async disconnect(req, res, next) {
        try {
            const clientCode = req.user.clientCode;
            const clientId = req.user.id;

            console.log(`🔌 Disconnect request for client: ${clientCode}`);

            // Desconectar cliente
            const disconnected = await whatsappService.disconnectClient(clientCode);

            if (disconnected) {
                // Actualizar estado en BD
                const session = await WhatsAppSession.findByClientId(clientId);
                if (session) {
                    await session.updateStatus('disconnected');
                }

                // Emitir evento por Socket.io SOLO al cliente específico
                const socketIo = req.app.get('socketio');
                if (socketIo) {
                    const roomName = `client_${clientCode}`;
                    console.log(`📡 Emitting whatsapp:disconnected to room: ${roomName} (manual disconnect)`);
                    
                    socketIo.to(roomName).emit('whatsapp:disconnected', {
                        clientCode,
                        reason: 'manual_disconnect',
                        timestamp: new Date()
                    });
                }
            }

            res.status(200).json({
                success: true,
                message: 'Cliente desconectado correctamente',
                status: 'disconnected'
            });

        } catch (error) {
            console.error('❌ Error in WhatsAppController.disconnect:', error.message);
            next(error);
        }
    }

    /**
     * Obtener estado del cliente de WhatsApp - GET /api/whatsapp/status
     */
    static async getStatus(req, res, next) {
        try {
            const clientCode = req.user.clientCode;
            const clientId = req.user.id;

            console.log(`📊 Status request for client: ${clientCode}`);

            // Obtener estado del servicio
            const serviceStatus = whatsappService.getClientStatus(clientCode);

            // Obtener información de la BD
            const session = await WhatsAppSession.findByClientId(clientId);
            const sessionStats = session ? await session.getStats() : null;

            res.status(200).json({
                success: true,
                status: serviceStatus.status,
                connected: serviceStatus.connected,
                hasQR: serviceStatus.hasQR,
                phoneNumber: serviceStatus.phoneNumber,
                clientInfo: serviceStatus.clientInfo,
                session: session ? session.toPublicJSON() : null,
                stats: sessionStats
            });

        } catch (error) {
            console.error('❌ Error in WhatsAppController.getStatus:', error.message);
            next(error);
        }
    }

    /**
     * Enviar mensaje de texto - POST /api/whatsapp/send-message
     */
    static async sendMessage(req, res, next) {
        try {
            const clientCode = req.user.clientCode;
            const { to, message, isBot = false } = req.body;

            // Validar datos requeridos
            if (!to || !message) {
                return res.status(400).json({
                    success: false,
                    message: 'Número de destino y mensaje son requeridos'
                });
            }

            console.log(`📤 Send message request from ${clientCode} to ${to}`);

            // Verificar que el cliente esté conectado
            if (!whatsappService.isClientConnected(clientCode)) {
                return res.status(400).json({
                    success: false,
                    message: 'Cliente de WhatsApp no está conectado'
                });
            }

            // Formatear número si es necesario
            let formattedTo = to;
            if (!to.includes('@')) {
                // Asegurar formato correcto: número@c.us
                formattedTo = to.replace(/\D/g, '') + '@c.us';
            }

            // Obtener instancia de Socket.io
            const socketIo = req.app.get('socketio');

            // Enviar mensaje usando MessageService
            const MessageService = require('../services/MessageService');
            let savedMessage;

            if (isBot) {
                // Mensaje automático del bot (no debería llamarse desde aquí normalmente)
                const result = await whatsappService.sendMessage(clientCode, formattedTo, message, true);
                // El MessageService manejará esto automáticamente en el evento 'message'
                savedMessage = { message_id: result.messageId };
            } else {
                // Mensaje manual desde el CRM
                savedMessage = await MessageService.sendManualMessage(
                    clientCode, 
                    req.user.id, 
                    formattedTo, 
                    message, 
                    socketIo
                );
            }

            res.status(200).json({
                success: true,
                message: 'Mensaje enviado correctamente',
                messageId: savedMessage.message_id,
                to: formattedTo,
                isBot: isBot
            });

        } catch (error) {
            console.error('❌ Error in WhatsAppController.sendMessage:', error.message);
            
            res.status(500).json({
                success: false,
                message: 'Error al enviar mensaje',
                error: error.message
            });
        }
    }

    /**
     * Enviar imagen - POST /api/whatsapp/send-image
     */
    static async sendImage(req, res, next) {
        try {
            const clientCode = req.user.clientCode;
            const { to, caption = '' } = req.body;

            // Validar que se subió un archivo
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Imagen es requerida'
                });
            }

            // Validar número de destino
            if (!to) {
                return res.status(400).json({
                    success: false,
                    message: 'Número de destino es requerido'
                });
            }

            console.log(`📷 Send image request from ${clientCode} to ${to}`);

            // Verificar que el cliente esté conectado
            if (!whatsappService.isClientConnected(clientCode)) {
                return res.status(400).json({
                    success: false,
                    message: 'Cliente de WhatsApp no está conectado'
                });
            }

            // Formatear número
            let formattedTo = to;
            if (!to.includes('@')) {
                formattedTo = to.replace(/\D/g, '') + '@c.us';
            }

            // Enviar imagen
            const result = await whatsappService.sendImage(clientCode, formattedTo, req.file.path, caption);

            res.status(200).json({
                success: true,
                message: 'Imagen enviada correctamente',
                messageId: result.messageId,
                timestamp: result.timestamp,
                to: formattedTo,
                type: 'image'
            });

        } catch (error) {
            console.error('❌ Error in WhatsAppController.sendImage:', error.message);
            
            res.status(500).json({
                success: false,
                message: 'Error al enviar imagen',
                error: error.message
            });
        }
    }

    /**
     * Enviar documento - POST /api/whatsapp/send-document
     */
    static async sendDocument(req, res, next) {
        try {
            const clientCode = req.user.clientCode;
            const { to, caption = '' } = req.body;

            // Validar que se haya subido un archivo
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Archivo de documento es requerido'
                });
            }

            // Validar número de destino
            if (!to) {
                return res.status(400).json({
                    success: false,
                    message: 'Número de destino es requerido'
                });
            }

            console.log(`📄 Send document request from ${clientCode} to ${to}`);

            // Verificar que el cliente esté conectado
            if (!whatsappService.isClientConnected(clientCode)) {
                return res.status(400).json({
                    success: false,
                    message: 'Cliente de WhatsApp no está conectado'
                });
            }

            // Validar tipo de archivo
            const allowedTypes = [
                'application/pdf',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
                'application/msword', // .doc
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
                'application/vnd.ms-excel', // .xls
                'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
                'application/vnd.ms-powerpoint', // .ppt
                'text/plain', // .txt
                'text/csv', // .csv
                'application/zip',
                'application/x-rar-compressed'
            ];

            if (!allowedTypes.includes(req.file.mimetype)) {
                return res.status(400).json({
                    success: false,
                    message: 'Tipo de archivo no permitido. Formatos permitidos: PDF, Word, Excel, PowerPoint, TXT, CSV, ZIP, RAR'
                });
            }

            // Validar tamaño (máximo 16MB para WhatsApp)
            const maxSize = 16 * 1024 * 1024; // 16MB
            if (req.file.size > maxSize) {
                return res.status(400).json({
                    success: false,
                    message: 'El archivo es demasiado grande. Tamaño máximo: 16MB'
                });
            }

            // Formatear número
            let formattedTo = to;
            if (!to.includes('@')) {
                formattedTo = to.replace(/\D/g, '') + '@c.us';
            }

            // Enviar documento
            const result = await whatsappService.sendDocument(clientCode, formattedTo, req.file.path, caption, req.file.originalname);

            res.status(200).json({
                success: true,
                message: 'Documento enviado correctamente',
                messageId: result.messageId,
                timestamp: result.timestamp,
                to: formattedTo,
                type: 'document',
                filename: req.file.originalname,
                size: req.file.size
            });

        } catch (error) {
            console.error('❌ Error in WhatsAppController.sendDocument:', error.message);
            
            res.status(500).json({
                success: false,
                message: 'Error al enviar documento',
                error: error.message
            });
        }
    }

    /**
     * Obtener estadísticas generales de WhatsApp - GET /api/whatsapp/stats
     */
    static async getStats(req, res, next) {
        try {
            const stats = whatsappService.getStats();
            
            res.status(200).json({
                success: true,
                stats
            });

        } catch (error) {
            console.error('❌ Error in WhatsAppController.getStats:', error.message);
            next(error);
        }
    }

    /**
     * Health check específico de WhatsApp - GET /api/whatsapp/health
     */
    static async health(req, res, next) {
        try {
            const stats = whatsappService.getStats();
            
            res.status(200).json({
                success: true,
                message: 'WhatsApp service is running',
                stats,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Error in WhatsApp health check:', error.message);
            res.status(500).json({
                success: false,
                message: 'WhatsApp service error',
                error: error.message
            });
        }
    }

    /**
     * Endpoint de desarrollo para reiniciar servicio - POST /api/whatsapp/dev/restart
     * Solo disponible en desarrollo
     */
    static async devRestart(req, res, next) {
        try {
            if (process.env.NODE_ENV === 'production') {
                return res.status(403).json({
                    success: false,
                    message: 'Endpoint no disponible en producción'
                });
            }

            console.log('🔄 Restarting WhatsApp service (DEV)...');
            
            // Limpiar todos los clientes
            await whatsappService.cleanup();
            
            res.status(200).json({
                success: true,
                message: 'WhatsApp service restarted successfully'
            });

        } catch (error) {
            console.error('❌ Error restarting WhatsApp service:', error.message);
            next(error);
        }
    }
}

module.exports = WhatsAppController;
