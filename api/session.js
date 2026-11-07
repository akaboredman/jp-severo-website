import { select, track } from './_lib/db.js';
import { send, studentRoute } from './_lib/http.js';

// GET /api/session: who the link belongs to and what they may see.
export default studentRoute('GET', async (req, res, student) => {
  const [bonuses] = await Promise.all([
    select('referral_bonuses',
      `select=granted_on,used_on&referrer_id=eq.${student.id}&order=granted_on.desc`),
    // Last access, only so the teacher knows who opened the link.
    track('students', `id=eq.${student.id}`, { last_seen_at: new Date().toISOString() }),
  ]);
  return send(res, 200, {
    firstName: student.first_name,
    // Minors never see the referral CTA.
    referralCode: student.is_minor ? null : student.referral_code,
    bonuses: { available: bonuses.filter((b) => !b.used_on).length, total: bonuses.length },
    // Aulas desmarcadas ainda sem reposição, com o link da agenda do professor.
    makeup: student.makeup_pending > 0 && /^https:\/\//.test(student.makeup_agenda_url || '')
      ? { pending: student.makeup_pending, agendaUrl: student.makeup_agenda_url }
      : null,
  });
});
