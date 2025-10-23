const webpush = require('web-push');

// Generar claves VAPID
const vapidKeys = webpush.generateVAPIDKeys();

console.log('=== CLAVES VAPID GENERADAS ===');
console.log('Public Key:', vapidKeys.publicKey);
console.log('Private Key:', vapidKeys.privateKey);
console.log('');
console.log('Guarda estas claves de forma segura:');
console.log('- La clave pública va en el frontend');
console.log('- La clave privada va en las variables de entorno del backend');
console.log('');
console.log('Ejemplo para .env:');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:admin@crmcondorito.com`);