-- Migration 020: Add Student Attendance Staff role
-- Safe additive migration file for dedicated STUDENT_ATTENDANCE role

INSERT INTO `roles` (`code`, `name`, `description`) VALUES
  ('STUDENT_ATTENDANCE', 'Student Attendance Staff', 'Dedicated student attendance management and timetable tracking')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`);
