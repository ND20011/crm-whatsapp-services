/**
 * Configuración global de la aplicación CRM Condorito
 * Centraliza todas las variables de configuración para facilitar el mantenimiento
 */

export interface AppConfig {
  api: {
    baseUrl: string;
    timeout: number;
    endpoints: {
      auth: {
        login: string;
        verify: string;
        logout: string;
        refresh: string;
      };
      messages: {
        conversations: string;
        conversation: string;
        markAsRead: string;
        search: string;
        send: string;
        stats: string;
        botStatus: string;
        botToggle: string;
        botEnableAll: string;
        botDisableAll: string;
        botEnableConversation: string;
        botDisableConversation: string;
      };
      templates: {
        list: string;
        create: string;
        get: string;
        update: string;
        delete: string;
        preview: string;
        use: string;
        duplicate: string;
        toggle: string;
        categories: string;
        stats: string;
      };
      whatsapp: {
        status: string;
        connect: string;
        disconnect: string;
        forceCleanup: string;
        qr: string;
        sendMessage: string;
        sendImage: string;
        sendDocument: string;
      };
      contacts: {
        list: string;
        create: string;
        update: string;
        delete: string;
        tags: string;
        createTag: string;
        updateTag: string;
        deleteTag: string;
        tagContacts: string;
        assignTags: string;
        removeTag: string;
        import: string;
        export: string;
        template: string;
      };
      scheduledMessages: {
        list: string;
        create: string;
        get: string;
        update: string;
        delete: string;
        pause: string;
        resume: string;
        duplicate: string;
        executions: string;
        recipients: string;
        statistics: string;
        processorStatus: string;
        processorRestart: string;
        processManually: string;
      };
    };
  };
  app: {
    name: string;
    version: string;
    description: string;
  };
  storage: {
    tokenKey: string;
    userKey: string;
    refreshTokenKey: string;
  };
  ui: {
    itemsPerPage: number;
    toastDuration: number;
    debounceTime: number;
    refreshInterval: number;
  };
  files: {
    maxSize: number;
    allowedImageTypes: string[];
    allowedDocumentTypes: string[];
    previewMaxWidth: number;
    previewMaxHeight: number;
  };
}

export const APP_CONFIG: AppConfig = {
  api: {
    baseUrl: (window as any)['env']?.['apiUrl'] || 'https://localhost:3000',
    timeout: 30000,
    endpoints: {
      auth: {
        login: '/api/auth/login',
        verify: '/api/auth/verify',
        logout: '/api/auth/logout',
        refresh: '/api/auth/refresh'
      },
      messages: {
        conversations: '/api/messages/conversations',
        conversation: '/api/messages/conversation/{id}',
        markAsRead: '/api/messages/conversation/{id}/read',
        search: '/api/messages/search',
        send: '/api/messages/send',
        stats: '/api/messages/stats',
        botStatus: '/api/messages/bot/status',
        botToggle: '/api/messages/bot/toggle',
        botEnableAll: '/api/messages/bot/enable-all',
        botDisableAll: '/api/messages/bot/disable-all',
        botEnableConversation: '/api/messages/conversation/{id}/bot/enable',
        botDisableConversation: '/api/messages/conversation/{id}/bot/disable'
      },
      templates: {
        list: '/api/messages/templates',
        create: '/api/messages/templates',
        get: '/api/messages/templates/{id}',
        update: '/api/messages/templates/{id}',
        delete: '/api/messages/templates/{id}',
        preview: '/api/messages/templates/{id}/preview',
        use: '/api/messages/templates/{id}/use',
        duplicate: '/api/messages/templates/duplicate/{id}',
        toggle: '/api/messages/templates/{id}/toggle',
        categories: '/api/messages/templates/categories',
        stats: '/api/messages/templates/stats'
      },
      whatsapp: {
        status: '/api/whatsapp/status',
        connect: '/api/whatsapp/connect',
        disconnect: '/api/whatsapp/disconnect',
        forceCleanup: '/api/whatsapp/force-cleanup',
        qr: '/api/whatsapp/qr',
        sendMessage: '/api/whatsapp/send-message',
        sendImage: '/api/whatsapp/send-image',
        sendDocument: '/api/whatsapp/send-document'
      },
      contacts: {
        list: '/api/contacts',
        create: '/api/contacts',
        update: '/api/contacts/{id}',
        delete: '/api/contacts/{id}',
        tags: '/api/contacts/tags',
        createTag: '/api/contacts/tags',
        updateTag: '/api/contacts/tags/{id}',
        deleteTag: '/api/contacts/tags/{id}',
        tagContacts: '/api/contacts/tags/{id}/contacts',
        assignTags: '/api/contacts/{id}/tags',
        removeTag: '/api/contacts/{id}/tags/{tagId}',
        import: '/api/contacts/import',
        export: '/api/contacts/export',
        template: '/api/contacts/export/template'
      },
      scheduledMessages: {
        list: '/api/scheduled-messages',
        create: '/api/scheduled-messages',
        get: '/api/scheduled-messages/{id}',
        update: '/api/scheduled-messages/{id}',
        delete: '/api/scheduled-messages/{id}',
        pause: '/api/scheduled-messages/{id}/pause',
        resume: '/api/scheduled-messages/{id}/resume',
        duplicate: '/api/scheduled-messages/{id}/duplicate',
        executions: '/api/scheduled-messages/{id}/executions',
        recipients: '/api/scheduled-messages/{id}/recipients/{executionId}',
        statistics: '/api/scheduled-messages/statistics',
        processorStatus: '/api/scheduled-messages/processor/status',
        processorRestart: '/api/scheduled-messages/processor/restart',
        processManually: '/api/scheduled-messages/process'
      }
    }
  },
  app: {
    name: 'CRM Condorito',
    version: '1.0.0',
    description: 'Sistema CRM con integración WhatsApp'
  },
  storage: {
    tokenKey: 'crm_access_token',
    userKey: 'crm_user_data',
    refreshTokenKey: 'crm_refresh_token'
  },
  ui: {
    itemsPerPage: 50,
    toastDuration: 3000,
    debounceTime: 300,
    refreshInterval: 10000
  },
  files: {
    maxSize: 16 * 1024 * 1024, // 16MB en bytes
    allowedImageTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    allowedDocumentTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'application/zip',
      'application/x-rar-compressed'
    ],
    previewMaxWidth: 300,
    previewMaxHeight: 200
  }
};
