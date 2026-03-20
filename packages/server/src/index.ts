import 'dotenv/config';
import app from './app.js';

const port = process.env['PORT'] ?? '3001';

app.listen(Number(port), () => {
  console.log(`Server running on port ${port}`);
});
