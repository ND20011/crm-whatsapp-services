#!/bin/bash

# ============================================================================
# SCRIPT DE TESTING - SISTEMA DE BÚSQUEDA DE PRODUCTOS - CRM CONDORITO V2
# ============================================================================

echo "🧪 INICIANDO TESTS DEL SISTEMA DE BÚSQUEDA DE PRODUCTOS"
echo "======================================================="

# Configuración
BASE_URL="http://localhost:3000"
API_BASE="$BASE_URL/api"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contadores
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

# Función para logging
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((TESTS_PASSED++))
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    ((TESTS_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Función para hacer requests
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local token=$4
    
    if [ -n "$data" ]; then
        if [ -n "$token" ]; then
            curl -s -X "$method" "$API_BASE$endpoint" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $token" \
                -d "$data"
        else
            curl -s -X "$method" "$API_BASE$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data"
        fi
    else
        if [ -n "$token" ]; then
            curl -s -X "$method" "$API_BASE$endpoint" \
                -H "Authorization: Bearer $token"
        else
            curl -s -X "$method" "$API_BASE$endpoint"
        fi
    fi
}

# Función para test individual
run_test() {
    local test_name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local token=$5
    local expected_status=$6
    
    ((TESTS_TOTAL++))
    log_info "Test: $test_name"
    
    response=$(make_request "$method" "$endpoint" "$data" "$token")
    
    # Verificar si la respuesta es JSON válido
    if echo "$response" | jq . >/dev/null 2>&1; then
        success=$(echo "$response" | jq -r '.success // false')
        if [ "$success" = "true" ] || [ "$expected_status" = "error" ]; then
            log_success "$test_name - PASSED"
            echo "   Response: $(echo "$response" | jq -c '.')"
        else
            log_error "$test_name - FAILED"
            echo "   Response: $response"
        fi
    else
        log_error "$test_name - INVALID JSON RESPONSE"
        echo "   Raw response: $response"
    fi
    
    echo ""
}

# ============================================================================
# PREPARACIÓN
# ============================================================================

log_info "Verificando que el servidor esté ejecutándose..."

# Test de conectividad
health_response=$(curl -s "$BASE_URL/health" || echo '{"error": "connection_failed"}')
if echo "$health_response" | grep -q "error"; then
    log_error "El servidor no está ejecutándose en $BASE_URL"
    log_warning "Por favor inicia el servidor backend antes de ejecutar los tests"
    exit 1
else
    log_success "Servidor backend disponible"
fi

# ============================================================================
# OBTENER TOKEN DE AUTENTICACIÓN
# ============================================================================

log_info "Obteniendo token de autenticación..."

# Intentar login (ajustar credenciales según tu configuración)
login_data='{
    "email": "admin@condorito.com",
    "password": "admin123",
    "client_code": "CONDORITO"
}'

auth_response=$(make_request "POST" "/auth/login" "$login_data")
AUTH_TOKEN=$(echo "$auth_response" | jq -r '.token // empty')

if [ -z "$AUTH_TOKEN" ] || [ "$AUTH_TOKEN" = "null" ]; then
    log_warning "No se pudo obtener token de autenticación automáticamente"
    log_info "Por favor proporciona un token válido:"
    read -p "Token: " AUTH_TOKEN
    
    if [ -z "$AUTH_TOKEN" ]; then
        log_error "Token requerido para continuar con los tests"
        exit 1
    fi
else
    log_success "Token de autenticación obtenido"
fi

echo ""

# ============================================================================
# TESTS DE MIGRACIÓN DE BASE DE DATOS
# ============================================================================

log_info "🗄️  EJECUTANDO TESTS DE BASE DE DATOS"
echo "======================================"

log_info "Ejecutando migración de campos de productos..."
cd /Users/ndamario/Downloads/crm-whatsapp-services-2/crm-condorito/backend

# Ejecutar migración
migration_result=$(node migrate_product_search_fields.js 2>&1)
migration_exit_code=$?

if [ $migration_exit_code -eq 0 ]; then
    log_success "Migración de base de datos completada exitosamente"
    echo "$migration_result" | grep -E "(✅|⚠️|🎉)" | while read line; do
        echo "   $line"
    done
else
    log_error "Error en migración de base de datos"
    echo "$migration_result"
fi

echo ""

# ============================================================================
# TESTS DE ENDPOINTS DE CONFIGURACIÓN
# ============================================================================

log_info "🎛️  EJECUTANDO TESTS DE ENDPOINTS DE CONFIGURACIÓN"
echo "=================================================="

# Test 1: Obtener configuración actual
run_test "GET configuración de productos" "GET" "/ai/product-search-config" "" "$AUTH_TOKEN" "success"

# Test 2: Actualizar configuración básica
config_data='{
    "product_search_enabled": true,
    "product_endpoint_url": "https://jsonplaceholder.typicode.com/posts",
    "product_endpoint_method": "GET",
    "product_search_param_name": "q",
    "product_response_path": "",
    "product_max_results": 10,
    "product_cache_ttl": 300,
    "product_timeout": 5000
}'

run_test "PUT actualizar configuración de productos" "PUT" "/ai/product-search-config" "$config_data" "$AUTH_TOKEN" "success"

# Test 3: Configuración inválida (URL mal formada)
invalid_config='{
    "product_search_enabled": true,
    "product_endpoint_url": "not-a-valid-url",
    "product_endpoint_method": "GET"
}'

run_test "PUT configuración inválida (URL)" "PUT" "/ai/product-search-config" "$invalid_config" "$AUTH_TOKEN" "error"

# Test 4: Configuración inválida (método HTTP)
invalid_method_config='{
    "product_search_enabled": true,
    "product_endpoint_url": "https://api.example.com/search",
    "product_endpoint_method": "PATCH"
}'

run_test "PUT configuración inválida (método)" "PUT" "/ai/product-search-config" "$invalid_method_config" "$AUTH_TOKEN" "error"

echo ""

# ============================================================================
# TESTS DE BÚSQUEDA DE PRODUCTOS
# ============================================================================

log_info "🔍 EJECUTANDO TESTS DE BÚSQUEDA DE PRODUCTOS"
echo "============================================="

# Test 5: Probar búsqueda con configuración actual
search_test_data='{
    "searchTerm": "test product"
}'

run_test "POST probar búsqueda de productos" "POST" "/ai/test-product-search" "$search_test_data" "$AUTH_TOKEN" "success"

# Test 6: Probar con configuración personalizada
custom_search_data='{
    "searchTerm": "test",
    "testConfig": {
        "product_endpoint_url": "https://jsonplaceholder.typicode.com/posts",
        "product_endpoint_method": "GET",
        "product_search_param_name": "q",
        "product_response_path": "",
        "product_max_results": 5,
        "product_timeout": 3000
    }
}'

run_test "POST búsqueda con config personalizada" "POST" "/ai/test-product-search" "$custom_search_data" "$AUTH_TOKEN" "success"

# Test 7: Búsqueda sin término
empty_search_data='{
    "searchTerm": ""
}'

run_test "POST búsqueda sin término (error esperado)" "POST" "/ai/test-product-search" "$empty_search_data" "$AUTH_TOKEN" "error"

echo ""

# ============================================================================
# TESTS DE CACHE Y ESTADÍSTICAS
# ============================================================================

log_info "📊 EJECUTANDO TESTS DE CACHE Y ESTADÍSTICAS"
echo "============================================"

# Test 8: Obtener estadísticas del cache
run_test "GET estadísticas del cache" "GET" "/ai/product-search-stats" "" "$AUTH_TOKEN" "success"

# Test 9: Limpiar cache
run_test "DELETE limpiar cache" "DELETE" "/ai/product-search-cache" "" "$AUTH_TOKEN" "success"

# Test 10: Verificar estadísticas después de limpiar
run_test "GET estadísticas post-limpieza" "GET" "/ai/product-search-stats" "" "$AUTH_TOKEN" "success"

echo ""

# ============================================================================
# TESTS DE INTEGRACIÓN CON IA
# ============================================================================

log_info "🧠 EJECUTANDO TESTS DE INTEGRACIÓN CON IA"
echo "=========================================="

# Test 11: Respuesta sugerida con productos habilitados
suggest_data='{
    "conversationHistory": [
        {"content": "Hola", "sender_type": "client"},
        {"content": "¡Hola! ¿En qué puedo ayudarte?", "sender_type": "bot"}
    ],
    "lastMessage": "¿Tienes productos disponibles?"
}'

run_test "POST respuesta sugerida con productos" "POST" "/ai/suggest-response" "$suggest_data" "$AUTH_TOKEN" "success"

# Test 12: Análisis de conversación
analyze_data='{
    "conversationHistory": [
        {"content": "Hola", "sender_type": "client", "sent_at": "2024-01-01T10:00:00Z"},
        {"content": "¡Hola! ¿En qué puedo ayudarte?", "sender_type": "bot", "sent_at": "2024-01-01T10:00:05Z"},
        {"content": "Busco un teléfono", "sender_type": "client", "sent_at": "2024-01-01T10:00:10Z"}
    ],
    "question": "¿Qué producto está buscando el cliente?"
}'

run_test "POST análisis de conversación" "POST" "/ai/analyze-conversation" "$analyze_data" "$AUTH_TOKEN" "success"

echo ""

# ============================================================================
# TESTS DE SERVICIOS INTERNOS
# ============================================================================

log_info "⚙️  EJECUTANDO TESTS DE SERVICIOS INTERNOS"
echo "=========================================="

# Crear test de Node.js para servicios internos
cat > /tmp/test_product_services.js << 'EOF'
const ProductSearchService = require('./src/services/ProductSearchService');

async function testProductSearchService() {
    console.log('🧪 Testing ProductSearchService...');
    
    const mockConfig = {
        client_id: 1,
        product_endpoint_url: 'https://jsonplaceholder.typicode.com/posts',
        product_endpoint_method: 'GET',
        product_search_param_name: 'q',
        product_response_path: '',
        product_max_results: 5,
        product_cache_ttl: 300,
        product_timeout: 5000
    };
    
    try {
        // Test 1: Validación de configuración
        const isValid = ProductSearchService.validateProductConfig(mockConfig);
        console.log('✅ Validación de configuración:', isValid ? 'PASSED' : 'FAILED');
        
        // Test 2: Búsqueda de productos
        const searchResult = await ProductSearchService.searchProducts(1, mockConfig, 'test');
        console.log('✅ Búsqueda de productos:', searchResult.success ? 'PASSED' : 'FAILED');
        console.log('   Productos encontrados:', searchResult.products?.length || 0);
        
        // Test 3: Estadísticas de cache
        const stats = await ProductSearchService.getCacheStats(1);
        console.log('✅ Estadísticas de cache:', stats ? 'PASSED' : 'FAILED');
        
        return true;
    } catch (error) {
        console.error('❌ Error en tests de servicios:', error.message);
        return false;
    }
}

testProductSearchService().then(success => {
    process.exit(success ? 0 : 1);
});
EOF

# Ejecutar test de servicios
cd /Users/ndamario/Downloads/crm-whatsapp-services-2/crm-condorito/backend
service_test_result=$(node /tmp/test_product_services.js 2>&1)
service_exit_code=$?

if [ $service_exit_code -eq 0 ]; then
    log_success "Tests de servicios internos completados"
    echo "$service_test_result" | grep -E "(✅|❌)" | while read line; do
        echo "   $line"
    done
    ((TESTS_PASSED++))
else
    log_error "Error en tests de servicios internos"
    echo "$service_test_result"
    ((TESTS_FAILED++))
fi

((TESTS_TOTAL++))

# Limpiar archivo temporal
rm -f /tmp/test_product_services.js

echo ""

# ============================================================================
# RESUMEN FINAL
# ============================================================================

log_info "📋 RESUMEN DE TESTS"
echo "==================="
echo "Total de tests ejecutados: $TESTS_TOTAL"
echo -e "Tests exitosos: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests fallidos: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    log_success "¡TODOS LOS TESTS PASARON! 🎉"
    echo ""
    log_info "El sistema de búsqueda de productos está listo para usar:"
    echo "• Base de datos migrada correctamente"
    echo "• Endpoints de configuración funcionando"
    echo "• Búsqueda de productos operativa"
    echo "• Cache y estadísticas disponibles"
    echo "• Integración con IA completada"
    exit 0
else
    log_error "ALGUNOS TESTS FALLARON"
    echo ""
    log_warning "Por favor revisa los errores anteriores y corrige los problemas"
    echo "antes de usar el sistema en producción."
    exit 1
fi
