using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using KriptoBot.API.Data;
using KriptoBot.API.Models;
using KriptoBot.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KriptoBot.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class WalletController : ControllerBase
    {
        private readonly JsonDatabase _db;
        private readonly BinanceService _binanceService;

        public WalletController(JsonDatabase db, BinanceService binanceService)
        {
            _db = db;
            _binanceService = binanceService;
        }

        private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

        [HttpGet]
        public async Task<IActionResult> GetWallet()
        {
            try
            {
                var balances = await _binanceService.GetWalletBalances(UserId);
                var allPrices = await _binanceService.GetAllPrices();

                var enrichedBalances = balances.Select(b =>
                {
                    string coin = b.coin;
                    double amount = (double)b.amount;
                    
                    if (coin == "USDT")
                    {
                        return new { coin, amount, price = 1m, valueUsdt = amount, pnlPercent = 0.0, pnlUsdt = 0.0, avgBuyPrice = 1.0 };
                    }

                    var symbol = $"{coin}/USDT";
                    decimal currentPrice = allPrices.ContainsKey(symbol.Replace("/", "")) ? allPrices[symbol.Replace("/", "")] : 0;
                    
                    var openTrades = _db.Trades.Values.Where(t => t.UserId == UserId && t.Symbol == symbol && t.Status == "OPEN").ToList();
                    
                    double pnlPercent = 0;
                    double pnlUsdt = 0;
                    double avgBuyPrice = 0;

                    if (openTrades.Any())
                    {
                        double totalCost = openTrades.Sum(t => t.Price * t.Amount);
                        double totalAmount = openTrades.Sum(t => t.Amount);
                        avgBuyPrice = totalCost / totalAmount;
                        
                        pnlPercent = (((double)currentPrice - avgBuyPrice) / avgBuyPrice) * 100;
                        pnlUsdt = ((double)currentPrice - avgBuyPrice) * amount;
                    }

                    return new {
                        coin,
                        amount,
                        price = currentPrice,
                        valueUsdt = amount * (double)currentPrice,
                        pnlPercent,
                        pnlUsdt,
                        avgBuyPrice
                    };
                }).OrderByDescending(x => x.valueUsdt).ToList();

                return Ok(enrichedBalances);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Cüzdan bakiyeleri alınamadı: " + ex.Message });
            }
        }

        public class ManualTradeDto { public string Symbol {get;set;}=""; public string Side {get;set;}=""; public double Amount {get;set;} }

        [HttpPost("trade")]
        public async Task<IActionResult> ManualTrade([FromBody] ManualTradeDto dto)
        {
            try
            {
                var order = await _binanceService.CreateMarketOrder(UserId, dto.Symbol, dto.Side, (decimal)dto.Amount);
                var currentPrice = await _binanceService.GetCurrentPrice(dto.Symbol);

                var log = new TradeLog { UserId = UserId, Symbol = dto.Symbol, Action = dto.Side.ToUpper(), Reasoning = "KULLANICI MANUEL İŞLEM", Price = (double)currentPrice };
                _db.TradeLogs.TryAdd(log.Id, log);

                if (dto.Side.ToUpper() == "BUY")
                {
                    var t = new Trade { UserId = UserId, Symbol = dto.Symbol, Side = "BUY", Price = (double)currentPrice, Amount = dto.Amount, Reason = "KULLANICI MANUEL", Status = "OPEN" };
                    _db.Trades.TryAdd(t.Id, t);
                }
                else if (dto.Side.ToUpper() == "SELL")
                {
                    var openTrade = _db.Trades.Values.FirstOrDefault(t => t.UserId == UserId && t.Symbol == dto.Symbol && t.Status == "OPEN");
                    if (openTrade != null)
                    {
                        openTrade.Status = "CLOSED";
                        openTrade.SellPrice = (double)currentPrice;
                        openTrade.ClosedAt = DateTime.UtcNow;
                        openTrade.Pnl = ((double)currentPrice - openTrade.Price) * openTrade.Amount;
                    }
                }
                _db.SaveChanges();

                return Ok(new { success = true, message = "İşlem başarıyla borsaya iletildi." });
            }
            catch (Exception ex)
            {
                var msg = ex.Message;
                if (msg.Contains("NOTIONAL")) msg = "Binance minimum işlem tutarı (genellikle 5 USDT) karşılanmıyor.";
                else if (msg.Contains("LOT_SIZE")) msg = "Miktar veya fiyat küsuratı hatası.";
                else if (msg.Contains("INSUFFICIENT_FUNDS")) msg = "Yetersiz bakiye.";
                else if (msg.Contains("Market is closed")) msg = "Bu parite kapalı veya testnet üzerinde desteklenmiyor.";
                
                return StatusCode(500, new { error = "İşlem hatası: " + msg });
            }
        }
    }
}
