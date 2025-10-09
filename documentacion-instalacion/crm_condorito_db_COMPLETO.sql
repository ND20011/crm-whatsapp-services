-- MySQL dump 10.13  Distrib 9.4.0, for macos14.7 (arm64)
--
-- Host: localhost    Database: crm_condorito_db
-- ------------------------------------------------------
-- Server version	9.4.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `ai_configurations`
--

DROP TABLE IF EXISTS `ai_configurations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ai_configurations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` int NOT NULL,
  `enabled` tinyint(1) DEFAULT '1' COMMENT 'Si la IA está habilitada para este cliente',
  `ai_mode` enum('prompt_only','database_search') COLLATE utf8mb4_unicode_ci DEFAULT 'prompt_only' COMMENT 'Modo de operación de la IA',
  `business_prompt` text COLLATE utf8mb4_unicode_ci COMMENT 'Prompt personalizado con información del negocio',
  `max_tokens` int DEFAULT '500' COMMENT 'Máximo número de tokens en la respuesta',
  `temperature` decimal(3,2) DEFAULT '0.70' COMMENT 'Creatividad de la respuesta (0.0 a 1.0)',
  `max_history_messages` int DEFAULT '10' COMMENT 'Máximo de mensajes de historial a considerar',
  `response_timeout` int DEFAULT '30000' COMMENT 'Timeout en milisegundos para respuesta',
  `fallback_message` text COLLATE utf8mb4_unicode_ci COMMENT 'Mensaje por defecto si falla la IA',
  `working_hours_enabled` tinyint(1) DEFAULT '1' COMMENT 'Si respeta horarios de trabajo',
  `working_hours_start` time DEFAULT '00:00:00' COMMENT 'Hora de inicio de atención',
  `working_hours_end` time DEFAULT '23:59:00' COMMENT 'Hora de fin de atención',
  `working_days` json DEFAULT NULL COMMENT 'Días de la semana activos (0=domingo, 6=sábado)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_client_ai_config` (`client_id`),
  KEY `idx_ai_config_enabled` (`enabled`),
  KEY `idx_ai_config_mode` (`ai_mode`),
  KEY `idx_ai_config_client_enabled` (`client_id`,`enabled`),
  CONSTRAINT `ai_configurations_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Configuraciones de IA personalizadas por cliente';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ai_configurations`
--

LOCK TABLES `ai_configurations` WRITE;
/*!40000 ALTER TABLE `ai_configurations` DISABLE KEYS */;
INSERT INTO `ai_configurations` VALUES (10,1,1,'prompt_only','Condor Estudio: Soluciones de gestión para negocios y PYMES.\n\n¿Quiénes somos?\nDesarrollamos software para optimizar procesos y mejorar eficiencia: inventario, ventas, contabilidad y más. Permitimos a las empresas enfocarse en crecer.\n\nServicios principales:\n- Inventario: control de productos, historial de movimientos, ajustes de stock.  \n- Ventas y facturación: ventas rápidas, lector de códigos, facturación automática, comprobantes y AFIP opcional.  \n- Clientes y proveedores: historial de compras, cuentas corrientes, pagos y remitos.  \n- Finanzas: registro de gastos, reportes, control detallado de transacciones.  \n- Sucursales: sincronización de inventarios, precios y transferencias de stock.  \n- Etiquetas: generación de códigos de barra y góndolas.  \n- Opcionales: módulo de envíos, tienda online, WhatsApp masivo, reportes personalizados.  \n\nBeneficios:  \n- Multimoneda (USD y ARS).  \n- Integración AFIP (opcional).  \n- Listas de precios, control de caja.  \n- Promociones, combos, descuentos y vouchers.  \n\nSistema demo (solo si lo piden):  \n🔗 https://sistema.condorestudio.com.ar/#/login?id=demo  \nUsuario: demo | Contraseña: demo | Código cliente: demo  \n👉 Recomendado ingresar desde computadora.  \n\nIndicaciones para responder:  \n- Siempre amable y profesional en ventas.  \n- Responder corto, solo lo que pregunten, sin agregar extra.  \n- Enviar links una sola vez, en formato claro y fácil de leer.  \n- Incluir link al video de presentación cuando corresponda.  \n',500,0.70,10,30000,'Disculpa, no pude procesar tu mensaje en este momento.',1,'00:00:00','23:59:00','[0, 1, 2, 3, 4, 5, 6]','2025-10-02 00:25:27','2025-10-02 00:44:58'),(11,2,1,'prompt_only','Sos un asistente que responde mensajes de WhatsApp de Test Company SA. \n\nINSTRUCCIONES:\n- Siempre sé amable y profesional\n- Proporciona información útil sobre el negocio\n- Si no sabes algo específico, sugiere contactar directamente\n- Mantén las respuestas concisas pero informativas',500,0.70,10,30000,'Disculpa, no pude procesar tu mensaje en este momento. Por favor intenta de nuevo más tarde.',1,'00:00:00','23:59:00','[0, 1, 2, 3, 4, 5, 6]','2025-10-02 00:25:27','2025-10-02 00:25:27'),(12,4,1,'prompt_only','Habla amablemente como un trabajador ',500,0.70,10,30000,'Disculpa, no pude procesar tu mensaje en este momento.',1,'00:00:00','23:59:00','[0, 1, 2, 3, 4, 5, 6]','2025-10-02 16:29:11','2025-10-02 16:29:11');
/*!40000 ALTER TABLE `ai_configurations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ai_suggestions`
--

DROP TABLE IF EXISTS `ai_suggestions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ai_suggestions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `conversation_id` int NOT NULL,
  `suggested_message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `confidence_score` decimal(3,2) DEFAULT '0.00',
  `context_data` json DEFAULT NULL,
  `used` tinyint(1) DEFAULT '0',
  `used_at` timestamp NULL DEFAULT NULL,
  `feedback` enum('positive','negative','neutral') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_conversation_id` (`conversation_id`),
  KEY `idx_confidence_score` (`confidence_score`),
  KEY `idx_used` (`used`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `ai_suggestions_ibfk_1` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ai_suggestions`
--

LOCK TABLES `ai_suggestions` WRITE;
/*!40000 ALTER TABLE `ai_suggestions` DISABLE KEYS */;
/*!40000 ALTER TABLE `ai_suggestions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bot_configurations`
--

DROP TABLE IF EXISTS `bot_configurations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bot_configurations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` int NOT NULL,
  `is_enabled` tinyint(1) DEFAULT '1',
  `working_hours_start` time DEFAULT '09:00:00',
  `working_hours_end` time DEFAULT '18:00:00',
  `working_days` json DEFAULT NULL,
  `auto_response_delay` int DEFAULT '2000',
  `custom_instructions` text COLLATE utf8mb4_unicode_ci,
  `welcome_message` text COLLATE utf8mb4_unicode_ci,
  `fallback_message` text COLLATE utf8mb4_unicode_ci,
  `max_auto_responses_per_conversation` int DEFAULT '5',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `product_search_enabled` tinyint(1) DEFAULT '0' COMMENT 'Habilita búsqueda de productos (0=solo texto, 1=con productos)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_client_bot_config` (`client_id`),
  KEY `idx_client_id` (`client_id`),
  KEY `idx_is_enabled` (`is_enabled`),
  CONSTRAINT `bot_configurations_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bot_configurations`
--

LOCK TABLES `bot_configurations` WRITE;
/*!40000 ALTER TABLE `bot_configurations` DISABLE KEYS */;
INSERT INTO `bot_configurations` VALUES (1,1,0,'00:00:00','23:59:00','[0, 1, 2, 3, 4, 5, 6]',2000,'Responde de manera amigable y profesional. Siempre ofrece ayuda adicional.','¡Hola! Soy el asistente virtual. ¿En qué puedo ayudarte?','Lo siento, no pude entender tu consulta. Un agente te contactará pronto.',5,'2025-09-05 23:52:49','2025-10-03 21:26:00',1),(2,2,1,'09:00:00','18:00:00','[1, 2, 3, 4, 5]',2000,NULL,'¡Hola! Bienvenido a Test Company SA. ¿En qué podemos ayudarte?','Lo siento, no pude entender tu consulta. Un agente te contactará pronto.',5,'2025-09-05 23:52:49','2025-09-05 23:52:49',0),(3,4,1,'00:00:00','23:59:00','[0, 1, 2, 3, 4, 5, 6]',2000,NULL,'¡Hola! Bienvenido a nahuel. ¿En qué podemos ayudarte?','Lo siento, no pude entender tu consulta. Un agente te contactará pronto.',5,'2025-10-02 16:38:52','2025-10-02 16:38:52',0),(4,5,1,'00:00:00','23:59:00','[0, 1, 2, 3, 4, 5, 6]',2000,NULL,'¡Hola! Bienvenido a Uma gestion. ¿En qué podemos ayudarte?','Lo siento, no pude entender tu consulta. Un agente te contactará pronto.',5,'2025-10-03 18:39:37','2025-10-03 18:39:37',0),(5,3,1,'00:00:00','23:59:00','[0, 1, 2, 3, 4, 5, 6]',2000,NULL,NULL,'Lo siento, no pude entender tu consulta. Un agente te contactará pronto.',5,'2025-10-03 21:50:11','2025-10-03 21:50:11',0);
/*!40000 ALTER TABLE `bot_configurations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bulk_messages`
--

DROP TABLE IF EXISTS `bulk_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bulk_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` int NOT NULL,
  `campaign_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `template_id` int DEFAULT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `scheduled_at` timestamp NULL DEFAULT NULL,
  `status` enum('draft','scheduled','pending','sending','completed','failed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'draft',
  `contact_filter` json DEFAULT NULL,
  `selected_contacts` json DEFAULT NULL,
  `total_contacts` int DEFAULT '0',
  `sent_count` int DEFAULT '0',
  `failed_count` int DEFAULT '0',
  `success_rate` decimal(5,2) DEFAULT '0.00',
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_client_id` (`client_id`),
  KEY `idx_status` (`status`),
  KEY `idx_scheduled_at` (`scheduled_at`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `bulk_messages_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bulk_messages`
--

LOCK TABLES `bulk_messages` WRITE;
/*!40000 ALTER TABLE `bulk_messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `bulk_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `clients`
--

DROP TABLE IF EXISTS `clients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `company_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','inactive','suspended') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `monthly_bot_limit` int DEFAULT '2500' COMMENT 'Límite mensual de respuestas automáticas del bot',
  `current_bot_usage` int DEFAULT '0' COMMENT 'Uso actual del bot en el mes',
  `bot_usage_reset_date` date DEFAULT (date_format(now(),_utf8mb4'%Y-%m-01')) COMMENT 'Fecha de reset del contador mensual',
  `monthly_token_limit` int DEFAULT '100000' COMMENT 'Límite mensual de tokens de IA (input + output)',
  `current_token_usage` int DEFAULT '0' COMMENT 'Uso actual de tokens en el mes',
  `token_usage_reset_date` date DEFAULT (date_format(now(),_utf8mb4'%Y-%m-01')) COMMENT 'Fecha de reset del contador mensual de tokens',
  `code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Código único del cliente',
  PRIMARY KEY (`id`),
  UNIQUE KEY `client_code` (`client_code`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_client_code` (`client_code`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clients`
--

LOCK TABLES `clients` WRITE;
/*!40000 ALTER TABLE `clients` DISABLE KEYS */;
INSERT INTO `clients` VALUES (1,'demo','$2a$12$XjqpV2zF21vDCAsva/Izj.TwSLbJrvdd9jT7UfhkSltIv6tP9P4Wm','Empresa Demo CRM','demo@crm-condorito.com','+5491123456789','active','2025-09-05 23:52:49','2025-10-03 20:09:29',2500,1,'2025-10-03',100000,516,'2025-10-03',NULL),(2,'demo1','$2a$12$SGbTvA2aXNU7iyt.GLaj.e/9ZL8i2U3J33IrXpyN76MQzcUYWDbLO','Test Company SA','test@crm-condorito.com','+5491987654321','active','2025-09-05 23:52:49','2025-10-03 19:32:03',2500,0,'2025-10-03',100000,0,'2025-10-03',NULL),(3,'admin','$2a$12$MU3Rx1fTFUjKDC3f4YdSQOjGaUR0iFocPHaWo5al73m/I1tB00Gfi','Admin','admin@crmcondorito.com','+5491123456789','active','2025-10-02 15:51:46','2025-10-03 19:32:03',999999,0,'2025-10-03',100000,0,'2025-10-03',NULL),(4,'nahuel','$2a$12$nvC1GJe4j77i3oLUGmepA.Qy7ORzFfsrYo6qQdaKIOU4Y3qtNVy5C','nahuel','nahuel@gmail.com','1150239962','active','2025-10-02 16:20:29','2025-10-03 19:32:03',2500,0,'2025-10-03',100000,0,'2025-10-03',NULL),(5,'Tomas','$2a$12$e7TJAHCsAYA/4nnw4veSROalZ/pZTD01lKhGXDLcLtSakr1eVxvki','Uma gestion','Umagestion@gmail.com','','active','2025-10-03 18:39:37','2025-10-03 19:32:03',1000,0,'2025-10-03',10000,0,'2025-10-03',NULL);
/*!40000 ALTER TABLE `clients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `contact_tag_relations`
--

DROP TABLE IF EXISTS `contact_tag_relations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contact_tag_relations` (
  `contact_id` int NOT NULL,
  `tag_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`contact_id`,`tag_id`),
  KEY `idx_contact_id` (`contact_id`),
  KEY `idx_tag_id` (`tag_id`),
  CONSTRAINT `contact_tag_relations_ibfk_1` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `contact_tag_relations_ibfk_2` FOREIGN KEY (`tag_id`) REFERENCES `contact_tags` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contact_tag_relations`
--

LOCK TABLES `contact_tag_relations` WRITE;
/*!40000 ALTER TABLE `contact_tag_relations` DISABLE KEYS */;
INSERT INTO `contact_tag_relations` VALUES (1,26,'2025-10-03 12:22:36'),(1,27,'2025-10-03 12:22:36'),(1,30,'2025-10-03 12:22:36'),(3,5,'2025-09-28 21:26:27'),(15,1,'2025-09-28 14:24:43'),(16,1,'2025-09-28 14:23:53'),(16,5,'2025-09-28 14:23:53'),(16,13,'2025-09-28 14:23:53'),(17,1,'2025-09-28 14:42:01'),(17,5,'2025-09-28 14:42:01'),(18,3,'2025-09-28 14:41:55'),(18,11,'2025-09-28 14:41:55'),(18,12,'2025-09-28 14:41:55'),(22,12,'2025-10-02 02:38:54'),(24,1,'2025-10-03 01:45:49'),(35,5,'2025-10-02 19:44:58');
/*!40000 ALTER TABLE `contact_tag_relations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `contact_tags`
--

DROP TABLE IF EXISTS `contact_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contact_tags` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` int NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT '#007bff',
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `auto_message_template_id` int DEFAULT NULL COMMENT 'ID del template a usar (opcional)',
  `auto_message_delay_hours` decimal(5,2) DEFAULT '24.00' COMMENT 'Horas de retraso para enviar el mensaje (acepta decimales para minutos)',
  `auto_message_content` text COLLATE utf8mb4_unicode_ci COMMENT 'Contenido del mensaje si no usa template',
  `is_active_auto` tinyint(1) DEFAULT '1' COMMENT 'Si el mensaje automático está activo',
  `has_auto_message` tinyint(1) DEFAULT '0' COMMENT 'Si la etiqueta tiene mensaje automático habilitado',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_client_tag` (`client_id`,`name`),
  KEY `idx_client_id` (`client_id`),
  KEY `fk_auto_message_template` (`auto_message_template_id`),
  KEY `idx_contact_tags_auto_message` (`client_id`,`has_auto_message`),
  CONSTRAINT `contact_tags_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_auto_message_template` FOREIGN KEY (`auto_message_template_id`) REFERENCES `message_templates` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contact_tags`
--

LOCK TABLES `contact_tags` WRITE;
/*!40000 ALTER TABLE `contact_tags` DISABLE KEYS */;
INSERT INTO `contact_tags` VALUES (1,1,'Cliente VIP','#007bff','Clientes importantes','2025-09-05 23:52:49','2025-10-03 02:33:53',NULL,2.00,'Hola {{nombre}}, gracias por tu interés. Este es un mensaje automático de prueba.',1,1),(2,1,'Prospecto','#28a745','Cliente potencial','2025-09-05 23:52:49','2025-09-28 21:26:27',NULL,24.00,NULL,1,0),(3,1,'Soporte','#17a2b8','Consultas de soporte técnico','2025-09-05 23:52:49','2025-09-05 23:52:49',NULL,24.00,NULL,1,0),(4,1,'Ventas','#007bff','Contactos relacionados con ventas','2025-09-05 23:52:49','2025-09-05 23:52:49',NULL,24.00,NULL,1,0),(5,1,'Inactivo','#6c757d','Contactos inactivos','2025-09-05 23:52:49','2025-09-05 23:52:49',NULL,24.00,NULL,1,0),(6,2,'Cliente VIP','#28a745','Clientes de alta prioridad','2025-09-05 23:52:49','2025-09-05 23:52:49',NULL,24.00,NULL,1,0),(7,2,'Prospecto','#ffc107','Posibles clientes','2025-09-05 23:52:49','2025-09-05 23:52:49',NULL,24.00,NULL,1,0),(8,2,'Soporte','#17a2b8','Consultas de soporte técnico','2025-09-05 23:52:49','2025-09-05 23:52:49',NULL,24.00,NULL,1,0),(9,2,'Ventas','#007bff','Contactos relacionados con ventas','2025-09-05 23:52:49','2025-09-05 23:52:49',NULL,24.00,NULL,1,0),(10,2,'Inactivo','#6c757d','Contactos inactivos','2025-09-05 23:52:49','2025-09-05 23:52:49',NULL,24.00,NULL,1,0),(11,1,'VIP','#FFD700','Clientes VIP con descuentos especiales','2025-09-09 02:29:48','2025-09-09 02:29:48',NULL,24.00,NULL,1,0),(12,1,'Potencial','#28A745','Clientes potenciales','2025-09-09 02:29:48','2025-09-09 02:29:48',NULL,24.00,NULL,1,0),(13,1,'Frecuente','#007BFF','Clientes que compran frecuentemente','2025-09-09 02:29:48','2025-09-09 02:29:48',NULL,24.00,NULL,1,0),(14,1,'test 1','#29b6f6','test','2025-09-28 15:01:53','2025-09-28 15:01:53',NULL,24.00,NULL,1,0),(16,1,'Urgente','#dc3545','Requiere atención inmediata','2025-09-28 21:26:27','2025-09-28 21:26:27',NULL,24.00,NULL,1,0),(18,1,'test mensaje automatico','#ff6b6b','','2025-10-03 02:45:38','2025-10-03 02:45:38',NULL,24.00,NULL,1,0),(19,1,'ggggggg','#8e24aa','','2025-10-03 03:00:34','2025-10-03 03:00:34',NULL,24.00,NULL,1,0),(20,1,'eeeee','#ffa726','','2025-10-03 03:12:42','2025-10-03 03:12:42',NULL,24.00,NULL,1,0),(21,1,'ttttt','#29b6f6','','2025-10-03 03:14:27','2025-10-03 03:14:27',NULL,5.00,'ffff {nombre}',1,1),(25,1,'ooooo','#8e24aa','','2025-10-03 03:37:24','2025-10-03 03:37:24',NULL,0.00,'hola {{nombre}}',1,1),(26,1,'llllll','#ab47bc','','2025-10-03 03:55:00','2025-10-03 03:55:00',NULL,0.00,'test {NOMBRE_CONTACTO}',1,1),(27,1,'dddd','#96ceb4','','2025-10-03 04:01:57','2025-10-03 04:01:57',NULL,0.00,'uuuuu {NOMBRE_CONTACTO}',1,1),(28,1,'mmmmmmmmmm','#96ceb4','sdfghjklñ','2025-10-03 11:46:49','2025-10-03 11:46:49',NULL,24.00,'sdfghjkl {NOMBRE_CONTACTO}',1,1),(29,1,'test agregar mensaje','#4ecdc4','test agregar mensaje','2025-10-03 12:11:02','2025-10-03 12:11:02',NULL,0.00,'test agregar mensaje{NOMBRE_CONTACTO}',1,1),(30,1,'asdf','#8e24aa','asdf','2025-10-03 12:14:24','2025-10-03 12:15:29',NULL,0.20,'asdf {NOMBRE_CONTACTO}',1,1);
/*!40000 ALTER TABLE `contact_tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `contacts`
--

DROP TABLE IF EXISTS `contacts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contacts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` int NOT NULL,
  `phone_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `custom_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `profile_pic_url` text COLLATE utf8mb4_unicode_ci,
  `comments` text COLLATE utf8mb4_unicode_ci,
  `is_blocked` tinyint(1) DEFAULT '0',
  `last_message_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_client_phone` (`client_id`,`phone_number`),
  KEY `idx_client_id` (`client_id`),
  KEY `idx_phone_number` (`phone_number`),
  KEY `idx_is_blocked` (`is_blocked`),
  KEY `idx_last_message_at` (`last_message_at`),
  CONSTRAINT `contacts_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contacts`
--

LOCK TABLES `contacts` WRITE;
/*!40000 ALTER TABLE `contacts` DISABLE KEYS */;
INSERT INTO `contacts` VALUES (1,1,'5491150239962','Nahuel',NULL,NULL,'test',0,NULL,'2025-09-06 01:48:06','2025-09-28 21:42:47'),(2,1,'status@broadcast','Silvina☺️',NULL,NULL,NULL,0,NULL,'2025-09-06 02:00:42','2025-09-28 21:26:27'),(3,1,'5491127088255','Cóndor Estudio 1',NULL,NULL,NULL,0,NULL,'2025-09-06 02:04:56','2025-10-03 01:13:47'),(4,1,'5491171921728','5491171921728',NULL,NULL,NULL,0,NULL,'2025-09-06 03:35:44','2025-09-06 03:35:44'),(5,1,'5493834267691','5493834267691',NULL,NULL,NULL,0,NULL,'2025-09-07 16:10:48','2025-09-07 16:10:48'),(6,1,'5491132086865','5491132086865',NULL,NULL,NULL,0,NULL,'2025-09-07 16:11:10','2025-09-07 16:11:10'),(7,1,'5491131890541','5491131890541',NULL,NULL,NULL,0,NULL,'2025-09-07 16:11:32','2025-09-07 16:11:32'),(8,1,'5491157380279','5491157380279',NULL,NULL,NULL,0,NULL,'2025-09-07 16:11:45','2025-09-07 16:11:45'),(9,1,'5492215024057','5492215024057',NULL,NULL,NULL,0,NULL,'2025-09-07 16:12:06','2025-09-07 16:12:06'),(10,1,'120363400953373274@g.us','Nahuel',NULL,NULL,NULL,0,NULL,'2025-09-07 16:17:06','2025-09-07 16:17:06'),(11,1,'5491130868237',NULL,NULL,NULL,NULL,0,NULL,'2025-09-07 16:22:07','2025-09-07 16:22:07'),(12,1,'5491131624119','BRANDSHOP',NULL,NULL,NULL,0,NULL,'2025-09-08 18:25:03','2025-09-08 18:25:03'),(13,1,'5493512295823','Ale',NULL,NULL,NULL,0,NULL,'2025-09-08 18:25:03','2025-09-08 18:25:03'),(14,1,'5491158982648','Instinto',NULL,NULL,NULL,0,NULL,'2025-09-08 18:25:04','2025-09-08 18:25:04'),(15,1,'5491154981114','5491154981114',NULL,NULL,NULL,0,NULL,'2025-09-08 18:25:35','2025-09-08 18:25:35'),(16,1,'5491123456789','Juan Pérez','Juancito',NULL,'Cliente VIP desde 2020',0,NULL,'2025-09-09 02:29:48','2025-09-09 02:29:48'),(17,1,'5491987654321','María García','Mari',NULL,'Interesada en productos orgánicos',0,NULL,'2025-09-09 02:29:48','2025-09-09 02:29:48'),(18,1,'5491555111222','Pedro López','Pedrito',NULL,'Cliente frecuente, compra mensualmente',0,NULL,'2025-09-09 02:29:48','2025-09-09 02:29:48'),(22,1,'5491134432203','Martu 🫀',NULL,NULL,NULL,0,NULL,'2025-10-02 02:33:31','2025-10-02 02:33:31'),(23,1,'5491161190246','A F Turnos Y Presupuestos',NULL,NULL,NULL,0,NULL,'2025-10-02 12:22:22','2025-10-02 12:22:22'),(24,1,'5493496529858','Rodrii',NULL,NULL,NULL,0,NULL,'2025-10-02 16:18:36','2025-10-02 16:18:36'),(25,4,'5491127088255','Cóndor Estudio',NULL,NULL,NULL,0,NULL,'2025-10-02 16:23:50','2025-10-02 16:23:50'),(26,4,'5491134432203','Martu 🫀',NULL,NULL,NULL,0,NULL,'2025-10-02 16:37:13','2025-10-02 16:37:13'),(27,1,'5493513459962','ⒸⓁⓄ',NULL,NULL,NULL,0,NULL,'2025-10-02 16:39:30','2025-10-02 16:39:30'),(28,4,'5491130868237','Tomas D´Amario',NULL,NULL,NULL,0,NULL,'2025-10-02 16:43:33','2025-10-02 16:43:33'),(29,4,'5491171290607','Uma gestión',NULL,NULL,NULL,0,NULL,'2025-10-02 16:48:33','2025-10-02 16:48:33'),(30,4,'5491131171507','Ine🩵',NULL,NULL,NULL,0,NULL,'2025-10-02 16:56:18','2025-10-02 16:56:18'),(31,1,'5491136575051','Luciano',NULL,NULL,NULL,0,NULL,'2025-10-02 17:16:50','2025-10-02 17:16:50'),(32,4,'54911664765491427563294','Bauti',NULL,NULL,NULL,0,NULL,'2025-10-02 18:22:39','2025-10-02 18:22:39'),(33,4,'549120363418860425873','Al',NULL,NULL,NULL,0,NULL,'2025-10-02 18:49:10','2025-10-02 18:49:10'),(34,4,'541150239962','541150239962',NULL,NULL,NULL,0,NULL,'2025-10-02 18:56:03','2025-10-02 18:56:03'),(35,1,'5493515501854','Cóndor Estudio',NULL,NULL,NULL,0,NULL,'2025-10-02 19:43:46','2025-10-02 19:43:46'),(36,4,'5491151215645','condor',NULL,NULL,NULL,0,NULL,'2025-10-02 19:44:11','2025-10-02 19:44:11'),(37,1,'5493854022935','Micaela Malano',NULL,NULL,NULL,0,NULL,'2025-10-03 12:16:10','2025-10-03 12:16:10'),(38,1,'5492257602329','Los Chicos 2',NULL,NULL,NULL,0,NULL,'2025-10-03 12:36:43','2025-10-03 13:04:18'),(39,1,'5491158888714','‎Sopla_Escuela',NULL,NULL,NULL,0,NULL,'2025-10-03 14:12:37','2025-10-03 14:12:37'),(40,1,'5491159270496','Pablo Dipri',NULL,NULL,NULL,0,NULL,'2025-10-03 15:08:39','2025-10-03 15:08:39'),(41,1,'5491140436538','Mel ts soluciones',NULL,NULL,NULL,0,NULL,'2025-10-03 17:16:46','2025-10-03 17:19:28'),(42,1,'5491151548838','Cóndor Estudio',NULL,NULL,NULL,0,NULL,'2025-10-03 17:18:06','2025-10-03 17:18:06'),(43,1,'5491150239963','test','test',NULL,NULL,0,NULL,'2025-10-03 17:40:33','2025-10-03 17:40:33'),(44,1,'5492615269898','Laura',NULL,NULL,NULL,0,NULL,'2025-10-03 17:40:39','2025-10-03 17:40:39'),(45,1,'549','name','custom_name',NULL,'comments',0,NULL,'2025-10-03 17:52:37','2025-10-03 17:52:37'),(46,1,'5491150239964','Carlos López','Proveedor',NULL,'Empresa de servicios',0,NULL,'2025-10-03 17:52:37','2025-10-03 17:52:37'),(47,1,'5493874044293','Cóndor Estudio',NULL,NULL,NULL,0,NULL,'2025-10-03 21:33:11','2025-10-03 21:33:11'),(48,1,'5493855953681','Mariano',NULL,NULL,NULL,0,NULL,'2025-10-03 22:09:09','2025-10-03 22:09:09');
/*!40000 ALTER TABLE `contacts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `conversation_group_relations`
--

DROP TABLE IF EXISTS `conversation_group_relations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `conversation_group_relations` (
  `conversation_id` int NOT NULL,
  `group_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`conversation_id`,`group_id`),
  KEY `idx_conversation_id` (`conversation_id`),
  KEY `idx_group_id` (`group_id`),
  CONSTRAINT `conversation_group_relations_ibfk_1` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `conversation_group_relations_ibfk_2` FOREIGN KEY (`group_id`) REFERENCES `conversation_groups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `conversation_group_relations`
--

LOCK TABLES `conversation_group_relations` WRITE;
/*!40000 ALTER TABLE `conversation_group_relations` DISABLE KEYS */;
/*!40000 ALTER TABLE `conversation_group_relations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `conversation_groups`
--

DROP TABLE IF EXISTS `conversation_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `conversation_groups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT '#007bff',
  `description` text COLLATE utf8mb4_unicode_ci,
  `sort_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_client_group` (`client_id`,`name`),
  KEY `idx_client_id` (`client_id`),
  KEY `idx_sort_order` (`sort_order`),
  CONSTRAINT `conversation_groups_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `conversation_groups`
--

LOCK TABLES `conversation_groups` WRITE;
/*!40000 ALTER TABLE `conversation_groups` DISABLE KEYS */;
/*!40000 ALTER TABLE `conversation_groups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `conversations`
--

DROP TABLE IF EXISTS `conversations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `conversations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` int NOT NULL,
  `contact_id` int NOT NULL,
  `contact_phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_message` text COLLATE utf8mb4_unicode_ci,
  `last_message_at` timestamp NULL DEFAULT NULL,
  `unread_count` int DEFAULT '0',
  `is_bot_disabled` tinyint(1) DEFAULT '0',
  `bot_enabled` tinyint(1) DEFAULT '1',
  `is_archived` tinyint(1) DEFAULT '0',
  `is_pinned` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_client_contact` (`client_id`,`contact_id`),
  KEY `idx_client_id` (`client_id`),
  KEY `idx_contact_id` (`contact_id`),
  KEY `idx_last_message_at` (`last_message_at`),
  KEY `idx_unread_count` (`unread_count`),
  KEY `idx_is_bot_disabled` (`is_bot_disabled`),
  KEY `idx_is_archived` (`is_archived`),
  CONSTRAINT `conversations_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `conversations_ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=66 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `conversations`
--

LOCK TABLES `conversations` WRITE;
/*!40000 ALTER TABLE `conversations` DISABLE KEYS */;
INSERT INTO `conversations` VALUES (1,1,1,'5491150239962','Nahuel','Test','2025-10-03 21:34:32',0,0,0,0,0,'2025-09-06 01:48:06','2025-10-03 21:50:27'),(3,1,2,'status@broadcast','Silvina☺️','[image]','2025-09-28 05:58:03',0,0,0,0,0,'2025-09-06 02:00:42','2025-10-03 20:21:13'),(5,1,4,'5491171921728','5491171921728',NULL,'2025-09-06 03:35:44',0,0,0,0,0,'2025-09-06 03:35:44','2025-10-03 20:21:13'),(6,1,5,'5493834267691','5493834267691','[text]','2025-09-07 21:33:58',0,0,0,0,0,'2025-09-07 16:10:48','2025-10-03 20:21:13'),(7,1,6,'5491132086865','5491132086865','[text]','2025-09-07 21:33:58',0,0,0,0,0,'2025-09-07 16:11:10','2025-10-03 20:21:13'),(8,1,7,'5491131890541','5491131890541','[text]','2025-10-03 21:30:55',0,0,0,0,0,'2025-09-07 16:11:32','2025-10-03 21:33:40'),(9,1,8,'5491157380279','5491157380279','[text]','2025-10-03 21:30:55',0,0,0,0,0,'2025-09-07 16:11:45','2025-10-03 21:33:46'),(10,1,9,'5492215024057','5492215024057','[text]','2025-09-07 21:35:05',0,0,0,0,0,'2025-09-07 16:12:06','2025-10-03 20:21:13'),(11,1,10,'120363400953373274@g.us','Nahuel','Hola','2025-10-02 14:54:54',0,0,0,0,0,'2025-09-07 16:17:06','2025-10-03 20:21:13'),(12,1,11,'5491130868237','Tomas D´Amario','Bot: Nuestras principales funciones son:\n\n- **Inventario**: control de productos, historial de movimientos y ajustes de stock.\n- **Ventas y facturación**: ventas rápidas, lector de códigos y facturación automática.\n- **Clientes y proveedores**: historial de compras y cuentas corrientes.\n- **Finanzas**: registro de gastos y reportes.\n- **Sucursales**: sincronización de inventarios y transferencias de stock.\n- **Etiquetas**: generación de códigos de barra y góndolas.\n\nSi necesitas más información sobre alguna función en particular, házmelo saber.','2025-10-02 16:43:59',0,0,0,0,0,'2025-09-07 16:22:07','2025-10-03 20:21:13'),(13,1,12,'5491131624119','BRANDSHOP','Revisamos tu consulta sobre el talle 36.  Aquí te mostramos algunas opciones:\n\n* **Sandalia Hayley Late Talle 36:** $11737  ✅ En stock. ¡Última unidad!\n* **Boost negro Talle 36:** $26137.5 ✅ En stock.  4 unidades disponibles.\n* **Boost beige Talle 36:** $26137.5 ✅ En stock. 5 unidades disponibles.\n\nTenemos más opciones disponibles.  😉  Consultanos para más detalles!','2025-09-08 21:25:14',0,0,0,0,0,'2025-09-08 18:25:03','2025-10-03 20:21:13'),(14,1,13,'5493512295823','Ale','Para facturar a un consumidor final, debes utilizar el tipo de comprobante correspondiente, que normalmente es \"Factura A\" o \"Factura B\" dependiendo de la situación. Si no tienes un CUIT, puedes emitir una \"Factura B\" como consumidor final, que no requiere el CUIT. Asegúrate de seleccionar la opción adecuada en el sistema al momento de emitir la factura. Si continúas con problemas, te sugiero contactar directamente a nuestro soporte técnico para asistencia específica.','2025-10-02 14:41:57',0,0,0,0,0,'2025-09-08 18:25:03','2025-10-03 20:21:13'),(17,1,15,'5491154981114','5491154981114','Disculpa, hubo un problema al procesar tu mensaje. Por favor intenta de nuevo más tarde.','2025-09-08 21:25:41',0,0,0,0,0,'2025-09-08 18:25:35','2025-10-03 20:21:13'),(18,1,22,'5491134432203','Martu 🫀','nop','2025-10-02 05:50:59',0,0,0,0,0,'2025-10-02 02:33:31','2025-10-03 20:21:13'),(19,1,23,'5491161190246','A F Turnos Y Presupuestos','Si obvio, estamos mejorando el sistema a full, así que cualquier sugerencia me avisan','2025-10-02 15:38:50',0,0,0,0,0,'2025-10-02 12:22:22','2025-10-03 20:21:13'),(20,1,24,'5493496529858','Rodrii','Lo estamos evaluando con mis compañeros como agregarlo','2025-10-02 19:14:18',0,0,0,0,0,'2025-10-02 16:18:36','2025-10-03 20:21:13'),(21,4,25,'5491127088255','Cóndor Estudio','Hola','2025-10-02 18:29:37',0,0,0,0,0,'2025-10-02 16:23:50','2025-10-02 18:29:37'),(22,4,26,'5491134432203','Martu 🫀','Vos qué ondi?','2025-10-02 19:08:13',0,0,0,0,0,'2025-10-02 16:37:13','2025-10-03 13:46:15'),(23,1,27,'5493513459962','ⒸⓁⓄ','[audio]','2025-10-02 17:20:11',0,0,0,0,0,'2025-10-02 16:39:30','2025-10-03 20:21:13'),(24,4,28,'5491130868237','Tomas D´Amario','Esa fluidez fue lo más difícil','2025-10-02 18:39:05',0,0,0,0,0,'2025-10-02 16:43:33','2025-10-02 18:42:25'),(25,4,29,'5491171290607','Uma gestión','¡Hola! ¿En qué puedo ayudarte hoy?','2025-10-02 16:48:34',0,0,0,0,0,'2025-10-02 16:48:33','2025-10-02 17:43:36'),(26,4,30,'5491131171507','Ine🩵','Cassette','2025-10-02 18:56:35',1,0,0,0,0,'2025-10-02 16:56:18','2025-10-02 18:56:35'),(27,1,31,'5491136575051','Luciano','https://angeliniiphone.ar/inicio','2025-10-02 17:24:27',0,0,0,0,0,'2025-10-02 17:16:50','2025-10-03 20:21:13'),(28,4,32,'54911664765491427563294','Bauti','“MILLONARIO”','2025-10-02 18:22:38',0,0,1,0,0,'2025-10-02 18:22:39','2025-10-02 18:27:38'),(32,4,33,'549120363418860425873','Al','Buen día, hoy es el CITI y la idea era compensar con una clase online el sábado cierto?','2025-10-02 18:49:10',0,0,1,0,0,'2025-10-02 18:49:10','2025-10-02 18:49:29'),(39,4,34,'541150239962','541150239962','hola','2025-10-02 18:56:03',0,0,0,0,0,'2025-10-02 18:56:03','2025-10-02 18:56:44'),(56,4,36,'5491151215645','condor','Hola, gracias por tu consulta. Para obtener información específica sobre los costos de las plantillas y mensajes programados, te recomendaría que contactes directamente con el servicio al cliente de la empresa. Ellos podrán proporcionarte detalles precisos sobre precios y opciones disponibles. Si necesitas ayuda con algo más, no dudes en decírmelo. ¡Estoy aquí para ayudarte!','2025-10-02 19:44:16',0,0,0,0,0,'2025-10-02 19:44:11','2025-10-02 19:46:10'),(57,1,37,'5493854022935','Micaela Malano','Ahora le veo','2025-10-03 12:27:52',0,0,0,0,0,'2025-10-03 12:16:10','2025-10-03 20:21:13'),(58,1,38,'5492257602329','Los Chicos 2','Querés que te llame y lo veamos ?','2025-10-03 15:19:32',0,0,0,0,0,'2025-10-03 12:36:44','2025-10-03 20:21:13'),(59,1,39,'5491158888714','‎Sopla_Escuela','Hola Coni, un gusto 😊. \n\nSoy Condor Estudio, especializado en soluciones de gestión para negocios y PYMES. Si necesitas información sobre nuestros servicios, estaré encantado de ayudarte. \n\n¿Buscas algo en particular?','2025-10-03 14:12:39',0,0,0,0,0,'2025-10-03 14:12:37','2025-10-03 20:21:13'),(60,1,40,'5491159270496','Pablo Dipri','Ya le reenvié los audios para que lo puedan analizar mil gracias','2025-10-03 15:29:45',0,0,0,0,0,'2025-10-03 15:08:39','2025-10-03 20:21:13'),(61,1,41,'5491140436538','Mel ts soluciones','Gracias','2025-10-03 17:20:23',0,0,0,0,0,'2025-10-03 17:16:46','2025-10-03 20:21:13'),(62,1,42,'5491151548838','Cóndor Estudio','Muchas gracias','2025-10-03 17:18:05',0,0,0,0,0,'2025-10-03 17:18:06','2025-10-03 20:21:13'),(63,1,44,'5492615269898','Laura','Muchas gracias','2025-10-03 19:52:41',0,0,0,0,0,'2025-10-03 17:40:39','2025-10-03 20:21:13'),(64,1,47,'5493874044293','Cóndor Estudio','entiendo que si cargo aquí el iva como impuesto me lo resta de la diferencia de costo - precio= o sea de los 12000 y no me cierra','2025-10-03 22:33:28',2,0,0,0,0,'2025-10-03 21:33:11','2025-10-03 22:33:28'),(65,1,48,'5493855953681','Mariano','te fato tocar terminar','2025-10-03 22:35:05',6,0,0,0,0,'2025-10-03 22:09:09','2025-10-03 22:35:05');
/*!40000 ALTER TABLE `conversations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `message_templates`
--

DROP TABLE IF EXISTS `message_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `message_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `variables` json DEFAULT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'general',
  `is_active` tinyint(1) DEFAULT '1',
  `usage_count` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_client_template` (`client_id`,`name`),
  KEY `idx_client_id` (`client_id`),
  KEY `idx_category` (`category`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `message_templates_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `message_templates`
--

LOCK TABLES `message_templates` WRITE;
/*!40000 ALTER TABLE `message_templates` DISABLE KEYS */;
INSERT INTO `message_templates` VALUES (1,1,'Bienvenida','Hola {nombre}! Bienvenido a {empresa}. ¿En qué podemos ayudarte?','[\"nombre\", \"empresa\"]','saludo',1,0,'2025-09-09 02:29:48','2025-09-09 02:29:48'),(2,1,'Promoción VIP','🎉 ¡Oferta especial para {nombre}! {descuento}% de descuento en {producto}','[\"nombre\", \"descuento\", \"producto\"]','promocion',1,0,'2025-09-09 02:29:48','2025-09-09 02:29:48'),(3,1,'Seguimiento','Hola {nombre}, ¿cómo va tu experiencia con {producto}?','[\"nombre\", \"producto\"]','seguimiento',1,0,'2025-09-09 02:29:48','2025-09-09 02:29:48'),(4,1,'Template de Prueba','Hola {{cliente}}, tu cita está programada para el {{fecha}}.','[]','appointment',1,0,'2025-09-29 01:18:47','2025-09-29 01:18:47'),(5,1,'test nahuela','tests asdasd{{cliente}}','[{\"name\": \"cliente\", \"type\": \"text\", \"required\": true, \"description\": \"Nombre del cliente\", \"default_value\": \"\"}]','undefined',1,0,'2025-09-29 01:23:14','2025-09-29 01:23:14'),(6,4,'test','hola {NOMBRE_CONTACTO} {{var2}}','[{\"name\": \"var2\", \"type\": \"text\", \"description\": \"lo que sea\", \"is_required\": false, \"default_value\": \"\"}]','general',1,0,'2025-10-03 13:46:05','2025-10-03 13:46:05');
/*!40000 ALTER TABLE `message_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `messages`
--

DROP TABLE IF EXISTS `messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `conversation_id` int NOT NULL,
  `message_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sender_type` enum('contact','client','bot') COLLATE utf8mb4_unicode_ci NOT NULL,
  `message_type` enum('text','image','document','audio','video','sticker','location','contact_card') COLLATE utf8mb4_unicode_ci DEFAULT 'text',
  `content` text COLLATE utf8mb4_unicode_ci,
  `media_url` text COLLATE utf8mb4_unicode_ci,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_size` int DEFAULT NULL,
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `from_me` tinyint(1) NOT NULL,
  `is_from_bot` tinyint(1) DEFAULT '0',
  `quoted_message_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sent_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `delivered_at` timestamp NULL DEFAULT NULL,
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `message_id` (`message_id`),
  KEY `idx_conversation_id` (`conversation_id`),
  KEY `idx_message_id` (`message_id`),
  KEY `idx_sender_type` (`sender_type`),
  KEY `idx_message_type` (`message_type`),
  KEY `idx_is_read` (`is_read`),
  KEY `idx_from_me` (`from_me`),
  KEY `idx_is_from_bot` (`is_from_bot`),
  KEY `idx_sent_at` (`sent_at`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=963 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `messages`
--

LOCK TABLES `messages` WRITE;
/*!40000 ALTER TABLE `messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `scheduled_message_executions`
--

DROP TABLE IF EXISTS `scheduled_message_executions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scheduled_message_executions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `scheduled_message_id` int NOT NULL,
  `execution_date` datetime NOT NULL,
  `status` enum('success','error','skipped') COLLATE utf8mb4_unicode_ci NOT NULL,
  `messages_sent` int DEFAULT '0' COMMENT 'Número de mensajes enviados',
  `messages_failed` int DEFAULT '0' COMMENT 'Número de mensajes fallidos',
  `recipients_processed` int DEFAULT '0' COMMENT 'Destinatarios procesados',
  `error_message` text COLLATE utf8mb4_unicode_ci COMMENT 'Mensaje de error si falló',
  `execution_time_ms` int DEFAULT NULL COMMENT 'Tiempo de ejecución en ms',
  `details` json DEFAULT NULL COMMENT 'Detalles adicionales de la ejecución',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_scheduled_message_id` (`scheduled_message_id`),
  KEY `idx_execution_date` (`execution_date`),
  KEY `idx_status` (`status`),
  CONSTRAINT `scheduled_message_executions_ibfk_1` FOREIGN KEY (`scheduled_message_id`) REFERENCES `scheduled_messages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `scheduled_message_executions`
--

LOCK TABLES `scheduled_message_executions` WRITE;
/*!40000 ALTER TABLE `scheduled_message_executions` DISABLE KEYS */;
INSERT INTO `scheduled_message_executions` VALUES (16,23,'2025-10-03 00:40:00','error',0,1,1,NULL,26,'{\"send_type\": \"individual\", \"message_type\": \"text\", \"recipients_count\": 1}','2025-10-03 03:40:00'),(17,24,'2025-10-03 00:42:00','error',0,1,1,NULL,7,'{\"send_type\": \"individual\", \"message_type\": \"text\", \"recipients_count\": 1}','2025-10-03 03:42:00'),(18,25,'2025-10-03 00:45:00','success',1,0,1,NULL,178,'{\"send_type\": \"individual\", \"message_type\": \"text\", \"recipients_count\": 1}','2025-10-03 03:45:00'),(19,26,'2025-10-03 00:56:00','error',0,1,1,NULL,7,'{\"send_type\": \"individual\", \"message_type\": \"text\", \"recipients_count\": 1}','2025-10-03 03:56:00'),(20,27,'2025-10-03 00:59:00','error',0,1,1,NULL,3,'{\"send_type\": \"individual\", \"message_type\": \"text\", \"recipients_count\": 1}','2025-10-03 03:59:00'),(21,28,'2025-10-03 01:03:00','error',0,1,1,NULL,16,'{\"send_type\": \"individual\", \"message_type\": \"text\", \"recipients_count\": 1}','2025-10-03 04:03:00'),(22,29,'2025-10-03 01:12:32','error',0,0,0,'Expression #1 of ORDER BY clause is not in SELECT list, references column \'crm_condorito_db.c.name\' which is not in SELECT list; this is incompatible with DISTINCT',5,NULL,'2025-10-03 04:12:32'),(23,30,'2025-10-03 01:15:00','error',0,0,0,'Expression #1 of ORDER BY clause is not in SELECT list, references column \'crm_condorito_db.c.name\' which is not in SELECT list; this is incompatible with DISTINCT',5,NULL,'2025-10-03 04:15:00'),(24,31,'2025-10-03 01:20:00','error',0,0,0,'Expression #1 of ORDER BY clause is not in SELECT list, references column \'crm_condorito_db.c.name\' which is not in SELECT list; this is incompatible with DISTINCT',4,NULL,'2025-10-03 04:20:00'),(25,33,'2025-10-03 09:05:00','error',0,1,1,NULL,5028,'{\"send_type\": \"bulk_tags\", \"message_type\": \"template\", \"recipients_count\": 1}','2025-10-03 12:05:00'),(26,33,'2025-10-03 09:07:00','error',0,1,1,NULL,5013,'{\"send_type\": \"bulk_tags\", \"message_type\": \"template\", \"recipients_count\": 1}','2025-10-03 12:07:00'),(27,33,'2025-10-03 09:09:00','error',0,1,1,NULL,5027,'{\"send_type\": \"bulk_tags\", \"message_type\": \"template\", \"recipients_count\": 1}','2025-10-03 12:09:00'),(28,33,'2025-10-03 09:09:00','success',1,0,1,NULL,190,'{\"send_type\": \"bulk_tags\", \"message_type\": \"template\", \"recipients_count\": 1}','2025-10-03 12:09:00'),(29,36,'2025-10-03 09:35:00','success',1,0,1,NULL,220,'{\"send_type\": \"individual\", \"message_type\": \"text\", \"recipients_count\": 1}','2025-10-03 12:35:00');
/*!40000 ALTER TABLE `scheduled_message_executions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `scheduled_message_recipients`
--

DROP TABLE IF EXISTS `scheduled_message_recipients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scheduled_message_recipients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `scheduled_message_id` int NOT NULL,
  `execution_id` int DEFAULT NULL,
  `contact_id` int DEFAULT NULL,
  `phone_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','sent','failed','skipped') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `sent_at` datetime DEFAULT NULL,
  `message_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ID del mensaje enviado por WhatsApp',
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `final_message_content` text COLLATE utf8mb4_unicode_ci COMMENT 'Mensaje final después de procesar variables',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_scheduled_message_id` (`scheduled_message_id`),
  KEY `idx_execution_id` (`execution_id`),
  KEY `idx_contact_id` (`contact_id`),
  KEY `idx_phone_number` (`phone_number`),
  KEY `idx_status` (`status`),
  KEY `idx_sent_at` (`sent_at`),
  CONSTRAINT `scheduled_message_recipients_ibfk_1` FOREIGN KEY (`scheduled_message_id`) REFERENCES `scheduled_messages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `scheduled_message_recipients_ibfk_2` FOREIGN KEY (`execution_id`) REFERENCES `scheduled_message_executions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `scheduled_message_recipients_ibfk_3` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `scheduled_message_recipients`
--

LOCK TABLES `scheduled_message_recipients` WRITE;
/*!40000 ALTER TABLE `scheduled_message_recipients` DISABLE KEYS */;
INSERT INTO `scheduled_message_recipients` VALUES (21,23,16,1,'5491150239962','Nahuel','pending',NULL,NULL,NULL,'hola {{nombre}}','2025-10-03 03:40:00'),(22,23,16,1,'5491150239962','Nahuel','failed',NULL,NULL,'Cliente demo no está conectado','hola {{nombre}}','2025-10-03 03:40:00'),(23,24,17,1,'5491150239962','Nahuel','pending',NULL,NULL,NULL,'hola {{nombre}}','2025-10-03 03:42:00'),(24,24,17,1,'5491150239962','Nahuel','failed',NULL,NULL,'Cliente demo no está conectado','hola {{nombre}}','2025-10-03 03:42:00'),(25,25,18,1,'5491150239962','Nahuel','sent','2025-10-03 00:45:00','true_5491150239962@c.us_3EB0642DBFD8E2E4889178',NULL,'hola {{nombre}}','2025-10-03 03:45:00'),(26,26,19,1,'5491150239962','Nahuel','pending',NULL,NULL,NULL,'test Nahuel','2025-10-03 03:56:00'),(27,26,19,1,'5491150239962','Nahuel','failed',NULL,NULL,'Cliente demo no está conectado','test {NOMBRE_CONTACTO}','2025-10-03 03:56:00'),(28,27,20,1,'5491150239962','Nahuel','pending',NULL,NULL,NULL,'test Nahuel','2025-10-03 03:59:00'),(29,27,20,1,'5491150239962','Nahuel','failed',NULL,NULL,'Cliente demo no está conectado','test {NOMBRE_CONTACTO}','2025-10-03 03:59:00'),(30,28,21,1,'5491150239962','Nahuel','pending',NULL,NULL,NULL,'uuuuu Nahuel','2025-10-03 04:03:00'),(31,28,21,1,'5491150239962','Nahuel','failed',NULL,NULL,'Cliente demo no está conectado','uuuuu {NOMBRE_CONTACTO}','2025-10-03 04:03:00'),(32,33,25,1,'5491150239962','Nahuel','pending',NULL,NULL,NULL,'Hola {nombre}! Bienvenido a {empresa}. ¿En qué podemos ayudarte?','2025-10-03 12:05:00'),(33,33,25,1,'5491150239962','Nahuel','failed',NULL,NULL,'Failed to send message after 3 attempts. Last error: Protocol error (Runtime.callFunctionOn): Session closed. Most likely the page has been closed.','Hola {nombre}! Bienvenido a {empresa}. ¿En qué podemos ayudarte?','2025-10-03 12:05:05'),(34,33,26,1,'5491150239962','Nahuel','pending',NULL,NULL,NULL,'Hola {nombre}! Bienvenido a {empresa}. ¿En qué podemos ayudarte?','2025-10-03 12:07:00'),(35,33,26,1,'5491150239962','Nahuel','failed',NULL,NULL,'Failed to send message after 3 attempts. Last error: Protocol error (Runtime.callFunctionOn): Session closed. Most likely the page has been closed.','Hola {nombre}! Bienvenido a {empresa}. ¿En qué podemos ayudarte?','2025-10-03 12:07:05'),(36,33,27,1,'5491150239962','Nahuel','pending',NULL,NULL,NULL,'Hola {nombre}! Bienvenido a {empresa}. ¿En qué podemos ayudarte?','2025-10-03 12:09:00'),(37,33,28,1,'5491150239962','Nahuel','sent','2025-10-03 09:09:00','true_5491150239962@c.us_3EB031E4E31A07631B939C',NULL,'Hola {nombre}! Bienvenido a {empresa}. ¿En qué podemos ayudarte?','2025-10-03 12:09:00'),(38,33,27,1,'5491150239962','Nahuel','failed',NULL,NULL,'Failed to send message after 3 attempts. Last error: Protocol error (Runtime.callFunctionOn): Session closed. Most likely the page has been closed.','Hola {nombre}! Bienvenido a {empresa}. ¿En qué podemos ayudarte?','2025-10-03 12:09:05'),(39,36,29,1,'5491150239962','Nahuel','sent','2025-10-03 09:35:00','true_5491150239962@c.us_3EB02C09D69C57CF9071A7',NULL,'asdf Nahuel','2025-10-03 12:35:00');
/*!40000 ALTER TABLE `scheduled_message_recipients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `scheduled_messages`
--

DROP TABLE IF EXISTS `scheduled_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scheduled_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` int NOT NULL,
  `contact_id` int DEFAULT NULL,
  `template_id` int DEFAULT NULL,
  `content` text COLLATE utf8mb4_unicode_ci,
  `scheduled_at` timestamp NOT NULL,
  `sent_at` timestamp NULL DEFAULT NULL,
  `status` enum('pending','active','paused','completed','cancelled','error') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `is_bulk` tinyint(1) DEFAULT '0',
  `bulk_contacts` json DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_active` tinyint(1) DEFAULT '1' COMMENT 'Si está activo',
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Mensaje Programado' COMMENT 'Nombre descriptivo del mensaje programado',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT 'Descripción opcional',
  `send_type` enum('individual','bulk_tags','bulk_all') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'individual' COMMENT 'Tipo de envío',
  `recipient_phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Teléfono individual',
  `recipient_contact_id` int DEFAULT NULL COMMENT 'ID del contacto individual',
  `target_tag_ids` json DEFAULT NULL COMMENT 'IDs de etiquetas para envío masivo',
  `message_type` enum('text','template') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'text' COMMENT 'Tipo de mensaje',
  `message_content` text COLLATE utf8mb4_unicode_ci COMMENT 'Contenido del mensaje de texto',
  `timezone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'America/Argentina/Buenos_Aires' COMMENT 'Zona horaria',
  `is_recurring` tinyint(1) DEFAULT '0' COMMENT 'Si el mensaje es recurrente',
  `recurrence_type` enum('minutes','hours','days','weeks','months') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Tipo de recurrencia',
  `recurrence_interval` int DEFAULT NULL COMMENT 'Intervalo de recurrencia',
  `recurrence_end_date` datetime DEFAULT NULL COMMENT 'Fecha de fin de recurrencia',
  `max_executions` int DEFAULT NULL COMMENT 'Máximo número de ejecuciones',
  `next_execution` datetime DEFAULT NULL COMMENT 'Próxima ejecución calculada',
  `last_execution` datetime DEFAULT NULL COMMENT 'Última ejecución',
  `execution_count` int DEFAULT '0' COMMENT 'Número de ejecuciones realizadas',
  `success_count` int DEFAULT '0' COMMENT 'Ejecuciones exitosas',
  `error_count` int DEFAULT '0' COMMENT 'Ejecuciones con error',
  `template_variables` json DEFAULT NULL COMMENT 'Variables para el template',
  `source_tag_id` int DEFAULT NULL COMMENT 'ID de la etiqueta que generó el mensaje',
  `source_contact_id` int DEFAULT NULL COMMENT 'ID del contacto para el que se generó',
  `auto_generated` tinyint(1) DEFAULT '0' COMMENT 'Si el mensaje fue generado automáticamente',
  PRIMARY KEY (`id`),
  KEY `idx_client_id` (`client_id`),
  KEY `idx_contact_id` (`contact_id`),
  KEY `idx_scheduled_at` (`scheduled_at`),
  KEY `idx_status` (`status`),
  KEY `idx_is_bulk` (`is_bulk`),
  KEY `idx_next_execution` (`next_execution`),
  KEY `idx_send_type` (`send_type`),
  KEY `idx_is_recurring` (`is_recurring`),
  KEY `idx_message_type` (`message_type`),
  KEY `fk_recipient_contact` (`recipient_contact_id`),
  KEY `fk_template` (`template_id`),
  KEY `idx_scheduled_messages_auto` (`auto_generated`,`source_tag_id`,`status`),
  CONSTRAINT `scheduled_messages_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `scheduled_messages_ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `scheduled_messages_ibfk_3` FOREIGN KEY (`template_id`) REFERENCES `message_templates` (`id`) ON DELETE SET NULL,
  CONSTRAINT `scheduled_messages_ibfk_4` FOREIGN KEY (`recipient_contact_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `scheduled_messages_ibfk_5` FOREIGN KEY (`template_id`) REFERENCES `message_templates` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `scheduled_messages`
--

LOCK TABLES `scheduled_messages` WRITE;
/*!40000 ALTER TABLE `scheduled_messages` DISABLE KEYS */;
INSERT INTO `scheduled_messages` VALUES (19,1,NULL,NULL,NULL,'2025-10-03 08:16:39',NULL,'cancelled',0,NULL,NULL,'2025-10-03 03:16:38','2025-10-03 03:17:33',0,'Auto: ttttt - Nahuel','Mensaje automático generado por etiqueta \"ttttt\"','individual','5491150239962',1,NULL,'text','ffff {nombre}','America/Argentina/Buenos_Aires',0,NULL,NULL,NULL,NULL,'2025-10-03 05:16:39',NULL,0,0,0,NULL,21,1,1),(22,1,NULL,NULL,NULL,'2025-10-03 08:27:32',NULL,'cancelled',0,NULL,NULL,'2025-10-03 03:27:31','2025-10-03 03:27:57',0,'Auto: ttttt - Nahuel','Mensaje automático generado por etiqueta \"ttttt\"','individual','5491150239962',1,NULL,'text','ffff {nombre}','America/Argentina/Buenos_Aires',0,NULL,NULL,NULL,NULL,'2025-10-03 05:27:32',NULL,0,0,0,NULL,21,1,1),(23,1,NULL,NULL,NULL,'2025-10-03 03:39:29',NULL,'completed',0,NULL,NULL,'2025-10-03 03:39:28','2025-10-03 03:40:00',0,'Auto: ooooo - Nahuel','Mensaje automático generado por etiqueta \"ooooo\"','individual','5491150239962',1,NULL,'text','hola {{nombre}}','America/Argentina/Buenos_Aires',0,NULL,NULL,NULL,NULL,'2025-10-03 00:39:29','2025-10-03 00:40:00',1,0,1,NULL,25,1,1),(24,1,NULL,NULL,NULL,'2025-10-03 03:41:34',NULL,'completed',0,NULL,NULL,'2025-10-03 03:41:34','2025-10-03 03:42:00',0,'Auto: ooooo - Nahuel','Mensaje automático generado por etiqueta \"ooooo\"','individual','5491150239962',1,NULL,'text','hola {{nombre}}','America/Argentina/Buenos_Aires',0,NULL,NULL,NULL,NULL,'2025-10-03 00:41:34','2025-10-03 00:42:00',1,0,1,NULL,25,1,1),(25,1,NULL,NULL,NULL,'2025-10-03 03:44:15',NULL,'completed',0,NULL,NULL,'2025-10-03 03:44:14','2025-10-03 03:45:00',0,'Auto: ooooo - Nahuel','Mensaje automático generado por etiqueta \"ooooo\"','individual','5491150239962',1,NULL,'text','hola {{nombre}}','America/Argentina/Buenos_Aires',0,NULL,NULL,NULL,NULL,'2025-10-03 00:44:15','2025-10-03 00:45:00',1,1,0,NULL,25,1,1),(26,1,NULL,NULL,NULL,'2025-10-03 03:55:11',NULL,'completed',0,NULL,NULL,'2025-10-03 03:55:11','2025-10-03 03:56:00',0,'Auto: llllll - Nahuel','Mensaje automático generado por etiqueta \"llllll\"','individual','5491150239962',1,NULL,'text','test {NOMBRE_CONTACTO}','America/Argentina/Buenos_Aires',0,NULL,NULL,NULL,NULL,'2025-10-03 00:55:11','2025-10-03 00:56:00',1,0,1,NULL,26,1,1),(27,1,NULL,NULL,NULL,'2025-10-03 03:58:54',NULL,'completed',0,NULL,NULL,'2025-10-03 03:58:54','2025-10-03 03:59:00',0,'Auto: llllll - Nahuel','Mensaje automático generado por etiqueta \"llllll\"','individual','5491150239962',1,NULL,'text','test {NOMBRE_CONTACTO}','America/Argentina/Buenos_Aires',0,NULL,NULL,NULL,NULL,'2025-10-03 00:58:54','2025-10-03 00:59:00',1,0,1,NULL,26,1,1),(28,1,NULL,NULL,NULL,'2025-10-03 04:02:07',NULL,'completed',0,NULL,NULL,'2025-10-03 04:02:07','2025-10-03 04:03:00',0,'Auto: dddd - Nahuel','Mensaje automático generado por etiqueta \"dddd\"','individual','5491150239962',1,NULL,'text','uuuuu {NOMBRE_CONTACTO}','America/Argentina/Buenos_Aires',0,NULL,NULL,NULL,NULL,'2025-10-03 01:02:07','2025-10-03 01:03:00',1,0,1,NULL,27,1,1),(29,1,NULL,5,'Mensaje con template programado','2025-10-03 04:12:00',NULL,'error',0,NULL,NULL,'2025-10-03 04:10:37','2025-10-03 04:12:32',1,'hhhhhh',NULL,'bulk_tags',NULL,NULL,'[27]','template',NULL,'America/Argentina/Buenos_Aires',1,'minutes',5,'2025-10-04 01:10:00',10,'2025-10-03 01:12:00',NULL,0,0,0,'{}',NULL,NULL,0),(30,1,NULL,5,'Mensaje con template programado','2025-10-03 04:15:00',NULL,'error',0,NULL,NULL,'2025-10-03 04:13:22','2025-10-03 04:15:00',1,'hjk',NULL,'bulk_tags',NULL,NULL,'[27]','template',NULL,'America/Argentina/Buenos_Aires',1,'minutes',2,'2025-10-04 01:13:00',10,'2025-10-03 01:15:00',NULL,0,0,0,'{}',NULL,NULL,0),(31,1,NULL,5,'Mensaje con template programado','2025-10-03 04:20:00',NULL,'error',0,NULL,NULL,'2025-10-03 04:19:28','2025-10-03 04:20:00',1,'nnn',NULL,'bulk_tags',NULL,NULL,'[27]','template',NULL,'America/Argentina/Buenos_Aires',1,'minutes',1,'2025-10-04 01:24:00',10,'2025-10-03 01:20:00',NULL,0,0,0,'{}',NULL,NULL,0),(32,1,NULL,NULL,NULL,'2025-10-04 11:47:10',NULL,'cancelled',0,NULL,NULL,'2025-10-03 11:47:09','2025-10-03 11:47:33',0,'Auto: mmmmmmmmmm - Nahuel','Mensaje automático generado por etiqueta \"mmmmmmmmmm\"','individual','5491150239962',1,NULL,'text','sdfghjkl {NOMBRE_CONTACTO}','America/Argentina/Buenos_Aires',0,NULL,NULL,NULL,NULL,'2025-10-04 08:47:10',NULL,0,0,0,NULL,28,1,1),(33,1,NULL,1,'Mensaje con template programado','2025-10-03 12:05:00',NULL,'paused',0,NULL,NULL,'2025-10-03 12:04:17','2025-10-03 12:09:35',0,'test 4',NULL,'bulk_tags',NULL,NULL,'[27]','template',NULL,'America/Argentina/Buenos_Aires',1,'minutes',1,'2025-10-03 10:04:00',10,'2025-10-03 09:10:05','2025-10-03 09:09:05',3,1,3,'{}',NULL,NULL,0),(35,1,NULL,NULL,NULL,'2025-10-06 21:15:51',NULL,'cancelled',0,NULL,NULL,'2025-10-03 12:15:51','2025-10-03 12:22:27',0,'Auto: asdf - Nahuel','Mensaje automático generado por etiqueta \"asdf\"','individual','5491150239962',1,NULL,'text','asdf {NOMBRE_CONTACTO}','America/Argentina/Buenos_Aires',0,NULL,NULL,NULL,NULL,'2025-10-06 18:15:51',NULL,0,0,0,NULL,30,1,1),(36,1,NULL,NULL,NULL,'2025-10-03 12:34:36',NULL,'completed',0,NULL,NULL,'2025-10-03 12:22:36','2025-10-03 12:35:00',0,'Auto: asdf - Nahuel','Mensaje automático generado por etiqueta \"asdf\"','individual','5491150239962',1,NULL,'text','asdf {NOMBRE_CONTACTO}','America/Argentina/Buenos_Aires',0,NULL,NULL,NULL,NULL,'2025-10-03 09:34:36','2025-10-03 09:35:00',1,1,0,NULL,30,1,1);
/*!40000 ALTER TABLE `scheduled_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `whatsapp_sessions`
--

DROP TABLE IF EXISTS `whatsapp_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `whatsapp_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` int NOT NULL,
  `session_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `session_data` json DEFAULT NULL,
  `qr_code` text COLLATE utf8mb4_unicode_ci,
  `status` enum('connecting','connected','disconnected','error') COLLATE utf8mb4_unicode_ci DEFAULT 'disconnected',
  `connected_at` timestamp NULL DEFAULT NULL,
  `disconnected_at` timestamp NULL DEFAULT NULL,
  `last_activity` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `retry_count` int DEFAULT '0',
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_id` (`session_id`),
  KEY `idx_client_id` (`client_id`),
  KEY `idx_phone_number` (`phone_number`),
  KEY `idx_status` (`status`),
  KEY `idx_last_activity` (`last_activity`),
  CONSTRAINT `whatsapp_sessions_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `whatsapp_sessions`
--

LOCK TABLES `whatsapp_sessions` WRITE;
/*!40000 ALTER TABLE `whatsapp_sessions` DISABLE KEYS */;
INSERT INTO `whatsapp_sessions` VALUES (2,1,'demo','5491127088255',NULL,NULL,'connected','2025-10-03 21:28:58','2025-10-02 04:45:43','2025-10-03 22:34:25',0,NULL,'2025-09-28 22:14:53','2025-10-03 22:34:25'),(3,4,'nahuel','5491150239962',NULL,'data:image/png;base64,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','connecting','2025-10-02 19:44:11','2025-10-02 19:46:00','2025-10-03 15:29:00',0,NULL,'2025-10-02 16:23:10','2025-10-03 15:29:00');
/*!40000 ALTER TABLE `whatsapp_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'crm_condorito_db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-03 20:45:43
