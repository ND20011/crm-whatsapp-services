# CRM Condorito - Frontend Angular

Sistema CRM con integración WhatsApp desarrollado en Angular 17+ con arquitectura escalable y principios SOLID.

## 🚀 Características

- **Autenticación JWT**: Login seguro con código de cliente y contraseña
- **Dashboard Interactivo**: Estadísticas en tiempo real y control del bot
- **Chat WhatsApp**: Interfaz completa para gestionar conversaciones
- **Arquitectura Escalable**: Componentes modulares y servicios reutilizables
- **Responsive Design**: Optimizado para desktop y móvil
- **TypeScript**: Tipado fuerte para mejor mantenibilidad

## 📁 Estructura del Proyecto

```
src/
├── app/
│   ├── core/                    # Servicios y configuración global
│   │   ├── config/             # Configuración de la aplicación
│   │   ├── guards/             # Guards de autenticación
│   │   ├── models/             # Interfaces y tipos TypeScript
│   │   └── services/           # Servicios globales (API, Storage)
│   ├── features/               # Módulos de funcionalidades
│   │   ├── auth/               # Módulo de autenticación
│   │   │   ├── components/     # Componentes de auth
│   │   │   └── services/       # Servicios de auth
│   │   ├── dashboard/          # Módulo del dashboard
│   │   │   ├── components/     # Componentes del dashboard
│   │   │   └── services/       # Servicios del dashboard
│   │   └── chat/               # Módulo del chat
│   │       ├── components/     # Componentes del chat
│   │       └── services/       # Servicios del chat
│   ├── app.config.ts           # Configuración de la aplicación
│   ├── app.routes.ts           # Configuración de rutas
│   └── app.ts                  # Componente raíz
└── styles.scss                 # Estilos globales
```

## 🛠️ Tecnologías Utilizadas

- **Angular 17+**: Framework principal con standalone components
- **TypeScript**: Lenguaje de programación
- **Bootstrap 5**: Framework CSS para UI
- **Font Awesome**: Iconos
- **RxJS**: Programación reactiva
- **SCSS**: Preprocesador CSS

## 📋 Prerrequisitos

- Node.js 18+ 
- npm o yarn
- Angular CLI 17+

## 🚀 Instalación y Configuración

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Configurar la API**:
   - Edita `src/app/core/config/app.config.ts`
   - Cambia `baseUrl` por la URL de tu backend

3. **Ejecutar en desarrollo**:
   ```bash
   npm start
   # o
   ng serve
   ```

4. **Compilar para producción**:
   ```bash
   npm run build
   # o
   ng build --configuration production
   ```

## 🔧 Configuración del Backend

El frontend está configurado para conectarse con el backend en `http://localhost:3000`. 

### Endpoints utilizados:

- **Autenticación**:
  - `POST /api/auth/login` - Iniciar sesión
  - `GET /api/auth/verify` - Verificar token
  - `POST /api/auth/logout` - Cerrar sesión

- **Dashboard**:
  - `GET /api/messages/stats` - Estadísticas de mensajes
  - `GET /api/messages/bot/status` - Estado del bot
  - `POST /api/messages/bot/enable-all` - Activar bot global
  - `POST /api/messages/bot/disable-all` - Desactivar bot global

- **Chat**:
  - `GET /api/messages/conversations` - Lista de conversaciones
  - `GET /api/messages/conversation/:id` - Mensajes de conversación
  - `POST /api/whatsapp/send-message` - Enviar mensaje

## 🎯 Funcionalidades Principales

### 1. Autenticación
- Login con código de cliente y contraseña
- Manejo automático de tokens JWT
- Guards de protección de rutas
- Logout seguro

### 2. Dashboard
- Estadísticas en tiempo real:
  - Total de conversaciones
  - Mensajes sin leer
  - Estado del bot
  - Respuestas del bot
- Control global del bot
- Auto-refresh cada 30 segundos

### 3. Chat
- Lista de conversaciones con búsqueda
- Chat en tiempo real
- Envío de mensajes
- Control individual del bot por conversación
- Indicadores visuales (mensajes no leídos, bot activo)
- Auto-refresh cada 10 segundos

## 🏗️ Arquitectura y Principios SOLID

### Single Responsibility Principle (SRP)
- Cada servicio tiene una responsabilidad específica
- Componentes enfocados en una funcionalidad

### Open/Closed Principle (OCP)
- Servicios extensibles sin modificar código existente
- Interfaces bien definidas para nuevas funcionalidades

### Liskov Substitution Principle (LSP)
- Interfaces consistentes entre servicios
- Implementaciones intercambiables

### Interface Segregation Principle (ISP)
- Interfaces específicas y pequeñas
- Modelos de datos bien definidos

### Dependency Inversion Principle (DIP)
- Inyección de dependencias con Angular
- Servicios desacoplados

## 🎨 Personalización de Estilos

Los estilos están organizados en:

- **Variables CSS**: En `app.scss` para colores y medidas globales
- **Componentes**: Cada componente tiene su archivo `.scss`
- **Bootstrap**: Framework base personalizable
- **Responsive**: Diseño adaptativo para móviles

## 🔒 Seguridad

- Tokens JWT almacenados en localStorage
- Guards de autenticación en todas las rutas protegidas
- Validación de formularios
- Manejo seguro de errores de API

## 📱 Responsive Design

- Diseño mobile-first
- Breakpoints optimizados
- Interfaz adaptativa para tablets y móviles
- Chat optimizado para pantallas pequeñas

## 🚀 Despliegue

### Desarrollo
```bash
ng serve --host 0.0.0.0 --port 4200
```

### Producción
```bash
ng build --configuration production
# Los archivos se generan en dist/frontend2/
```

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Agrega nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.

## 🆘 Soporte

Para soporte técnico o preguntas:
- Crear un issue en el repositorio
- Revisar la documentación del backend
- Verificar la configuración de la API

---

**Desarrollado con ❤️ para CRM Condorito**