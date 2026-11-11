-- -----------------------------------------------------------------------------
-- Migration: 013_student_attendance_v1.sql
-- KAMCH ERP — Student Attendance Monitor Module Migration V1 (Additive)
-- Krishna Ayurvedic Medical College & Hospital
-- Stage 1: Database Foundation (Class Type Mappings, Timetable Versions & Slots,
-- Sub-Batches & Student Assignments, Attendance Sessions & Absences)
-- -----------------------------------------------------------------------------

-- 1. Class Type Mappings Table
CREATE TABLE IF NOT EXISTS `attendance_class_type_mappings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `abbreviation` VARCHAR(20) NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `category` ENUM('LT', 'NLT', 'NLP', 'OTHER') NOT NULL DEFAULT 'LT',
  `description` VARCHAR(255) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_actm_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed standard institutional class type abbreviations idempotently
INSERT INTO `attendance_class_type_mappings` (`abbreviation`, `name`, `category`, `description`) VALUES
  ('LT', 'Lecture Theory', 'LT', 'Standard theory lecture session'),
  ('NLT', 'Non-Lecture Theory', 'NLT', 'Interactive theory / seminar / demonstration'),
  ('NLP', 'Non-Lecture Practical', 'NLP', 'Practical, clinical, or laboratory session (1-3 hours)'),
  ('PRAC', 'Practical Session', 'NLP', 'Clinical / practical laboratory session'),
  ('CLIN', 'Clinical Posting', 'NLP', 'Hospital clinical posting session'),
  ('LIB', 'Library', 'OTHER', 'Self-study / Library session'),
  ('SPORTS', 'Sports & Physical Education', 'OTHER', 'Sports or physical training session'),
  ('MENTOR', 'Mentor-Mentee', 'OTHER', 'Mentorship and guidance session')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `category` = VALUES(`category`),
  `description` = VALUES(`description`);

-- 2. Timetable Versions Table
CREATE TABLE IF NOT EXISTS `attendance_timetable_versions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `batch_id` INT NOT NULL,
  `version_code` VARCHAR(50) NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `effective_from` DATE NOT NULL,
  `effective_to` DATE NULL DEFAULT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_by` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_atv_batch` FOREIGN KEY (`batch_id`) REFERENCES `academic_batches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_atv_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_atv_batch_effective` (`batch_id`, `effective_from`, `effective_to`),
  INDEX `idx_atv_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Sub-Batches Table
CREATE TABLE IF NOT EXISTS `sub_batches` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `batch_id` INT NOT NULL,
  `code` VARCHAR(30) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_sb_batch` FOREIGN KEY (`batch_id`) REFERENCES `academic_batches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  UNIQUE KEY `uq_batch_sub_code` (`batch_id`, `code`),
  INDEX `idx_sb_batch` (`batch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Sub-Batch Student Assignments Table
CREATE TABLE IF NOT EXISTS `sub_batch_students` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sub_batch_id` INT NOT NULL,
  `student_id` INT NOT NULL,
  `assigned_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_sbs_sub_batch` FOREIGN KEY (`sub_batch_id`) REFERENCES `sub_batches` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_sbs_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY `uq_sub_batch_student` (`sub_batch_id`, `student_id`),
  INDEX `idx_sbs_student` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Timetable Slots Table
CREATE TABLE IF NOT EXISTS `attendance_timetable_slots` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `timetable_version_id` INT NOT NULL,
  `weekday` ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY') NOT NULL,
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `subject_id` INT NULL DEFAULT NULL,
  `class_type` ENUM('LT', 'NLT', 'NLP', 'OTHER') NOT NULL DEFAULT 'LT',
  `sub_batch_id` INT NULL DEFAULT NULL,
  `week_pattern` ENUM('EVERY_WEEK', 'ODD_WEEKS', 'EVEN_WEEKS') NOT NULL DEFAULT 'EVERY_WEEK',
  `location_or_room` VARCHAR(100) NULL,
  `notes` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_atts_version` FOREIGN KEY (`timetable_version_id`) REFERENCES `attendance_timetable_versions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_atts_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_atts_sub_batch` FOREIGN KEY (`sub_batch_id`) REFERENCES `sub_batches` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_atts_version_day` (`timetable_version_id`, `weekday`),
  INDEX `idx_atts_subject` (`subject_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Attendance Sessions Table
CREATE TABLE IF NOT EXISTS `attendance_sessions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `timetable_version_id` INT NOT NULL,
  `slot_id` INT NOT NULL,
  `batch_id` INT NOT NULL,
  `sub_batch_id` INT NULL DEFAULT NULL,
  `attendance_date` DATE NOT NULL,
  `created_by` INT NULL,
  `updated_by` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_ats_version` FOREIGN KEY (`timetable_version_id`) REFERENCES `attendance_timetable_versions` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_ats_slot` FOREIGN KEY (`slot_id`) REFERENCES `attendance_timetable_slots` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_ats_batch` FOREIGN KEY (`batch_id`) REFERENCES `academic_batches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_ats_sub_batch` FOREIGN KEY (`sub_batch_id`) REFERENCES `sub_batches` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_ats_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_ats_updater` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  UNIQUE KEY `uq_slot_date_subbatch` (`slot_id`, `attendance_date`, `sub_batch_id`),
  INDEX `idx_ats_date_batch` (`attendance_date`, `batch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Attendance Absences Table (Stores only students marked absent)
CREATE TABLE IF NOT EXISTS `attendance_absences` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `session_id` INT NOT NULL,
  `student_id` INT NOT NULL,
  `recorded_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_atabs_session` FOREIGN KEY (`session_id`) REFERENCES `attendance_sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_atabs_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  UNIQUE KEY `uq_session_student_absent` (`session_id`, `student_id`),
  INDEX `idx_atabs_student` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
