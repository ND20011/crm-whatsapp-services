/**
 * Modelos de datos para la API del CRM Condorito
 * Define las interfaces para tipado fuerte en TypeScript
 */

import { ContactTag } from '../../features/contacts/models/contact.models';

// ============================================================================
// AUTH MODELS
// ============================================================================

export interface LoginRequest {
  client_code: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  client: User;
  isAdmin?: boolean;
  redirectTo?: string;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
  };
  stats?: {
    totalContacts: number;
    totalConversations: number;
    totalMessages: number;
    botMessages: string;
    manualMessages: string;
    totalTemplates: number;
  };
}

export interface User {
  id: number;
  client_code: string;
  company_name: string;
  email?: string;
  phone?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// MESSAGE MODELS
// ============================================================================

export interface Conversation {
  id: number;
  client_id: number;
  contact_phone: string;
  contact_name?: string;
  last_message: string | null;
  last_message_at: string;
  unread_count: number;
  is_archived: boolean;
  is_pinned: boolean;
  bot_enabled: number; // 0 or 1
  created_at: string;
  updated_at: string;
  total_messages: number;
  unread_messages: string;
  contact_tags?: ContactTag[]; // Etiquetas del contacto asociado
}

export interface Message {
  id: number;
  conversation_id: number;
  message_id: string;
  sender_type: 'client' | 'contact' | 'bot';
  from_me: number; // 0 or 1
  is_from_bot: boolean | number;
  content: string;
  message_type: 'text' | 'image' | 'document' | 'audio' | 'video';
  media_url: string | null;
  file_name: string | null;
  media_mimetype: string | null;
  media_size: number | null;
  quoted_message_id: string | null;
  is_read: number; // 0 or 1
  read_at: string | null;
  sent_at: string;
  delivered_at: string | null;
  created_at: string;
  updated_at: string | null;
  contact_phone: string;
  contact_name: string;
}

// Response interfaces
export interface ConversationsResponse {
  success: boolean;
  conversations: Conversation[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface MessagesResponse {
  success: boolean;
  messages: Message[];
  conversation_id: number;
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface SearchMessagesResponse {
  success: boolean;
  messages: Message[];
  search_term: string;
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface MarkAsReadResponse {
  success: boolean;
  message: string;
  conversation_id: number;
}

export interface SendMessageRequest {
  to: string;
  message: string;
  isBot?: boolean;
}

export interface SendImageRequest {
  to: string;
  caption?: string;
  image: File;
}

export interface SendDocumentRequest {
  to: string;
  filename?: string;
  document: File;
}

export interface SendMessageResponse {
  success: boolean;
  message: string;
  messageId?: string;
  timestamp?: string;
  to?: string;
  type?: 'text' | 'image' | 'document';
}

export interface FileUploadProgress {
  file: File;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
  preview?: string; // Para imágenes
}

export interface ChatFile {
  file: File;
  type: 'image' | 'document';
  preview?: string;
  size: string;
  name: string;
}

// ============================================================================
// STATS MODELS
// ============================================================================

export interface MessageStats {
  total_messages: number;
  manual_messages: string;
  bot_messages: string;
  received_messages: string;
  active_conversations: number;
  unread_messages: string;
  period_hours: number;
}

export interface BotStatus {
  total_conversations: number;
  bot_enabled_conversations: string;
  bot_disabled_conversations: string;
  bot_enabled_percentage: string;
  client_id: number;
}

// Respuestas del backend
export interface MessageStatsResponse {
  success: boolean;
  stats: MessageStats;
}

export interface BotStatusResponse {
  success: boolean;
  bot_status: BotStatus;
}

// ============================================================================
// WHATSAPP MODELS
// ============================================================================

// Tipos de estado de WhatsApp
export type WhatsAppConnectionStatus = 
  | 'not_initialized' 
  | 'initializing' 
  | 'connecting'
  | 'connected' 
  | 'disconnected'
  | 'error';

// Sesión de WhatsApp
export interface WhatsAppSession {
  session_id: string;
  phone_number: string;
  status: string;
  connected_at: string;
  last_activity: string;
  is_active: boolean;
  is_connecting: boolean;
}

// Estadísticas de WhatsApp
export interface WhatsAppStats {
  session_id: string;
  phone_number: string;
  status: string;
  connected_at: string;
  last_activity: string;
  total_conversations: number;
  total_messages: number;
  manual_messages: string;
  bot_messages: string;
  received_messages: string;
}

// Información del cliente WhatsApp
export interface WhatsAppClientInfo {
  pushname: string;
  platform: string;
}

// Respuesta del endpoint /api/whatsapp/status
export interface WhatsAppStatusResponse {
  success: boolean;
  status: WhatsAppConnectionStatus;
  connected: boolean;
  hasQR: boolean;
  session?: WhatsAppSession;
  stats?: WhatsAppStats;
  message?: string;
}

// Respuesta del endpoint /api/whatsapp/connect
export interface WhatsAppConnectResponse {
  success: boolean;
  message: string;
  status: WhatsAppConnectionStatus;
  phoneNumber?: string | null;
  hasQR?: boolean;
  clientInfo?: WhatsAppClientInfo;
}

// Para el QR (endpoint retorna blob de imagen)
export interface WhatsAppQRResponse {
  qrImage: Blob;
  timestamp: Date;
}

// Estado consolidado de WhatsApp para el frontend
export interface WhatsAppState {
  status: WhatsAppConnectionStatus;
  connected: boolean;
  phoneNumber?: string;
  clientInfo?: WhatsAppClientInfo;
  session?: WhatsAppSession;
  stats?: WhatsAppStats;
  lastUpdated: Date;
  isLoading: boolean;
  error?: string;
}

// ============================================================================
// GENERIC API MODELS
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
  search?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

// ============================================================================
// ERROR MODELS
// ============================================================================

export interface ApiError {
  success: false;
  message: string;
  errors?: string[];
  code?: string;
}
