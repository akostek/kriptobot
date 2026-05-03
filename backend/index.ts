import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { startBot, runBot } from './cron/botCron.js';
import { getBalance } from './services/ccxtService.js';
import approvalRoutes from './routes/approvalRoutes.js';
import coinRoutes from './routes/coinRoutes.js';
import walletRoutes from './routes/walletRoutes.js';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Mount Routers
app.use('/api/approvals', approvalRoutes);
app.use('/api/coins', coinRoutes);
app.use('/api/wallet', walletRoutes);

// API Routes
app.get('/api/stats', async (req, res) => {
  try {
    const balance = await getBalance();
    const openTrades = await prisma.trade.count({ where: { status: 'OPEN' } });
    const totalTrades = await prisma.trade.count();
    
    // Calculate total PnL
    const closedTrades = await prisma.trade.findMany({ where: { status: 'CLOSED' } });
    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

    // Get balance history
    const history = await prisma.balanceHistory.findMany({
      orderBy: { date: 'asc' },
      take: 30
    });
    
    res.json({
      balance,
      openTrades,
      totalTrades,
      totalPnl,
      history
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    const logs = await prisma.tradeLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Settings API
app.get('/api/settings', async (req, res) => {
  try {
    let setting = await prisma.setting.findUnique({ where: { id: "1" } });
    if (!setting) {
      setting = await prisma.setting.create({
        data: {
          id: "1",
          binanceKey: process.env.BINANCE_API_KEY || "",
          binanceSecret: process.env.BINANCE_API_SECRET || "",
          openaiKey: process.env.OPENAI_API_KEY || "",
          symbol: "BTC/USDT",
          tradeAmount: 100
        }
      });
    }
    res.json(setting);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.post('/api/settings', async (req, res) => {
  const { binanceKey, binanceSecret, openaiKey, aiModel, symbol, tradeAmount, isManualApproval, maxTradesPerDay, scanInterval } = req.body;
  try {
    const setting = await prisma.setting.upsert({
      where: { id: "1" },
      update: {
        binanceKey,
        binanceSecret,
        openaiKey,
        aiModel,
        symbol,
        tradeAmount: Number(tradeAmount),
        isManualApproval,
        maxTradesPerDay: Number(maxTradesPerDay),
        scanInterval: Number(scanInterval)
      },
      create: {
        id: "1",
        binanceKey,
        binanceSecret,
        openaiKey,
        aiModel: aiModel || 'gpt-4o-mini',
        symbol,
        tradeAmount: Number(tradeAmount),
        isManualApproval,
        maxTradesPerDay: Number(maxTradesPerDay),
        scanInterval: Number(scanInterval)
      }
    });
    res.json(setting);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

app.get('/api/trades', async (req, res) => {
  try {
    const trades = await prisma.trade.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(trades);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

app.post('/api/force-run', async (req, res) => {
  try {
    // Run asynchronously so we don't block the request if it takes long
    runBot();
    res.json({ success: true, message: 'Bot tetiklendi!' });
  } catch (error) {
    res.status(500).json({ error: 'Tetkileme hatası' });
  }
});

app.post('/api/restart-cron', async (req, res) => {
  try {
    startBot();
    res.json({ success: true, message: 'Bot motoru yeni ayarlarla yeniden başlatıldı.' });
  } catch (error) {
    res.status(500).json({ error: 'Yeniden başlatma hatası' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Kripto Bot Backend is running on http://localhost:${PORT}`);
  startBot();
});
