import ccxt from 'ccxt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const getExchange = async () => {
  const setting = await prisma.setting.findUnique({ where: { id: "1" } });
  
  const exchange = new ccxt.binance({
    apiKey: setting?.binanceKey?.trim() || '',
    secret: setting?.binanceSecret?.trim() || '',
    enableRateLimit: true,
    options: {
      defaultType: 'spot',
    },
  });
  
  if (setting?.isTestnet) {
    // Binance Sandbox mode is deprecated for some endpoints.
    // Use the new Unified Demo Trading mode instead.
    exchange.options['enableDemoTrading'] = true;
    exchange.enableDemoTrading(true);
  }
  
  return exchange;
};

export const getBalance = async (): Promise<number> => {
  try {
    const exchange = await getExchange();
    const balance = await exchange.fetchBalance();
    return Number(balance.USDT ? balance.USDT.total : 0) || 0;
  } catch (error) {
    console.error('Error fetching balance:', error);
    return 0;
  }
};

export const getOHLCV = async (symbol: string, timeframe: string = '1h', limit: number = 24) => {
  try {
    const exchange = await getExchange();
    const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
    return ohlcv.map((candle) => ({
      timestamp: candle[0],
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: candle[5],
    }));
  } catch (error) {
    console.error('Error fetching OHLCV:', error);
    return [];
  }
};

export const createMarketOrder = async (symbol: string, side: 'buy' | 'sell', amount: number) => {
  try {
    const exchange = await getExchange();
    const order = await exchange.createMarketOrder(symbol, side, amount);
    return order;
  } catch (error) {
    console.error(`Error creating ${side} order:`, error);
    throw error;
  }
};

export const getCurrentPrice = async (symbol: string) => {
  try {
    const exchange = await getExchange();
    const ticker = await exchange.fetchTicker(symbol);
    return ticker.last;
  } catch (error) {
    console.error('Error fetching ticker:', error);
    return 0;
  }
};

export const getAllPrices = async () => {
  try {
    const exchange = await getExchange();
    const tickers = await exchange.fetchTickers();
    const prices: Record<string, number> = {};
    for (const [symbol, ticker] of Object.entries(tickers)) {
      prices[symbol] = ticker.last || 0;
    }
    return prices;
  } catch (error) {
    console.error('Error fetching all tickers:', error);
    return {};
  }
};

export const syncCoinWhitelist = async () => {
  try {
    const exchange = await getExchange();
    await exchange.loadMarkets();
    const allSymbols = Object.keys(exchange.markets);
    
    // Sadece USDT spot paritelerini al
    const usdtPairs = allSymbols.filter(s => s.endsWith('/USDT') && exchange.markets[s].spot);

    // Mevcut db'deki coinleri al
    const currentCoins = await prisma.coinSettings.findMany();
    const currentSymbols = new Set(currentCoins.map(c => c.symbol));

    // Yeni olanları bul
    const newPairs = usdtPairs.filter(s => !currentSymbols.has(s));
    
    if (newPairs.length > 0) {
      // Create new pairs in DB, limit to ~100 to avoid huge initial load
      const toAdd = newPairs.slice(0, 150).map(s => ({ symbol: s, isActive: true }));
      await prisma.coinSettings.createMany({
        data: toAdd,
      });
      console.log(`✅ Synced ${toAdd.length} new USDT pairs to DB.`);
    }
  } catch (error) {
    console.error('Error syncing coins:', error);
  }
};
export const saveBalanceHistory = async () => {
  try {
    const currentBalance = await getBalance();
    
    // Check if we already logged today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const existing = await prisma.balanceHistory.findFirst({
      where: {
        date: { gte: startOfDay }
      }
    });

    if (!existing) {
      await prisma.balanceHistory.create({
        data: { balance: currentBalance }
      });
      console.log(`✅ Saved daily balance history: $${currentBalance}`);
    }
  } catch (error) {
    console.error('Error saving balance history:', error);
  }
};

export const getWalletBalances = async () => {
  try {
    const exchange = await getExchange();
    const balance = await exchange.fetchBalance();
    
    // Yalnızca 0'dan büyük olan kullanılabilir (free) bakiyeleri filtrele
    const nonZeroBalances = Object.entries(balance.free)
      .filter(([coin, amount]) => amount && Number(amount) > 0)
      .map(([coin, amount]) => ({
        coin,
        amount: Number(amount)
      }));

    return nonZeroBalances;
  } catch (error) {
    console.error('Error fetching wallet balances:', error);
    return [];
  }
};

export const createLimitOrder = async (symbol: string, side: 'buy' | 'sell', amount: number, price: number) => {
  try {
    const exchange = await getExchange();
    const order = await exchange.createLimitOrder(symbol, side, amount, price);
    return order;
  } catch (error) {
    console.error(`Error creating limit ${side} order:`, error);
    throw error;
  }
};
