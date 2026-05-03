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
    public class ApprovalController : ControllerBase
    {
        private readonly JsonDatabase _db;
        private readonly BinanceService _binanceService;

        public ApprovalController(JsonDatabase db, BinanceService binanceService)
        {
            _db = db;
            _binanceService = binanceService;
        }

        private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

        [HttpGet]
        public IActionResult Get()
        {
            var queue = _db.ApprovalQueues.Values
                .Where(a => a.UserId == UserId && a.Status == "PENDING")
                .OrderByDescending(a => a.CreatedAt)
                .ToList();
            return Ok(queue);
        }

        [HttpPost("{id}/approve")]
        public async Task<IActionResult> Approve(string id)
        {
            var item = _db.ApprovalQueues.Values.FirstOrDefault(a => a.Id == id && a.UserId == UserId);
            if (item == null || item.Status != "PENDING") return BadRequest(new { error = "Bulunamadı veya zaten işlenmiş." });

            try
            {
                double tradeAmount = item.Amount;

                if (item.Action == "SELL")
                {
                    var balances = await _binanceService.GetWalletBalances(UserId);
                    var baseCoin = item.Symbol.Split('/')[0];
                    var coinBalance = balances.FirstOrDefault(b => b.coin == baseCoin);
                    
                    if (coinBalance == null || (double)coinBalance.amount <= 0)
                    {
                        item.Status = "REJECTED";
                        item.ProcessedAt = DateTime.UtcNow;
                        
                        var ot = _db.Trades.Values.FirstOrDefault(t => t.UserId == UserId && t.Symbol == item.Symbol && t.Status == "OPEN");
                        if (ot != null)
                        {
                            ot.Status = "CLOSED";
                            ot.SellPrice = item.Price;
                            ot.ClosedAt = DateTime.UtcNow;
                            ot.Pnl = 0;
                        }
                        _db.SaveChanges();
                        return BadRequest(new { error = "Cüzdanda bu coinden kalmamış." });
                    }

                    if ((double)coinBalance.amount < tradeAmount)
                    {
                        tradeAmount = (double)coinBalance.amount * 0.998;
                    }
                }

                var order = await _binanceService.CreateMarketOrder(UserId, item.Symbol, item.Action, (decimal)tradeAmount);
                
                item.Status = "APPROVED";
                item.ProcessedAt = DateTime.UtcNow;

                if (item.Action == "BUY")
                {
                    var t = new Trade { UserId = UserId, Symbol = item.Symbol, Side = "BUY", Price = item.Price, Amount = tradeAmount, Reason = item.Reasoning, Status = "OPEN" };
                    _db.Trades.TryAdd(t.Id, t);
                }
                else if (item.Action == "SELL")
                {
                    var openTrade = _db.Trades.Values.FirstOrDefault(t => t.UserId == UserId && t.Symbol == item.Symbol && t.Status == "OPEN");
                    if (openTrade != null)
                    {
                        openTrade.Status = "CLOSED";
                        openTrade.SellPrice = item.Price;
                        openTrade.ClosedAt = DateTime.UtcNow;
                        openTrade.Pnl = (item.Price - openTrade.Price) * openTrade.Amount;
                    }
                }

                var log = new TradeLog { UserId = UserId, Symbol = item.Symbol, Action = item.Action, Reasoning = $"USER APPROVED: {item.Reasoning}", Price = item.Price };
                _db.TradeLogs.TryAdd(log.Id, log);

                _db.SaveChanges();
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                item.Status = "REJECTED";
                item.ProcessedAt = DateTime.UtcNow;
                _db.SaveChanges();

                var msg = ex.Message;
                if (msg.Contains("NOTIONAL")) msg = "Minimum işlem tutarı (5 USDT) karşılanmıyor.";
                else if (msg.Contains("Market is closed")) msg = "Testnet bu pariteye kapalı.";
                return StatusCode(500, new { error = "Onaylama hatası: " + msg });
            }
        }

        [HttpPost("{id}/reject")]
        public IActionResult Reject(string id)
        {
            var item = _db.ApprovalQueues.Values.FirstOrDefault(a => a.Id == id && a.UserId == UserId);
            if (item != null)
            {
                item.Status = "REJECTED";
                item.ProcessedAt = DateTime.UtcNow;
                _db.SaveChanges();
            }
            return Ok(new { success = true });
        }
    }
}
