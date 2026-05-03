using System;
using System.Collections.Generic;

namespace KriptoBot.API.Models
{
    public class User
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Username { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class Setting
    {
        public string UserId { get; set; } = string.Empty;
        public string? BinanceKey { get; set; }
        public string? BinanceSecret { get; set; }
        public string? OpenaiKey { get; set; }
        public string AiModel { get; set; } = "gpt-4o-mini";
        public string Symbol { get; set; } = "BTC/USDT";
        public double TradeAmount { get; set; } = 100.0;
        public bool IsManualApproval { get; set; } = true;
        public bool IsTestnet { get; set; } = false;
        public int MaxTradesPerDay { get; set; } = 5;
        public int ScanInterval { get; set; } = 5;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    public class Trade
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string UserId { get; set; } = string.Empty;
        public string Symbol { get; set; } = string.Empty;
        public string Side { get; set; } = string.Empty; // BUY, SELL
        public double Price { get; set; }
        public double Amount { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string Status { get; set; } = "OPEN"; // OPEN, CLOSED
        public double? Pnl { get; set; }
        public double? SellPrice { get; set; }
        public DateTime? ClosedAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    public class TradeLog
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string UserId { get; set; } = string.Empty;
        public string Symbol { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string Reasoning { get; set; } = string.Empty;
        public double Price { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class ApprovalQueue
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string UserId { get; set; } = string.Empty;
        public string Symbol { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty; // BUY, SELL
        public string Reasoning { get; set; } = string.Empty;
        public double Price { get; set; }
        public double Amount { get; set; }
        public string Status { get; set; } = "PENDING"; // PENDING, APPROVED, REJECTED
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ProcessedAt { get; set; }
    }

    public class CoinSettings
    {
        public string UserId { get; set; } = string.Empty;
        public string Symbol { get; set; } = string.Empty;
        public bool IsActive { get; set; } = true;
        public DateTime? LastScanned { get; set; }
    }

    public class BalanceHistory
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string UserId { get; set; } = string.Empty;
        public double Balance { get; set; }
        public DateTime Date { get; set; } = DateTime.UtcNow;
    }
}
