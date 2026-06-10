import 'dotenv/config';
import app from './app.js';
import { startScheduler } from './scheduler/scheduler.js';

const port = process.env['PORT'] ?? '3001';

app.listen(Number(port), () => {
  console.log(`Server running on port ${port}`);
  startScheduler();
});
