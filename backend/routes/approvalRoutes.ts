import express from 'express';
import { PrismaClient } from '@prisma/client';
import { createMarketOrder } from '../services/ccxtService.js';

const router = express.Router();
const prisma = new PrismaClient();

// Get Pending Approvals
router.get('/', async (req, res) => {
  try {
    const queue = await prisma.approvalQueue.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' }
    });
    res.json(queue);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch approval queue' });
  }
});

// Approve an action
router.post('/:id/approve', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const item = await prisma.approvalQueue.findUnique({ where: { id } });

    if (!item || item.status !== 'PENDING') {
      return res.status(400).json({ error: 'Item not found or already processed' });
    }

    // Check actual wallet balance to prevent insufficient balance error
    let tradeAmount = item.amount;
    if (item.action === 'SELL') {
      const { getWalletBalances } = await import('../services/ccxtService.js');
      const balances = await getWalletBalances();
      const baseCoin = item.symbol.split('/')[0];
      const coinBalance = balances.find(b => b.coin === baseCoin);
      
      if (!coinBalance || coinBalance.amount <= 0) {
        // Cüzdanda hiç kalmamışsa veya Binance tarafından kesilmişse, işlemi direk kapatalım.
        await prisma.approvalQueue.update({
          where: { id },
          data: { status: 'REJECTED', processedAt: new Date() }
        });
        
        // Açık işlemi de kapatalım (sıfırlanmış)
        const openTrade = await prisma.trade.findFirst({ where: { symbol: item.symbol, status: 'OPEN' } });
        if (openTrade) {
          await prisma.trade.update({
            where: { id: openTrade.id },
            data: { status: 'CLOSED', sellPrice: item.price, closedAt: new Date(), pnl: 0 }
          });
        }
        return res.status(400).json({ error: 'Cüzdanda bu coinden kalmamış (komisyon kesintisi veya satılmış). İşlem iptal edildi.' });
      }

      // Eğer cüzdandaki miktar, satmak istenenden azsa (komisyon kesilmişse), cüzdandakini sat.
      if (coinBalance.amount < tradeAmount) {
        // Binance emirlerinde hassasiyet çok önemli olduğu için %99.9'unu satalım ki
        // precision hatasına takılmayalım.
        tradeAmount = coinBalance.amount * 0.998; 
      }
    }

    // Execute the trade
    let order;
    try {
      order = await createMarketOrder(item.symbol, item.action.toLowerCase() as 'buy' | 'sell', tradeAmount);
    } catch (tradeError: any) {
      // If Binance rejects the trade (e.g. NOTIONAL, INSUFFICIENT_FUNDS), reject the approval item so it doesn't get stuck
      await prisma.approvalQueue.update({
        where: { id },
        data: { status: 'REJECTED', processedAt: new Date() }
      });
      throw tradeError; // pass to the outer catch block to format the message
    }

    // Update queue status
    await prisma.approvalQueue.update({
      where: { id },
      data: { status: 'APPROVED', processedAt: new Date() }
    });

    // Create Trade Record
    if (item.action === 'BUY') {
      await prisma.trade.create({
        data: {
          symbol: item.symbol,
          side: item.action,
          price: item.price,
          amount: tradeAmount, // Use the actual executed amount
          reason: item.reasoning,
          status: 'OPEN'
        }
      });
    } else if (item.action === 'SELL') {
      // Find open trade to close
      const openTrade = await prisma.trade.findFirst({
        where: { symbol: item.symbol, status: 'OPEN' }
      });
      
      if (openTrade) {
        const pnl = (item.price - openTrade.price) * openTrade.amount;
        await prisma.trade.update({
          where: { id: openTrade.id },
          data: {
            status: 'CLOSED',
            sellPrice: item.price,
            closedAt: new Date(),
            pnl: pnl
          }
        });
      }
    }

    // Log the action
    await prisma.tradeLog.create({
      data: {
        symbol: item.symbol,
        action: item.action,
        reasoning: `USER APPROVED: ${item.reasoning}`,
        price: item.price
      }
    });

    res.json({ success: true, message: 'İşlem başarıyla onaylandı ve borsaya iletildi.' });
  } catch (error: any) {
    let errorMessage = error.message || String(error);
    if (errorMessage.includes('NOTIONAL')) {
      errorMessage = 'Minimum işlem tutarı (5 USDT) karşılanmıyor. Bu işlem Binance tarafından reddedildi.';
    } else if (errorMessage.includes('LOT_SIZE') || errorMessage.includes('PRICE_FILTER')) {
      errorMessage = 'Miktar küsuratı hatası.';
    } else if (errorMessage.includes('INSUFFICIENT_FUNDS') || errorMessage.includes('-2010')) {
      errorMessage = 'Yetersiz bakiye.';
    } else if (errorMessage.includes('Market is closed')) {
      errorMessage = 'Bu parite Binance Testnet (Demo) üzerinde işleme kapalı. Testnet sadece belirli ana pariteleri destekler.';
    }
    res.status(500).json({ error: `Onaylama hatası: ${errorMessage}` });
  }
});

// Reject an action
router.post('/:id/reject', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    await prisma.approvalQueue.update({
      where: { id },
      data: { status: 'REJECTED', processedAt: new Date() }
    });

    res.json({ success: true, message: 'İşlem reddedildi.' });
  } catch (error) {
    res.status(500).json({ error: 'Reddetme hatası' });
  }
});

export default router;
