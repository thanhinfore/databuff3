import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { json, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';
import { config } from './config';

const app = express();
app.use(helmet());
app.use(json());

const limiter = rateLimit({ windowMs: 60 * 1000, max: 100 });
app.use(limiter);

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
  async (req: Request, res: Response): Promise<void> => {
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
  }
);

app.post(
  '/api/auth/login',
  [body('usernameOrEmail').notEmpty(), body('password').notEmpty()],
  async (req: Request, res: Response): Promise<void> => {
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
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
