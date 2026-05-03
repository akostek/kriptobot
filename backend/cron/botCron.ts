import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { getBalance, getOHLCV, createMarketOrder, getCurrentPrice, syncCoinWhitelist, saveBalanceHistory } from '../services/ccxtService.js';
import { analyzeMarketAndTrade } from '../services/aiService.js';

const prisma = new PrismaClient();

export const runBot = async () => {
  try {
    const setting = await prisma.setting.findUnique({ where: { id: "1" } });
    if (!setting) return;
    
    const TRADE_AMOUNT_USDT = setting.tradeAmount || 100;
    const isManualApproval = setting.isManualApproval;
    
    // Check daily trade limit (only count BUY actions to represent full trade cycles)
    const today = new Date();
    today.setHours(0,0,0,0);
    const tradesToday = await prisma.trade.count({
      where: { 
        createdAt: { gte: today },
        side: 'BUY'
      }
    });
    
    if (tradesToday >= setting.maxTradesPerDay) {
      console.log(`Daily trade limit reached (${tradesToday}/${setting.maxTradesPerDay} buys). Skipping.`);
      return;
    }

    // Get active coins to scan
    const activeCoins = await prisma.coinSettings.findMany({
      where: { isActive: true },
      orderBy: { lastScanned: 'asc' },
      take: 1 // Scan 1 coin per cycle to avoid rate limits
    });

    if (activeCoins.length === 0) {
      console.log("No active coins to scan.");
      return;
    }

    const coin = activeCoins[0]!;
    const SYMBOL = coin.symbol;

    console.log(`[${new Date().toISOString()}] Scanning ${SYMBOL}...`);
      
    const ohlcv = await getOHLCV(SYMBOL, '1h', 24);
    if (ohlcv.length === 0) return;

    // Update last scanned
    await prisma.coinSettings.update({
      where: { symbol: SYMBOL },
      data: { lastScanned: new Date() }
    });

    // Check if we already own this coin
    const openTrade = await prisma.trade.findFirst({
      where: { symbol: SYMBOL, status: 'OPEN' }
    });
    const hasOpenPosition = !!openTrade;

    console.log('Brainstorming with AI...');
    const decision = await analyzeMarketAndTrade(SYMBOL, ohlcv, hasOpenPosition);
    console.log(`AI Decision: ${decision.action} - Reason: ${decision.reasoning}`);

    const currentPrice = await getCurrentPrice(SYMBOL) || 0;

    // Log the decision
    await prisma.tradeLog.create({
      data: {
        symbol: SYMBOL,
        action: decision.action,
        reasoning: decision.reasoning,
        price: currentPrice,
      }
    });

    if (decision.action === 'BUY' || decision.action === 'SELL') {
      const amountToTrade = TRADE_AMOUNT_USDT / currentPrice;

      if (isManualApproval) {
        // Send to Approval Queue
        // First check if an identical approval is already pending
        const existingApproval = await prisma.approvalQueue.findFirst({
          where: { symbol: SYMBOL, action: decision.action, status: 'PENDING' }
        });

        if (!existingApproval) {
          await prisma.approvalQueue.create({
            data: {
              symbol: SYMBOL,
              action: decision.action,
              reasoning: decision.reasoning,
              price: currentPrice,
              amount: decision.action === 'SELL' && openTrade ? openTrade.amount : amountToTrade
            }
          });
          console.log(`Sent ${decision.action} decision for ${SYMBOL} to Approval Queue.`);
        }
      } else {
        // Fully Automatic Mode
        try {
           let tradeAmount = decision.action === 'SELL' && openTrade ? openTrade.amount : amountToTrade;
           
           if (decision.action === 'SELL') {
             const { getWalletBalances } = await import('../services/ccxtService.js');
             const balances = await getWalletBalances();
             const baseCoin = SYMBOL.split('/')[0];
             const coinBalance = balances.find(b => b.coin === baseCoin);
             
             if (!coinBalance || coinBalance.amount <= 0) {
               console.log(`Skipping SELL for ${SYMBOL}: Insufficient actual balance.`);
               if (openTrade) {
                 await prisma.trade.update({
                   where: { id: openTrade.id },
                   data: { status: 'CLOSED', sellPrice: currentPrice, closedAt: new Date(), pnl: 0 }
                 });
               }
               return; // Stop execution for this coin
             }
             if (coinBalance.amount < tradeAmount) {
               tradeAmount = coinBalance.amount * 0.998; // safe margin
             }
           }

           const order = await createMarketOrder(SYMBOL, decision.action.toLowerCase() as 'buy' | 'sell', tradeAmount);
           console.log('Trade Executed:', order.id);

           if (decision.action === 'BUY') {
             await prisma.trade.create({
               data: {
                 symbol: SYMBOL,
                 side: decision.action,
                 price: currentPrice,
                 amount: tradeAmount,
                 reason: decision.reasoning,
                 status: 'OPEN'
               }
             });
           } else if (decision.action === 'SELL') {
             if (openTrade) {
               const pnl = (currentPrice - openTrade.price) * openTrade.amount;
               await prisma.trade.update({
                 where: { id: openTrade.id },
                 data: {
                   status: 'CLOSED',
                   sellPrice: currentPrice,
                   closedAt: new Date(),
                   pnl: pnl
                 }
               });
             }
           }
        } catch (tradeError: any) {
           console.error("Binance Error:", tradeError.message);
           await prisma.tradeLog.create({
             data: {
               symbol: SYMBOL,
               action: 'ERROR',
               reasoning: `İşlem Başarısız: Bakiye Yetersiz veya API Hatası. Detay: ${tradeError.message}`,
               price: currentPrice,
             }
           });
        }
      }
    }
  } catch (error) {
    console.error('Error in runBot:', error);
  }
};

let cronJob: cron.ScheduledTask | null = null;

export const startBot = async () => {
  console.log('🤖 AI Trading Bot Engine Starting...');
  
  // Initial Sync of Coins
  await syncCoinWhitelist();

  const setting = await prisma.setting.findUnique({ where: { id: "1" } });
  const interval = setting?.scanInterval || 5;

  console.log(`Cron scheduled to run every ${interval} minutes.`);
  
  if (cronJob) cronJob.stop();

  cronJob = cron.schedule(`*/${interval} * * * *`, async () => {
    await saveBalanceHistory(); // log balance daily
    await runBot();
  });
};
