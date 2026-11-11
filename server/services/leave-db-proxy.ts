import { MemoryDatabase } from './memory-db.ts';
import { parseSqlInsertObject } from './student-db-proxy.ts';

export interface MemoryLeaveApplication {
  id: number;
  teacher_id: number;
  leave_category: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  submitted_at: string;
  decided_by: number | null;
  decided_at: string | null;
  decision_remarks: string | null;
}

export function ensureLeaveMemoryStore(memDb: any) {
  if (!memDb.leaveApplications) memDb.leaveApplications = [];
}

export function handleLeaveQuery(
  memDb: MemoryDatabase,
  sql: string,
  params: any[] = []
): [any, any] | null {
  const upper = sql.trim().toUpperCase();
  ensureLeaveMemoryStore(memDb);
  const m = memDb as any;

  if (upper.startsWith('DELETE FROM LEAVE_APPLICATIONS') || upper.startsWith('DELETE FROM `LEAVE_APPLICATIONS`')) {
    m.leaveApplications = [];
    return [{ affectedRows: 0 }, []];
  }

  if (upper.startsWith('INSERT INTO LEAVE_APPLICATIONS') || upper.startsWith('INSERT INTO `LEAVE_APPLICATIONS`')) {
    const obj = parseSqlInsertObject(sql, params);
    const nextId = m.leaveApplications.length > 0 ? Math.max(...m.leaveApplications.map((a: any) => a.id)) + 1 : 1;
    const now = new Date().toISOString();

    const newApp: MemoryLeaveApplication = {
      id: Number(obj.id) || nextId,
      teacher_id: Number(obj.teacher_id),
      leave_category: String(obj.leave_category || 'CL').toUpperCase(),
      start_date: String(obj.start_date),
      end_date: String(obj.end_date),
      reason: String(obj.reason || ''),
      status: (obj.status || 'PENDING') as any,
      submitted_at: obj.submitted_at || now,
      decided_by: obj.decided_by !== undefined && obj.decided_by !== null ? Number(obj.decided_by) : null,
      decided_at: obj.decided_at ?? null,
      decision_remarks: obj.decision_remarks ?? null,
    };

    m.leaveApplications.push(newApp);
    return [{ insertId: newApp.id, affectedRows: 1 }, []];
  }

  if (upper.startsWith('UPDATE LEAVE_APPLICATIONS') || upper.startsWith('UPDATE `LEAVE_APPLICATIONS`')) {
    let id = params.length > 0 ? Number(params[params.length - 1]) : NaN;
    if (isNaN(id)) {
      const idMatch = sql.match(/WHERE\s+[`\w.]*id`?\s*=\s*(\d+)/i);
      if (idMatch) id = Number(idMatch[1]);
    }
    const app = m.leaveApplications.find((a: any) => a.id === id);
    if (app) {
      if (upper.includes("STATUS = 'CANCELLED'")) {
        app.status = 'CANCELLED';
        return [{ affectedRows: 1 }, []];
      }
      if (upper.includes('SET STATUS = ?')) {
        app.status = params[0];
        if (upper.includes('DECIDED_BY = ?')) app.decided_by = Number(params[1]);
        if (upper.includes('DECISION_REMARKS = ?')) app.decision_remarks = params[2];
        app.decided_at = new Date().toISOString();
        return [{ affectedRows: 1 }, []];
      }
    }
    return [{ affectedRows: 0 }, []];
  }

  if (upper.includes('FROM LEAVE_APPLICATIONS') || upper.includes('FROM `LEAVE_APPLICATIONS`')) {
    let result = [...m.leaveApplications];

    if (upper.includes('WHERE TEACHER_ID =') || upper.includes('LA.TEACHER_ID =')) {
      let tid = params.length > 0 ? Number(params[0]) : NaN;
      if (isNaN(tid)) {
        const match = sql.match(/teacher_id\s*=\s*(\d+)/i);
        if (match) tid = Number(match[1]);
      }
      if (!isNaN(tid)) {
        result = result.filter((a: any) => a.teacher_id === tid);
      }
    }
    if (upper.includes('STATUS IN')) {
      result = result.filter((a: any) => a.status === 'APPROVED' || a.status === 'PENDING' || a.status === 'REJECTED');
    }
    if (upper.includes('WHERE ID =') || upper.includes('WHERE LA.ID =') || upper.includes('LA.ID =')) {
      let id = params.length > 0 ? Number(params[0]) : NaN;
      if (isNaN(id)) {
        const match = sql.match(/WHERE\s+[`\w.]*id`?\s*=\s*(\d+)/i);
        if (match) id = Number(match[1]);
      }
      if (!isNaN(id)) {
        result = result.filter((a: any) => a.id === id);
      }
    }

    // Attach teacher details if joined
    if (upper.includes('JOIN TEACHERS')) {
      result = result.map((a: any) => {
        const teacher = (memDb.teachers as any[]).find((t) => t.id === a.teacher_id);
        const dept = teacher ? (memDb.departments as any[]).find((d) => d.id === teacher.department_id) : null;
        return {
          ...a,
          teacher_name: teacher?.full_name || 'Dr. Faculty Member',
          teacher_designation: teacher?.designation || 'Faculty Member',
          department_name: dept?.name || 'Department of Ayurveda',
        };
      });
    }

    return [result, []];
  }

  return null;
}
