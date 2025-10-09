# Solución a los Errores 429 (Too Many Requests)

## Problema Identificado

El dashboard estaba generando errores `429 (Too Many Requests)` debido a que hacía múltiples llamadas simultáneas a la API cuando se cargaba, excediendo los límites de rate limiting configurados en el backend.

### Errores específicos encontrados:
- `GET http://localhost:3000/api/contacts 429 (Too Many Requests)`
- `GET http://localhost:3000/api/messages/conversations 429 (Too Many Requests)`
- `GET http://localhost:3000/api/messages/whatsapp/status/public 429 (Too Many Requests)`
- `GET http://localhost:3000/api/messages/bot/status/public 429 (Too Many Requests)`
- `GET http://localhost:3000/api/messages/bot/quota/public 429 (Too Many Requests)`
- `GET http://localhost:3000/api/messages/templates 429 (Too Many Requests)`

## Causas Identificadas

1. **Rate limiting global muy restrictivo**: 100 requests por 15 minutos por IP
2. **Múltiples llamadas simultáneas**: El dashboard hacía 7 llamadas API simultáneas al cargar
3. **Sin cache**: No había mecanismo de cache para evitar llamadas redundantes

## Soluciones Implementadas

### 1. Backend: Ajuste del Rate Limiting Global

**Archivo**: `/backend/src/app.js`

```javascript
// Rate Limiting mejorado
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: process.env.NODE_ENV === 'production' ? 500 : 1000, // Más requests en desarrollo
    message: {
        error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo en 15 minutos.'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
```

**Cambios**:
- ✅ Aumentó límite de 100 a 1000 requests en desarrollo
- ✅ Aumentó límite de 100 a 500 requests en producción
- ✅ Añadió headers estándar para información de rate limiting

### 2. Frontend: Sistema de Cache en Dashboard Service

**Archivo**: `/frontend/src/app/core/services/dashboard.service.ts`

```typescript
// Cache para reducir llamadas a la API
private cache = new Map<string, { data: any, timestamp: number }>();
private readonly CACHE_DURATION = 30000; // 30 segundos

// Métodos de cache implementados
private getCachedData<T>(key: string): T | null
private setCachedData(key: string, data: any): void
private requestWithCache<T>(key: string, httpRequest: Observable<T>): Observable<T>
```

**Beneficios**:
- ✅ Cache de 30 segundos para todas las respuestas
- ✅ Evita llamadas redundantes a la API
- ✅ Mejora la experiencia del usuario

### 3. Frontend: Carga Secuencial con Delays

**Archivo**: `/frontend/src/app/core/services/dashboard.service.ts`

```typescript
// Requests secuenciales con delays para evitar rate limiting
getDashboardStats(): Observable<DashboardResponse> {
    return of(null).pipe(
        // Primero contactos
        concatMap(() => /* contactos con delay 100ms */),
        // Luego templates  
        concatMap(() => /* templates con delay 100ms */),
        // Finalmente conversaciones
        concatMap(() => /* conversaciones con delay 100ms */)
    );
}
```

**Archivo**: `/frontend/src/app/features/dashboard/dashboard.component.ts`

```typescript
// Carga secuencial en lugar de simultánea
// 1. Stats principales (inmediato)
// 2. Actividad reciente (delay 200ms)  
// 3. Estados del bot y WhatsApp (delay 400ms)
```

**Beneficios**:
- ✅ Reduce picos de requests simultáneos
- ✅ Distribuye la carga en el tiempo
- ✅ Mantiene la funcionalidad completa

### 4. Frontend: Optimización de Métodos de Estado

Todos los métodos de estado del bot y WhatsApp ahora usan cache:

```typescript
getBotStatus(): Observable<ApiResponse> {
    return this.requestWithCache('bot_status', /* HTTP request */);
}

getBotQuota(): Observable<ApiResponse> {
    return this.requestWithCache('bot_quota', /* HTTP request */);
}

getWhatsAppStatus(): Observable<ApiResponse> {
    return this.requestWithCache('whatsapp_status', /* HTTP request */);
}
```

## Resultados Esperados

1. **Eliminación de errores 429**: No más "Too Many Requests"
2. **Mejor performance**: Cache reduce llamadas innecesarias
3. **Carga más suave**: Requests distribuidos en el tiempo
4. **Mejor experiencia**: Loading más gradual y estable

## Configuración Flexible

- **Desarrollo**: 1000 requests por 15 minutos (muy permisivo)
- **Producción**: 500 requests por 15 minutos (balanceado)
- **Cache**: 30 segundos (configurable en `CACHE_DURATION`)
- **Delays**: 100-400ms entre requests (configurable)

## Próximos Pasos

Para probar los cambios:

1. **Reiniciar backend**:
   ```bash
   cd backend
   npm start
   ```

2. **Reiniciar frontend**:
   ```bash
   cd frontend  
   npm start
   ```

3. **Verificar en navegador**:
   - Abrir DevTools > Network
   - Navegar al dashboard
   - Verificar que no aparezcan errores 429
   - Observar el patrón de carga secuencial

## Monitoreo

Los logs del navegador mostrarán:
- `📦 DashboardService: Usando datos en cache para {key}` (cuando usa cache)
- `📊 Dashboard secondary data loaded` (carga secuencial funcionando)
- Ausencia de errores 429 en la consola

La implementación es retrocompatible y no requiere cambios en la base de datos ni en otros componentes.
