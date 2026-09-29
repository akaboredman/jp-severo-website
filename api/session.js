import { select } from './_lib/db.js';
import { send, studentRoute } from './_lib/http.js';

// GET /api/session: who the link belongs to and what they may see.
export default studentRoute('GET', async (req, res, student) => {
  const bonuses = await select('referral_bonuses',
    `select=granted_on,used_on&referrer_id=eq.${student.id}&order=granted_on.desc`);
  const canJoinRanking = !student.is_minor || Boolean(student.guardian_consent_at);
  return send(res, 200, {
    firstName: student.first_name,
    nickname: student.nickname,
    rankingOptIn: student.ranking_opt_in,
    canJoinRanking,
    // Minors never see the referral CTA.
    referralCode: student.is_minor ? null : student.referral_code,
    bonuses: { available: bonuses.filter((b) => !b.used_on).length, total: bonuses.length },
  });
});
