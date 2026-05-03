namespace KriptoBot.API.Models
{
    public class WalletBalanceDto
    {
        public string Coin { get; set; } = string.Empty;
        public decimal Amount { get; set; }
    }
}
