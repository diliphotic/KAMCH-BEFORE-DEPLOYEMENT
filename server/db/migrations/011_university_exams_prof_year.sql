-- -----------------------------------------------------------------------------
-- Migration: 011_university_exams_prof_year.sql
-- Decouples examination professional year from student's current professional year.
-- Adds examination_professional_year to student_university_exam_attempts and
-- safely backfills from university_subjects without modifying any existing values.
-- -----------------------------------------------------------------------------

-- 1. Add examination_professional_year column if not present
ALTER TABLE `student_university_exam_attempts`
ADD COLUMN `examination_professional_year` INT NULL AFTER `subject_id`;

-- 2. Add index for efficient filtering by examination professional year
ALTER TABLE `student_university_exam_attempts`
ADD INDEX `idx_suea_exam_prof_year` (`examination_professional_year`);

-- 3. Non-destructive backfill: match examination_professional_year to subject's professional_year
UPDATE `student_university_exam_attempts` suea
JOIN `university_subjects` us ON suea.subject_id = us.id
SET suea.examination_professional_year = us.professional_year
WHERE suea.examination_professional_year IS NULL;
