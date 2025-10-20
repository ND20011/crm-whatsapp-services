const Conversation = require('./src/entities/Conversation');

async function testConversationTags() {
    try {
        console.log('🧪 Probando carga de etiquetas en conversaciones...');
        
        const conversations = await Conversation.findByClientId(1, { limit: 2 });
        
        console.log(`📞 Encontradas ${conversations.length} conversaciones:`);
        
        conversations.forEach((conv, index) => {
            console.log(`\n${index + 1}. Conversación ID: ${conv.id}`);
            console.log(`   📱 Teléfono: ${conv.contact_phone}`);
            console.log(`   👤 Nombre: ${conv.contact_name || 'Sin nombre'}`);
            console.log(`   🏷️ Etiquetas (${conv.contact_tags ? conv.contact_tags.length : 0}):`);
            
            if (conv.contact_tags && conv.contact_tags.length > 0) {
                conv.contact_tags.forEach(tag => {
                    console.log(`      - ${tag.name} (${tag.color})`);
                });
            } else {
                console.log(`      (Sin etiquetas)`);
            }
        });
        
        // Verificar si se serializan correctamente
        console.log('\n📦 JSON serializado:');
        console.log(JSON.stringify(conversations, null, 2));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testConversationTags().then(() => process.exit(0));
