const axios = require('axios');

/**
 * 🧠 Script de prueba para endpoints de configuración de AI
 */

const BASE_URL = 'http://localhost:3000/api';
let authToken = null;

// Configuración de prueba
const testConfig = {
    enabled: true,
    ai_mode: 'prompt_only',
    business_prompt: `Sos un asistente que responde mensajes de WhatsApp de una panadería llamada "Panadería Don José".

INFORMACIÓN DEL NEGOCIO:
- Nombre: Panadería Don José
- Horarios: Lunes a Sábado de 8:00 a 20:00 hs, Domingos de 9:00 a 18:00 hs
- Especialidades: Pan artesanal, facturas, tortas, empanadas
- Ubicación: Av. Principal 123, Centro
- Teléfono: (011) 1234-5678
- Delivery: Disponible en un radio de 5km

INSTRUCCIONES:
- Siempre sé amable y profesional
- Proporciona información precisa sobre horarios y productos
- Si preguntan por precios, sugiere que llamen o visiten la panadería
- Promociona nuestras especialidades cuando sea apropiado
- Si no sabes algo específico, sugiere contactar directamente`,
    max_tokens: 300,
    temperature: 0.7,
    maxHistoryMessages: 8,
    responseTimeout: 25000,
    fallbackMessage: 'Disculpa, no pude procesar tu mensaje. Por favor contacta directamente a la panadería.',
    workingHours: {
        enabled: true,
        start: '08:00',
        end: '20:00',
        days: [1, 2, 3, 4, 5, 6] // Lunes a Sábado
    }
};

async function login() {
    try {
        console.log('🔐 Iniciando sesión...');
        
        const response = await axios.post(`${BASE_URL}/auth/login`, {
            client_code: 'CLI001',
            password: 'demo123456'
        });

        if (response.data.success) {
            authToken = response.data.tokens.accessToken;
            console.log('✅ Login exitoso');
            return true;
        } else {
            console.error('❌ Error en login:', response.data.message);
            return false;
        }
    } catch (error) {
        console.error('❌ Error conectando:', error.message);
        return false;
    }
}

async function testHealthCheck() {
    try {
        console.log('\n🔍 Probando health check...');
        
        const response = await axios.get(`${BASE_URL}/ai/health`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        console.log('✅ Health check:', response.data.data);
    } catch (error) {
        console.error('❌ Error en health check:', error.response?.data || error.message);
    }
}

async function testGetModes() {
    try {
        console.log('\n🎯 Obteniendo modos disponibles...');
        
        const response = await axios.get(`${BASE_URL}/ai/modes`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        console.log('✅ Modos disponibles:', JSON.stringify(response.data.data, null, 2));
    } catch (error) {
        console.error('❌ Error obteniendo modos:', error.response?.data || error.message);
    }
}

async function testGetConfig() {
    try {
        console.log('\n📋 Obteniendo configuración actual...');
        
        const response = await axios.get(`${BASE_URL}/ai/config`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        console.log('✅ Configuración actual:', JSON.stringify(response.data.data, null, 2));
        return response.data.data;
    } catch (error) {
        console.error('❌ Error obteniendo config:', error.response?.data || error.message);
        return null;
    }
}

async function testUpdateConfig() {
    try {
        console.log('\n🔧 Actualizando configuración...');
        
        const response = await axios.put(`${BASE_URL}/ai/config`, testConfig, {
            headers: { 
                Authorization: `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Configuración actualizada:', response.data.message);
        return true;
    } catch (error) {
        console.error('❌ Error actualizando config:', error.response?.data || error.message);
        return false;
    }
}

async function testAIResponse() {
    try {
        console.log('\n🧠 Probando respuesta de IA...');
        
        const testMessage = '¿Hasta qué hora están abiertos hoy?';
        
        const response = await axios.post(`${BASE_URL}/ai/test`, {
            message: testMessage
        }, {
            headers: { 
                Authorization: `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Prueba de IA:');
        console.log('   Pregunta:', response.data.data.input_message);
        console.log('   Respuesta:', response.data.data.ai_response);
    } catch (error) {
        console.error('❌ Error en prueba de IA:', error.response?.data || error.message);
    }
}

async function testGetStats() {
    try {
        console.log('\n📊 Obteniendo estadísticas...');
        
        const response = await axios.get(`${BASE_URL}/ai/stats?hours=24`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        console.log('✅ Estadísticas:', JSON.stringify(response.data.data, null, 2));
    } catch (error) {
        console.error('❌ Error obteniendo stats:', error.response?.data || error.message);
    }
}

async function runAllTests() {
    console.log('🚀 INICIANDO PRUEBAS DE ENDPOINTS DE AI\n');
    
    // 1. Login
    const loginSuccess = await login();
    if (!loginSuccess) {
        console.error('❌ No se pudo hacer login. Abortando pruebas.');
        return;
    }

    // 2. Health check
    await testHealthCheck();

    // 3. Obtener modos
    await testGetModes();

    // 4. Obtener configuración actual
    const currentConfig = await testGetConfig();

    // 5. Actualizar configuración
    const updateSuccess = await testUpdateConfig();
    
    if (updateSuccess) {
        // 6. Verificar configuración actualizada
        await testGetConfig();

        // 7. Probar respuesta de IA
        await testAIResponse();
    }

    // 8. Obtener estadísticas
    await testGetStats();

    console.log('\n🎉 PRUEBAS COMPLETADAS');
}

// Ejecutar pruebas
runAllTests().catch(error => {
    console.error('❌ Error en las pruebas:', error.message);
    process.exit(1);
});
