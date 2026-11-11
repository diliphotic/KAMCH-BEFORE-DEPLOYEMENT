-- ============================================================================
-- KAMCH ERP — Fees Management Upgrade Stage 1 Migration
-- Reference SQL Migration File: fees_v3_stage1.sql
-- Description: Creates fee_collection_groups, service_billing_periods, and
--              fee_payment_allocations tables, and adds collection_group_id to
--              fee_payments and fee_receipts for multi-account collection groups.
-- ============================================================================

-- 1. Create Logical Collection Groups Table
CREATE TABLE IF NOT EXISTS `fee_collection_groups` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_id` INT NOT NULL,
  `receipt_number` VARCHAR(50) NOT NULL UNIQUE,
  `total_amount` DECIMAL(12, 2) NOT NULL,
  `payment_date` DATE NOT NULL,
  `recorded_by` INT NOT NULL,
  `notes` VARCHAR(255) NULL,
  `status` ENUM('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'REVERSED') NOT NULL DEFAULT 'VERIFIED',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_fcg_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_fcg_recorder` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_fcg_student` (`student_id`),
  INDEX `idx_fcg_receipt` (`receipt_number`),
  INDEX `idx_fcg_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create Service Billing Periods Table (Hostel/Mess Anniversary Billing)
CREATE TABLE IF NOT EXISTS `service_billing_periods` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `enrollment_id` INT NOT NULL,
  `student_id` INT NOT NULL,
  `service_type` ENUM('HOSTEL', 'MESS') NOT NULL,
  `period_start_date` DATE NOT NULL,
  `period_end_date` DATE NOT NULL,
  `assessed_amount` DECIMAL(12, 2) NOT NULL,
  `status` ENUM('ACTIVE', 'COMPLETED', 'TERMINATED') NOT NULL DEFAULT 'ACTIVE',
  `termination_date` DATE NULL,
  `termination_reason` VARCHAR(255) NULL,
  `terminated_by` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_sbp_enrollment` FOREIGN KEY (`enrollment_id`) REFERENCES `service_enrollments` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_sbp_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_sbp_terminator` FOREIGN KEY (`terminated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  UNIQUE KEY `uq_enrollment_period` (`enrollment_id`, `period_start_date`),
  INDEX `idx_sbp_student_service` (`student_id`, `service_type`),
  INDEX `idx_sbp_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create Multi-Account Payment Allocations Table
CREATE TABLE IF NOT EXISTS `fee_payment_allocations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `payment_id` INT NOT NULL,
  `account_type` ENUM('COLLEGE', 'DEVELOPMENT', 'HOSTEL_MESS') NOT NULL,
  `allocated_amount` DECIMAL(12, 2) NOT NULL,
  `assessment_id` INT NULL DEFAULT NULL,
  `billing_period_id` INT NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_fpa_payment` FOREIGN KEY (`payment_id`) REFERENCES `fee_payments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_fpa_assessment` FOREIGN KEY (`assessment_id`) REFERENCES `student_fee_assessments` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_fpa_billing_period` FOREIGN KEY (`billing_period_id`) REFERENCES `service_billing_periods` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_fpa_payment` (`payment_id`),
  INDEX `idx_fpa_account` (`account_type`),
  INDEX `idx_fpa_assessment` (`assessment_id`),
  INDEX `idx_fpa_billing_period` (`billing_period_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Add collection_group_id to fee_payments
ALTER TABLE `fee_payments`
  ADD COLUMN IF NOT EXISTS `collection_group_id` INT NULL DEFAULT NULL AFTER `student_id`;

-- 5. Modify fee_receipts to support collection_group_id alongside payment_id
ALTER TABLE `fee_receipts`
  MODIFY COLUMN `payment_id` INT NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `collection_group_id` INT NULL DEFAULT NULL AFTER `payment_id`;

-- 6. Add Indexes & Foreign Keys
ALTER TABLE `fee_payments`
  ADD INDEX IF NOT EXISTS `idx_fp_collection_group` (`collection_group_id`);

ALTER TABLE `fee_receipts`
  ADD UNIQUE INDEX IF NOT EXISTS `uq_fr_collection_group` (`collection_group_id`);
