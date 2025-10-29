import { Router } from 'express';

const router = Router();

// POST /api/v1/jumps -> compute & persist metrics (stub)
router.post('/', (req, res) => {
  res.status(501).json({ message: 'Not implemented: create jump' });
});

// GET /api/v1/jumps/:id -> details (stub)
router.get('/:id', (req, res) => {
  res.status(501).json({ message: 'Not implemented: get jump' });
});

export default router;
