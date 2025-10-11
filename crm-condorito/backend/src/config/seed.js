const bcrypt = require('bcryptjs');
const { executeQuery, testConnection } = require('./database');
require('dotenv').config();

// ============================================================================
// SCRIPT DE SEEDS - CRM CONDORITO
// ============================================================================

/**
 * Datos de prueba para el sistema
 */
const seedData = {
    clients: [
        {
            client_code: 'CLI001',
            password: 'demo123456', // Se encriptará
            company_name: 'Empresa Demo CRM',
            email: 'demo@crm-condorito.com',
            phone: '+5491123456789',
            status: 'active'
        },
        {
            client_code: 'TEST001',
            password: 'test123456', // Se encriptará
            company_name: 'Test Company SA',
            email: 'test@crm-condorito.com',
            phone: '+5491987654321',
            status: 'active'
        }
    ],
    
    // Tags por defecto para cada cliente
    defaultTags: [
        { name: 'Cliente VIP', color: '#28a745', description: 'Clientes de alta prioridad' },
        { name: 'Prospecto', color: '#ffc107', description: 'Posibles clientes' },
        { name: 'Soporte', color: '#17a2b8', description: 'Consultas de soporte técnico' },
        { name: 'Ventas', color: '#007bff', description: 'Contactos relacionados con ventas' },
        { name: 'Inactivo', color: '#6c757d', description: 'Contactos inactivos' }
    ],
    
    // Templates por defecto
    defaultTemplates: [
        {
            name: 'Bienvenida',
            content: 'Hola {nombre}, ¡Bienvenido a {empresa}! ¿En qué podemos ayudarte hoy?',
            variables: JSON.stringify(['nombre', 'empresa']),
            category: 'saludo'
        },
        {
            name: 'Confirmación de Pedido',
            content: 'Hola {nombre}, tu pedido #{numero_pedido} ha sido confirmado y será procesado en {tiempo_estimado}.',
            variables: JSON.stringify(['nombre', 'numero_pedido', 'tiempo_estimado']),
            category: 'confirmacion'
        },
        {
            name: 'Seguimiento',
            content: 'Hola {nombre}, ¿cómo estuvo tu experiencia con nosotros? Nos encantaría conocer tu opinión.',
            variables: JSON.stringify(['nombre']),
            category: 'seguimiento'
        },
        {
            name: 'Respuesta Fuera de Horario',
            content: 'Gracias por contactarnos. Actualmente estamos fuera del horario de atención. Te responderemos en cuanto sea posible.',
            variables: JSON.stringify([]),
            category: 'automatico'
        }
    ],
    
    // Grupos de conversaciones por defecto
    defaultGroups: [
        { name: 'Urgentes', color: '#dc3545', description: 'Conversaciones que requieren atención inmediata' },
        { name: 'Ventas', color: '#28a745', description: 'Consultas relacionadas con ventas' },
        { name: 'Soporte', color: '#ffc107', description: 'Consultas de soporte técnico' },
        { name: 'Seguimiento', color: '#17a2b8', description: 'Clientes en proceso de seguimiento' }
    ]
};

// ============================================================================
// FUNCIONES DE SEEDING
// ============================================================================

/**
 * Crear clientes de prueba
 */
async function seedClients() {
    console.log('👥 Creando clientes de prueba...');
    
    const createdClients = [];
    
    for (const client of seedData.clients) {
        try {
            // Verificar si el cliente ya existe
            const existingClient = await executeQuery(
                'SELECT id FROM clients WHERE client_code = ?',
                [client.client_code]
            );
            
            if (existingClient.length > 0) {
                console.log(`⚠️  Cliente ${client.client_code} ya existe, saltando...`);
                createdClients.push({ id: existingClient[0].id, ...client });
                continue;
            }
            
            // Encriptar contraseña
            const hashedPassword = await bcrypt.hash(client.password, 12);
            
            // Insertar cliente
            const result = await executeQuery(`
                INSERT INTO clients (client_code, password, company_name, email, phone, status, monthly_bot_limit, current_bot_usage, bot_usage_reset_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                client.client_code,
                hashedPassword,
                client.company_name,
                client.email,
                client.phone,
                client.status,
                2500, // monthly_bot_limit por defecto
                0,    // current_bot_usage inicial
                new Date().toISOString().split('T')[0].substring(0, 8) + '01' // Primer día del mes actual
            ]);
            
            createdClients.push({ id: result.insertId, ...client });
            console.log(`✅ Cliente ${client.client_code} creado (ID: ${result.insertId})`);
            
        } catch (error) {
            console.error(`❌ Error creando cliente ${client.client_code}:`, error.message);
        }
    }
    
    return createdClients;
}

/**
 * Crear configuraciones de bot por defecto
 */
async function seedBotConfigurations(clients) {
    console.log('🤖 Creando configuraciones de bot...');
    
    for (const client of clients) {
        try {
            // Verificar si ya existe configuración
            const existingConfig = await executeQuery(
                'SELECT id FROM bot_configurations WHERE client_id = ?',
                [client.id]
            );
            
            if (existingConfig.length > 0) {
                console.log(`⚠️  Configuración bot para ${client.client_code} ya existe, saltando...`);
                continue;
            }
            
            // Crear configuración por defecto
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
                client.id,
                true,
                '00:00:00',
                '23:59:00',
                JSON.stringify([0, 1, 2, 3, 4, 5, 6]), // Todos los días
                2000,
                `¡Hola! Bienvenido a ${client.company_name}. ¿En qué podemos ayudarte?`,
                'Lo siento, no pude entender tu consulta. Un agente te contactará pronto.',
                5,
                false  // Por defecto, solo respuestas de texto (sin búsqueda de productos)
            ]);
            
            console.log(`✅ Configuración bot creada para ${client.client_code}`);
            
        } catch (error) {
            console.error(`❌ Error creando configuración bot para ${client.client_code}:`, error.message);
        }
    }
}

/**
 * Crear etiquetas por defecto
 */
async function seedContactTags(clients) {
    console.log('🏷️  Creando etiquetas de contactos...');
    
    for (const client of clients) {
        for (const tag of seedData.defaultTags) {
            try {
                // Verificar si la etiqueta ya existe
                const existingTag = await executeQuery(
                    'SELECT id FROM contact_tags WHERE client_id = ? AND name = ?',
                    [client.id, tag.name]
                );
                
                if (existingTag.length > 0) {
                    console.log(`⚠️  Etiqueta '${tag.name}' para ${client.client_code} ya existe, saltando...`);
                    continue;
                }
                
                // Crear etiqueta
                await executeQuery(`
                    INSERT INTO contact_tags (client_id, name, color, description)
                    VALUES (?, ?, ?, ?)
                `, [client.id, tag.name, tag.color, tag.description]);
                
                console.log(`✅ Etiqueta '${tag.name}' creada para ${client.client_code}`);
                
            } catch (error) {
                console.error(`❌ Error creando etiqueta '${tag.name}' para ${client.client_code}:`, error.message);
            }
        }
    }
}

/**
 * Crear templates por defecto
 */
async function seedMessageTemplates(clients) {
    console.log('📝 Creando templates de mensajes...');
    
    for (const client of clients) {
        for (const template of seedData.defaultTemplates) {
            try {
                // Verificar si el template ya existe
                const existingTemplate = await executeQuery(
                    'SELECT id FROM message_templates WHERE client_id = ? AND name = ?',
                    [client.id, template.name]
                );
                
                if (existingTemplate.length > 0) {
                    console.log(`⚠️  Template '${template.name}' para ${client.client_code} ya existe, saltando...`);
                    continue;
                }
                
                // Crear template
                await executeQuery(`
                    INSERT INTO message_templates (client_id, name, content, variables, category, is_active)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    client.id, 
                    template.name, 
                    template.content, 
                    template.variables, 
                    template.category, 
                    true
                ]);
                
                console.log(`✅ Template '${template.name}' creado para ${client.client_code}`);
                
            } catch (error) {
                console.error(`❌ Error creando template '${template.name}' para ${client.client_code}:`, error.message);
            }
        }
    }
}

/**
 * Crear grupos de conversaciones por defecto
 */
async function seedConversationGroups(clients) {
    console.log('📁 Creando grupos de conversaciones...');
    
    for (const client of clients) {
        for (const [index, group] of seedData.defaultGroups.entries()) {
            try {
                // Verificar si el grupo ya existe
                const existingGroup = await executeQuery(
                    'SELECT id FROM conversation_groups WHERE client_id = ? AND name = ?',
                    [client.id, group.name]
                );
                
                if (existingGroup.length > 0) {
                    console.log(`⚠️  Grupo '${group.name}' para ${client.client_code} ya existe, saltando...`);
                    continue;
                }
                
                // Crear grupo
                await executeQuery(`
                    INSERT INTO conversation_groups (client_id, name, color, description, sort_order)
                    VALUES (?, ?, ?, ?, ?)
                `, [client.id, group.name, group.color, group.description, index]);
                
                console.log(`✅ Grupo '${group.name}' creado para ${client.client_code}`);
                
            } catch (error) {
                console.error(`❌ Error creando grupo '${group.name}' para ${client.client_code}:`, error.message);
            }
        }
    }
}

/**
 * Ejecutar seeding completo
 */
async function runSeeds() {
    console.log(`
🌱 ====================================
   INICIANDO SEEDING DE DATOS DE PRUEBA
🌱 ====================================
    `);
    
    try {
        // Verificar conexión
        const connected = await testConnection();
        if (!connected) {
            throw new Error('No se pudo conectar a la base de datos');
        }
        
        // Ejecutar seeds en orden
        const clients = await seedClients();
        await seedBotConfigurations(clients);
        await seedContactTags(clients);
        await seedMessageTemplates(clients);
        await seedConversationGroups(clients);
        
        console.log(`
✅ ====================================
   SEEDING COMPLETADO EXITOSAMENTE
✅ ====================================
👥 Clientes creados: ${clients.length}
🤖 Configuraciones bot: ${clients.length}
🏷️  Etiquetas por cliente: ${seedData.defaultTags.length}
📝 Templates por cliente: ${seedData.defaultTemplates.length}
📁 Grupos por cliente: ${seedData.defaultGroups.length}
⏰ Timestamp: ${new Date().toISOString()}
✅ ====================================

🔐 CREDENCIALES DE PRUEBA:
========================
Cliente: CLI001
Contraseña: demo123456
Empresa: Empresa Demo CRM

Cliente: TEST001  
Contraseña: test123456
Empresa: Test Company SA
========================
        `);
        
        return true;
        
    } catch (error) {
        console.error(`
❌ ====================================
   ERROR EN SEEDING
❌ ====================================
Error: ${error.message}
❌ ====================================
        `);
        throw error;
    }
}

/**
 * Limpiar datos de prueba
 */
async function clearSeeds() {
    console.log('🗑️  Limpiando datos de prueba...');
    
    try {
        // Eliminar en orden inverso por foreign keys
        const tables = [
            'ai_suggestions',
            'conversation_group_relations',
            'conversation_groups',
            'bulk_messages',
            'scheduled_messages',
            'message_templates',
            'contact_tag_relations',
            'contact_tags',
            'messages',
            'conversations',
            'contacts',
            'bot_configurations',
            'whatsapp_sessions',
            'clients'
        ];
        
        for (const table of tables) {
            await executeQuery(`DELETE FROM ${table} WHERE 1=1`);
            console.log(`✅ Tabla ${table} limpiada`);
        }
        
        console.log('✅ Todos los datos de prueba eliminados');
        
    } catch (error) {
        console.error('❌ Error limpiando datos:', error.message);
        throw error;
    }
}

// ============================================================================
// EJECUCIÓN CLI
// ============================================================================

if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    
    (async () => {
        try {
            switch (command) {
                case 'run':
                    await runSeeds();
                    break;
                    
                case 'clear':
                    await clearSeeds();
                    break;
                    
                case 'reset':
                    await clearSeeds();
                    await runSeeds();
                    break;
                    
                default:
                    console.log(`
📖 Uso del script de seeds:

   node src/config/seed.js run      Crear datos de prueba
   node src/config/seed.js clear    Limpiar todos los datos
   node src/config/seed.js reset    Limpiar y recrear datos
                    `);
            }
            
            process.exit(0);
            
        } catch (error) {
            console.error('❌ Error en seeding:', error.message);
            process.exit(1);
        }
    })();
}

module.exports = {
    runSeeds,
    clearSeeds,
    seedData
};
