using System.Linq;
using System.Security.Claims;
using KriptoBot.API.Data;
using KriptoBot.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KriptoBot.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class CoinsController : ControllerBase
    {
        private readonly JsonDatabase _db;

        public CoinsController(JsonDatabase db)
        {
            _db = db;
        }

        private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

        [HttpGet]
        public IActionResult Get()
        {
            var coins = _db.CoinSettings.Values.Where(c => c.UserId == UserId).ToList();
            if (!coins.Any())
            {
                var defaultCoins = new[] { "BTC/USDT", "ETH/USDT", "BNB/USDT" };
                foreach (var c in defaultCoins)
                {
                    var coin = new CoinSettings { UserId = UserId, Symbol = c, IsActive = true };
                    _db.CoinSettings.TryAdd($"{UserId}_{c}", coin);
                }
                _db.SaveChanges();
                coins = _db.CoinSettings.Values.Where(c => c.UserId == UserId).ToList();
            }
            return Ok(coins);
        }

        [HttpPost("toggle")]
        public IActionResult Toggle([FromBody] CoinSettings dto)
        {
            var key = $"{UserId}_{dto.Symbol}";
            if (_db.CoinSettings.TryGetValue(key, out var coin))
            {
                coin.IsActive = !coin.IsActive;
            }
            else
            {
                _db.CoinSettings.TryAdd(key, new CoinSettings { UserId = UserId, Symbol = dto.Symbol, IsActive = true });
            }
            _db.SaveChanges();
            return Ok(new { success = true });
        }
    }

    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class DashboardController : ControllerBase
    {
        private readonly JsonDatabase _db;

        public DashboardController(JsonDatabase db)
        {
            _db = db;
        }

        private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

        [HttpGet("stats")]
        public IActionResult GetStats()
        {
            var trades = _db.Trades.Values.Where(t => t.UserId == UserId).ToList();
            var totalTrades = trades.Count;
            var winTrades = trades.Count(t => t.Status == "CLOSED" && t.Pnl > 0);
            var winRate = totalTrades > 0 ? (double)winTrades / trades.Count(t => t.Status == "CLOSED") * 100 : 0;
            var totalPnl = trades.Sum(t => t.Pnl ?? 0);

            var openTrades = trades.Where(t => t.Status == "OPEN").Select(t => new
            {
                id = t.Id,
                symbol = t.Symbol,
                type = t.Side,
                entryPrice = t.Price,
                amount = t.Amount,
                currentPrice = t.Price, // Real price handled in frontend via wallet or binance service
                date = t.CreatedAt
            }).ToList();

            var recentActivity = _db.TradeLogs.Values
                .Where(t => t.UserId == UserId)
                .OrderByDescending(t => t.CreatedAt)
                .Take(10)
                .Select(t => new
                {
                    id = t.Id,
                    type = t.Action,
                    symbol = t.Symbol,
                    date = t.CreatedAt,
                    status = "Tamamlandı"
                }).ToList();

            return Ok(new {
                totalTrades,
                winRate = double.IsNaN(winRate) ? 0 : winRate,
                totalPnl,
                openTrades,
                recentActivity
            });
        }
    }
}
