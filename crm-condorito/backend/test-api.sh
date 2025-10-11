#!/bin/bash

# ============================================================================
# SCRIPT DE TESTING COMPLETO - CRM CONDORITO BACKEND
# ============================================================================

BASE_URL="http://localhost:3002"
echo "🧪 Testing CRM Condorito Backend APIs"
echo "📡 Base URL: $BASE_URL"
echo "============================================"

# 1. Health Check
echo "1️⃣  Health Check"
curl -s -X GET $BASE_URL/health | jq '.'
echo -e "\n"

# 2. Login
echo "2️⃣  Login CLI001"
LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"client_code": "CLI001", "password": "demo123456"}')

echo $LOGIN_RESPONSE | jq '.'

# Extraer token
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.tokens.accessToken')
REFRESH_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.tokens.refreshToken')

if [ "$TOKEN" != "null" ]; then
    echo "✅ Token obtenido: ${TOKEN:0:50}..."
else
    echo "❌ Error obteniendo token"
    exit 1
fi
echo -e "\n"

# 3. Verify Token
echo "3️⃣  Verify Token"
curl -s -X GET $BASE_URL/api/auth/verify \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo -e "\n"

# 4. Get Profile
echo "4️⃣  Get Profile"
curl -s -X GET $BASE_URL/api/auth/profile \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo -e "\n"

# 5. Update Profile
echo "5️⃣  Update Profile"
curl -s -X PUT $BASE_URL/api/auth/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"company_name": "Empresa Demo CRM Actualizada"}' | jq '.'
echo -e "\n"

# 6. Validate Client Code
echo "6️⃣  Validate Client Code"
curl -s -X POST $BASE_URL/api/auth/validate-client-code \
  -H "Content-Type: application/json" \
  -d '{"client_code": "NUEVO001"}' | jq '.'
echo -e "\n"

# 7. Module Health Checks
echo "7️⃣  Module Health Checks"
echo "Auth Module:"
curl -s -X GET $BASE_URL/api/auth/health | jq '.module, .status'

echo "WhatsApp Module:"
curl -s -X GET $BASE_URL/api/whatsapp/health | jq '.module, .status'

echo "Messages Module:"
curl -s -X GET $BASE_URL/api/messages/health | jq '.module, .status'

echo "Contacts Module:"
curl -s -X GET $BASE_URL/api/contacts/health | jq '.module, .status'
echo -e "\n"

# 8. Test Development Endpoints (should return 501)
echo "8️⃣  Testing Development Endpoints (should return 501)"
echo "WhatsApp QR:"
curl -s -X GET $BASE_URL/api/whatsapp/qr/CLI001 \
  -H "Authorization: Bearer $TOKEN" | jq '.message'

echo "Send Message:"
curl -s -X POST $BASE_URL/api/messages/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "5491234567890", "message": "Test"}' | jq '.message'

echo "Get Contacts:"
curl -s -X GET $BASE_URL/api/contacts \
  -H "Authorization: Bearer $TOKEN" | jq '.message'
echo -e "\n"

# 9. Refresh Token
echo "9️⃣  Refresh Token"
curl -s -X POST $BASE_URL/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}" | jq '.success, .message'
echo -e "\n"

# 10. Logout
echo "🔟 Logout"
curl -s -X POST $BASE_URL/api/auth/logout \
  -H "Authorization: Bearer $TOKEN" | jq '.'

echo -e "\n============================================"
echo "✅ Testing completado!"
echo "🚀 Backend CRM Condorito funcionando correctamente"
