import { select } from './_lib/db.js';
import { send, studentRoute } from './_lib/http.js';

const TOP = 5;

// GET /api/ranking: this week's top 5 (nicknames only) plus the caller's position.
export default studentRoute('GET', async (req, res, student) => {
  const rows = await select('weekly_ranking',
    'select=student_id,nickname,points&order=points.desc,nickname.asc');
  const ranked = rows.map((row, i) => ({ ...row, position: i + 1 }));
  const me = ranked.find((row) => row.student_id === student.id);
  return send(res, 200, {
    top: ranked.slice(0, TOP).map(({ position, nickname, points, student_id }) =>
      ({ position, nickname, points, isMe: student_id === student.id })),
    me: me ? { position: me.position, points: me.points } : null,
    participating: Boolean(me) || student.ranking_opt_in,
  });
});
