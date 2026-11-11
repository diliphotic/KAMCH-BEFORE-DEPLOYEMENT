-- ============================================================================
-- KAMCH ERP — Module: Service Billing Periods Migration
-- Version: service_billing_periods_v1
-- Character Set: utf8mb4, Engine: InnoDB
-- ============================================================================

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
  INDEX `idx_sbp_student` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
