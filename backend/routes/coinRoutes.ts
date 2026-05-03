import express from 'express';
import { PrismaClient } from '@prisma/client';
import { syncCoinWhitelist } from '../services/ccxtService.js';

const router = express.Router();
const prisma = new PrismaClient();

// Get all coins
router.get('/', async (req, res) => {
  try {
    const coins = await prisma.coinSettings.findMany({
      orderBy: { symbol: 'asc' }
    });
    res.json(coins);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch coins' });
  }
});

// Toggle coin status (Active/Quarantine)
router.post('/:symbol/toggle', async (req, res) => {
  try {
    const symbol = req.params.symbol.replace('-', '/'); // React router might send BTC-USDT
    const coin = await prisma.coinSettings.findUnique({ where: { symbol } });
    
    if (!coin) {
      return res.status(404).json({ error: 'Coin not found' });
    }

    const updated = await prisma.coinSettings.update({
      where: { symbol },
      data: { isActive: !coin.isActive }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle coin status' });
  }
});

// Force Sync Coins from Binance
router.post('/sync', async (req, res) => {
  try {
    await syncCoinWhitelist();
    res.json({ success: true, message: 'Coins synced successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to sync coins' });
  }
});

export default router;
