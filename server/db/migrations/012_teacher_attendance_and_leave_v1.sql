-- -----------------------------------------------------------------------------
-- Migration: 012_teacher_attendance_and_leave_v1.sql
-- Unified Teacher Attendance & Leave Management schema additions.
-- Adds leave_category to leave_applications and creates teacher_daily_attendance table.
-- -----------------------------------------------------------------------------

-- 1. Add leave_category column to leave_applications if not present
ALTER TABLE `leave_applications`
ADD COLUMN `leave_category` ENUM('CL', 'EL', 'SPECIAL_SL', 'PATERNITY', 'MATERNITY') NOT NULL DEFAULT 'CL' AFTER `teacher_id`;

-- 2. Add index for leave_category
ALTER TABLE `leave_applications`
ADD INDEX `idx_leave_category` (`leave_category`);

-- 3. Create teacher_daily_attendance table for date-based attendance and absence tracking
CREATE TABLE IF NOT EXISTS `teacher_daily_attendance` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `teacher_id` INT NOT NULL,
  `attendance_date` DATE NOT NULL,
  `status` ENUM('PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY') NOT NULL DEFAULT 'PRESENT',
  `leave_application_id` INT NULL DEFAULT NULL,
  `recorded_reason` VARCHAR(255) NULL DEFAULT NULL,
  `recorded_by` INT NULL DEFAULT NULL,
  `recorded_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_teacher_daily_date` (`teacher_id`, `attendance_date`),
  INDEX `idx_tda_date` (`attendance_date`),
  INDEX `idx_tda_status` (`status`),
  CONSTRAINT `fk_tda_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_tda_leave` FOREIGN KEY (`leave_application_id`) REFERENCES `leave_applications` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_tda_recorder` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
