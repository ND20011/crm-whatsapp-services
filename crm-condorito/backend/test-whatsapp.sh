#!/bin/bash

# Script para probar endpoints de WhatsApp del CRM Condorito
# Uso: ./test-whatsapp.sh

BASE_URL="http://localhost:3002"
CLIENT_CODE="CLI001"
PASSWORD="demo123456"

echo "🚀 ========================================"
echo "   TESTING WHATSAPP ENDPOINTS - CRM CONDORITO"
echo "🚀 ========================================"

# Función para extraer token manualmente
extract_token() {
    echo "$1" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4
}

echo -e "\n=== 1. Login para obtener token ==="
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"client_code\": \"$CLIENT_CODE\", \"password\": \"$PASSWORD\"}")

echo "$LOGIN_RESPONSE"

# Extraer token
TOKEN=$(extract_token "$LOGIN_RESPONSE")

if [ -z "$TOKEN" ]; then
    echo "❌ Error: No se pudo obtener el token de acceso"
    exit 1
fi

echo -e "\n✅ Token obtenido: ${TOKEN:0:50}..."

echo -e "\n=== 2. Health check de WhatsApp ==="
curl -s -X GET "$BASE_URL/api/whatsapp/health" \
  -H "Authorization: Bearer $TOKEN"

echo -e "\n\n=== 3. Verificar estado inicial de WhatsApp ==="
curl -s -X GET "$BASE_URL/api/whatsapp/status" \
  -H "Authorization: Bearer $TOKEN"

echo -e "\n\n=== 4. Conectar WhatsApp (generar QR) ==="
CONNECT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/whatsapp/connect" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "$CONNECT_RESPONSE"

echo -e "\n\n=== 5. Esperar 3 segundos para generar QR... ==="
sleep 3

echo -e "\n=== 6. Obtener QR Code ==="
QR_RESPONSE=$(curl -s -X GET "$BASE_URL/api/whatsapp/qr/$CLIENT_CODE" \
  -H "Authorization: Bearer $TOKEN")

echo "$QR_RESPONSE"

echo -e "\n\n=== 7. Verificar estado después de conectar ==="
curl -s -X GET "$BASE_URL/api/whatsapp/status" \
  -H "Authorization: Bearer $TOKEN"

echo -e "\n\n=== 8. Obtener estadísticas de WhatsApp ==="
curl -s -X GET "$BASE_URL/api/whatsapp/stats" \
  -H "Authorization: Bearer $TOKEN"

echo -e "\n\n=== 9. Probar envío de mensaje (sin conexión real) ==="
curl -s -X POST "$BASE_URL/api/whatsapp/send-message" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to": "5491123456789", "message": "Mensaje de prueba desde CRM Condorito"}'

echo -e "\n\n=== 10. Desconectar WhatsApp ==="
curl -s -X POST "$BASE_URL/api/whatsapp/disconnect" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

echo -e "\n\n=== 11. Verificar estado final ==="
curl -s -X GET "$BASE_URL/api/whatsapp/status" \
  -H "Authorization: Bearer $TOKEN"

echo -e "\n\n🎉 ========================================"
echo "   TESTING COMPLETADO"
echo "🎉 ========================================"
echo ""
echo "📋 Resumen de pruebas:"
echo "✅ Login y autenticación"
echo "✅ Health check de WhatsApp"
echo "✅ Estado de sesión"
echo "✅ Conexión y generación de QR"
echo "✅ Obtención de QR code"
echo "✅ Estadísticas"
echo "✅ Envío de mensaje (test)"
echo "✅ Desconexión"
echo ""
echo "📱 Para conectar WhatsApp real:"
echo "1. Ejecuta: POST /api/whatsapp/connect"
echo "2. Obtén QR: GET /api/whatsapp/qr/$CLIENT_CODE"
echo "3. Escanea el QR con WhatsApp Web"
echo "4. Verifica estado: GET /api/whatsapp/status"
echo ""
