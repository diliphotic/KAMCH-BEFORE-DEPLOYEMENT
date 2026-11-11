-- ============================================================================
-- KAMCH ERP — Module: Fees Management Database Schema Reconciliation
-- Migration: 019_fees_database_reconciliation_consolidated.sql
-- Engine: InnoDB, Charset: utf8mb4, Collation: utf8mb4_unicode_ci
-- Target: XAMPP MariaDB (10.4+) & MySQL (8.0+)
-- Description:
--   Single consolidated, non-destructive, idempotent migration script that
--   reconciles all fee management tables, columns, constraints, and indexes.
--   Preserves all existing data, users, students, payments, and receipts.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Ensure `schema_migrations` tracking table exists
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `version` VARCHAR(100) NOT NULL PRIMARY KEY,
  `applied_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. `students` Table — Add Hostel/Mess service enrollment indicators
-- ----------------------------------------------------------------------------
ALTER TABLE `students`
  ADD COLUMN IF NOT EXISTS `mess_enrolled` BOOLEAN NOT NULL DEFAULT FALSE AFTER `kea_acknowledgement_no`,
  ADD COLUMN IF NOT EXISTS `hostel_enrolled` BOOLEAN NOT NULL DEFAULT FALSE AFTER `mess_enrolled`;

-- ----------------------------------------------------------------------------
-- 3. `fee_structures` Table — Ensure all component columns and active flag exist
-- ----------------------------------------------------------------------------
ALTER TABLE `fee_structures`
  ADD COLUMN IF NOT EXISTS `college_fee` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER `year_of_study`,
  ADD COLUMN IF NOT EXISTS `development_fee` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER `college_fee`,
  ADD COLUMN IF NOT EXISTS `mess_fee` DECIMAL(12, 2) NOT NULL DEFAULT 30000.00 AFTER `development_fee`,
  ADD COLUMN IF NOT EXISTS `hostel_fee` DECIMAL(12, 2) NOT NULL DEFAULT 30000.00 AFTER `mess_fee`,
  ADD COLUMN IF NOT EXISTS `is_active` BOOLEAN NOT NULL DEFAULT TRUE AFTER `description`;

-- ----------------------------------------------------------------------------
-- 4. `student_fee_assessments` Table — Add component amounts and concessions
-- ----------------------------------------------------------------------------
ALTER TABLE `student_fee_assessments`
  ADD COLUMN IF NOT EXISTS `assessed_mess_fee` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER `assessed_development_fee`,
  ADD COLUMN IF NOT EXISTS `assessed_hostel_fee` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER `assessed_mess_fee`,
  ADD COLUMN IF NOT EXISTS `concession_total` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER `total_assessed_fee`,
  ADD COLUMN IF NOT EXISTS `revised_payable` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER `concession_total`,
  ADD COLUMN IF NOT EXISTS `notes` VARCHAR(255) NULL DEFAULT NULL AFTER `revised_payable`;

-- ----------------------------------------------------------------------------
-- 5. `service_enrollments` Table — Expand status ENUM to include 'TERMINATED'
-- ----------------------------------------------------------------------------
ALTER TABLE `service_enrollments`
  MODIFY COLUMN `status` ENUM('ACTIVE', 'COMPLETED', 'CANCELLED', 'TERMINATED') NOT NULL DEFAULT 'ACTIVE';

-- ----------------------------------------------------------------------------
-- 6. `service_billing_periods` Table — Create table for lifecycle tracking
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `service_billing_periods` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `enrollment_id` INT NOT NULL,
  `student_id` INT NOT NULL,
  `service_type` ENUM('MESS', 'HOSTEL') NOT NULL,
  `period_start_date` DATE NOT NULL,
  `period_end_date` DATE NOT NULL,
  `assessed_amount` DECIMAL(12, 2) NOT NULL DEFAULT 30000.00,
  `status` ENUM('ACTIVE', 'COMPLETED', 'CANCELLED', 'TERMINATED') NOT NULL DEFAULT 'ACTIVE',
  `termination_date` DATE NULL DEFAULT NULL,
  `termination_reason` VARCHAR(255) NULL DEFAULT NULL,
  `terminated_by` INT NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_sbp_enrollment` FOREIGN KEY (`enrollment_id`) REFERENCES `service_enrollments` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_sbp_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_sbp_terminator` FOREIGN KEY (`terminated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_sbp_enrollment` (`enrollment_id`),
  INDEX `idx_sbp_student` (`student_id`),
  INDEX `idx_sbp_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. `fee_collection_groups` Table — Ensure table exists
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `fee_collection_groups` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_id` INT NOT NULL,
  `collection_reference` VARCHAR(64) NOT NULL UNIQUE,
  `total_amount` DECIMAL(12, 2) NOT NULL,
  `payment_method` ENUM('CASH', 'BANK_TRANSFER', 'ONLINE_DEV') NOT NULL DEFAULT 'CASH',
  `status` ENUM('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'REVERSED') NOT NULL DEFAULT 'VERIFIED',
  `recorded_by` INT NOT NULL,
  `verified_by` INT NULL DEFAULT NULL,
  `verified_at` TIMESTAMP NULL DEFAULT NULL,
  `notes` VARCHAR(255) NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_fcg_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_fcg_recorder` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_fcg_verifier` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_fcg_student` (`student_id`),
  INDEX `idx_fcg_status` (`status`),
  INDEX `idx_fcg_date` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 8. `fee_payments` Table — Add `fee_component`, collection grouping & bank verification columns
-- ----------------------------------------------------------------------------
ALTER TABLE `fee_payments`
  ADD COLUMN IF NOT EXISTS `collection_group_id` INT NULL DEFAULT NULL AFTER `assessment_id`,
  ADD COLUMN IF NOT EXISTS `fee_component` ENUM('COLLEGE', 'DEVELOPMENT', 'HOSTEL', 'MESS') NULL DEFAULT NULL AFTER `collection_group_id`,
  ADD COLUMN IF NOT EXISTS `bank_transaction_ref` VARCHAR(100) NULL DEFAULT NULL AFTER `payment_method`,
  ADD COLUMN IF NOT EXISTS `student_tx_ref` VARCHAR(100) NULL DEFAULT NULL AFTER `bank_transaction_ref`,
  ADD COLUMN IF NOT EXISTS `passbook_tx_ref` VARCHAR(100) NULL DEFAULT NULL AFTER `student_tx_ref`,
  ADD COLUMN IF NOT EXISTS `bank_name` VARCHAR(100) NULL DEFAULT NULL AFTER `passbook_tx_ref`,
  ADD COLUMN IF NOT EXISTS `verified_by` INT NULL DEFAULT NULL AFTER `status`,
  ADD COLUMN IF NOT EXISTS `verified_at` TIMESTAMP NULL DEFAULT NULL AFTER `verified_by`,
  ADD COLUMN IF NOT EXISTS `rejection_reason` VARCHAR(255) NULL DEFAULT NULL AFTER `verified_at`,
  ADD COLUMN IF NOT EXISTS `reversal_reason` VARCHAR(255) NULL DEFAULT NULL AFTER `rejection_reason`,
  ADD COLUMN IF NOT EXISTS `reversed_by` INT NULL DEFAULT NULL AFTER `reversal_reason`,
  ADD COLUMN IF NOT EXISTS `reversed_at` TIMESTAMP NULL DEFAULT NULL AFTER `reversed_by`,
  ADD INDEX IF NOT EXISTS `idx_fp_component_status` (`student_id`, `fee_component`, `status`),
  ADD INDEX IF NOT EXISTS `idx_fp_collection_group` (`collection_group_id`);

-- ----------------------------------------------------------------------------
-- 9. `fee_payment_allocations` Table — Ensure table exists & has financial_account & billing_period_id
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `fee_payment_allocations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `payment_id` INT NOT NULL,
  `collection_group_id` INT NULL DEFAULT NULL,
  `student_id` INT NULL DEFAULT NULL,
  `financial_account` ENUM('COLLEGE', 'DEVELOPMENT', 'HOSTEL_MESS') NOT NULL,
  `allocated_amount` DECIMAL(12, 2) NOT NULL,
  `assessment_id` INT NULL DEFAULT NULL,
  `service_enrollment_id` INT NULL DEFAULT NULL,
  `billing_period_id` INT NULL DEFAULT NULL,
  `allocation_status` ENUM('ALLOCATED', 'LEGACY_UNALLOCATED') NOT NULL DEFAULT 'ALLOCATED',
  `notes` VARCHAR(255) NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_fpa_payment` FOREIGN KEY (`payment_id`) REFERENCES `fee_payments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_fpa_group` FOREIGN KEY (`collection_group_id`) REFERENCES `fee_collection_groups` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_fpa_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_fpa_assessment` FOREIGN KEY (`assessment_id`) REFERENCES `student_fee_assessments` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_fpa_payment` (`payment_id`),
  INDEX `idx_fpa_group` (`collection_group_id`),
  INDEX `idx_fpa_account` (`financial_account`),
  INDEX `idx_fpa_student` (`student_id`),
  INDEX `idx_fpa_billing_period` (`billing_period_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `fee_payment_allocations`
  ADD COLUMN IF NOT EXISTS `collection_group_id` INT NULL DEFAULT NULL AFTER `payment_id`,
  ADD COLUMN IF NOT EXISTS `student_id` INT NULL DEFAULT NULL AFTER `collection_group_id`,
  ADD COLUMN IF NOT EXISTS `financial_account` ENUM('COLLEGE', 'DEVELOPMENT', 'HOSTEL_MESS') NOT NULL DEFAULT 'COLLEGE' AFTER `student_id`,
  ADD COLUMN IF NOT EXISTS `service_enrollment_id` INT NULL DEFAULT NULL AFTER `assessment_id`,
  ADD COLUMN IF NOT EXISTS `billing_period_id` INT NULL DEFAULT NULL AFTER `service_enrollment_id`,
  ADD COLUMN IF NOT EXISTS `allocation_status` ENUM('ALLOCATED', 'LEGACY_UNALLOCATED') NOT NULL DEFAULT 'ALLOCATED' AFTER `billing_period_id`,
  ADD COLUMN IF NOT EXISTS `notes` VARCHAR(255) NULL DEFAULT NULL AFTER `allocation_status`,
  ADD INDEX IF NOT EXISTS `idx_fpa_account` (`financial_account`),
  ADD INDEX IF NOT EXISTS `idx_fpa_billing_period` (`billing_period_id`);

-- ----------------------------------------------------------------------------
-- 10. `fee_receipts` Table — Add `printed_at`, `print_count`, `is_combined`
-- ----------------------------------------------------------------------------
ALTER TABLE `fee_receipts`
  MODIFY COLUMN `payment_id` INT NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `collection_group_id` INT NULL DEFAULT NULL AFTER `payment_id`,
  ADD COLUMN IF NOT EXISTS `is_combined` BOOLEAN NOT NULL DEFAULT FALSE AFTER `receipt_type`,
  ADD COLUMN IF NOT EXISTS `printed_at` TIMESTAMP NULL DEFAULT NULL AFTER `status`,
  ADD COLUMN IF NOT EXISTS `print_count` INT NOT NULL DEFAULT 0 AFTER `printed_at`,
  ADD INDEX IF NOT EXISTS `idx_fr_print_status` (`status`, `print_count`),
  ADD INDEX IF NOT EXISTS `idx_fr_collection_group` (`collection_group_id`);

-- ----------------------------------------------------------------------------
-- 11. `academic_year_settings` Table — Institutional Singleton Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `academic_year_settings` (
  `id` INT NOT NULL DEFAULT 1 PRIMARY KEY,
  `commencement_month` INT NOT NULL DEFAULT 11,
  `commencement_day` INT NOT NULL DEFAULT 30,
  `updated_by` INT NULL DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `chk_ays_singleton` CHECK (`id` = 1),
  CONSTRAINT `fk_ays_updater` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Safe non-destructive seed: only insert if no row is present
INSERT IGNORE INTO `academic_year_settings` (`id`, `commencement_month`, `commencement_day`)
VALUES (1, 11, 30);

-- ----------------------------------------------------------------------------
-- 12. Record Migration in `schema_migrations` Table
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO `schema_migrations` (`version`) VALUES
  ('016_fees_three_accounts'),
  ('017_service_billing_periods'),
  ('018_fees_single_component_architecture_v1'),
  ('019_fees_database_reconciliation_consolidated');
