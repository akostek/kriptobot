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
    [Route("api/coins")]
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

}
