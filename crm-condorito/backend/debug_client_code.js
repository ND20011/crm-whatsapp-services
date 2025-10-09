const AuthService = require('./src/services/AuthService');
const AIService = require('./src/services/AIService');

async function debugClientCode() {
    try {
        const token = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiY2xpZW50Q29kZSI6ImRlbW8iLCJjb21wYW55TmFtZSI6IkVtcHJlc2EgRGVtbyBDUk0iLCJzdGF0dXMiOiJhY3RpdmUiLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzU5MzUyMjc0LCJleHAiOjE3NTk0Mzg2NzQsImF1ZCI6ImNybS1jbGllbnQiLCJpc3MiOiJjcm0tY29uZG9yaXRvIn0.2AdHiawHV1QA2aBQygaJ-MhTyJeVsqN4W8xKRBNm3Q4';
        
        console.log('🔍 1. Verificando token...');
        const payload = await AuthService.verifyToken(token);
        
        console.log('✅ Payload:', {
            id: payload.id,
            clientCode: payload.clientCode,
            client_code_from_client: payload.client?.client_code
        });
        
        // Simular lo que hace el controlador
        const clientCode = payload.clientCode || payload.client?.client_code;
        console.log('🎯 ClientCode extraído:', clientCode);
        
        console.log('\n🔍 2. Probando getClientAIConfig...');
        const config = await AIService.getClientAIConfig(clientCode);
        console.log('✅ Config obtenida:', config ? 'Sí' : 'No');
        
        console.log('\n🔍 3. Probando updateClientAIConfig...');
        const testConfig = {
            enabled: true,
            ai_mode: 'prompt_only',
            business_prompt: 'Test prompt simple',
            max_tokens: 300,
            temperature: 0.7,
            fallbackMessage: 'Mensaje de fallback'
        };
        
        const success = await AIService.updateClientAIConfig(clientCode, testConfig);
        console.log('✅ Update success:', success);
        
        if (success) {
            console.log('\n🔍 4. Verificando config actualizada...');
            const updatedConfig = await AIService.getClientAIConfig(clientCode);
            console.log('✅ Prompt actualizado:', updatedConfig.business_prompt);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

debugClientCode();
