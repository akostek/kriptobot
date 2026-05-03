using System.Text;
using KriptoBot.API.Data;
using KriptoBot.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
// Core Services
builder.Services.AddSingleton<JsonDatabase>();
builder.Services.AddHttpClient();
builder.Services.AddTransient<AiTradeService>();
builder.Services.AddTransient<BinanceService>();

// Hosted Background Service
builder.Services.AddHostedService<BotCronService>();

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", builder =>
    {
        builder.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
    });
});

// JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"] ?? "VerySecretSuperSecureKeyForJwtTokens123!";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateIssuer = false,
            ValidateAudience = false,
        };
    });

var app = builder.Build();

app.UseCors("AllowAll");

if (app.Environment.IsDevelopment())
{
    // Swagger removed
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
