const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs').promises;
const WhatsAppSession = require('../entities/WhatsAppSession');

/**
 * Servicio de WhatsApp - Maneja múltiples clientes de WhatsApp
 */
class WhatsAppService {
    constructor() {
        // Map para almacenar las instancias de Client por clientCode
        this.clients = new Map();
        
        // Map para almacenar los últimos QR codes generados
        this.qrCodes = new Map();
        
        // Map para rastrear mensajes enviados por bot (para clasificación)
        this.botSentMessages = new Map();
        
        // Map para rastrear último mensaje recibido por conversación
        this.lastReceivedMessage = new Map();
        
        // Directorio base para sesiones
        this.sessionsPath = path.resolve(__dirname, '../../sessions');
        
        // Asegurar que el directorio de sesiones existe
        this.ensureSessionsDirectory();
        
        console.log('🔧 WhatsAppService initialized');
    }

    /**
     * Asegurar que el directorio de sesiones existe
     */
    async ensureSessionsDirectory() {
        try {
            await fs.access(this.sessionsPath);
        } catch (error) {
            await fs.mkdir(this.sessionsPath, { recursive: true });
            console.log(`📁 Created sessions directory: ${this.sessionsPath}`);
        }
    }

    /**
     * Limpiar completamente una sesión de cliente (procesos, archivos, memoria)
     * @param {string} clientCode - Código del cliente a limpiar
     * @returns {Promise<void>}
     */
    async forceCleanupSession(clientCode) {
        console.log(`🧹 Force cleaning session for client: ${clientCode}`);
        
        try {
            // 1. Limpiar cliente en memoria si existe
            if (this.clients.has(clientCode)) {
                const client = this.clients.get(clientCode);
                try {
                    await client.destroy();
                    console.log(`✅ Client instance destroyed for: ${clientCode}`);
                } catch (error) {
                    console.warn(`⚠️ Error destroying client instance: ${error.message}`);
                }
                this.clients.delete(clientCode);
            }
            
            // 2. Limpiar QR codes en memoria
            if (this.qrCodes.has(clientCode)) {
                this.qrCodes.delete(clientCode);
                console.log(`✅ QR code cleared for: ${clientCode}`);
            }
            
            // 3. Limpiar otros datos en memoria
            if (this.botSentMessages.has(clientCode)) {
                this.botSentMessages.delete(clientCode);
            }
            if (this.lastReceivedMessage.has(clientCode)) {
                this.lastReceivedMessage.delete(clientCode);
            }
            
            // 4. Terminar procesos de Chrome/Puppeteer relacionados
            try {
                const { exec } = require('child_process');
                const util = require('util');
                const execAsync = util.promisify(exec);
                
                // Buscar y terminar procesos específicos de esta sesión con timeout
                const killCommand = `pkill -f "sessions/${clientCode}"`;
                console.log(`🔍 Searching for processes to kill: ${killCommand}`);
                
                // Agregar timeout de 5 segundos para evitar que se cuelgue
                const killPromise = execAsync(killCommand);
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Process kill timeout')), 5000)
                );
                
                await Promise.race([killPromise, timeoutPromise]);
                console.log(`✅ Chrome processes killed for: ${clientCode}`);
            } catch (processError) {
                // No es crítico si no hay procesos que matar o si hay timeout
                console.log(`ℹ️ Process cleanup completed (${processError.message}) for: ${clientCode}`);
            }
            
            // 5. Limpiar archivos de sesión
            try {
                const fs = require('fs').promises;
                const sessionPath = path.join(this.sessionsPath, clientCode);
                console.log(`🗂️ Checking session files at: ${sessionPath}`);
                
                // Verificar si el directorio existe antes de intentar eliminarlo
                try {
                    await fs.access(sessionPath);
                    await fs.rm(sessionPath, { recursive: true, force: true });
                    console.log(`✅ Session files cleaned for: ${clientCode}`);
                } catch (accessError) {
                    console.log(`ℹ️ No session files found for: ${clientCode}`);
                }
            } catch (fileError) {
                console.warn(`⚠️ Error cleaning session files: ${fileError.message}`);
            }
            
            // 6. Esperar un momento breve para que todo se limpie
            console.log(`⏳ Waiting for cleanup to complete...`);
            await new Promise(resolve => setTimeout(resolve, 500));
            
            console.log(`🎉 Complete cleanup finished for: ${clientCode}`);
            
        } catch (error) {
            console.error(`❌ Error during force cleanup for ${clientCode}:`, error.message);
            throw error;
        }
    }

    /**
     * Verificar si existe una sesión válida para el cliente
     * @param {string} clientCode - Código único del cliente
     * @param {number} clientId - ID del cliente en la BD
     * @returns {Promise<Object>} Estado de la sesión existente
     */
    async checkExistingSession(clientCode, clientId) {
        try {
            console.log(`🔍 Checking existing session for client: ${clientCode}`);
            
            // 1. Verificar si ya hay un cliente activo en memoria
            const existingClient = this.getClient(clientCode);
            if (existingClient) {
                try {
                    // Verificar si el cliente está realmente conectado
                    if (this.isClientConnected(clientCode)) {
                        console.log(`✅ Found active connected client in memory: ${clientCode}`);
                        return {
                            hasValidSession: true,
                            status: 'connected',
                            needsCleanup: false,
                            client: existingClient
                        };
                    } else {
                        console.log(`⚠️ Client in memory but not connected: ${clientCode}`);
                        return {
                            hasValidSession: false,
                            status: 'disconnected',
                            needsCleanup: true,
                            reason: 'Client in memory but not connected'
                        };
                    }
                } catch (error) {
                    console.log(`⚠️ Error checking client connection: ${error.message}`);
                    return {
                        hasValidSession: false,
                        status: 'error',
                        needsCleanup: true,
                        reason: `Client check error: ${error.message}`
                    };
                }
            }
            
            // 2. Verificar estado en base de datos
            const session = await WhatsAppSession.findByClientId(clientId);
            if (session && session.status === 'connected') {
                // Verificar si la sesión no es muy antigua (más de 1 hora)
                const lastActivity = new Date(session.last_activity || session.updated_at);
                const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
                
                if (lastActivity > hourAgo) {
                    console.log(`📱 Found recent connected session in DB: ${clientCode}`);
                    
                    // 3. Verificar si existen archivos de sesión
                    const sessionPath = path.join(this.sessionsPath, clientCode);
                    try {
                        await fs.access(sessionPath);
                        console.log(`📁 Session files exist for: ${clientCode}`);
                        return {
                            hasValidSession: true,
                            status: 'connected',
                            needsCleanup: false,
                            sessionPath: sessionPath,
                            lastActivity: lastActivity
                        };
                    } catch (fileError) {
                        console.log(`📁 No session files found for: ${clientCode}`);
                        return {
                            hasValidSession: false,
                            status: 'no_files',
                            needsCleanup: true,
                            reason: 'DB shows connected but no session files'
                        };
                    }
                } else {
                    console.log(`⏰ Session too old for: ${clientCode}`);
                    return {
                        hasValidSession: false,
                        status: 'expired',
                        needsCleanup: true,
                        reason: 'Session expired (more than 1 hour old)'
                    };
                }
            }
            
            console.log(`❌ No valid session found for: ${clientCode}`);
            return {
                hasValidSession: false,
                status: 'not_found',
                needsCleanup: true,
                reason: 'No session in DB or not connected'
            };
            
        } catch (error) {
            console.error(`❌ Error checking existing session for ${clientCode}:`, error.message);
            return {
                hasValidSession: false,
                status: 'error',
                needsCleanup: true,
                reason: `Check error: ${error.message}`
            };
        }
    }

    /**
     * Crear un nuevo cliente de WhatsApp para un clientCode
     * @param {string} clientCode - Código único del cliente
     * @param {number} clientId - ID del cliente en la BD
     * @param {Object} socketIo - Instancia de Socket.io para eventos en tiempo real
     * @returns {Promise<Object>} Información del cliente creado
     */
    async createClient(clientCode, clientId, socketIo = null) {
        const INITIALIZATION_TIMEOUT = 60000; // 60 segundos timeout
        let initializationTimer = null;
        
        try {
            console.log(`🔄 Starting connection process for client: ${clientCode}`);
            
            // 1. Verificar si existe una sesión válida
            const sessionCheck = await this.checkExistingSession(clientCode, clientId);
            
            if (sessionCheck.hasValidSession) {
                console.log(`♻️ Reusing existing valid session for: ${clientCode}`);
                
                // Si ya hay un cliente conectado, devolverlo
                if (sessionCheck.client) {
                    return {
                        success: true,
                        message: 'Cliente ya conectado',
                        status: 'connected',
                        reused: true
                    };
                }
                
                // Si hay sesión válida pero no cliente en memoria, intentar restaurar
                console.log(`🔄 Attempting to restore session for: ${clientCode}`);
            } else {
                // Solo hacer limpieza si es necesario
                if (sessionCheck.needsCleanup) {
                    console.log(`🧹 Cleanup needed for ${clientCode}: ${sessionCheck.reason}`);
                    await this.forceCleanupSession(clientCode);
                } else {
                    console.log(`✅ No cleanup needed for: ${clientCode}`);
                }
            }

            console.log(`🔄 Creating WhatsApp client for: ${clientCode}`);

            // Configurar LocalAuth con directorio específico para el cliente
            const sessionPath = path.join(this.sessionsPath, clientCode);
            
            const client = new Client({
                authStrategy: new LocalAuth({
                    clientId: clientCode,
                    dataPath: sessionPath
                }),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--single-process',
                        '--disable-gpu'
                    ]
                }
            });

            // Configurar eventos del cliente
            await this.setupClientEvents(client, clientCode, clientId, socketIo);

            // Almacenar el cliente
            this.clients.set(clientCode, client);

            // Crear promise con timeout para la inicialización
            const initializationPromise = new Promise((resolve, reject) => {
                // Timer de timeout
                initializationTimer = setTimeout(() => {
                    reject(new Error(`Timeout: La inicialización del cliente ${clientCode} tomó más de ${INITIALIZATION_TIMEOUT/1000} segundos`));
                }, INITIALIZATION_TIMEOUT);

                // Escuchar eventos de éxito
                const onReady = () => {
                    clearTimeout(initializationTimer);
                    client.removeListener('ready', onReady);
                    client.removeListener('qr', onQR);
                    client.removeListener('auth_failure', onAuthFailure);
                    resolve({ status: 'connected' });
                };

                const onQR = () => {
                    clearTimeout(initializationTimer);
                    client.removeListener('ready', onReady);
                    client.removeListener('qr', onQR);
                    client.removeListener('auth_failure', onAuthFailure);
                    resolve({ status: 'qr_generated' });
                };

                const onAuthFailure = (msg) => {
                    clearTimeout(initializationTimer);
                    client.removeListener('ready', onReady);
                    client.removeListener('qr', onQR);
                    client.removeListener('auth_failure', onAuthFailure);
                    reject(new Error(`Authentication failed: ${msg}`));
                };

                client.once('ready', onReady);
                client.once('qr', onQR);
                client.once('auth_failure', onAuthFailure);

                // Inicializar el cliente
                client.initialize().catch(reject);
            });

            // Esperar inicialización con timeout
            const result = await initializationPromise;

            console.log(`✅ WhatsApp client initialized for: ${clientCode} - Status: ${result.status}`);

            return {
                success: true,
                message: result.status === 'connected' ? 'Cliente conectado correctamente' : 'Cliente inicializado, esperando QR',
                status: result.status === 'connected' ? 'connected' : 'initializing'
            };

        } catch (error) {
            console.error(`❌ Error creating WhatsApp client for ${clientCode}:`, error.message);
            
            // Limpiar timer si existe
            if (initializationTimer) {
                clearTimeout(initializationTimer);
            }
            
            // Limpiar cliente en caso de error
            if (this.clients.has(clientCode)) {
                try {
                    const client = this.clients.get(clientCode);
                    await client.destroy();
                } catch (destroyError) {
                    console.warn(`⚠️ Error destroying client after failure: ${destroyError.message}`);
                }
                this.clients.delete(clientCode);
            }
            
            // Actualizar estado en BD
            try {
                const session = await WhatsAppSession.findByClientId(clientId);
                if (session) {
                    await session.updateStatus('error', { error_message: error.message });
                }
            } catch (dbError) {
                console.error(`❌ Error updating session status: ${dbError.message}`);
            }

            throw error;
        }
    }

    /**
     * Configurar eventos del cliente de WhatsApp
     * @param {Client} client - Cliente de WhatsApp
     * @param {string} clientCode - Código del cliente
     * @param {number} clientId - ID del cliente en BD
     * @param {Object} socketIo - Instancia de Socket.io
     */
    async setupClientEvents(client, clientCode, clientId, socketIo) {
        // Evento: QR Code generado
        client.on('qr', async (qr) => {
            try {
                console.log(`📱 QR Code generated for client: ${clientCode}`);
                
                // Generar QR code como imagen base64
                const qrImage = await qrcode.toDataURL(qr);
                
                // Almacenar QR code
                this.qrCodes.set(clientCode, {
                    qr: qr,
                    qrImage: qrImage,
                    timestamp: new Date()
                });

                // Actualizar estado en BD
                let session = await WhatsAppSession.findByClientId(clientId);
                if (!session) {
                    session = await WhatsAppSession.create({
                        client_id: clientId,
                        session_id: clientCode,
                        status: 'connecting',
                        qr_code: qrImage
                    });
                } else {
                    await session.updateStatus('connecting', { qr_code: qrImage });
                }

                // Emitir evento por Socket.io SOLO al cliente específico
                if (socketIo) {
                    const roomName = `client_${clientCode}`;
                    console.log(`📡 Emitting whatsapp:qr to room: ${roomName}`);
                    
                    socketIo.to(roomName).emit('whatsapp:qr', {
                        clientCode,
                        qr: qrImage,
                        timestamp: new Date()
                    });
                }

                console.log(`✅ QR Code stored for client: ${clientCode}`);
            } catch (error) {
                console.error(`❌ Error handling QR for ${clientCode}:`, error.message);
            }
        });

        // Evento: Cliente autenticado
        client.on('authenticated', async () => {
            try {
                console.log(`🔐 Client authenticated: ${clientCode}`);
                
                // Limpiar QR code
                this.qrCodes.delete(clientCode);

                // Actualizar estado en BD
                const session = await WhatsAppSession.findByClientId(clientId);
                if (session) {
                    await session.updateStatus('connecting', { qr_code: null });
                }

                // Emitir evento por Socket.io SOLO al cliente específico
                if (socketIo) {
                    const roomName = `client_${clientCode}`;
                    console.log(`📡 Emitting whatsapp:authenticated to room: ${roomName}`);
                    
                    socketIo.to(roomName).emit('whatsapp:authenticated', {
                        clientCode,
                        timestamp: new Date()
                    });
                }
            } catch (error) {
                console.error(`❌ Error handling authentication for ${clientCode}:`, error.message);
            }
        });

        // Evento: Cliente listo
        client.on('ready', async () => {
            try {
                console.log(`🚀 Client ready: ${clientCode}`);
                
                // Obtener información del cliente
                const clientInfo = client.info;
                const phoneNumber = clientInfo.wid.user;

                // Actualizar estado en BD
                const session = await WhatsAppSession.findByClientId(clientId);
                if (session) {
                    await session.updateStatus('connected', {
                        phone_number: phoneNumber,
                        qr_code: null,
                        error_message: null
                    });
                }

                // Emitir evento por Socket.io con información completa SOLO al cliente específico
                if (socketIo) {
                    const roomName = `client_${clientCode}`;
                    console.log(`📡 Emitting whatsapp events to room: ${roomName}`);
                    
                    // Emitir evento específico de conexión exitosa
                    socketIo.to(roomName).emit('whatsapp:ready', {
                        clientCode,
                        phoneNumber,
                        clientInfo: {
                            pushname: clientInfo.pushname,
                            platform: clientInfo.platform
                        },
                        timestamp: new Date()
                    });

                    // Emitir evento de estado actualizado para el dashboard
                    socketIo.to(roomName).emit('whatsapp:status_updated', {
                        clientCode,
                        status: 'connected',
                        phoneNumber,
                        connected: true,
                        timestamp: new Date()
                    });

                    // Emitir evento específico para cerrar modal
                    socketIo.to(roomName).emit('whatsapp:connection_completed', {
                        clientCode,
                        success: true,
                        phoneNumber,
                        timestamp: new Date()
                    });
                }

                console.log(`✅ Client ${clientCode} ready with phone: ${phoneNumber}`);
            } catch (error) {
                console.error(`❌ Error handling ready event for ${clientCode}:`, error.message);
            }
        });

        // Evento: Error de autenticación
        client.on('auth_failure', async (message) => {
            try {
                console.error(`🔒 Authentication failed for ${clientCode}:`, message);
                
                // Limpiar QR code
                this.qrCodes.delete(clientCode);

                // Actualizar estado en BD
                const session = await WhatsAppSession.findByClientId(clientId);
                if (session) {
                    await session.updateStatus('error', {
                        error_message: `Authentication failed: ${message}`,
                        qr_code: null
                    });
                }

                // Emitir evento por Socket.io SOLO al cliente específico
                if (socketIo) {
                    const roomName = `client_${clientCode}`;
                    console.log(`📡 Emitting whatsapp:auth_failure to room: ${roomName}`);
                    
                    socketIo.to(roomName).emit('whatsapp:auth_failure', {
                        clientCode,
                        message,
                        timestamp: new Date()
                    });
                }
            } catch (error) {
                console.error(`❌ Error handling auth failure for ${clientCode}:`, error.message);
            }
        });

        // Evento: Cliente desconectado
        client.on('disconnected', async (reason) => {
            try {
                console.log(`📴 Client disconnected: ${clientCode}, reason: ${reason}`);
                
                // Limpiar datos del cliente
                this.qrCodes.delete(clientCode);
                this.clients.delete(clientCode);

                // Actualizar estado en BD
                const session = await WhatsAppSession.findByClientId(clientId);
                if (session) {
                    await session.updateStatus('disconnected', {
                        error_message: reason === 'NAVIGATION' ? null : `Disconnected: ${reason}`
                    });
                }

                // Emitir evento por Socket.io SOLO al cliente específico
                if (socketIo) {
                    const roomName = `client_${clientCode}`;
                    console.log(`📡 Emitting whatsapp:disconnected to room: ${roomName}`);
                    
                    socketIo.to(roomName).emit('whatsapp:disconnected', {
                        clientCode,
                        reason,
                        timestamp: new Date()
                    });
                }
            } catch (error) {
                console.error(`❌ Error handling disconnect for ${clientCode}:`, error.message);
            }
        });

        // Evento: Mensaje recibido - Integrado con MessageService
        client.on('message', async (message) => {
            try {
                // Actualizar última actividad
                const session = await WhatsAppSession.findByClientId(clientId);
                if (session) {
                    await session.updateLastActivity();
                }

                // Rastrear último mensaje recibido para clasificación de bot
                if (!message.fromMe) {
                    this.lastReceivedMessage.set(message.from, Date.now());
                }

                // Log detallado del mensaje
                console.log(`📨 Message received for ${clientCode}:`);
                console.log(`   From: ${message.from}`);
                console.log(`   FromMe: ${message.fromMe}`);
                console.log(`   Body: ${message.body?.substring(0, 100) || '[media]'}`);
                console.log(`   Type: ${message.type}`);
                console.log(`   Timestamp: ${new Date(message.timestamp * 1000).toISOString()}`);
                
                // Solo procesar mensajes recibidos (fromMe: false) 
                // Los mensajes enviados se procesan en message_create o sendManualMessage
                if (!message.fromMe) {
                    console.log(`📥 Processing received message`);
                    const MessageService = require('./MessageService');
                    await MessageService.handleIncomingMessage(clientId, clientCode, message, socketIo);
                } else {
                    console.log(`📤 Sent message detected, will be processed by message_create or sendManualMessage`);
                }

            } catch (error) {
                console.error(`❌ Error handling message for ${clientCode}:`, error.message);
            }
        });

        // Evento adicional: Message sent (para asegurar captura de mensajes enviados)
        client.on('message_create', async (message) => {
            try {
                console.log(`🔔 Message_create event for ${clientCode}:`);
                console.log(`   From: ${message.from}`);
                console.log(`   To: ${message.to || 'N/A'}`);
                console.log(`   FromMe: ${message.fromMe}`);
                console.log(`   Body: ${message.body?.substring(0, 100) || '[media]'}`);
                
                // Solo procesar mensajes enviados desde el celular (no desde la API)
                // Y que no sean del bot para evitar bucles
                if (message.fromMe && !message.body?.startsWith('[BOT]') && !message.body?.startsWith('[CRM-BOT]')) {
                    console.log(`📤 Processing message_create for sent message from phone`);
                    
                    // Procesar con MessageService
                    const MessageService = require('./MessageService');
                    await MessageService.handleIncomingMessage(clientId, clientCode, message, socketIo);
                }
            } catch (error) {
                console.error(`❌ Error handling message_create for ${clientCode}:`, error.message);
            }
        });

        // Evento: Message ACK (confirmación de mensaje)
        client.on('message_ack', async (message, ack) => {
            try {
                if (message.fromMe) {
                    console.log(`✅ Message ACK for ${clientCode}: ${message.id._serialized} - Status: ${ack}`);
                }
            } catch (error) {
                console.error(`❌ Error handling message_ack for ${clientCode}:`, error.message);
            }
        });
    }

    /**
     * Obtener cliente por clientCode
     * @param {string} clientCode - Código del cliente
     * @returns {Client|null} Cliente de WhatsApp o null
     */
    getClient(clientCode) {
        return this.clients.get(clientCode) || null;
    }

    /**
     * Obtener QR code para un cliente
     * @param {string} clientCode - Código del cliente
     * @returns {Object|null} Datos del QR code o null
     */
    getQRCode(clientCode) {
        return this.qrCodes.get(clientCode) || null;
    }

    /**
     * Verificar si un cliente está conectado
     * @param {string} clientCode - Código del cliente
     * @returns {boolean} True si está conectado
     */
    isClientConnected(clientCode) {
        const client = this.getClient(clientCode);
        return client && client.info && client.info.wid;
    }

    /**
     * Obtener estado del cliente
     * @param {string} clientCode - Código del cliente
     * @returns {Object} Estado del cliente
     */
    getClientStatus(clientCode) {
        try {
            const client = this.getClient(clientCode);
            const qrData = this.getQRCode(clientCode);
            
            if (!client) {
                return {
                    status: 'not_initialized',
                    connected: false,
                    hasQR: false,
                    phoneNumber: null,
                    clientInfo: null,
                    lastCheck: new Date().toISOString()
                };
            }

            // Verificar estado de conexión de manera más robusta
            let isConnected = false;
            let connectionError = null;
            
            try {
                isConnected = this.isClientConnected(clientCode);
                
                // Verificación adicional: intentar acceder a info del cliente
                if (isConnected && client.info) {
                    // Verificar que la información del cliente sea válida
                    const hasValidInfo = client.info.wid && client.info.wid.user;
                    if (!hasValidInfo) {
                        isConnected = false;
                        connectionError = 'Client info is invalid';
                    }
                }
            } catch (error) {
                console.warn(`⚠️ Error checking connection status for ${clientCode}:`, error.message);
                isConnected = false;
                connectionError = error.message;
            }

            // Determinar estado basado en conexión y QR
            let status = 'initializing';
            if (isConnected) {
                status = 'connected';
            } else if (qrData) {
                // Verificar si el QR no ha expirado (5 minutos)
                const qrAge = Date.now() - qrData.timestamp.getTime();
                const maxAge = 5 * 60 * 1000; // 5 minutos
                status = qrAge > maxAge ? 'qr_expired' : 'waiting_qr';
            } else if (connectionError) {
                status = 'error';
            }
            
            return {
                status: status,
                connected: isConnected,
                hasQR: !!qrData && status !== 'qr_expired',
                qrCode: (qrData && status !== 'qr_expired') ? qrData.qrImage : null,
                qrExpired: status === 'qr_expired',
                phoneNumber: (isConnected && client.info?.wid?.user) ? client.info.wid.user : null,
                clientInfo: (isConnected && client.info) ? {
                    pushname: client.info.pushname || 'Unknown',
                    platform: client.info.platform || 'Unknown'
                } : null,
                connectionError: connectionError,
                lastCheck: new Date().toISOString(),
                // Información adicional para debugging
                hasClientInMemory: !!client,
                hasQRInMemory: !!qrData,
                qrAge: qrData ? Math.floor((Date.now() - qrData.timestamp.getTime()) / 1000) : null
            };
        } catch (error) {
            console.error(`❌ Error in getClientStatus for ${clientCode}:`, error.message);
            return {
                status: 'error',
                connected: false,
                hasQR: false,
                phoneNumber: null,
                clientInfo: null,
                connectionError: error.message,
                lastCheck: new Date().toISOString()
            };
        }
    }

    /**
     * Desconectar cliente
     * @param {string} clientCode - Código del cliente
     * @returns {Promise<boolean>} True si se desconectó correctamente
     */
    async disconnectClient(clientCode) {
        try {
            const client = this.getClient(clientCode);
            
            if (!client) {
                console.log(`⚠️ Client ${clientCode} not found for disconnection`);
                return true;
            }

            console.log(`🔌 Disconnecting client: ${clientCode}`);
            
            // Desconectar cliente
            await client.destroy();
            
            // Limpiar datos
            this.clients.delete(clientCode);
            this.qrCodes.delete(clientCode);
            this.botSentMessages.delete(clientCode);
            this.lastReceivedMessage.delete(clientCode);

            console.log(`✅ Client ${clientCode} disconnected successfully`);
            return true;
        } catch (error) {
            console.error(`❌ Error disconnecting client ${clientCode}:`, error.message);
            throw error;
        }
    }

    /**
     * Enviar mensaje de texto
     * @param {string} clientCode - Código del cliente
     * @param {string} to - Número de destino (formato: 5491123456789@c.us)
     * @param {string} message - Mensaje a enviar
     * @param {boolean} isBot - Si el mensaje es enviado por bot
     * @returns {Promise<Object>} Resultado del envío
     */
    async sendMessage(clientCode, to, message, isBot = false) {
        try {
            const client = this.getClient(clientCode);
            
            if (!client || !this.isClientConnected(clientCode)) {
                throw new Error(`Cliente ${clientCode} no está conectado`);
            }

            console.log(`📤 Sending message from ${clientCode} to ${to}: ${message ? message.substring(0, 50) : 'Empty message'}...`);

            // Marcar mensaje como bot si corresponde
            let finalMessage = message;
            if (isBot) {
                finalMessage = `[BOT] ${message}`;
            }

            // Validar que el mensaje no esté vacío
            if (!finalMessage || finalMessage.trim() === '') {
                throw new Error('El mensaje no puede estar vacío');
            }

            // Formatear número de destino si es necesario
            let formattedTo = to;
            if (!to.includes('@c.us')) {
                formattedTo = `${to}@c.us`;
            }

            console.log(`📤 Attempting to send to: ${formattedTo}`);

            // Enviar mensaje con timeout y retry
            const sentMessage = await this.sendMessageWithRetry(client, formattedTo, finalMessage);

            // Rastrear mensaje enviado por bot para clasificación
            if (isBot) {
                const botMessages = this.botSentMessages.get(clientCode) || new Set();
                botMessages.add(sentMessage.id._serialized);
                this.botSentMessages.set(clientCode, botMessages);
                
                // Limpiar mensajes antiguos (mantener solo los últimos 100)
                if (botMessages.size > 100) {
                    const messagesArray = Array.from(botMessages);
                    const toKeep = messagesArray.slice(-100);
                    this.botSentMessages.set(clientCode, new Set(toKeep));
                }
            }

            console.log(`✅ Message sent successfully from ${clientCode}`);

            return {
                success: true,
                messageId: sentMessage.id._serialized,
                timestamp: sentMessage.timestamp,
                isBot
            };

        } catch (error) {
            console.error(`❌ Error sending message from ${clientCode}:`, error.message);
            throw error;
        }
    }

    /**
     * Enviar imagen
     * @param {string} clientCode - Código del cliente
     * @param {string} to - Número de destino
     * @param {string} imagePath - Ruta de la imagen o base64
     * @param {string} caption - Texto opcional
     * @returns {Promise<Object>} Resultado del envío
     */
    async sendImage(clientCode, to, imagePath, caption = '') {
        try {
            const client = this.getClient(clientCode);
            
            if (!client || !this.isClientConnected(clientCode)) {
                throw new Error(`Cliente ${clientCode} no está conectado`);
            }

            console.log(`📷 Sending image from ${clientCode} to ${to}`);

            // Crear MessageMedia
            const media = MessageMedia.fromFilePath(imagePath);
            
            // Enviar imagen
            const sentMessage = await client.sendMessage(to, media, { caption });

            console.log(`✅ Image sent successfully from ${clientCode}`);

            return {
                success: true,
                messageId: sentMessage.id._serialized,
                timestamp: sentMessage.timestamp,
                type: 'image'
            };

        } catch (error) {
            console.error(`❌ Error sending image from ${clientCode}:`, error.message);
            throw error;
        }
    }

    /**
     * Verificar si un mensaje fue enviado por bot
     * @param {string} clientCode - Código del cliente
     * @param {string} messageId - ID del mensaje
     * @param {string} conversationId - ID de la conversación
     * @returns {boolean} True si fue enviado por bot
     */
    isAutomaticBotMessage(clientCode, messageId, conversationId) {
        // Verificar si el mensaje está marcado como bot
        const botMessages = this.botSentMessages.get(clientCode) || new Set();
        if (botMessages.has(messageId)) {
            return true;
        }

        // Verificar por timing (si se envió poco después de recibir un mensaje)
        const lastReceived = this.lastReceivedMessage.get(conversationId);
        if (lastReceived) {
            const timeSinceReceived = Date.now() - lastReceived;
            return timeSinceReceived < 2000; // 2 segundos
        }

        return false;
    }

    /**
     * Enviar mensaje con reintentos y manejo de errores
     * @param {Object} client - Cliente de WhatsApp
     * @param {string} to - Número de destino
     * @param {string} message - Mensaje a enviar
     * @param {number} maxRetries - Número máximo de reintentos
     * @returns {Promise<Object>} Mensaje enviado
     */
    async sendMessageWithRetry(client, to, message, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`📤 Attempt ${attempt}/${maxRetries} to send message to ${to}`);
                
                // Verificar que el cliente esté listo
                if (!client || typeof client.sendMessage !== 'function') {
                    throw new Error('Cliente no está inicializado correctamente');
                }

                // Verificar estado del cliente
                try {
                    const state = await client.getState();
                    if (state !== 'CONNECTED') {
                        throw new Error(`Cliente no está conectado. Estado: ${state}`);
                    }
                } catch (stateError) {
                    console.log(`⚠️ Could not verify client state: ${stateError.message}`);
                }

                // Esperar un poco entre reintentos
                if (attempt > 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }

                // Intentar enviar el mensaje
                const sentMessage = await Promise.race([
                    client.sendMessage(to, message),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout sending message')), 15000)
                    )
                ]);

                console.log(`✅ Message sent successfully on attempt ${attempt}`);
                return sentMessage;

            } catch (error) {
                lastError = error;
                console.log(`❌ Attempt ${attempt} failed:`, error.message);
                
                // Si es el último intento, lanzar el error
                if (attempt === maxRetries) {
                    break;
                }
                
                // Para ciertos errores, no reintentar
                if (error.message.includes('Rate limit') || 
                    error.message.includes('blocked') ||
                    error.message.includes('invalid number')) {
                    console.log(`🚫 Non-retryable error detected: ${error.message}`);
                    break;
                }

                // Para "Evaluation failed", esperar más tiempo antes del siguiente intento
                if (error.message.includes('Evaluation failed')) {
                    console.log(`⚠️ Evaluation failed detected, waiting longer before retry...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        
        // Si llegamos aquí, todos los intentos fallaron
        throw new Error(`Failed to send message after ${maxRetries} attempts. Last error: ${lastError.message}`);
    }

    /**
     * Obtener estadísticas de todos los clientes
     * @returns {Object} Estadísticas generales
     */
    getStats() {
        const totalClients = this.clients.size;
        const connectedClients = Array.from(this.clients.keys())
            .filter(clientCode => this.isClientConnected(clientCode)).length;
        const waitingQR = this.qrCodes.size;

        return {
            totalClients,
            connectedClients,
            waitingQR,
            disconnectedClients: totalClients - connectedClients
        };
    }

    /**
     * Limpiar recursos y desconectar todos los clientes
     */
    async cleanup() {
        console.log('🧹 Cleaning up WhatsApp service...');
        
        const disconnectPromises = Array.from(this.clients.keys())
            .map(clientCode => this.disconnectClient(clientCode));
        
        await Promise.allSettled(disconnectPromises);
        
        console.log('✅ WhatsApp service cleanup completed');
    }

    /**
     * Enviar documento
     * @param {string} clientCode - Código del cliente
     * @param {string} to - Número de destino (formato: 5491123456789@c.us)
     * @param {string} filePath - Ruta del archivo
     * @param {string} caption - Caption opcional
     * @param {string} filename - Nombre original del archivo
     * @returns {Promise<Object>} Resultado del envío
     */
    async sendDocument(clientCode, to, filePath, caption = '', filename = '') {
        try {
            const client = this.getClient(clientCode);
            
            if (!client || !this.isClientConnected(clientCode)) {
                throw new Error(`Cliente ${clientCode} no está conectado`);
            }

            console.log(`📄 Sending document from ${clientCode} to ${to}: ${filename}`);

            // Validar que el archivo exista
            const fs = require('fs');
            if (!fs.existsSync(filePath)) {
                throw new Error('El archivo no existe en el servidor');
            }

            // Formatear número de destino
            let formattedTo = to;
            if (!to.includes('@c.us')) {
                formattedTo = `${to}@c.us`;
            }

            // Importar MessageMedia
            const { MessageMedia } = require('whatsapp-web.js');
            
            // Crear media desde archivo
            const media = MessageMedia.fromFilePath(filePath);
            
            // Establecer nombre del archivo si se proporciona
            if (filename) {
                media.filename = filename;
            }

            console.log(`📄 Attempting to send document to: ${formattedTo}`);

            // Enviar documento con timeout
            let sentMessage;
            try {
                if (caption && caption.trim()) {
                    sentMessage = await client.sendMessage(formattedTo, media, { caption });
                } else {
                    sentMessage = await client.sendMessage(formattedTo, media);
                }
            } catch (sendError) {
                console.error(`❌ Error sending document to ${formattedTo}:`, sendError.message);
                throw new Error(`Error al enviar documento: ${sendError.message}`);
            }

            console.log(`✅ Document sent successfully to ${formattedTo}. MessageId: ${sentMessage ? sentMessage.id._serialized : 'unknown'}`);

            // Limpiar archivo temporal después del envío
            try {
                fs.unlinkSync(filePath);
                console.log(`🗑️ Temporary file deleted: ${filePath}`);
            } catch (unlinkError) {
                console.log(`⚠️ Could not delete temporary file: ${unlinkError.message}`);
            }

            return {
                messageId: sentMessage ? sentMessage.id._serialized : null,
                timestamp: new Date(),
                to: formattedTo,
                filename: filename,
                caption: caption
            };

        } catch (error) {
            console.error(`❌ Error in sendDocument for ${clientCode}:`, error.message);
            
            // Limpiar archivo temporal en caso de error
            try {
                const fs = require('fs');
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`🗑️ Temporary file deleted after error: ${filePath}`);
                }
            } catch (unlinkError) {
                console.log(`⚠️ Could not delete temporary file after error: ${unlinkError.message}`);
            }

            throw error;
        }
    }
}

// Instancia singleton
const whatsappService = new WhatsAppService();

module.exports = whatsappService;
