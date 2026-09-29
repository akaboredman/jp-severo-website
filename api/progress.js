import { send, studentRoute } from './_lib/http.js';
import { progressFor } from './_lib/progress.js';

// GET /api/progress: weekly streak, this week's goal and the anonymous community count.
export default studentRoute('GET', async (req, res, student) =>
  send(res, 200, await progressFor(student.id)));
