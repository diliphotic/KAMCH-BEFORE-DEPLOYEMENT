-- -----------------------------------------------------------------------------
-- Migration: 015_attendance_non_subject_slots.sql
-- KAMCH ERP — Non-Subject Timetable Slots & Student Attendance Additive Migration
-- Krishna Ayurvedic Medical College & Hospital
-- -----------------------------------------------------------------------------

-- 1. Relax subject_id on attendance_timetable_slots to allow NULL for non-subject classes
--    (e.g., Mentor-Mentee, Sports, Library Classes)
ALTER TABLE `attendance_timetable_slots`
  MODIFY COLUMN `subject_id` INT NULL DEFAULT NULL;

-- 2. Ensure attendance_threshold_settings table exists
CREATE TABLE IF NOT EXISTS `attendance_threshold_settings` (
  `id` INT PRIMARY KEY,
  `threshold` DECIMAL(5, 2) NOT NULL DEFAULT 75.00,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` INT NULL,
  CONSTRAINT `fk_ats_updater` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initialize threshold setting to 75.00 idempotently
INSERT INTO `attendance_threshold_settings` (`id`, `threshold`) VALUES (1, 75.00)
ON DUPLICATE KEY UPDATE `threshold` = VALUES(`threshold`);

-- Record applied migration versions
INSERT IGNORE INTO `schema_migrations` (`version`) VALUES ('attendance_threshold_v1');
INSERT IGNORE INTO `schema_migrations` (`version`) VALUES ('attendance_non_subject_slots_v1');
