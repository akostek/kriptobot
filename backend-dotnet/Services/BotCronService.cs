using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using KriptoBot.API.Data;
using KriptoBot.API.Models;

namespace KriptoBot.API.Services
{
    public class BotCronService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly JsonDatabase _db;

        public BotCronService(IServiceProvider serviceProvider, JsonDatabase db)
        {
            _serviceProvider = serviceProvider;
            _db = db;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            Console.WriteLine("🤖 AI Trading Bot Engine Starting (SaaS Mode)...");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    // Loop through all users
                    foreach (var user in _db.Users.Values)
                    {
                        var settings = _db.Settings.Values.FirstOrDefault(s => s.UserId == user.Id);
                        if (settings == null || string.IsNullOrEmpty(settings.BinanceKey) || string.IsNullOrEmpty(settings.OpenaiKey))
                        {
                            continue; // Skip inactive users
                        }

                        // Run user specific bot process
                        await ProcessUserBot(user.Id, settings);
                    }
                    
                    _db.SaveChanges(); // Persist any changes
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error in Cron Loop: {ex.Message}");
                }

                // In a real SaaS this should be dynamic per user, but for simplicity we'll just check every minute
                // The ProcessUserBot handles the actual ScanInterval logic per user
                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }
        }

        private async Task ProcessUserBot(string userId, Setting settings)
        {
            using var scope = _serviceProvider.CreateScope();
            var binanceService = scope.ServiceProvider.GetRequiredService<BinanceService>();
            var aiService = scope.ServiceProvider.GetRequiredService<AiTradeService>();

            // Check if it's time to scan based on user's scan interval
            // For simplicity, we assume we scan 1 coin per cycle per user
            var activeCoins = _db.CoinSettings.Values
                .Where(c => c.UserId == userId && c.IsActive)
                .OrderBy(c => c.LastScanned ?? DateTime.MinValue)
                .ToList();

            if (!activeCoins.Any()) return;

            var coin = activeCoins.First();
            
            // Respect ScanInterval
            if (coin.LastScanned.HasValue && (DateTime.UtcNow - coin.LastScanned.Value).TotalMinutes < settings.ScanInterval)
            {
                return; // Not time yet
            }

            var symbol = coin.Symbol;
            Console.WriteLine($"[{DateTime.UtcNow:O}] Scanning {symbol} for User {userId}...");

            try
            {
                var ohlcv = await binanceService.GetOHLCV(userId, symbol);
                if (!ohlcv.Any()) return;

                coin.LastScanned = DateTime.UtcNow;

                var hasOpenPosition = _db.Trades.Values.Any(t => t.UserId == userId && t.Symbol == symbol && t.Status == "OPEN");
                var currentPrice = await binanceService.GetCurrentPrice(symbol);

                var decision = await aiService.AnalyzeMarketAndTrade(userId, symbol, ohlcv, hasOpenPosition);
                Console.WriteLine($"User {userId} | AI Decision for {symbol}: {decision.action} - {decision.reasoning}");

                // Log decision
                var log = new TradeLog { UserId = userId, Symbol = symbol, Action = decision.action, Reasoning = decision.reasoning, Price = (double)currentPrice };
                _db.TradeLogs.TryAdd(log.Id, log);

                if (decision.action == "BUY" || decision.action == "SELL")
                {
                    var amountToTrade = settings.TradeAmount / (double)currentPrice;
                    var openTrade = _db.Trades.Values.FirstOrDefault(t => t.UserId == userId && t.Symbol == symbol && t.Status == "OPEN");
                    var tradeAmount = decision.action == "SELL" && openTrade != null ? openTrade.Amount : amountToTrade;

                    if (settings.IsManualApproval)
                    {
                        var exists = _db.ApprovalQueues.Values.Any(a => a.UserId == userId && a.Symbol == symbol && a.Action == decision.action && a.Status == "PENDING");
                        if (!exists)
                        {
                            var queue = new ApprovalQueue
                            {
                                UserId = userId,
                                Symbol = symbol,
                                Action = decision.action,
                                Reasoning = decision.reasoning,
                                Price = (double)currentPrice,
                                Amount = tradeAmount
                            };
                            _db.ApprovalQueues.TryAdd(queue.Id, queue);
                            Console.WriteLine($"Sent {decision.action} to Approval Queue for User {userId}");
                        }
                    }
                    else
                    {
                        // Automatic Execution
                        if (decision.action == "SELL")
                        {
                            var balances = await binanceService.GetWalletBalances(userId);
                            var baseCoin = symbol.Split('/')[0];
                            var coinBalanceData = balances.FirstOrDefault(b => b.coin == baseCoin);
                            
                            if (coinBalanceData == null || (double)coinBalanceData.amount <= 0)
                            {
                                Console.WriteLine($"Skipping SELL for {symbol}: Insufficient actual balance.");
                                if (openTrade != null)
                                {
                                    openTrade.Status = "CLOSED";
                                    openTrade.SellPrice = (double)currentPrice;
                                    openTrade.ClosedAt = DateTime.UtcNow;
                                    openTrade.Pnl = 0;
                                }
                                return;
                            }
                            
                            if ((double)coinBalanceData.amount < tradeAmount)
                            {
                                tradeAmount = (double)coinBalanceData.amount * 0.998;
                            }
                        }

                        var order = await binanceService.CreateMarketOrder(userId, symbol, decision.action, (decimal)tradeAmount);
                        Console.WriteLine($"Trade Executed for User {userId}: {order.id}");

                        if (decision.action == "BUY")
                        {
                            var t = new Trade
                            {
                                UserId = userId,
                                Symbol = symbol,
                                Side = "BUY",
                                Price = (double)currentPrice,
                                Amount = tradeAmount,
                                Reason = decision.reasoning,
                                Status = "OPEN"
                            };
                            _db.Trades.TryAdd(t.Id, t);
                        }
                        else if (decision.action == "SELL" && openTrade != null)
                        {
                            openTrade.Status = "CLOSED";
                            openTrade.SellPrice = (double)currentPrice;
                            openTrade.ClosedAt = DateTime.UtcNow;
                            openTrade.Pnl = ((double)currentPrice - openTrade.Price) * openTrade.Amount;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"User {userId} | Error scanning {symbol}: {ex.Message}");
                var errLog = new TradeLog { UserId = userId, Symbol = symbol, Action = "ERROR", Reasoning = $"API Hatası: {ex.Message}", Price = 0 };
                _db.TradeLogs.TryAdd(errLog.Id, errLog);
            }
        }
    }
}
