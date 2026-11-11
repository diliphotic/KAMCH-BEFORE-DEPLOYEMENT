-- -----------------------------------------------------------------------------
-- Migration: 014_attendance_threshold.sql
-- KAMCH ERP — Student Attendance Monitor Module Migration V2 (Additive)
-- Krishna Ayurvedic Medical College & Hospital
-- Stage: Dynamic Attendance Threshold Setting
-- -----------------------------------------------------------------------------

-- 1. Attendance Threshold Settings Table
CREATE TABLE IF NOT EXISTS `attendance_threshold_settings` (
  `id` INT PRIMARY KEY,
  `threshold` DECIMAL(5, 2) NOT NULL DEFAULT 75.00,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` INT NULL,
  CONSTRAINT `fk_attendance_threshold_updater` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initialize threshold setting to 75.00
INSERT INTO `attendance_threshold_settings` (`id`, `threshold`) VALUES (1, 75.00)
ON DUPLICATE KEY UPDATE `threshold` = VALUES(`threshold`);
