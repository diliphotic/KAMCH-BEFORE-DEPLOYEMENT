-- ============================================================================
-- KAMCH ERP — Fees Management Upgrade Stage 5 Migration
-- Reference SQL Migration File: fees_v3_stage5.sql
-- Description: Ensures fee_receipts status enum supports 'REVERSED' for receipt
--              lifecycle consistency, and adds indexes for financial reports.
-- ============================================================================

-- 1. Modify fee_receipts to include 'REVERSED' in status enum
ALTER TABLE `fee_receipts`
  MODIFY COLUMN `status` ENUM('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'REVERSED') NOT NULL DEFAULT 'APPROVED';

-- 2. Ensure indexes exist on fee_payment_allocations for report performance
ALTER TABLE `fee_payment_allocations`
  ADD INDEX IF NOT EXISTS `idx_fpa_account_amount` (`account_type`, `allocated_amount`);

-- 3. Ensure indexes exist on fee_payments for report performance
ALTER TABLE `fee_payments`
  ADD INDEX IF NOT EXISTS `idx_fp_dest_status_date` (`destination`, `status`, `payment_date`);
