import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { json, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import { prisma } from './prisma';
import { config } from './config';
import { authenticate, requireRole, AuthRequest } from './auth';
import { Prisma } from '@prisma/client';

const app = express();
app.use(helmet());
app.use(json());

const limiter = rateLimit({ windowMs: 60 * 1000, max: 100 });
app.use(limiter);

function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.post(
  '/api/auth/register',
  [
    body('username').isLength({ min: 3 }).trim(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const { username, email, password } = req.body;
    const existing = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
    if (existing) {
      res.status(409).json({ error: 'User exists' });
      return;
    }
    const password_hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { username, email, password_hash } });
  res.status(201).json({ id: user.id, username: user.username, email: user.email });
  })
);

app.post(
  '/api/auth/login',
  [body('usernameOrEmail').notEmpty(), body('password').notEmpty()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const { usernameOrEmail, password } = req.body;
    const user = await prisma.user.findFirst({ where: { OR: [{ username: usernameOrEmail }, { email: usernameOrEmail }] } });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const token = jwt.sign({ userId: user.id, username: user.username }, config.jwtSecret, { expiresIn: '1h' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  })
);

// Middleware to attach authenticated user
app.use(asyncHandler(authenticate));

// Create a job with an array of task inputs
app.post(
  '/api/jobs',
  [body('user_prompt').notEmpty(), body('data').isArray({ min: 1 })],
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !user.roles.includes('requester')) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const { user_prompt, target_column_name, original_filename, data } = req.body;
    const pointsCost = data.length;
    if (user.points < pointsCost) {
      res.status(402).json({ error: 'Insufficient points' });
      return;
    }

    const job = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { points: { decrement: pointsCost } },
      });
      const newJob = await tx.job.create({
        data: {
          requester_id: updatedUser.id,
          user_prompt,
          target_column_name,
          original_filename,
          total_tasks: data.length,
          points_cost: pointsCost,
        },
      });
      await tx.pointTransaction.create({
        data: {
          user_id: updatedUser.id,
          transaction_type: 'job_creation_debit',
          amount: -pointsCost,
          related_job_id: newJob.id,
        },
      });
      for (const [idx, input] of (data as string[]).entries()) {
        await tx.task.create({
          data: {
            job_id: newJob.id,
            original_row_id: idx,
            input_data: input,
          },
        });
      }
      return newJob;
    });

    res.status(201).json({ job_id: job.id, total_tasks: job.total_tasks });
  })
);

// List jobs for the current requester
app.get(
  '/api/jobs',
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const jobs = await prisma.job.findMany({
      where: { requester_id: req.user!.id },
      orderBy: { created_at: 'desc' },
    });
    res.json(jobs);
  })
);

// Worker fetch tasks
app.get(
  '/api/tasks/batch',
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !user.roles.includes('worker')) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const limit = parseInt(req.query.limit as string) || 10;
    const tasks = await prisma.task.findMany({
      where: { status: 'pending' },
      orderBy: { created_at: 'asc' },
      take: limit,
    });
    const assignments = await prisma.$transaction(
      tasks.map((t: { id: number }) =>
        prisma.taskAssignment.create({
          data: {
            task_id: t.id,
            assigned_worker_id: user.id,
          },
        })
      )
    );
    await prisma.task.updateMany({
      where: { id: { in: tasks.map((t: { id: number }) => t.id) } },
      data: { status: 'assigned' },
    });
    res.json({ assignments: assignments.map((a: any, i: number) => ({ id: a.id, task: tasks[i] })) });
  })
);

// Worker submit task results
app.post(
  '/api/tasks/results',
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const results: { id: number; output: string }[] = req.body.results;
    if (!Array.isArray(results) || results.length === 0) {
      res.status(400).json({ error: 'Invalid results' });
      return;
    }
    for (const r of results) {
      const assignment = await prisma.taskAssignment.findUnique({ where: { id: r.id } });
      if (!assignment || assignment.assigned_worker_id !== req.user!.id) continue;
      await prisma.taskAssignment.update({
        where: { id: r.id },
        data: { worker_output_label: r.output, status: 'submitted', submitted_at: new Date() },
      });
      await prisma.task.update({ where: { id: assignment.task_id }, data: { output_label: r.output, status: 'completed' } });
      await prisma.pointTransaction.create({
        data: {
          user_id: req.user!.id,
          transaction_type: 'task_completion_credit',
          amount: 1,
          related_task_assignment_id: r.id,
        },
      });
      await prisma.user.update({ where: { id: req.user!.id }, data: { points: { increment: 1 } } });
    }
    res.json({});
  })
);


const PORT = process.env.PORT || 3000;
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
