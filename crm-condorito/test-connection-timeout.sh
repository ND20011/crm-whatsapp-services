#!/bin/bash

# Script para probar las mejoras del endpoint de conexión WhatsApp
# Uso: ./test-connection-timeout.sh

BASE_URL="http://localhost:3002"
CLIENT_CODE="demo"
PASSWORD="demo123456"

echo "🚀 ========================================"
echo "   TESTING CONNECTION TIMEOUT IMPROVEMENTS"
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

echo -e "\n=== 2. Verificar estado inicial ==="
curl -s -X GET "$BASE_URL/api/whatsapp/status" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

echo -e "\n\n=== 3. Test de conexión con timeout mejorado ==="
echo "⏱️ Iniciando conexión (timeout: 65 segundos)..."

# Usar timeout del sistema para verificar que no se cuelgue
timeout 70s curl -s -X POST "$BASE_URL/api/whatsapp/connect" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'

CURL_EXIT_CODE=$?

if [ $CURL_EXIT_CODE -eq 124 ]; then
    echo "❌ FALLO: El endpoint se colgó por más de 70 segundos"
    exit 1
elif [ $CURL_EXIT_CODE -eq 0 ]; then
    echo "✅ ÉXITO: El endpoint respondió dentro del tiempo límite"
else
    echo "⚠️ Código de salida curl: $CURL_EXIT_CODE"
fi

echo -e "\n=== 4. Verificar estado después de conexión ==="
curl -s -X GET "$BASE_URL/api/whatsapp/status" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

echo -e "\n=== 5. Test de múltiples conexiones simultáneas ==="
echo "🔄 Probando múltiples conexiones para verificar manejo de concurrencia..."

for i in {1..3}; do
    echo "Conexión $i..."
    timeout 10s curl -s -X POST "$BASE_URL/api/whatsapp/connect" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" &
done

wait
echo "✅ Pruebas de concurrencia completadas"

echo -e "\n=== 6. Verificar estado final ==="
curl -s -X GET "$BASE_URL/api/whatsapp/status" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

echo -e "\n🎉 ========================================"
echo "   PRUEBAS DE TIMEOUT COMPLETADAS"
echo "🎉 ========================================"
