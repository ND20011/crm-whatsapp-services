<?php
require 'Database.php';

// 🚀 Configuración optimizada para performance
ini_set('max_execution_time', 30);
ini_set('memory_limit', '128M');
header('Content-Type: application/json; charset=utf-8');

// Variables de configuración
$GEMINI_API_KEY = 'AIzaSyCecokzafkb6sasd22tvgS_OVrnMg-E7CU';

// 🔍 Función para validar API key
function validateApiKey($apiKey) {
    if (empty($apiKey)) {
        return ['valid' => false, 'reason' => 'API key is empty'];
    }
    if (strlen($apiKey) < 30) {
        return ['valid' => false, 'reason' => 'API key too short'];
    }
    if (!preg_match('/^AIza[a-zA-Z0-9_-]+$/', $apiKey)) {
        return ['valid' => false, 'reason' => 'API key format invalid'];
    }
    return ['valid' => true, 'reason' => 'API key format looks valid'];
}
$CACHE_TTL = 300; // 5 minutos
$MAX_REQUESTS_PER_MINUTE = 30;

// 🛡️ Validación y rate limiting
function validateRequest() {
    global $MAX_REQUESTS_PER_MINUTE;
    
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        die(json_encode(['error' => 'Método de solicitud inválido']));
    }
    
    $clientId = $_GET['userclientid'] ?? '';
    if (empty($clientId) || !preg_match('/^[a-zA-Z0-9_-]+$/', $clientId)) {
        http_response_code(400);
        die(json_encode(['error' => 'userclientid inválido']));
    }
    
    // Rate limiting simple
    $rateLimitFile = sys_get_temp_dir() . "/rate_limit_{$clientId}";
    $currentTime = time();
    
    if (file_exists($rateLimitFile)) {
        $requests = json_decode(file_get_contents($rateLimitFile), true) ?: [];
        $requests = array_filter($requests, function($timestamp) use ($currentTime) {
            return ($currentTime - $timestamp) < 60;
        });
        
        if (count($requests) >= $MAX_REQUESTS_PER_MINUTE) {
            http_response_code(429);
            die(json_encode(['error' => 'Límite de solicitudes excedido']));
        }
        
        $requests[] = $currentTime;
    } else {
        $requests = [$currentTime];
    }
    
    file_put_contents($rateLimitFile, json_encode($requests));
    return $clientId;
}

// 🧠 Detectar si es continuación de conversación
function isConversationContinuation($question, $history) {
    if (!empty($history)) return true;
    
    $patterns = [
        '/^(y|pero|además|también|ahora|después|luego|entonces)/i',
        '/^(sí|si|no|ok|perfecto|gracias|genial)/i',
        '/^(me interesa|quiero|necesito|busco|cuánto)/i',
        '/\b(más|otro|otra|diferentes|opciones|precio|costo)\b/i'
    ];
    
    foreach ($patterns as $pattern) {
        if (preg_match($pattern, trim($question))) return true;
    }
    
    return false;
}

// 💾 Sistema de caché simple
function getCachedResponse($key) {
    global $CACHE_TTL;
    $file = sys_get_temp_dir() . "/ai_cache_" . md5($key);
    
    if (file_exists($file)) {
        $data = json_decode(file_get_contents($file), true);
        if ($data && (time() - $data['time']) < $CACHE_TTL) {
            return $data['response'];
        }
        unlink($file);
    }
    return null;
}

function setCachedResponse($key, $response) {
    $file = sys_get_temp_dir() . "/ai_cache_" . md5($key);
    file_put_contents($file, json_encode(['time' => time(), 'response' => $response]));
}

// 🔄 Función optimizada para llamar a Gemini API
function callGeminiAPI($conversationParts) {
    global $GEMINI_API_KEY;
    
    // Validar API key antes de hacer la llamada
    $keyValidation = validateApiKey($GEMINI_API_KEY);
    if (!$keyValidation['valid']) {
        return [
            'error' => 'Invalid API key',
            'details' => [
                'reason' => $keyValidation['reason'],
                'key_length' => strlen($GEMINI_API_KEY),
                'key_prefix' => substr($GEMINI_API_KEY, 0, 10) . '...'
            ]
        ];
    }
    
    $body = json_encode([
        "contents" => [["parts" => $conversationParts]]
    ], JSON_UNESCAPED_UNICODE);

    $ch = curl_init();
    $url = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" . $GEMINI_API_KEY;
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 25);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_MAXREDIRS, 3);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    $curlInfo = curl_getinfo($ch);
    curl_close($ch);

    if ($response === false) {
        return [
            'error' => 'cURL failed', 
            'details' => [
                'curl_error' => $curlError,
                'url' => substr($url, 0, 100) . '...',
                'body_length' => strlen($body),
                'curl_info' => $curlInfo,
                'body_sent' => $body
            ]
        ];
    }

    if ($httpCode !== 200) {
        // Intentar decodificar la respuesta de error para más detalles
        $errorResponse = json_decode($response, true);
        
        return [
            'error' => 'API HTTP error', 
            'details' => [
                'http_code' => $httpCode,
                'response_raw' => substr($response, 0, 500),
                'response_decoded' => $errorResponse,
                'url' => substr($url, 0, 100) . '...',
                'api_key_used' => substr($GEMINI_API_KEY, 0, 10) . '...',
                'body_sent' => $body,
                'curl_info' => $curlInfo,
                'common_errors' => [
                    '400' => 'Bad Request - Invalid request format',
                    '401' => 'Unauthorized - Invalid API key',
                    '403' => 'Forbidden - API key lacks permissions or quota exceeded',
                    '404' => 'Not Found - Invalid endpoint',
                    '429' => 'Too Many Requests - Rate limit exceeded',
                    '500' => 'Internal Server Error - Google API issue'
                ]
            ]
        ];
    }

    $decodedResponse = json_decode($response, true);
    if (!isset($decodedResponse['candidates'][0]['content']['parts'][0]['text'])) {
        return [
            'error' => 'Invalid API response format', 
            'details' => [
                'response_structure' => $decodedResponse,
                'response_raw' => substr($response, 0, 500)
            ]
        ];
    }

    return ['success' => true, 'text' => $decodedResponse['candidates'][0]['content']['parts'][0]['text']];
}

// 🔍 Función para consultas SQL (mantenida para compatibilidad)
function QueryGeneral($query) {
    try {
        $resultado = Database::getInstance()->getDb()->prepare($query);
        $resultado->execute(array());
        return $resultado->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        return [
            'error' => 'Database error',
            'details' => [
                'message' => $e->getMessage(),
                'code' => $e->getCode(),
                'query' => $query
            ]
        ];
    }
}

// 🛍️ Función COMPLETA para buscar productos (con todas las funcionalidades originales)
function buscarProductos($question) {
    // Primera consulta: Búsqueda general con campos específicos
    $conversationParts = [
        ["text" => "Analiza la siguiente pregunta y genera una consulta SQL para buscar productos en la tabla 'productos'. 
        La consulta debe incluir: name, stock, price, id
        Usa LIKE '%palabra%' para cada término relevante y ordena por relevancia.
        Solo responde con el SQL.
        Ejemplo de formato: SELECT name, stock, price, id FROM productos WHERE ...
    
        Pregunta: " . $question]
    ];

    $initialResponse = callGeminiAPI($conversationParts);
    if (isset($initialResponse['error'])) {
        return [
            'error' => $initialResponse['error'],
            'details' => $initialResponse['details'] ?? 'No additional details',
            'context' => 'Error in initial SQL generation for product search'
        ];
    }

    $sqlText = $initialResponse['text'];
    $cleanedSql = preg_replace('/```sql\\n|```/', '', $sqlText);

    if (!preg_match('/^\s*SELECT\b/i', $cleanedSql)) {
        return ['error' => 'No se pudo generar una consulta SQL válida'];
    }

    $result = QueryGeneral($cleanedSql);
    if (isset($result['error'])) {
        return ['error' => 'Database error in initial search', 'details' => $result['details']];
    }
    if ($result === false || empty($result)) {
        // Búsqueda más amplia con términos relacionados
        $conversationParts = [
            ["text" => "La búsqueda anterior no dio resultados. Genera una consulta SQL más amplia 
            que busque en todos los campos relevantes (name, description, category, brand) 
            usando términos más generales y sinónimos. Pregunta original: " . $question]
        ];

        $broadResponse = callGeminiAPI($conversationParts);
        if (isset($broadResponse['error'])) {
            return [
                'error' => $broadResponse['error'],
                'details' => $broadResponse['details'] ?? 'No additional details',
                'context' => 'Error in broad SQL generation for product search'
            ];
        }

        $broadSql = preg_replace('/```sql\\n|```/', '', $broadResponse['text']);
        $broadResult = QueryGeneral($broadSql);
        
        if (isset($broadResult['error'])) {
            return ['error' => 'Database error in broad search', 'details' => $broadResult['details']];
        }
        if ($broadResult === false || empty($broadResult)) {
            return ['error' => 'No se encontraron productos'];
        }
        
        $result = $broadResult;
    }

    // Refinar resultados con IA y agregar información adicional
    $conversationParts = [
        ["text" => "Analiza estos productos y determina cuáles son más relevantes para la pregunta: '" . $question . "'
        Productos encontrados: " . json_encode($result, JSON_UNESCAPED_UNICODE) . "
        Responde con un JSON que contenga:
        1. Los IDs de los productos más relevantes
        2. Una breve explicación de por qué cada producto es relevante
        3. Sugerencias de productos relacionados o complementarios
        Formato esperado:
        {
            'relevant_ids': [1, 2, 3],
            'explanations': {
                '1': 'Explicación para producto 1',
                '2': 'Explicación para producto 2'
            },
            'related_suggestions': ['Sugerencia 1', 'Sugerencia 2']
        }"]
    ];

    $refinementResponse = callGeminiAPI($conversationParts);
    if (isset($refinementResponse['error'])) {
        return [
            'error' => $refinementResponse['error'],
            'details' => $refinementResponse['details'] ?? 'No additional details',
            'context' => 'Error in product refinement analysis'
        ];
    }

    // Intentar decodificar la respuesta como JSON
    $refinementData = json_decode($refinementResponse['text'], true);
    
    // Si no es un JSON válido, crear una estructura básica con todos los productos
    if (!is_array($refinementData)) {
        $refinementData = [
            'relevant_ids' => array_column($result, 'id'),
            'explanations' => array_combine(
                array_column($result, 'id'),
                array_fill(0, count($result), 'Producto relevante para tu búsqueda')
            ),
            'related_suggestions' => []
        ];
    }

    // Asegurarse de que existan las claves necesarias
    $refinementData['relevant_ids'] = $refinementData['relevant_ids'] ?? array_column($result, 'id');
    $refinementData['explanations'] = $refinementData['explanations'] ?? [];
    $refinementData['related_suggestions'] = $refinementData['related_suggestions'] ?? [];

    // Filtrar resultados por IDs relevantes
    $filteredResults = array_filter($result, function($product) use ($refinementData) {
        return in_array($product['id'], $refinementData['relevant_ids']);
    });

    return [
        'success' => true, 
        'results' => array_values($filteredResults),
        'explanations' => $refinementData['explanations'],
        'related_suggestions' => $refinementData['related_suggestions']
    ];
}

// 🎯 Función principal optimizada
function generateContent($question, $history, $permisoProducto) {
    $clientId = $_GET['userclientid'];
    
    // Generar clave de caché
    $isContinuation = isConversationContinuation($question, $history);
    $cacheKey = $clientId . '|' . md5($question . $permisoProducto . ($isContinuation ? '1' : '0'));
    
    // Verificar caché
    $cached = getCachedResponse($cacheKey);
    if ($cached) return $cached;
    
    // Cargar especificaciones del cliente
    $txtFile = "https://sistema.condorestudio.com.ar/back/img/" . $clientId . "/respuestasEspecificaciones.txt";
    $fileContent = @file_get_contents($txtFile);
    if ($fileContent === false) {
        return json_encode([
            'error' => 'Error loading TXT file', 
            'details' => [
                'file_url' => $txtFile,
                'client_id' => $clientId,
                'error_get_last' => error_get_last()
            ]
        ]);
    }

    $conversationParts = [];
    foreach ($history as $entry) {
        $conversationParts[] = ["text" => $entry['text']];
    }

    // Instrucción para saludos según contexto
    $greetingInstruction = $isContinuation 
        ? "NO incluyas saludos como 'Hola' ya que es continuación de conversación." 
        : "Puedes incluir un saludo breve si es apropiado.";

    if ($permisoProducto == '1') {
        // Primero, determinar si la pregunta es sobre productos
        $conversationParts[] = ["text" => "Analiza si la siguiente pregunta es sobre buscar o consultar productos. 
        Responde solo con 'SI' o 'NO'. Pregunta: " . $question];

        $isProductQuestion = callGeminiAPI($conversationParts);
        if (isset($isProductQuestion['error'])) {
            return json_encode([
                'error' => $isProductQuestion['error'],
                'details' => $isProductQuestion['details'] ?? 'No additional details',
                'context' => 'Error in product question detection'
            ]);
        }

        if (stripos($isProductQuestion['text'], 'SI') !== false) {
            // Buscar productos
            $productSearch = buscarProductos($question);
            if (isset($productSearch['error'])) {
                return json_encode([
                    'error' => $productSearch['error'],
                    'details' => $productSearch['details'] ?? 'No additional details',
                    'context' => 'Error in product search'
                ]);
            }

            // Formatear respuesta final con más detalles (IGUAL QUE EL ORIGINAL)
            $conversationParts = [
                ["text" => "El cliente preguntó: '" . $question . "'. 
                Encontramos los siguientes productos relevantes: " . json_encode($productSearch['results'], JSON_UNESCAPED_UNICODE) . "
                Explicaciones de relevancia: " . json_encode($productSearch['explanations'], JSON_UNESCAPED_UNICODE) . "
                Sugerencias relacionadas: " . json_encode($productSearch['related_suggestions'], JSON_UNESCAPED_UNICODE) . "
                Genera una respuesta concisa y amigable para WhatsApp que incluya:
                1. {$greetingInstruction}
                2. Para cada producto encontrado (máximo 3):
                   - Nombre y precio
                   - Disponibilidad (en stock/no stock)
                   - Una línea con la característica más relevante
                3. Si hay más de 3 productos, mencionar 'Tenemos más opciones disponibles'
                4. Una línea de cierre invitando a consultar más detalles
                IMPORTANTE: Mantén la respuesta breve y fácil de leer en WhatsApp. Usa emojis apropiados."]
            ];

            $finalResponse = callGeminiAPI($conversationParts);
            if (isset($finalResponse['error'])) {
                return json_encode([
                    'error' => $finalResponse['error'],
                    'details' => $finalResponse['details'] ?? 'No additional details',
                    'context' => 'Error in final product response generation'
                ]);
            }

            $result = json_encode([
                'respuesta' => $finalResponse['text'],
                'productos' => $productSearch['results'],
                'sugerencias' => $productSearch['related_suggestions']
            ], JSON_UNESCAPED_UNICODE);
            
            setCachedResponse($cacheKey, $result);
            return $result;
        } else {
            // Si no es una pregunta sobre productos pero tiene permiso
            $currentMessage = "Utiliza las siguientes especificaciones para responder correctamente a las preguntas de los clientes por WhatsApp.
            Responde como si fueras la empresa, de forma concisa y amigable: \n" . $fileContent . "\ 
            Pregunta del cliente: " . $question . "
            IMPORTANTE:
            - {$greetingInstruction}
            - Mantén las respuestas breves y fáciles de leer
            - Estructura la información en puntos cortos
            - No escribas párrafos largos
            - Sé directo y amigable
            - Si la pregunta es sobre precios o disponibilidad general, menciona que pueden consultar nuestro catálogo completo
            - Si es sobre políticas o servicios, sé específico y conciso";

            $conversationParts = [["text" => $currentMessage]];
            $response = callGeminiAPI($conversationParts);
            
            if (isset($response['error'])) {
                return json_encode([
                    'error' => $response['error'],
                    'details' => $response['details'] ?? 'No additional details',
                    'context' => 'Error in non-product response generation'
                ]);
            }

            $result = json_encode(['respuesta' => $response['text']], JSON_UNESCAPED_UNICODE);
            setCachedResponse($cacheKey, $result);
            return $result;
        }
    } else {
        // Si no tiene permiso de productos
        $currentMessage = "Utiliza las siguientes especificaciones para responder correctamente a las preguntas de los clientes por WhatsApp.
        Responde como si fueras la empresa, de forma concisa y amigable: \n" . $fileContent . "\ 
        Pregunta del cliente: " . $question . "
        IMPORTANTE:
        - {$greetingInstruction}
        - Mantén las respuestas breves y fáciles de leer
        - Estructura la información en puntos cortos
        - No escribas párrafos largos
        - Si tenes que dar un Link, proporciona un enlace directo
        - Sé directo y amigable";
    }
    
    $conversationParts[] = ["text" => $currentMessage];
    $response = callGeminiAPI($conversationParts);
    
    if (isset($response['error'])) {
        return json_encode([
            'error' => $response['error'],
            'details' => $response['details'] ?? 'No additional details',
            'context' => 'Error in text-only response generation'
        ]);
    }

    // Post-procesar para remover saludos innecesarios
    $responseText = $response['text'];
    if ($isContinuation) {
        $responseText = preg_replace('/^(¡?Hola!?\s*,?\s*|Buenos días,?\s*|Buenas tardes,?\s*)/i', '', $responseText);
        $responseText = trim($responseText);
    }

    $result = json_encode(['respuesta' => $responseText], JSON_UNESCAPED_UNICODE);
    setCachedResponse($cacheKey, $result);
    return $result;
}

// 🧪 Función de prueba simple para debugging
function testGeminiConnection() {
    global $GEMINI_API_KEY;
    
    $testParts = [["text" => "Hola como estas"]];
    $result = callGeminiAPI($testParts);
    
    return json_encode([
        'test_result' => $result,
        'api_key_length' => strlen($GEMINI_API_KEY),
        'api_key_prefix' => substr($GEMINI_API_KEY, 0, 10) . '...'
    ], JSON_UNESCAPED_UNICODE);
}

// 🎬 INICIO DEL SCRIPT PRINCIPAL
try {
    // Si se pasa el parámetro test=1, ejecutar solo la prueba
    if (isset($_GET['test']) && $_GET['test'] == '1') {
        echo testGeminiConnection();
        exit;
    }
    
    $clientId = validateRequest();
    
    $datos = json_decode(file_get_contents("php://input"), true);
    
    if (!$datos || !isset($datos['question'])) {
        http_response_code(400);
        die(json_encode(['error' => 'No se proporcionó una pregunta']));
    }
    
    $question = trim($datos['question']);
    $history = $datos['history'] ?? [];
    $permisoProducto = $datos['permisoProducto'] ?? 0;
    
    if (empty($question)) {
        http_response_code(400);
        die(json_encode(['error' => 'La pregunta no puede estar vacía']));
    }

    $response = generateContent($question, $history, $permisoProducto);
    echo $response;
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Error interno del servidor',
        'details' => [
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => $e->getTraceAsString()
        ]
    ]);
} catch (Error $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Error fatal del servidor',
        'details' => [
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => $e->getTraceAsString()
        ]
    ]);
}
?>