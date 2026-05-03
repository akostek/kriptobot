import express from 'express';
import { PrismaClient } from '@prisma/client';
import { getWalletBalances, getCurrentPrice, getAllPrices, createMarketOrder, createLimitOrder } from '../services/ccxtService.js';

const router = express.Router();
const prisma = new PrismaClient();

// Get Wallet Balances with estimated USDT value
router.get('/', async (req, res) => {
  try {
    const [balances, allPrices] = await Promise.all([
      getWalletBalances(),
      getAllPrices()
    ]);
    
    // Calculate estimated USDT value and PnL for each coin
    const enrichedBalances = await Promise.all(
      balances.map(async (b) => {
        if (b.coin === 'USDT') {
          return { ...b, price: 1, valueUsdt: b.amount, pnlPercent: 0, pnlUsdt: 0, avgBuyPrice: 1 };
        }
        
        const symbol = `${b.coin}/USDT`;
        const price = allPrices[symbol] || 0;
        
        // Find if we have an open trade for this to calculate PnL
        const openTrades = await prisma.trade.findMany({
          where: { symbol: `${b.coin}/USDT`, status: 'OPEN' }
        });

        let pnlPercent = 0;
        let pnlUsdt = 0;
        let avgBuyPrice = 0;

        if (openTrades.length > 0) {
          const totalCost = openTrades.reduce((acc, t) => acc + (t.price * t.amount), 0);
          const totalAmount = openTrades.reduce((acc, t) => acc + t.amount, 0);
          avgBuyPrice = totalCost / totalAmount;
          
          pnlPercent = ((price - avgBuyPrice) / avgBuyPrice) * 100;
          pnlUsdt = (price - avgBuyPrice) * b.amount; // Use the actual held amount for PnL
        }

        return {
          ...b,
          price: price,
          valueUsdt: b.amount * (price || 0),
          pnlPercent,
          pnlUsdt,
          avgBuyPrice
        };
      })
    );

    // Sort by value descending
    enrichedBalances.sort((a, b) => b.valueUsdt - a.valueUsdt);

    res.json(enrichedBalances);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch wallet balances' });
  }
});

// Manual Trade Endpoint
router.post('/trade', async (req, res) => {
  try {
    const { symbol, side, type, amount, price } = req.body; // side: 'buy'|'sell', type: 'market'|'limit'

    if (!symbol || !side || !type || !amount) {
      return res.status(400).json({ error: 'Eksik parametre.' });
    }

    let order;
    if (type === 'market') {
      order = await createMarketOrder(symbol, side, Number(amount));
    } else if (type === 'limit') {
      if (!price) return res.status(400).json({ error: 'Limit emir için fiyat zorunludur.' });
      order = await createLimitOrder(symbol, side, Number(amount), Number(price));
    } else {
      return res.status(400).json({ error: 'Geçersiz emir tipi.' });
    }

    const currentPrice = await getCurrentPrice(symbol);

    // Log the manual trade to database
    await prisma.tradeLog.create({
      data: {
        symbol: symbol,
        action: side.toUpperCase(),
        reasoning: `KULLANICI MANUEL İŞLEM: ${type.toUpperCase()} Emir. Miktar: ${amount}. ${price ? 'Fiyat: '+price : ''}`,
        price: currentPrice || 0,
      }
    });

    // Update Open Trades in DB to keep stats correct
    if (type === 'market') {
      if (side === 'buy') {
        await prisma.trade.create({
          data: {
            symbol: symbol,
            side: 'BUY',
            price: currentPrice || (price || 0),
            amount: Number(amount),
            reason: 'KULLANICI MANUEL ALIM',
            status: 'OPEN'
          }
        });
      } else if (side === 'sell') {
        // Try to find open trade to close
        const openTrade = await prisma.trade.findFirst({
          where: { symbol: symbol, status: 'OPEN' }
        });
        
        if (openTrade) {
          const pnl = ((currentPrice || 0) - openTrade.price) * openTrade.amount;
          await prisma.trade.update({
            where: { id: openTrade.id },
            data: {
              status: 'CLOSED',
              sellPrice: currentPrice || 0,
              closedAt: new Date(),
              pnl: pnl
            }
          });
        }
      }
    }

    res.json({ success: true, message: 'İşlem başarıyla borsaya iletildi.', orderId: order.id });
  } catch (error: any) {
    let errorMessage = error.message || String(error);
    
    if (errorMessage.includes('NOTIONAL')) {
      errorMessage = 'Binance minimum işlem tutarı (genellikle 5 USDT) karşılanmıyor. Bakiyeniz çok düşükse Binance üzerinden "Küçük Bakiyeleri BNB\'ye Çevir" özelliğini kullanmanız gerekebilir.';
    } else if (errorMessage.includes('LOT_SIZE') || errorMessage.includes('PRICE_FILTER')) {
      errorMessage = 'Miktar veya fiyat küsuratı hatası. Lütfen borsanın izin verdiği ondalık hassasiyete uygun bir değer girin.';
    } else if (errorMessage.includes('INSUFFICIENT_FUNDS') || errorMessage.includes('insufficient balance') || errorMessage.includes('-2010')) {
      errorMessage = 'Yetersiz bakiye. Lütfen bakiyenizi kontrol edin.';
    } else if (errorMessage.includes('Market is closed')) {
      errorMessage = 'Bu parite Binance Testnet (Demo) üzerinde işleme kapalı. Testnet sadece belirli ana pariteleri destekler.';
    }

    res.status(500).json({ error: `İşlem hatası: ${errorMessage}` });
  }
});

export default router;
