-- ============================================================================
-- KAMCH ERP — Module: Fees Management Three-Account Model Extensions
-- Version: fees_v3_three_account_collections
-- Character Set: utf8mb4, Engine: InnoDB
-- ============================================================================

-- 1. Create fee_collection_groups table
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

-- 2. Create fee_payment_allocations table
CREATE TABLE IF NOT EXISTS `fee_payment_allocations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `payment_id` INT NOT NULL,
  `collection_group_id` INT NULL DEFAULT NULL,
  `student_id` INT NOT NULL,
  `financial_account` ENUM('COLLEGE', 'DEVELOPMENT', 'HOSTEL_MESS') NOT NULL,
  `allocated_amount` DECIMAL(12, 2) NOT NULL,
  `assessment_id` INT NULL DEFAULT NULL,
  `service_enrollment_id` INT NULL DEFAULT NULL,
  `allocation_status` ENUM('ALLOCATED', 'LEGACY_UNALLOCATED') NOT NULL DEFAULT 'ALLOCATED',
  `notes` VARCHAR(255) NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_fpa_payment` FOREIGN KEY (`payment_id`) REFERENCES `fee_payments` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_fpa_group` FOREIGN KEY (`collection_group_id`) REFERENCES `fee_collection_groups` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_fpa_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_fpa_assessment` FOREIGN KEY (`assessment_id`) REFERENCES `student_fee_assessments` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_fpa_enrollment` FOREIGN KEY (`service_enrollment_id`) REFERENCES `service_enrollments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_fpa_payment` (`payment_id`),
  INDEX `idx_fpa_group` (`collection_group_id`),
  INDEX `idx_fpa_account` (`financial_account`),
  INDEX `idx_fpa_student` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Additive columns for fee_payments and fee_receipts
ALTER TABLE `fee_payments`
  ADD COLUMN IF NOT EXISTS `collection_group_id` INT NULL DEFAULT NULL AFTER `assessment_id`;

ALTER TABLE `fee_receipts`
  MODIFY COLUMN `payment_id` INT NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `collection_group_id` INT NULL DEFAULT NULL AFTER `payment_id`,
  ADD COLUMN IF NOT EXISTS `is_combined` BOOLEAN NOT NULL DEFAULT FALSE AFTER `receipt_type`;
