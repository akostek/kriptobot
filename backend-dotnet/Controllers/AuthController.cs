using System;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Text;
using KriptoBot.API.Data;
using KriptoBot.API.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace KriptoBot.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly JsonDatabase _db;
        private readonly IConfiguration _config;

        public AuthController(JsonDatabase db, IConfiguration config)
        {
            _db = db;
            _config = config;
        }

        public class LoginDto { public string Username { get; set; } = ""; public string Password { get; set; } = ""; }

        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginDto dto)
        {
            var user = _db.Users.Values.FirstOrDefault(u => u.Username == dto.Username && u.PasswordHash == dto.Password);
            if (user == null) return Unauthorized(new { error = "Geçersiz kullanıcı adı veya şifre" });

            var token = GenerateJwtToken(user);
            return Ok(new { token, username = user.Username });
        }

        [HttpPost("register")]
        public IActionResult Register([FromBody] LoginDto dto)
        {
            if (_db.Users.Values.Any(u => u.Username == dto.Username))
                return BadRequest(new { error = "Kullanıcı adı zaten var" });

            var user = new User { Username = dto.Username, PasswordHash = dto.Password };
            _db.Users.TryAdd(user.Id, user);
            
            // Create default settings for new user
            var setting = new Setting { UserId = user.Id };
            _db.Settings.TryAdd(setting.UserId, setting);
            _db.SaveChanges();

            var token = GenerateJwtToken(user);
            return Ok(new { token, username = user.Username });
        }

        private string GenerateJwtToken(User user)
        {
            var jwtKey = _config["Jwt:Key"] ?? "VerySecretSuperSecureKeyForJwtTokens123!";
            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id),
                new Claim(ClaimTypes.Name, user.Username)
            };

            var token = new JwtSecurityToken(
                claims: claims,
                expires: DateTime.Now.AddDays(7),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
