import { MemoryDatabase } from './memory-db.ts';
import { parseSqlInsertObject } from './student-db-proxy.ts';

export interface MemoryMonthlyAttendance {
  id: number;
  teacher_id: number;
  year: number;
  month: number;
  total_working_days: number;
  days_present: number;
  attendance_percentage: number;
  status: 'PENDING' | 'FINALIZED';
  finalized_by: number | null;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemoryClassTypeMapping {
  id: number;
  abbreviation: string;
  name: string;
  category: 'LT' | 'NLT' | 'NLP' | 'OTHER';
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MemoryTimetableVersion {
  id: number;
  batch_id: number;
  version_code: string;
  title: string;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface MemorySubBatch {
  id: number;
  batch_id: number;
  code: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemorySubBatchStudent {
  id: number;
  sub_batch_id: number;
  student_id: number;
  created_at: string;
}

export interface MemoryTimetableSlot {
  id: number;
  timetable_version_id: number;
  weekday: string;
  start_time: string;
  end_time: string;
  subject_id: number;
  class_type: string;
  sub_batch_id: number | null;
  week_pattern: string;
  location_or_room: string | null;
  notes: string | null;
  created_at: string;
}

export interface MemoryAttendanceSession {
  id: number;
  timetable_version_id: number;
  slot_id: number;
  batch_id: number;
  sub_batch_id: number | null;
  attendance_date: string;
  created_by: number;
  updated_by: number;
  created_at: string;
  updated_at: string;
}

export interface MemoryAttendanceAbsence {
  id: number;
  session_id: number;
  student_id: number;
  created_at: string;
}

export interface MemoryInstitutionalHoliday {
  id: number;
  holiday_date: string;
  holiday_name: string;
  description: string | null;
  created_at: string;
}

export function ensureAttendanceMemoryStore(memDb: any) {
  if (!memDb.monthlyAttendance) memDb.monthlyAttendance = [];
  if (!memDb.classTypeMappings) {
    memDb.classTypeMappings = [
      { id: 1, abbreviation: 'LT', name: 'Lecture Theory', category: 'LT', description: 'Standard 1-hour didactic lecture', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 2, abbreviation: 'NLT', name: 'Non-Lecture Theory', category: 'NLT', description: 'Small group interactive tutorial or seminar', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 3, abbreviation: 'NLP', name: 'Non-Lecture Practical', category: 'NLP', description: 'Laboratory dissection or practical block', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 4, abbreviation: 'OTHER', name: 'Other Academic / Activity', category: 'OTHER', description: 'Library, Sports, or Yoga sessions', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];
  }
  if (!memDb.timetableVersions) memDb.timetableVersions = [];
  if (!memDb.subBatches) memDb.subBatches = [];
  if (!memDb.subBatchStudents) memDb.subBatchStudents = [];
  if (!memDb.timetableSlots) memDb.timetableSlots = [];
  if (!memDb.attendanceSessions) memDb.attendanceSessions = [];
  if (!memDb.attendanceAbsences) memDb.attendanceAbsences = [];
  if (!memDb.institutionalHolidays) memDb.institutionalHolidays = [];
  if (!memDb.attendanceThresholdSettings) {
    memDb.attendanceThresholdSettings = [{ id: 1, threshold: 75.00, updated_at: new Date().toISOString() }];
  }
}

export function handleAttendanceQuery(
  memDb: MemoryDatabase,
  sql: string,
  params: any[] = []
): [any, any] | null {
  const upper = sql.trim().toUpperCase();
  ensureAttendanceMemoryStore(memDb);
  const m = memDb as any;

  // ============================================================================
  // 1. INSTITUTIONAL HOLIDAYS
  // ============================================================================
  if (upper.startsWith('INSERT INTO INSTITUTIONAL_HOLIDAYS') || upper.startsWith('INSERT INTO `INSTITUTIONAL_HOLIDAYS`')) {
    const obj = parseSqlInsertObject(sql, params);
    const hDate = String(obj.holiday_date || params[0]).split('T')[0];
    const hName = String(obj.holiday_name || params[1] || 'Holiday');
    const hDesc = obj.description !== undefined ? obj.description : (params[2] !== undefined ? params[2] : null);
    const existing = m.institutionalHolidays.find((h: any) => h.holiday_date === hDate);
    if (existing) {
      existing.holiday_name = hName;
      existing.description = hDesc;
      return [{ affectedRows: 1 }, []];
    } else {
      const nextId = m.institutionalHolidays.length > 0 ? Math.max(...m.institutionalHolidays.map((h: any) => h.id)) + 1 : 1;
      m.institutionalHolidays.push({
        id: nextId,
        holiday_date: hDate,
        holiday_name: hName,
        description: hDesc,
        created_at: new Date().toISOString(),
      });
      return [{ insertId: nextId, affectedRows: 1 }, []];
    }
  }

  if (upper.startsWith('DELETE FROM INSTITUTIONAL_HOLIDAYS') || upper.startsWith('DELETE FROM `INSTITUTIONAL_HOLIDAYS`')) {
    if (upper.includes('WHERE HOLIDAY_DATE =') || upper.includes('WHERE HOLIDAY_DATE = ?')) {
      const match = sql.match(/WHERE\s+[`\w.]*holiday_date`?\s*=\s*['"]?(\d{4}-\d{2}-\d{2})['"]?/i);
      const hDate = match ? match[1] : String(params[0]).split('T')[0];
      const before = m.institutionalHolidays.length;
      m.institutionalHolidays = m.institutionalHolidays.filter((h: any) => h.holiday_date !== hDate);
      return [{ affectedRows: before - m.institutionalHolidays.length }, []];
    }
    m.institutionalHolidays = [];
    return [{ affectedRows: 0 }, []];
  }

  if (upper.includes('FROM INSTITUTIONAL_HOLIDAYS') || upper.includes('FROM `INSTITUTIONAL_HOLIDAYS`')) {
    if (upper.includes('WHERE HOLIDAY_DATE =') || upper.includes('WHERE HOLIDAY_DATE = ?')) {
      const match = sql.match(/WHERE\s+[`\w.]*holiday_date`?\s*=\s*['"]?(\d{4}-\d{2}-\d{2})['"]?/i);
      const hDate = match ? match[1] : String(params[0]).split('T')[0];
      const found = m.institutionalHolidays.filter((h: any) => h.holiday_date === hDate);
      return [found, []];
    }
    if (upper.includes('WHERE HOLIDAY_DATE BETWEEN')) {
      let d1 = params[0] ? String(params[0]).split('T')[0] : '';
      let d2 = params[1] ? String(params[1]).split('T')[0] : '';
      if (!d1 || !d2) {
        const match = sql.match(/BETWEEN\s*['"]?(\d{4}-\d{2}-\d{2})['"]?\s*AND\s*['"]?(\d{4}-\d{2}-\d{2})['"]?/i);
        if (match) {
          d1 = match[1];
          d2 = match[2];
        }
      }
      const found = m.institutionalHolidays.filter((h: any) => h.holiday_date >= d1 && h.holiday_date <= d2);
      return [found, []];
    }
    return [m.institutionalHolidays, []];
  }

  // ============================================================================
  // 1a. ATTENDANCE THRESHOLD (`attendance_threshold_settings`)
  // ============================================================================
  if (upper.startsWith('UPDATE ATTENDANCE_THRESHOLD_SETTINGS') || upper.startsWith('UPDATE `ATTENDANCE_THRESHOLD_SETTINGS`') || upper.startsWith('INSERT INTO ATTENDANCE_THRESHOLD_SETTINGS') || upper.startsWith('INSERT INTO `ATTENDANCE_THRESHOLD_SETTINGS`')) {
    const obj = parseSqlInsertObject(sql, params);
    const threshold = Number(obj.threshold ?? params[0]);
    if (!isNaN(threshold)) {
      if (!m.attendanceThresholdSettings || m.attendanceThresholdSettings.length === 0) {
        m.attendanceThresholdSettings = [{ id: 1, threshold: 75.00, updated_at: new Date().toISOString() }];
      }
      m.attendanceThresholdSettings[0].threshold = threshold;
      m.attendanceThresholdSettings[0].updated_at = new Date().toISOString();
    }
    return [{ affectedRows: 1 }, []];
  }
  if (upper.includes('FROM ATTENDANCE_THRESHOLD_SETTINGS')) {
    if (!m.attendanceThresholdSettings || m.attendanceThresholdSettings.length === 0) {
      m.attendanceThresholdSettings = [{ id: 1, threshold: 75.00, updated_at: new Date().toISOString() }];
    }
    return [m.attendanceThresholdSettings, []];
  }

  // ============================================================================
  // 2. TEACHER MONTHLY ATTENDANCE
  // ============================================================================
  if (upper.startsWith('DELETE FROM MONTHLY_ATTENDANCE') || upper.startsWith('DELETE FROM `MONTHLY_ATTENDANCE`')) {
    m.monthlyAttendance = [];
    return [{ affectedRows: 0 }, []];
  }

  if (upper.startsWith('INSERT INTO MONTHLY_ATTENDANCE') || upper.startsWith('INSERT INTO `MONTHLY_ATTENDANCE`')) {
    const obj = parseSqlInsertObject(sql, params);
    const tid = Number(obj.teacher_id ?? params[0]);
    const yr = Number(obj.year ?? params[1]);
    const mo = Number(obj.month ?? params[2]);
    const totalWorking = Number(obj.total_working_days ?? params[3]);
    const daysPresent = Number(obj.days_present ?? params[4]);
    const percentage = Number(obj.attendance_percentage ?? params[5]);
    const status = obj.status || params[6] || 'PENDING';
    const finalizedBy = obj.finalized_by !== undefined && obj.finalized_by !== null ? Number(obj.finalized_by) : (params[7] !== undefined && params[7] !== null ? Number(params[7]) : null);

    const existing = m.monthlyAttendance.find((a: any) => a.teacher_id === tid && a.year === yr && a.month === mo);
    const now = new Date().toISOString();

    if (existing) {
      existing.total_working_days = totalWorking;
      existing.days_present = daysPresent;
      existing.attendance_percentage = percentage;
      existing.status = status;
      if (finalizedBy) {
        existing.finalized_by = finalizedBy;
        existing.finalized_at = now;
      }
      existing.updated_at = now;
      return [{ insertId: existing.id, affectedRows: 1 }, []];
    } else {
      const nextId = m.monthlyAttendance.length > 0 ? Math.max(...m.monthlyAttendance.map((a: any) => a.id)) + 1 : 1;
      const newRec: MemoryMonthlyAttendance = {
        id: nextId,
        teacher_id: tid,
        year: yr,
        month: mo,
        total_working_days: totalWorking,
        days_present: daysPresent,
        attendance_percentage: percentage,
        status: status as any,
        finalized_by: finalizedBy,
        finalized_at: status === 'FINALIZED' ? now : null,
        created_at: now,
        updated_at: now,
      };
      m.monthlyAttendance.push(newRec);
      return [{ insertId: nextId, affectedRows: 1 }, []];
    }
  }

  if (upper.startsWith('UPDATE MONTHLY_ATTENDANCE') || upper.startsWith('UPDATE `MONTHLY_ATTENDANCE`')) {
    const now = new Date().toISOString();
    let yr = params.length >= 2 ? Number(params[params.length - 2]) : NaN;
    let mo = params.length >= 1 ? Number(params[params.length - 1]) : NaN;

    if (isNaN(yr) || isNaN(mo)) {
      const yrMatch = sql.match(/year\s*=\s*(\d+)/i);
      const moMatch = sql.match(/month\s*=\s*(\d+)/i);
      if (yrMatch) yr = Number(yrMatch[1]);
      if (moMatch) mo = Number(moMatch[1]);
    }

    let updatedCount = 0;
    m.monthlyAttendance.forEach((rec: any) => {
      if (rec.year === yr && rec.month === mo) {
        rec.status = 'FINALIZED';
        rec.finalized_by = params[0] !== undefined && params[0] !== null ? Number(params[0]) : 1;
        rec.finalized_at = now;
        rec.updated_at = now;
        updatedCount++;
      }
    });
    return [{ affectedRows: updatedCount }, []];
  }

  if (upper.includes('FROM MONTHLY_ATTENDANCE') || upper.includes('FROM `MONTHLY_ATTENDANCE`')) {
    let list = m.monthlyAttendance.map((ma: any) => {
      const t = memDb.teachers.find((teacher) => teacher.id === ma.teacher_id);
      return {
        ...ma,
        teacher_name: t?.full_name || '',
        employee_code: t?.employee_code || '',
        designation: t?.designation || '',
        department_id: t?.department_id || null,
      };
    });

    if (upper.includes('WHERE TEACHER_ID =') && upper.includes('YEAR =') && upper.includes('MONTH =')) {
      let tid = Number(params[0]);
      let yr = Number(params[1]);
      let mo = Number(params[2]);
      if (isNaN(tid)) {
        const match = sql.match(/teacher_id\s*=\s*(\d+)/i);
        if (match) tid = Number(match[1]);
      }
      if (isNaN(yr)) {
        const match = sql.match(/year\s*=\s*(\d+)/i);
        if (match) yr = Number(match[1]);
      }
      if (isNaN(mo)) {
        const match = sql.match(/month\s*=\s*(\d+)/i);
        if (match) mo = Number(match[1]);
      }
      const found = list.filter((a: any) => a.teacher_id === tid && a.year === yr && a.month === mo);
      return [found, []];
    }

    if (upper.includes('WHERE YEAR =') && upper.includes('MONTH =')) {
      let yr = Number(params[0]);
      let mo = Number(params[1]);
      if (isNaN(yr)) {
        const match = sql.match(/year\s*=\s*(\d+)/i);
        if (match) yr = Number(match[1]);
      }
      if (isNaN(mo)) {
        const match = sql.match(/month\s*=\s*(\d+)/i);
        if (match) mo = Number(match[1]);
      }
      const found = list.filter((a: any) => a.year === yr && a.month === mo);
      return [found, []];
    }

    if (upper.includes('WHERE ID =') || upper.includes('WHERE MA.ID =')) {
      let id = Number(params[0]);
      if (isNaN(id)) {
        const match = sql.match(/id\s*=\s*(\d+)/i);
        if (match) id = Number(match[1]);
      }
      const found = list.filter((a: any) => a.id === id);
      return [found, []];
    }

    if (upper.includes('WHERE TEACHER_ID =') || upper.includes('WHERE MA.TEACHER_ID =')) {
      let tid = Number(params[0]);
      if (isNaN(tid)) {
        const match = sql.match(/teacher_id\s*=\s*(\d+)/i);
        if (match) tid = Number(match[1]);
      }
      let found = list.filter((a: any) => a.teacher_id === tid);
      if (upper.includes('STATUS = "FINALIZED"') || upper.includes("STATUS = 'FINALIZED'")) {
        found = found.filter((a: any) => a.status === 'FINALIZED');
      }
      return [found, []];
    }

    return [list, []];
  }

  // ============================================================================
  // 3. CLASS TYPE MAPPINGS (`attendance_class_type_mappings`)
  // ============================================================================
  if (upper.includes('FROM ATTENDANCE_CLASS_TYPE_MAPPINGS') || upper.includes('FROM `ATTENDANCE_CLASS_TYPE_MAPPINGS`')) {
    let list = m.classTypeMappings;
    if (upper.includes('WHERE IS_ACTIVE = TRUE')) {
      list = list.filter((c: any) => c.is_active);
    }
    return [list, []];
  }

  // ============================================================================
  // 4. SUB-BATCHES & SUB-BATCH STUDENTS (`sub_batches`, `sub_batch_students`)
  // ============================================================================
  if (upper.startsWith('DELETE FROM SUB_BATCH_STUDENTS') || upper.startsWith('DELETE FROM `SUB_BATCH_STUDENTS`')) {
    m.subBatchStudents = [];
    return [{ affectedRows: 0 }, []];
  }

  if (upper.startsWith('DELETE FROM SUB_BATCHES') || upper.startsWith('DELETE FROM `SUB_BATCHES`')) {
    m.subBatches = [];
    return [{ affectedRows: 0 }, []];
  }

  if (upper.includes('FROM SUB_BATCH_STUDENTS') || upper.includes('FROM `SUB_BATCH_STUDENTS`')) {
    if (upper.includes('WHERE SB.BATCH_ID = ?')) {
      const bId = Number(params[0]);
      const matchingSubBatchIds = new Set(
        m.subBatches.filter((sb: any) => sb.batch_id === bId).map((sb: any) => sb.id)
      );
      const rows = m.subBatchStudents
        .filter((sbs: any) => matchingSubBatchIds.has(sbs.sub_batch_id))
        .map((sbs: any) => ({
          student_id: sbs.student_id,
          sub_batch_id: sbs.sub_batch_id,
        }));
      return [rows, []];
    }
    if (upper.includes('GROUP BY SBS.SUB_BATCH_ID')) {
      const counts: Record<number, number> = {};
      m.subBatchStudents.forEach((sbs: any) => {
        const student = memDb.students.find((s) => s.id === sbs.student_id);
        if (student && student.status === 'ACTIVE') {
          counts[sbs.sub_batch_id] = (counts[sbs.sub_batch_id] || 0) + 1;
        }
      });
      const rows = Object.entries(counts).map(([sbId, cnt]) => ({
        sub_batch_id: Number(sbId),
        cnt,
      }));
      return [rows, []];
    }
    if (upper.includes('WHERE SBS.STUDENT_ID = ?') || upper.includes('WHERE STUDENT_ID = ?')) {
      const stId = Number(params[0]);
      const links = m.subBatchStudents.filter((sbs: any) => sbs.student_id === stId);
      const rows = links.map((l: any) => {
        const sb = m.subBatches.find((b: any) => b.id === l.sub_batch_id);
        return {
          id: sb?.id || l.sub_batch_id,
          code: sb?.code || '',
          name: sb?.name || '',
          sub_batch_id: l.sub_batch_id,
          student_id: l.student_id,
        };
      });
      return [rows, []];
    }
    if (upper.includes('WHERE SBS.SUB_BATCH_ID = ?') || upper.includes('WHERE SUB_BATCH_ID = ?')) {
      const sbId = Number(params[0]);
      const found = m.subBatchStudents.filter((sbs: any) => sbs.sub_batch_id === sbId);
      return [found, []];
    }
    return [m.subBatchStudents, []];
  }

  if (upper.includes('FROM SUBJECTS') || upper.includes('FROM `SUBJECTS`')) {
    if (upper.includes('WHERE SUB.ID = ?') || upper.includes('WHERE ID = ?')) {
      const id = Number(params[0]);
      const found = (memDb.iaSubjects || []).filter((s: any) => s.id === id);
      return [found, []];
    }
    if (upper.includes('WHERE SUB.SCHEME_ID = ?') || upper.includes('WHERE SCHEME_ID = ?')) {
      const schId = Number(params[0]);
      const found = (memDb.iaSubjects || []).filter((s: any) => s.scheme_id === schId);
      return [found, []];
    }
    return [memDb.iaSubjects || [], []];
  }

  if (upper.startsWith('INSERT INTO SUB_BATCH_STUDENTS') || upper.startsWith('INSERT INTO `SUB_BATCH_STUDENTS`')) {
    const valuesPart = sql.slice(upper.indexOf('VALUES') + 6);
    const tupleMatches = valuesPart.matchAll(/\(([^)]+)\)/g);
    let pIdx = 0;
    let count = 0;
    for (const match of tupleMatches) {
      const parts = match[1].split(',').map((s) => s.trim());
      const sbVal = parts[0] === '?' ? params[pIdx++] : Number(parts[0]);
      const sVal = parts[1] === '?' ? params[pIdx++] : Number(parts[1]);
      if (sbVal && sVal) {
        const nextId = m.subBatchStudents.length > 0 ? Math.max(...m.subBatchStudents.map((s: any) => s.id)) + 1 : 1;
        m.subBatchStudents.push({
          id: nextId,
          sub_batch_id: Number(sbVal),
          student_id: Number(sVal),
          created_at: new Date().toISOString(),
        });
        count++;
      }
    }
    return [{ affectedRows: count }, []];
  }

  // ============================================================================
  // 4a. STUDENTS (for attendance eligibility and counting)
  // ============================================================================
  if ((upper.includes('FROM STUDENTS') || upper.includes('FROM `STUDENTS`')) && !sql.includes('/* SM:')) {
    if (upper.includes('WHERE S.ID = ?') || upper.includes('WHERE ID = ?')) {
      const stId = Number(params[0]);
      const st = memDb.students.find((s) => s.id === stId);
      if (!st) return [[], []];
      const batchId = st.current_placement_batch_id || st.original_batch_id;
      const batch = batchId ? memDb.academicBatches.find((b) => b.id === batchId) : null;
      const scheme = batch ? memDb.curriculumSchemes.find((cs) => cs.id === batch.scheme_id) : null;
      return [[{
        ...st,
        batch_id: batch?.id || null,
        batch_code: batch?.code || null,
        batch_name: batch?.name || null,
        current_professional_year: batch?.current_professional_year || 1,
        scheme_code: scheme?.code || null,
        scheme_name: scheme?.name || null,
      }], []];
    }
    if (upper.includes('COUNT(*) AS CNT') && (upper.includes('CURRENT_PLACEMENT_BATCH_ID') || upper.includes('ORIGINAL_BATCH_ID'))) {
      const bId = Number(params[0]);
      const cnt = memDb.students.filter(
        (st) =>
          (st.current_placement_batch_id === bId || st.original_batch_id === bId) &&
          (st.status === 'ACTIVE' || st.administrative_status === 'ACTIVE')
      ).length;
      return [[{ cnt }], []];
    }

    if (upper.includes('WHERE SBS.SUB_BATCH_ID = ?') && upper.includes('STATUS = \'ACTIVE\'')) {
      const sbId = Number(params[0]);
      const studentIds = m.subBatchStudents.filter((s: any) => s.sub_batch_id === sbId).map((s: any) => s.student_id);
      const list = memDb.students
        .filter((st) => studentIds.includes(st.id) && (st.status === 'ACTIVE' || st.administrative_status === 'ACTIVE'))
        .map((st) => ({
          id: st.id,
          student_id_number: st.student_id_number,
          temporary_roll_number: st.temporary_roll_number,
          permanent_university_number: st.permanent_university_number,
          full_name: st.full_name,
        }));
      list.sort((a, b) => (a.temporary_roll_number || a.student_id_number).localeCompare(b.temporary_roll_number || b.student_id_number));
      return [list, []];
    }

    if ((upper.includes('CURRENT_PLACEMENT_BATCH_ID') || upper.includes('ORIGINAL_BATCH_ID')) && upper.includes('STATUS = \'ACTIVE\'')) {
      const bId = Number(params[0]);
      let targetStudentId: number | null = null;
      if (upper.includes('AND S.ID = ?')) {
        targetStudentId = Number(params[2] ?? params[1]);
      }
      let list = memDb.students
        .filter(
          (st) =>
            (st.current_placement_batch_id === bId || st.original_batch_id === bId) &&
            (st.status === 'ACTIVE' || st.administrative_status === 'ACTIVE')
        );
      if (targetStudentId) {
        list = list.filter((st) => st.id === targetStudentId);
      }
      const mapped = list.map((st) => ({
        id: st.id,
        student_id_number: st.student_id_number,
        temporary_roll_number: st.temporary_roll_number,
        permanent_university_number: st.permanent_university_number,
        full_name: st.full_name,
      }));
      mapped.sort((a, b) => (a.temporary_roll_number || a.student_id_number).localeCompare(b.temporary_roll_number || b.student_id_number));
      return [mapped, []];
    }
  }

  if (upper.includes('FROM SUB_BATCHES') || upper.includes('FROM `SUB_BATCHES`')) {
    if (upper.includes('WHERE SB.BATCH_ID = ?') || upper.includes('WHERE BATCH_ID = ?')) {
      const bId = Number(params[0]);
      const list = m.subBatches
        .filter((sb: any) => sb.batch_id === bId)
        .map((sb: any) => ({
          ...sb,
          student_count: m.subBatchStudents.filter((s: any) => s.sub_batch_id === sb.id).length,
        }));
      return [list, []];
    }
    if (upper.includes('WHERE SB.ID = ?') || upper.includes('WHERE ID = ?')) {
      const id = Number(params[0]);
      const found = m.subBatches.filter((sb: any) => sb.id === id);
      return [found, []];
    }
    return [m.subBatches, []];
  }

  if (upper.startsWith('INSERT INTO SUB_BATCHES') || upper.startsWith('INSERT INTO `SUB_BATCHES`')) {
    const obj = parseSqlInsertObject(sql, params);
    const nextId = m.subBatches.length > 0 ? Math.max(...m.subBatches.map((s: any) => s.id)) + 1 : 1;
    const batchId = Number(obj.batch_id ?? params[0]);
    const code = String(obj.code ?? params[1]);
    const name = String(obj.name ?? params[2]);
    const desc = obj.description ?? (params[3] ? String(params[3]) : null);
    const now = new Date().toISOString();

    const existing = m.subBatches.find((sb: any) => sb.batch_id === batchId && sb.code === code);
    if (existing) {
      existing.name = name;
      existing.description = desc;
      existing.updated_at = now;
      return [{ insertId: existing.id, affectedRows: 1 }, []];
    } else {
      m.subBatches.push({
        id: nextId,
        batch_id: batchId,
        code,
        name,
        description: desc,
        created_at: now,
        updated_at: now,
      });
      return [{ insertId: nextId, affectedRows: 1 }, []];
    }
  }

  // ============================================================================
  // 5. TIMETABLE VERSIONS (`attendance_timetable_versions`)
  // ============================================================================
  if (upper.startsWith('DELETE FROM ATTENDANCE_TIMETABLE_VERSIONS') || upper.startsWith('DELETE FROM `ATTENDANCE_TIMETABLE_VERSIONS`')) {
    if (upper.includes('WHERE ID = ?')) {
      const id = Number(params[0]);
      m.timetableVersions = m.timetableVersions.filter((v: any) => v.id !== id);
      return [{ affectedRows: 1 }, []];
    }
    m.timetableVersions = [];
    return [{ affectedRows: 0 }, []];
  }

  if (upper.includes('FROM ATTENDANCE_TIMETABLE_VERSIONS') || upper.includes('FROM `ATTENDANCE_TIMETABLE_VERSIONS`')) {
    // 5a. Specific version by id
    if (upper.includes('WHERE ID = ?') || upper.includes('WHERE TV.ID = ?')) {
      const id = Number(params[0]);
      const found = m.timetableVersions.filter((v: any) => v.id === id);
      return [found, []];
    }

    // 5b. Overlap check query
    if (upper.includes('WHERE BATCH_ID = ? AND IS_ACTIVE = TRUE') && upper.includes('COALESCE(EFFECTIVE_TO')) {
      const bId = Number(params[0]);
      const newFrom = String(params[1]);
      const newTo = params[2] ? String(params[2]) : null;
      const overlaps = m.timetableVersions.filter((v: any) => {
        if (v.batch_id !== bId || !v.is_active) return false;
        const vFrom = v.effective_from;
        const vTo = v.effective_to || '9999-12-31';
        const targetTo = newTo || '9999-12-31';
        return newFrom <= vTo && targetTo >= vFrom;
      });
      return [overlaps, []];
    }

    // 5c. Version effective on target date
    if (upper.includes('EFFECTIVE_FROM <= ?') && (upper.includes('EFFECTIVE_TO IS NULL') || upper.includes('EFFECTIVE_TO >='))) {
      const bId = Number(params[0]);
      const targetDate = String(params[1]);
      const matched = m.timetableVersions.filter((v: any) => {
        if (v.batch_id !== bId || !v.is_active) return false;
        const vFrom = v.effective_from;
        const vTo = v.effective_to;
        return vFrom <= targetDate && (!vTo || vTo >= targetDate);
      });
      matched.sort((a: any, b: any) => b.effective_from.localeCompare(a.effective_from));
      return [matched.slice(0, 1), []];
    }

    // 5d. All versions for a batch
    if (upper.includes('WHERE TV.BATCH_ID = ?') || upper.includes('WHERE BATCH_ID = ?')) {
      const bId = Number(params[0]);
      let list = m.timetableVersions.filter((v: any) => v.batch_id === bId);
      if (upper.includes('AND IS_ACTIVE = TRUE')) {
        list = list.filter((v: any) => v.is_active);
      }
      const enriched = list.map((v: any) => {
        const creator = v.created_by ? memDb.users.find((u) => u.id === v.created_by) : null;
        return {
          ...v,
          creator_name: creator?.full_name || null,
        };
      });
      enriched.sort((a: any, b: any) => a.effective_from.localeCompare(b.effective_from));
      return [enriched, []];
    }

    return [m.timetableVersions, []];
  }

  if (upper.startsWith('INSERT INTO ATTENDANCE_TIMETABLE_VERSIONS') || upper.startsWith('INSERT INTO `ATTENDANCE_TIMETABLE_VERSIONS`')) {
    const obj = parseSqlInsertObject(sql, params);
    const nextId = m.timetableVersions.length > 0 ? Math.max(...m.timetableVersions.map((v: any) => v.id)) + 1 : 1;
    const batchId = Number(obj.batch_id ?? params[0]);
    const versionCode = String(obj.version_code ?? params[1]);
    const title = String(obj.title ?? params[2]);
    const effectiveFrom = String(obj.effective_from ?? params[3]);
    const effectiveTo = obj.effective_to !== undefined ? obj.effective_to : (params[4] ? String(params[4]) : null);
    const createdBy = obj.created_by !== undefined ? obj.created_by : (params[5] ? Number(params[5]) : null);
    const now = new Date().toISOString();

    m.timetableVersions.push({
      id: nextId,
      batch_id: batchId,
      version_code: versionCode,
      title,
      effective_from: effectiveFrom,
      effective_to: effectiveTo,
      is_active: true,
      created_by: createdBy,
      created_at: now,
      updated_at: now,
    });
    return [{ insertId: nextId, affectedRows: 1 }, []];
  }

  if (upper.startsWith('UPDATE ATTENDANCE_TIMETABLE_VERSIONS') || upper.startsWith('UPDATE `ATTENDANCE_TIMETABLE_VERSIONS`')) {
    const bId = Number(params[2]);
    const cleanFrom = String(params[3]);
    const prevDayStr = String(params[0]);

    let count = 0;
    m.timetableVersions.forEach((v: any) => {
      if (v.batch_id === bId && v.is_active && v.effective_from < cleanFrom && (!v.effective_to || v.effective_to >= cleanFrom)) {
        v.effective_to = prevDayStr;
        v.updated_at = new Date().toISOString();
        count++;
      }
    });
    return [{ affectedRows: count }, []];
  }

  // ============================================================================
  // 6. TIMETABLE SLOTS (`attendance_timetable_slots`)
  // ============================================================================
  if (upper.startsWith('DELETE FROM ATTENDANCE_TIMETABLE_SLOTS') || upper.startsWith('DELETE FROM `ATTENDANCE_TIMETABLE_SLOTS`')) {
    if (upper.includes('WHERE ID = ?')) {
      const id = Number(params[0]);
      m.timetableSlots = m.timetableSlots.filter((s: any) => s.id !== id);
      return [{ affectedRows: 1 }, []];
    }
    m.timetableSlots = [];
    return [{ affectedRows: 0 }, []];
  }

  if (upper.includes('FROM ATTENDANCE_TIMETABLE_SLOTS') || upper.includes('FROM `ATTENDANCE_TIMETABLE_SLOTS`')) {
    const enrichSlot = (slot: any) => {
      const sub = slot.subject_id ? memDb.iaSubjects?.find((s: any) => s.id === slot.subject_id) : null;
      const sb = slot.sub_batch_id ? m.subBatches.find((b: any) => b.id === slot.sub_batch_id) : null;
      return {
        ...slot,
        subject_code: sub?.code || '',
        subject_name: sub?.name || '',
        professional_year: sub?.professional_year || 1,
        sub_batch_code: sb?.code || null,
        sub_batch_name: sb?.name || null,
      };
    };

    if (upper.includes('WHERE S.ID = ?') || upper.includes('WHERE ID = ?')) {
      const id = Number(params[0]);
      const found = m.timetableSlots.filter((s: any) => s.id === id).map(enrichSlot);
      return [found, []];
    }

    if (upper.includes('WHERE S.TIMETABLE_VERSION_ID = ? AND S.WEEKDAY = ?')) {
      const vId = Number(params[0]);
      const day = String(params[1]);
      const found = m.timetableSlots
        .filter((s: any) => s.timetable_version_id === vId && s.weekday === day)
        .map(enrichSlot);
      found.sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));
      return [found, []];
    }

    if (upper.includes('WHERE S.TIMETABLE_VERSION_ID = ?') || upper.includes('WHERE TIMETABLE_VERSION_ID = ?')) {
      const vId = Number(params[0]);
      const found = m.timetableSlots
        .filter((s: any) => s.timetable_version_id === vId)
        .map(enrichSlot);
      found.sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));
      return [found, []];
    }

    if (upper.includes('WHERE S.TIMETABLE_VERSION_ID IN')) {
      const vIds = params.map(Number);
      const found = m.timetableSlots
        .filter((s: any) => vIds.includes(s.timetable_version_id))
        .map(enrichSlot);
      found.sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));
      return [found, []];
    }

    return [m.timetableSlots.map(enrichSlot), []];
  }

  if (upper.startsWith('INSERT INTO ATTENDANCE_TIMETABLE_SLOTS') || upper.startsWith('INSERT INTO `ATTENDANCE_TIMETABLE_SLOTS`')) {
    const obj = parseSqlInsertObject(sql, params);
    const nextId = m.timetableSlots.length > 0 ? Math.max(...m.timetableSlots.map((s: any) => s.id)) + 1 : 1;
    const rawSubjId = obj.subject_id !== undefined ? obj.subject_id : params[4];
    const cleanSubjId = rawSubjId !== null && rawSubjId !== undefined && rawSubjId !== '' ? Number(rawSubjId) : null;
    m.timetableSlots.push({
      id: nextId,
      timetable_version_id: Number(obj.timetable_version_id ?? params[0]),
      weekday: String(obj.weekday ?? params[1]),
      start_time: String(obj.start_time ?? params[2]),
      end_time: String(obj.end_time ?? params[3]),
      subject_id: cleanSubjId,
      class_type: String(obj.class_type ?? params[5]),
      sub_batch_id: obj.sub_batch_id !== undefined ? (obj.sub_batch_id ? Number(obj.sub_batch_id) : null) : (params[6] ? Number(params[6]) : null),
      week_pattern: String(obj.week_pattern ?? params[7] ?? 'EVERY_WEEK'),
      location_or_room: obj.location_or_room !== undefined ? obj.location_or_room : (params[8] ? String(params[8]) : null),
      notes: obj.notes !== undefined ? obj.notes : (params[9] ? String(params[9]) : null),
      created_at: new Date().toISOString(),
    });
    return [{ insertId: nextId, affectedRows: 1 }, []];
  }

  // ============================================================================
  // 7. ATTENDANCE SESSIONS (`attendance_sessions`)
  // ============================================================================
  if (upper.startsWith('DELETE FROM ATTENDANCE_SESSIONS') || upper.startsWith('DELETE FROM `ATTENDANCE_SESSIONS`')) {
    m.attendanceSessions = [];
    return [{ affectedRows: 0 }, []];
  }

  if (upper.includes('FROM ATTENDANCE_SESSIONS') || upper.includes('FROM `ATTENDANCE_SESSIONS`')) {
    if (upper.includes('COUNT(*) AS CNT FROM ATTENDANCE_SESSIONS WHERE TIMETABLE_VERSION_ID = ?')) {
      const vId = Number(params[0]);
      const cnt = m.attendanceSessions.filter((s: any) => s.timetable_version_id === vId).length;
      return [[{ cnt }], []];
    }

    if (upper.includes('WHERE TIMETABLE_VERSION_ID = ? AND SLOT_ID = ? AND ATTENDANCE_DATE = ?')) {
      const vId = Number(params[0]);
      const slotId = Number(params[1]);
      const aDate = String(params[2]).split('T')[0];
      const sbId = params[3] !== undefined && params[3] !== null ? Number(params[3]) : null;
      const found = m.attendanceSessions.filter((s: any) => {
        return (
          s.timetable_version_id === vId &&
          s.slot_id === slotId &&
          s.attendance_date === aDate &&
          ((s.sub_batch_id === null && sbId === null) || s.sub_batch_id === sbId)
        );
      });
      return [found.slice(0, 1), []];
    }

    if (upper.includes('WHERE SLOT_ID = ? AND ATTENDANCE_DATE = ?')) {
      const slotId = Number(params[0]);
      const aDate = String(params[1]).split('T')[0];
      const sbId = params[2] !== undefined && params[2] !== null ? Number(params[2]) : null;
      const found = m.attendanceSessions.filter((s: any) => {
        return (
          s.slot_id === slotId &&
          s.attendance_date === aDate &&
          ((s.sub_batch_id === null && sbId === null) || s.sub_batch_id === sbId)
        );
      });
      return [found.slice(0, 1), []];
    }

    if (upper.includes('WHERE ATS.BATCH_ID = ?') || upper.includes('WHERE BATCH_ID = ?')) {
      const bId = Number(params[0]);
      let pIdx = 1;
      let fromD: string | null = null;
      let toD: string | null = null;
      let filterSubjectId: number | null = null;
      let subBatchIds: number[] = [];
      let requireNullSubBatch = false;

      if (upper.includes('ATS.ATTENDANCE_DATE BETWEEN ? AND ?')) {
        fromD = String(params[pIdx++]);
        toD = String(params[pIdx++]);
      } else {
        if (upper.includes('ATS.ATTENDANCE_DATE >= ?')) {
          fromD = String(params[pIdx++]);
        }
        if (upper.includes('ATS.ATTENDANCE_DATE <= ?')) {
          toD = String(params[pIdx++]);
        }
      }

      if (upper.includes('SLOT.SUBJECT_ID = ?')) {
        filterSubjectId = Number(params[pIdx++]);
      }

      if (upper.includes('ATS.SUB_BATCH_ID IS NULL') && !upper.includes('ATS.SUB_BATCH_ID IN')) {
        requireNullSubBatch = true;
      } else if (upper.includes('ATS.SUB_BATCH_ID IN')) {
        while (pIdx < params.length) {
          subBatchIds.push(Number(params[pIdx++]));
        }
      }

      const found = m.attendanceSessions
        .filter((sess: any) => {
          if (sess.batch_id !== bId) return false;
          if (fromD && sess.attendance_date < fromD) return false;
          if (toD && sess.attendance_date > toD) return false;
          if (requireNullSubBatch && sess.sub_batch_id !== null) return false;
          if (subBatchIds.length > 0 && sess.sub_batch_id !== null && !subBatchIds.includes(sess.sub_batch_id)) return false;

          const slot = m.timetableSlots.find((sl: any) => sl.id === sess.slot_id);
          if (!slot) return false;
          if (filterSubjectId && slot.subject_id !== filterSubjectId) return false;

          return true;
        })
        .map((s: any) => {
          const slot = m.timetableSlots.find((sl: any) => sl.id === s.slot_id);
          const sub = slot ? memDb.iaSubjects?.find((sub: any) => sub.id === slot.subject_id) : null;
          const sb = s.sub_batch_id ? m.subBatches.find((b: any) => b.id === s.sub_batch_id) : null;
          const tv = m.timetableVersions.find((v: any) => v.id === s.timetable_version_id);
          const rec = s.created_by ? memDb.users.find((u) => u.id === s.created_by) : null;
          return {
            session_id: s.id,
            attendance_date: s.attendance_date,
            sub_batch_id: s.sub_batch_id,
            created_at: s.created_at,
            updated_at: s.updated_at,
            recorder_name: rec?.full_name || null,
            slot_id: slot?.id || s.slot_id,
            weekday: slot?.weekday || '',
            start_time: slot?.start_time || '',
            end_time: slot?.end_time || '',
            class_type: slot?.class_type || '',
            subject_id: sub?.id || slot?.subject_id || 0,
            subject_code: sub?.code || '',
            subject_name: sub?.name || '',
            sub_batch_code: sb?.code || null,
            sub_batch_name: sb?.name || null,
            timetable_version_id: tv?.id || s.timetable_version_id,
            version_code: tv?.version_code || '',
            ...s,
          };
        });

      found.sort((a: any, b: any) => {
        if (a.attendance_date !== b.attendance_date) return a.attendance_date.localeCompare(b.attendance_date);
        return a.start_time.localeCompare(b.start_time);
      });

      return [found, []];
    }

    return [m.attendanceSessions, []];
  }

  if (upper.startsWith('INSERT INTO ATTENDANCE_SESSIONS') || upper.startsWith('INSERT INTO `ATTENDANCE_SESSIONS`')) {
    const obj = parseSqlInsertObject(sql, params);
    const nextId = m.attendanceSessions.length > 0 ? Math.max(...m.attendanceSessions.map((s: any) => s.id)) + 1 : 1;
    const now = new Date().toISOString();
    m.attendanceSessions.push({
      id: nextId,
      timetable_version_id: Number(obj.timetable_version_id ?? params[0]),
      slot_id: Number(obj.slot_id ?? params[1]),
      batch_id: Number(obj.batch_id ?? params[2]),
      sub_batch_id: obj.sub_batch_id !== undefined ? (obj.sub_batch_id ? Number(obj.sub_batch_id) : null) : (params[3] !== undefined && params[3] !== null ? Number(params[3]) : null),
      attendance_date: String(obj.attendance_date ?? params[4]).split('T')[0],
      created_by: Number(obj.created_by ?? params[5] ?? 1),
      updated_by: Number(obj.updated_by ?? params[6] ?? 1),
      created_at: now,
      updated_at: now,
    });
    return [{ insertId: nextId, affectedRows: 1 }, []];
  }

  if (upper.startsWith('UPDATE ATTENDANCE_SESSIONS') || upper.startsWith('UPDATE `ATTENDANCE_SESSIONS`')) {
    const updatedBy = Number(params[0]);
    const id = Number(params[1]);
    const s = m.attendanceSessions.find((sess: any) => sess.id === id);
    if (s) {
      s.updated_by = updatedBy;
      s.updated_at = new Date().toISOString();
      return [{ affectedRows: 1 }, []];
    }
    return [{ affectedRows: 0 }, []];
  }

  // ============================================================================
  // 8. ATTENDANCE ABSENCES (`attendance_absences`)
  // ============================================================================
  if (upper.startsWith('DELETE FROM ATTENDANCE_ABSENCES') || upper.startsWith('DELETE FROM `ATTENDANCE_ABSENCES`')) {
    if (upper.includes('WHERE SESSION_ID = ?')) {
      const sessId = Number(params[0]);
      m.attendanceAbsences = m.attendanceAbsences.filter((a: any) => a.session_id !== sessId);
      return [{ affectedRows: 1 }, []];
    }
    m.attendanceAbsences = [];
    return [{ affectedRows: 0 }, []];
  }

  if (upper.includes('FROM ATTENDANCE_ABSENCES') || upper.includes('FROM `ATTENDANCE_ABSENCES`')) {
    // 8a. Absences by session_id
    if (upper.includes('WHERE SESSION_ID = ?')) {
      const sessId = Number(params[0]);
      const found = m.attendanceAbsences.filter((a: any) => a.session_id === sessId);
      return [found, []];
    }

    // 8b. Session IDs IN query
    if (upper.includes('WHERE AA.SESSION_ID IN')) {
      const sessIds = params.map(Number);
      const list = m.attendanceAbsences
        .filter((a: any) => sessIds.includes(a.session_id))
        .map((a: any) => {
          const st = memDb.students.find((s) => s.id === a.student_id);
          return {
            session_id: a.session_id,
            student_id: a.student_id,
            roll_number: st?.temporary_roll_number || st?.student_id_number || '',
            student_id_number: st?.student_id_number || '',
            permanent_university_number: st?.permanent_university_number || null,
            student_name: st?.full_name || '',
          };
        });
      list.sort((a: any, b: any) => a.roll_number.localeCompare(b.roll_number));
      return [list, []];
    }

    // 8c. Stage 4 Absences Report complex join
    if (upper.includes('WHERE ATS.BATCH_ID = ?') && upper.includes('ATS.ATTENDANCE_DATE BETWEEN ? AND ?')) {
      const batchId = Number(params[0]);
      const fromDate = String(params[1]);
      const toDate = String(params[2]);

      let pIdx = 3;
      let filterSubjectId: number | null = null;
      let filterClassType: string | null = null;
      let filterSubBatchId: number | null = null;

      if (upper.includes('AND SLOT.SUBJECT_ID = ?')) {
        filterSubjectId = Number(params[pIdx++]);
      }
      if (upper.includes('AND SLOT.CLASS_TYPE = ?')) {
        filterClassType = String(params[pIdx++]);
      }
      if (upper.includes('AND ATS.SUB_BATCH_ID = ?')) {
        filterSubBatchId = Number(params[pIdx++]);
      }

      const rows: any[] = [];
      m.attendanceAbsences.forEach((a: any) => {
        const sess = m.attendanceSessions.find((s: any) => s.id === a.session_id);
        if (!sess || sess.batch_id !== batchId) return;
        if (sess.attendance_date < fromDate || sess.attendance_date > toDate) return;
        if (filterSubBatchId !== null && sess.sub_batch_id !== filterSubBatchId) return;

        const slot = m.timetableSlots.find((sl: any) => sl.id === sess.slot_id);
        if (!slot) return;
        if (filterSubjectId && slot.subject_id !== filterSubjectId) return;
        if (filterClassType && slot.class_type !== filterClassType) return;

        const sub = memDb.iaSubjects?.find((s: any) => s.id === slot.subject_id);
        const sb = sess.sub_batch_id ? m.subBatches.find((b: any) => b.id === sess.sub_batch_id) : null;
        const student = memDb.students.find((st) => st.id === a.student_id);

        rows.push({
          absence_id: a.id,
          session_id: a.session_id,
          student_id: a.student_id,
          roll_number: student?.temporary_roll_number || student?.student_id_number || '',
          student_id_number: student?.student_id_number || '',
          permanent_university_number: student?.permanent_university_number || null,
          student_name: student?.full_name || '',
          attendance_date: sess.attendance_date,
          weekday: slot.weekday,
          start_time: slot.start_time,
          end_time: slot.end_time,
          class_type: slot.class_type,
          subject_id: sub?.id || slot.subject_id,
          subject_name: sub?.name || '',
          subject_code: sub?.code || '',
          sub_batch_id: sb?.id || null,
          sub_batch_code: sb?.code || null,
          sub_batch_name: sb?.name || null,
        });
      });

      rows.sort((a: any, b: any) => {
        if (a.attendance_date !== b.attendance_date) return a.attendance_date.localeCompare(b.attendance_date);
        if (a.start_time !== b.start_time) return a.start_time.localeCompare(b.start_time);
        return a.roll_number.localeCompare(b.roll_number);
      });

      return [rows, []];
    }

    // 8d. Absences by student_id
    if (upper.includes('WHERE STUDENT_ID = ?')) {
      const stId = Number(params[0]);
      if (upper.includes('SESSION_ID IN')) {
        const sessIds = params.slice(1).map(Number);
        const list = m.attendanceAbsences.filter((a: any) => a.student_id === stId && sessIds.includes(a.session_id));
        return [list, []];
      }
      const list = m.attendanceAbsences.filter((a: any) => a.student_id === stId);
      return [list, []];
    }

    return [m.attendanceAbsences, []];
  }

  if (upper.startsWith('INSERT INTO ATTENDANCE_ABSENCES') || upper.startsWith('INSERT INTO `ATTENDANCE_ABSENCES`')) {
    const valuesPart = sql.slice(upper.indexOf('VALUES') + 6);
    const tupleMatches = valuesPart.matchAll(/\(([^)]+)\)/g);
    let pIdx = 0;
    let count = 0;
    for (const match of tupleMatches) {
      const parts = match[1].split(',').map((s) => s.trim());
      const sessVal = parts[0] === '?' ? params[pIdx++] : Number(parts[0]);
      const stVal = parts[1] === '?' ? params[pIdx++] : Number(parts[1]);
      if (sessVal && stVal) {
        const nextId = m.attendanceAbsences.length > 0 ? Math.max(...m.attendanceAbsences.map((a: any) => a.id)) + 1 : 1;
        m.attendanceAbsences.push({
          id: nextId,
          session_id: Number(sessVal),
          student_id: Number(stVal),
          created_at: new Date().toISOString(),
        });
        count++;
      }
    }
    return [{ insertId: m.attendanceAbsences[m.attendanceAbsences.length - 1]?.id || 1, affectedRows: count }, []];
  }

  return null;
}
