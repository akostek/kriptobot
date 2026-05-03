using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using KriptoBot.API.Data;
using KriptoBot.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KriptoBot.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/stats")]
    public class StatsController : ControllerBase
    {
        private readonly JsonDatabase _db;
        private readonly BinanceService _binanceService;

        public StatsController(JsonDatabase db, BinanceService binanceService)
        {
            _db = db;
            _binanceService = binanceService;
        }

        private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

        [HttpGet]
        public async Task<IActionResult> Get()
        {
            // Calculate Total Bot Trades
            var totalBotTrades = _db.Trades.Values.Count(t => t.UserId == UserId);

            // Calculate Net PNL
            var closedTrades = _db.Trades.Values.Where(t => t.UserId == UserId && t.Status == "CLOSED").ToList();
            double netPnl = closedTrades.Sum(t => t.Pnl ?? 0);

            // Calculate Balance
            double totalBalance = 0;
            try
            {
                var balances = await _binanceService.GetWalletBalances(UserId);
                var allPrices = await _binanceService.GetAllPrices();

                foreach (var b in balances)
                {
                    string coin = b.Coin;
                    double amount = (double)b.Amount;

                    if (coin == "USDT")
                    {
                        totalBalance += amount;
                    }
                    else
                    {
                        var symbol = $"{coin}/USDT";
                        decimal price = allPrices.ContainsKey(symbol.Replace("/", "")) ? allPrices[symbol.Replace("/", "")] : 0;
                        totalBalance += amount * (double)price;
                    }
                }
            }
            catch
            {
                // If Binance API fails (e.g. wrong key), keep balance at 0 but return other stats
            }

            return Ok(new
            {
                balance = totalBalance,
                netPnl = netPnl,
                totalBotTrades = totalBotTrades
            });
        }
    }
}
