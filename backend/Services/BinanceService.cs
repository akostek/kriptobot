using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Binance.Net.Clients;
using Binance.Net.Enums;
using Binance.Net.Objects;
using CryptoExchange.Net.Authentication;
using KriptoBot.API.Data;
using KriptoBot.API.Models;

namespace KriptoBot.API.Services
{
    public class BinanceService
    {
        private readonly JsonDatabase _db;

        public BinanceService(JsonDatabase db)
        {
            _db = db;
        }

        private BinanceRestClient GetClient(string userId)
        {
            var settings = _db.Settings.Values.FirstOrDefault(s => s.UserId == userId);
            if (settings == null || string.IsNullOrEmpty(settings.BinanceKey) || string.IsNullOrEmpty(settings.BinanceSecret))
            {
                throw new Exception("Binance API credentials not found or incomplete.");
            }

            return new BinanceRestClient(options =>
            {
                options.ApiCredentials = new Binance.Net.BinanceCredentials(settings.BinanceKey, settings.BinanceSecret);
                // Kullanıcı isteği üzerine Live/Testnet ayrımı tamamen kaldırılıp, her zaman Demo'ya bağlanmaya zorlandı.
                options.Environment = Binance.Net.BinanceEnvironment.Demo;
            });
        }

        public async Task<List<WalletBalanceDto>> GetWalletBalances(string userId)
        {
            using var client = GetClient(userId);
            var result = await client.SpotApi.Account.GetAccountInfoAsync();
            
            if (!result.Success)
            {
                Console.WriteLine($"Error fetching balances: {result.Error}");
                return new List<WalletBalanceDto>();
            }

            var balances = result.Data.Balances
                .Where(b => b.Available > 0)
                .Select(b => new WalletBalanceDto { Coin = b.Asset, Amount = b.Available })
                .ToList();

            return balances;
        }

        public async Task<decimal> GetCurrentPrice(string symbol)
        {
            using var client = new BinanceRestClient();
            var result = await client.SpotApi.ExchangeData.GetTickerAsync(symbol.Replace("/", ""));
            
            if (!result.Success || result.Data == null)
            {
                return 0;
            }

            return result.Data.LastPrice;
        }

        public async Task<Dictionary<string, decimal>> GetAllPrices()
        {
            using var client = new BinanceRestClient();
            var result = await client.SpotApi.ExchangeData.GetTickersAsync();
            
            if (!result.Success)
            {
                return new Dictionary<string, decimal>();
            }

            return result.Data.ToDictionary(t => t.Symbol, t => t.LastPrice);
        }

        public async Task<dynamic> CreateMarketOrder(string userId, string symbol, string side, decimal amount)
        {
            using var client = GetClient(userId);
            var orderSide = side.ToUpper() == "BUY" ? OrderSide.Buy : OrderSide.Sell;
            var formattedSymbol = symbol.Replace("/", "");

            var result = await client.SpotApi.Trading.PlaceOrderAsync(
                formattedSymbol,
                orderSide,
                SpotOrderType.Market,
                quantity: amount
            );

            if (!result.Success)
            {
                throw new Exception(result.Error?.Message ?? "Unknown Binance Error");
            }

            return new { id = result.Data.Id.ToString() };
        }

        public async Task<List<dynamic>> GetOHLCV(string userId, string symbol, string timeframe = "1h", int limit = 24)
        {
            using var client = GetClient(userId); // We use user's client to respect their testnet/live setting
            var interval = timeframe switch
            {
                "1h" => KlineInterval.OneHour,
                "4h" => KlineInterval.FourHour,
                "1d" => KlineInterval.OneDay,
                _ => KlineInterval.OneHour
            };

            var result = await client.SpotApi.ExchangeData.GetKlinesAsync(symbol.Replace("/", ""), interval, limit: limit);
            
            if (!result.Success) return new List<dynamic>();

            return result.Data.Select(k => new {
                timestamp = new DateTimeOffset(k.OpenTime).ToUnixTimeMilliseconds(),
                open = k.OpenPrice,
                high = k.HighPrice,
                low = k.LowPrice,
                close = k.ClosePrice,
                volume = k.Volume
            }).ToList<dynamic>();
        }
    }
}
