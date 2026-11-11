import express from 'express';
import assert from 'node:assert';
import cookieParser from 'cookie-parser';
import http from 'http';
import bcrypt from 'bcryptjs';
import fetch from 'node-fetch';
import { getPool, checkDatabaseConnection } from '../server/db.ts';
import { authRouter } from '../server/routes/auth.routes.ts';
import { attendanceRouter } from '../server/routes/attendance.routes.ts';

function extractCookies(res: any): { session: string; csrf: string } {
  const getSetCookie = (res.headers as any).getSetCookie;
  const rawList: string[] =
    typeof getSetCookie === 'function'
      ? getSetCookie.call(res.headers)
      : (res.headers.get('set-cookie') || '').split(/,(?=\s*kamch_)/);

  let session = '';
  let csrf = '';
  for (const item of rawList) {
    const pair = item.split(';')[0].trim();
    if (pair.startsWith('kamch_session=')) session = pair;
    if (pair.startsWith('kamch_csrf=')) csrf = pair.replace('kamch_csrf=', '');
  }
  return { session, csrf };
}

async function runThresholdTests() {
  console.log('================================================================');
  console.log('KAMCH ERP — STAGE 8: DYNAMIC ATTENDANCE THRESHOLD VERIFICATION');
  console.log('================================================================\n');

  await checkDatabaseConnection();
  const pool = getPool();

  // Setup Express server
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.use('/api/attendance', attendanceRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Setup test users
    const [roles] = await pool.query<any[]>('SELECT id, code FROM roles');
    const principalRole = roles.find((r) => r.code === 'PRINCIPAL');
    const officeRole = roles.find((r) => r.code === 'OFFICE');
    const testPassword = 'PasswordThreshold1!';
    const pwdHash = await bcrypt.hash(testPassword, 10);
    
    // Add principal and office users
    await pool.query('INSERT INTO users (username, email, password_hash, role_id, full_name) VALUES (?, ?, ?, ?, ?)', ['principal_test', 'principal@kamch.ac.in', pwdHash, principalRole.id, 'Principal']);
    await pool.query('INSERT INTO users (username, email, password_hash, role_id, full_name) VALUES (?, ?, ?, ?, ?)', ['office_test', 'office@kamch.ac.in', pwdHash, officeRole.id, 'Office']);

    // Login Principal
    const princLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: 'principal_test', password: testPassword }),
    });
    const princAuth = extractCookies(princLoginRes);
    const princCookie = `${princAuth.session}; kamch_csrf=${princAuth.csrf}`;

    // Login Office
    const offLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: 'office_test', password: testPassword }),
    });
    const offAuth = extractCookies(offLoginRes);
    const offCookie = `${offAuth.session}; kamch_csrf=${offAuth.csrf}`;

    // 1. Verify default threshold
    const getRes = await fetch(`${baseUrl}/api/attendance/settings/threshold`, { headers: { Cookie: offCookie, 'x-csrf-token': offAuth.csrf } });
    const getData: any = await getRes.json();
    assert(getRes.status === 200 && Number(getData.threshold) === 75.00, 'Default threshold is 75%');
    console.log('[PASS] Default threshold is 75%');

    // 2. Verify Office cannot update
    const postRes1 = await fetch(`${baseUrl}/api/attendance/settings/threshold`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', Cookie: offCookie, 'x-csrf-token': offAuth.csrf },
        body: JSON.stringify({ threshold: 80 })
    });
    assert(postRes1.status === 403, 'Office role denied threshold update');
    console.log('[PASS] Office role denied threshold update');

    // 3. Verify Principal can update
    const postRes2 = await fetch(`${baseUrl}/api/attendance/settings/threshold`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', Cookie: princCookie, 'x-csrf-token': princAuth.csrf },
        body: JSON.stringify({ threshold: 80 })
    });
    assert(postRes2.status === 200, 'Principal role granted threshold update');
    
    const getRes2 = await fetch(`${baseUrl}/api/attendance/settings/threshold`, { headers: { Cookie: offCookie, 'x-csrf-token': offAuth.csrf } });
    const getData2: any = await getRes2.json();
    assert(Number(getData2.threshold) === 80.00, 'Threshold updated to 80%');
    console.log('[PASS] Principal role updated threshold to 80%');

    // 4. Verify invalid threshold rejected
    const postRes3 = await fetch(`${baseUrl}/api/attendance/settings/threshold`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', Cookie: princCookie, 'x-csrf-token': princAuth.csrf },
        body: JSON.stringify({ threshold: 105 })
    });
    assert(postRes3.status === 400, 'Invalid threshold (105) rejected');
    console.log('[PASS] Invalid threshold rejected');

    console.log('\n===============================================================');
    console.log('STAGE 8 TEST RESULTS: ALL PASSED');
    console.log('===============================================================\n');

  } finally {
    server.close();
  }
}

runThresholdTests().catch((err) => {
  console.error('\n[STAGE 8 TEST EXCEPTION]:', err);
  process.exit(1);
});
