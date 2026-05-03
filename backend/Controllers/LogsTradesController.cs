using System.Linq;
using System.Security.Claims;
using KriptoBot.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KriptoBot.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/logs")]
    public class LogsController : ControllerBase
    {
        private readonly JsonDatabase _db;

        public LogsController(JsonDatabase db)
        {
            _db = db;
        }

        private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

        [HttpGet]
        public IActionResult Get()
        {
            var logs = _db.TradeLogs.Values
                .Where(t => t.UserId == UserId)
                .OrderByDescending(t => t.CreatedAt)
                .Take(50)
                .ToList();
            return Ok(logs);
        }
    }

    [Authorize]
    [ApiController]
    [Route("api/trades")]
    public class TradesController : ControllerBase
    {
        private readonly JsonDatabase _db;

        public TradesController(JsonDatabase db)
        {
            _db = db;
        }

        private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

        [HttpGet]
        public IActionResult Get()
        {
            var trades = _db.Trades.Values
                .Where(t => t.UserId == UserId)
                .OrderByDescending(t => t.CreatedAt)
                .ToList();
            return Ok(trades);
        }
    }
}
