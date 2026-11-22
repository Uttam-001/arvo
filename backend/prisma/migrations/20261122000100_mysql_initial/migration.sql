-- Frontdesk Remake: MySQL 8 initial schema + immutable evidence triggers.
CREATE TABLE `agents` (
  `id` VARCHAR(36) NOT NULL, `email` VARCHAR(191) NOT NULL, `name` VARCHAR(120) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL, `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `role` ENUM('SUPPORT_LEAD','SUPPORT_AGENT') NOT NULL DEFAULT 'SUPPORT_AGENT',
  `is_demo` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `agents_email_key`(`email`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sessions` (
  `id` VARCHAR(36) NOT NULL, `token_hash` VARCHAR(64) NOT NULL, `agent_id` VARCHAR(36) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `sessions_token_hash_key`(`token_hash`), INDEX `sessions_agent_id_idx`(`agent_id`),
  INDEX `sessions_expires_at_idx`(`expires_at`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `customers` (
  `id` VARCHAR(36) NOT NULL, `name` VARCHAR(120) NOT NULL, `email` VARCHAR(191) NOT NULL,
  `company` VARCHAR(191) NOT NULL, `phone` VARCHAR(50) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `customers_email_key`(`email`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tickets` (
  `id` VARCHAR(36) NOT NULL, `ticket_number` VARCHAR(40) NOT NULL,
  `customer_name` VARCHAR(120) NOT NULL, `customer_email` VARCHAR(191) NOT NULL,
  `customer_reference` VARCHAR(191) NULL, `customer_id` VARCHAR(36) NULL,
  `customer_token_hash` VARCHAR(64) NOT NULL, `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `priority` ENUM('URGENT','MEDIUM','LOW') NOT NULL DEFAULT 'MEDIUM',
  `status` ENUM('OPEN','IN_PROGRESS','WAITING_ON_CUSTOMER','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
  `assigned_agent_id` VARCHAR(36) NULL, `first_response_at` DATETIME(3) NULL,
  `resolved_at` DATETIME(3) NULL, `closed_at` DATETIME(3) NULL,
  `sla_first_response_due_at` DATETIME(3) NOT NULL,
  `sla_resolution_due_at` DATETIME(3) NOT NULL,
  `sla_paused_at` DATETIME(3) NULL,
  `sla_paused_minutes` INTEGER NOT NULL DEFAULT 0,
  `waiting_since` DATETIME(3) NULL,
  `auto_close_due_at` DATETIME(3) NULL,
  `reopen_until` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `tickets_ticket_number_key`(`ticket_number`),
  INDEX `tickets_status_idx`(`status`), INDEX `tickets_assigned_agent_id_status_idx`(`assigned_agent_id`,`status`),
  INDEX `tickets_sla_first_response_due_at_idx`(`sla_first_response_due_at`),
  INDEX `tickets_sla_resolution_due_at_idx`(`sla_resolution_due_at`),
  INDEX `tickets_auto_close_due_at_idx`(`auto_close_due_at`),
  INDEX `tickets_customer_id_idx`(`customer_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `messages` (
  `id` VARCHAR(36) NOT NULL, `ticket_id` VARCHAR(36) NOT NULL, `author_id` VARCHAR(36) NULL,
  `sender_type` ENUM('AGENT','CUSTOMER','SYSTEM') NOT NULL,
  `visibility` ENUM('PUBLIC','INTERNAL') NOT NULL DEFAULT 'PUBLIC',
  `body` TEXT NOT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `messages_ticket_id_created_at_idx`(`ticket_id`,`created_at`),
  INDEX `messages_ticket_id_visibility_idx`(`ticket_id`,`visibility`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ticket_events` (
  `id` VARCHAR(36) NOT NULL, `ticket_id` VARCHAR(36) NOT NULL,
  `actor_agent_id` VARCHAR(36) NULL, `actor_label` VARCHAR(191) NOT NULL,
  `action` ENUM('TICKET_CREATED','TICKET_CLAIMED','ASSIGNMENT_CHANGED','PRIORITY_CHANGED','STATUS_CHANGED','PUBLIC_REPLY_POSTED','INTERNAL_NOTE_POSTED','CUSTOMER_REPLIED','SLA_PAUSED','SLA_RESUMED','TICKET_RESOLVED','TICKET_REOPENED','TICKET_AUTO_CLOSED') NOT NULL,
  `details` JSON NULL, `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ticket_events_ticket_id_occurred_at_idx`(`ticket_id`,`occurred_at`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ticket_sla_pauses` (
  `id` VARCHAR(36) NOT NULL, `ticket_id` VARCHAR(36) NOT NULL,
  `started_at` DATETIME(3) NOT NULL, `ended_at` DATETIME(3) NULL,
  `reason` VARCHAR(191) NOT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ticket_sla_pauses_ticket_id_started_at_idx`(`ticket_id`,`started_at`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `holidays` (
  `id` VARCHAR(36) NOT NULL, `holiday_date` DATE NOT NULL, `name` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `holidays_holiday_date_key`(`holiday_date`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `sessions` ADD CONSTRAINT `sessions_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_assigned_agent_id_fkey` FOREIGN KEY (`assigned_agent_id`) REFERENCES `agents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `messages` ADD CONSTRAINT `messages_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `messages` ADD CONSTRAINT `messages_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `agents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ticket_events` ADD CONSTRAINT `ticket_events_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ticket_events` ADD CONSTRAINT `ticket_events_actor_agent_id_fkey` FOREIGN KEY (`actor_agent_id`) REFERENCES `agents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ticket_sla_pauses` ADD CONSTRAINT `ticket_sla_pauses_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Single-statement triggers work in Prisma migrate without custom DELIMITER blocks.
CREATE TRIGGER `ticket_events_no_update` BEFORE UPDATE ON `ticket_events` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit event history is immutable';
CREATE TRIGGER `ticket_events_no_delete` BEFORE DELETE ON `ticket_events` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit event history is immutable';
CREATE TRIGGER `messages_no_update` BEFORE UPDATE ON `messages` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Conversation history is immutable';
CREATE TRIGGER `messages_no_delete` BEFORE DELETE ON `messages` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Conversation history is immutable';
