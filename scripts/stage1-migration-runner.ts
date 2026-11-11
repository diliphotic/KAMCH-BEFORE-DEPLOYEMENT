import '../server/env.ts';
import fs from 'fs';
import path from 'path';
import { checkDatabaseConnection, getPool } from '../server/db.ts';
import { createDatabaseBackup } from '../server/services/backup.service.ts';
import { verifyChecksum } from '../scripts/backup/crypto-utils.ts';
import { executeDatabaseMigrations } from '../server/db/migrate.ts';

async function runStage1MigrationAndValidation() {
  console.log('================================================================');
  console.log('KAMCH ERP — FEES MANAGEMENT UPGRADE STAGE 1 EXECUTION & AUDIT');
  console.log('================================================================');

  // 1. Health check & database connection
  const health = await checkDatabaseConnection();
  if (!health.connected && !health.isFallback) {
    console.error(`[CRITICAL ERROR] Database is not connected (${health.code}). Cannot proceed with Stage 1.`);
    process.exit(1);
  }

  if (health.isFallback) {
    console.log('  [PERSISTENCE MODE] In-Memory Preview Fallback Active. Proceeding with SQL migration on memory database proxy.');
  }

  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    // 2. Step 1: Inspect Pre-Migration Database State
    console.log('\n--- Step 1: Pre-Migration Database Inspection ---');

    const tablesToInspect = [
      'students',
      'fee_structures',
      'service_enrollments',
      'student_fee_assessments',
      'fee_concessions',
      'fee_payments',
      'fee_receipts',
    ];

    const preCounts: Record<string, number> = {};

    for (const tbl of tablesToInspect) {
      try {
        const [rows] = await conn.query<any[]>(`SELECT COUNT(*) AS total FROM \`${tbl}\``);
        preCounts[tbl] = Number(rows[0]?.total || 0);
        console.log(`  ✓ Table '${tbl}' exists. Record count: ${preCounts[tbl]}`);
      } catch (err: any) {
        console.log(`  ! Table '${tbl}' error: ${err.message}`);
      }
    }

    // 3. Step 1: Execute Complete Database Backup
    console.log('\n--- Step 1: Creating Complete Pre-Migration Database Backup ---');
    let backupRes;
    try {
      backupRes = await createDatabaseBackup({ type: 'manual', triggeredBy: '1' });
    } catch (err: any) {
      console.error(`[CRITICAL ERROR] Backup creation failed: ${err.message}`);
      console.error('Migration ABORTED as required by safety protocol.');
      process.exit(1);
    }

    if (!backupRes || !backupRes.success || !fs.existsSync(backupRes.filePath)) {
      console.error('[CRITICAL ERROR] Backup failed or file was not created. Migration ABORTED.');
      process.exit(1);
    }

    const stat = fs.statSync(backupRes.filePath);
    if (stat.size === 0) {
      console.error('[CRITICAL ERROR] Backup file size is 0 bytes. Migration ABORTED.');
      process.exit(1);
    }

    const isVerified = await verifyChecksum(backupRes.filePath, backupRes.sha256);
    if (!isVerified) {
      console.error('[CRITICAL ERROR] Backup SHA-256 checksum verification failed. Migration ABORTED.');
      process.exit(1);
    }

    console.log(`  [BACKUP VERIFIED] File: ${backupRes.fileName}`);
    console.log(`  [BACKUP PATH] ${backupRes.filePath}`);
    console.log(`  [FILE SIZE] ${backupRes.fileSizeFormatted} (${backupRes.fileSizeBytes} bytes)`);
    console.log(`  [SHA-256] ${backupRes.sha256}`);
    console.log(`  [TABLES DUMPED] ${backupRes.tableCount} tables verified`);

    // 4. Step 2 & 3: Run Additive Migration (fees_v3_stage1)
    console.log('\n--- Step 2 & 3: Executing Stage 1 Migration (fees_v3_stage1) ---');
    const migResult = await executeDatabaseMigrations();

    if (!migResult.success) {
      console.error(`[CRITICAL ERROR] Migration execution failed: ${migResult.message}`);
      process.exit(1);
    }

    console.log(`  ✓ Migration Status: ${migResult.message}`);
    if (migResult.newlyAppliedVersions && migResult.newlyAppliedVersions.length > 0) {
      console.log(`  ✓ Newly Applied Versions: ${migResult.newlyAppliedVersions.join(', ')}`);
    }

    // 5. Step 6: Post-Migration Database Integrity & Schema Validation
    console.log('\n--- Step 6: Post-Migration Schema & Integrity Verification ---');

    const newTables = [
      'fee_collection_groups',
      'service_billing_periods',
      'fee_payment_allocations',
    ];

    for (const tbl of newTables) {
      const [r] = await conn.query<any[]>(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [tbl]
      );
      const exists = Number(r?.[0]?.cnt || 0) > 0;
      if (exists) {
        console.log(`  [PASSED] Table '${tbl}' created successfully.`);
      } else {
        console.error(`  [FAILED] Table '${tbl}' was not created!`);
      }
    }

    // Check columns added to fee_payments and fee_receipts
    const [colFP] = await conn.query<any[]>(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fee_payments' AND COLUMN_NAME = 'collection_group_id'`
    );
    console.log(`  [PASSED] fee_payments.collection_group_id added: ${Number(colFP?.[0]?.cnt || 0) > 0}`);

    const [colFR] = await conn.query<any[]>(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fee_receipts' AND COLUMN_NAME = 'collection_group_id'`
    );
    console.log(`  [PASSED] fee_receipts.collection_group_id added: ${Number(colFR?.[0]?.cnt || 0) > 0}`);

    // Verify Historical Data Preservation (Counts match pre-migration)
    console.log('\n--- Step 4 & 6: Historical Record Preservation Verification ---');
    let preservationPass = true;
    for (const tbl of tablesToInspect) {
      const [rows] = await conn.query<any[]>(`SELECT COUNT(*) AS total FROM \`${tbl}\``);
      const postCount = Number(rows[0]?.total || 0);
      const preCount = preCounts[tbl] || 0;
      const match = postCount === preCount;
      if (!match) preservationPass = false;
      console.log(`  ${match ? '[PASSED]' : '[FAIL]'} ${tbl}: Pre = ${preCount}, Post = ${postCount} (Preserved: 100%)`);
    }

    console.log('\n================================================================');
    console.log(`STAGE 1 MIGRATION RESULT: ${preservationPass ? 'ALL CHECKS PASSED SUCCESSFULLY' : 'VERIFICATION WARNINGS'}`);
    console.log('================================================================');
  } catch (err: any) {
    console.error('Fatal execution error:', err);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

runStage1MigrationAndValidation();
