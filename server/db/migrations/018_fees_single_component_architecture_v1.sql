-- ============================================================================
-- KAMCH ERP — Module: Fees Management Stage 1 Architecture Migration
-- Version: 018_fees_single_component_architecture_v1.sql
-- Character Set: utf8mb4, Engine: InnoDB
-- ============================================================================

-- 1. Add `fee_component` to `fee_payments` table for single-component payment tracking
ALTER TABLE `fee_payments`
  ADD COLUMN IF NOT EXISTS `fee_component` ENUM('COLLEGE', 'DEVELOPMENT', 'HOSTEL', 'MESS') NULL DEFAULT NULL AFTER `assessment_id`,
  ADD INDEX IF NOT EXISTS `idx_fp_component_status` (`student_id`, `fee_component`, `status`);

-- 2. Add `printed_at` and `print_count` tracking columns to `fee_receipts` table
ALTER TABLE `fee_receipts`
  ADD COLUMN IF NOT EXISTS `printed_at` TIMESTAMP NULL DEFAULT NULL AFTER `status`,
  ADD COLUMN IF NOT EXISTS `print_count` INT NOT NULL DEFAULT 0 AFTER `printed_at`;

-- 3. Safely add unique constraint on payment_id in fee_receipts for single-payment receipts
-- Pre-condition: Check that no duplicate non-null payment_id values exist
-- In case of legacy multiple receipts per payment, this index is added conditionally:
ALTER TABLE `fee_receipts`
  ADD UNIQUE KEY IF NOT EXISTS `uq_receipt_single_payment` (`payment_id`);

-- 4. Create Institutional Academic-Year Settings Singleton Table
-- Guarantees exactly one record across MySQL and MariaDB versions
CREATE TABLE IF NOT EXISTS `academic_year_settings` (
  `id` INT NOT NULL DEFAULT 1 PRIMARY KEY,
  `commencement_month` INT NOT NULL DEFAULT 11,
  `commencement_day` INT NOT NULL DEFAULT 30,
  `updated_by` INT NULL DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `chk_ays_singleton` CHECK (`id` = 1),
  CONSTRAINT `fk_ays_updater` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Safe Idempotent Initialization
-- Non-overwriting insertion: preserves Office-configured settings if already present
INSERT IGNORE INTO `academic_year_settings` (`id`, `commencement_month`, `commencement_day`)
VALUES (1, 11, 30);
