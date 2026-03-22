import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRouter from './auth/auth.router.js';
import tasksRouter from './tasks/tasks.router.js';
import tagsRouter from './tags/tags.router.js';

const app = express();

app.use(cors({ origin: process.env['CORS_ORIGIN'], credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/tags', tagsRouter);

export default app;
