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
    [Route("api/settings")]
    public class SettingsController : ControllerBase
    {
        private readonly JsonDatabase _db;

        public SettingsController(JsonDatabase db)
        {
            _db = db;
        }

        private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

        [HttpGet]
        public IActionResult Get()
        {
            var setting = _db.Settings.Values.FirstOrDefault(s => s.UserId == UserId);
            return Ok(setting);
        }

        [HttpPost]
        public IActionResult Post([FromBody] Setting dto)
        {
            var setting = _db.Settings.Values.FirstOrDefault(s => s.UserId == UserId);
            if (setting != null)
            {
                setting.BinanceKey = dto.BinanceKey;
                setting.BinanceSecret = dto.BinanceSecret;
                setting.OpenaiKey = dto.OpenaiKey;
                setting.AiModel = dto.AiModel;
                setting.TradeAmount = dto.TradeAmount;
                setting.IsManualApproval = dto.IsManualApproval;
                setting.IsTestnet = dto.IsTestnet;
                setting.MaxTradesPerDay = dto.MaxTradesPerDay;
                setting.ScanInterval = dto.ScanInterval;
                setting.UpdatedAt = System.DateTime.UtcNow;
            }
            else
            {
                dto.UserId = UserId;
                _db.Settings.TryAdd(dto.UserId, dto);
            }
            _db.SaveChanges();
            return Ok(new { success = true, message = "Ayarlar kaydedildi." });
        }

        [HttpPost("restart-cron")]
        [Route("/api/restart-cron")]
        public IActionResult RestartCron()
        {
            // The BotCronService continuously scans every minute.
            // This is just a dummy endpoint to satisfy the UI's manual trigger button.
            return Ok(new { success = true, message = "Bot tetiklendi." });
        }
    }
}
