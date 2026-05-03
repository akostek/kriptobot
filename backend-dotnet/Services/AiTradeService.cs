using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using KriptoBot.API.Data;
using System.Linq;

namespace KriptoBot.API.Services
{
    public class AiTradeService
    {
        private readonly HttpClient _httpClient;
        private readonly JsonDatabase _db;

        public AiTradeService(HttpClient httpClient, JsonDatabase db)
        {
            _httpClient = httpClient;
            _db = db;
        }

        public async Task<(string action, string reasoning)> AnalyzeMarketAndTrade(string userId, string symbol, List<dynamic> ohlcv, bool hasOpenPosition)
        {
            var settings = _db.Settings.Values.FirstOrDefault(s => s.UserId == userId);
            if (settings == null || string.IsNullOrEmpty(settings.OpenaiKey))
            {
                throw new Exception("OpenAI API key not found.");
            }

            var prompt = $@"
Sen profesyonel bir kripto para algoritma botusun. 
Amacın sana verilen mum (OHLCV) verilerini analiz ederek kısa vadeli (day trading) al-sat kararı vermek.
Piyasa dinamiklerini, trendleri, hacim değişikliklerini dikkate al.
Eğer pozisyon açıksa (hasOpenPosition=true), sadece SELL veya HOLD kararı verebilirsin. Asla BUY diyemezsin.
Eğer pozisyon kapalıysa (hasOpenPosition=false), sadece BUY veya HOLD kararı verebilirsin. Asla SELL diyemezsin.

Şu anki durum:
Coin: {symbol}
Açık Pozisyon Var Mı?: {(hasOpenPosition ? "EVET (Satış Fırsatı Ara)" : "HAYIR (Alım Fırsatı Ara)")}

Son 24 saatlik OHLCV verileri:
{JsonSerializer.Serialize(ohlcv)}

Lütfen analizini yap ve kararını kesinlikle şu JSON formatında dön:
{{
  ""action"": ""BUY"" | ""SELL"" | ""HOLD"",
  ""reasoning"": ""Kararının kısa ve net teknik açıklaması""
}}
Sadece geçerli bir JSON dön, başka hiçbir açıklama ekleme.
";

            var requestBody = new
            {
                model = settings.AiModel ?? "gpt-4o-mini",
                messages = new[]
                {
                    new { role = "system", content = "You are a professional crypto trading algorithm that responds strictly in valid JSON." },
                    new { role = "user", content = prompt }
                },
                response_format = new { type = "json_object" }
            };

            var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions");
            request.Headers.Add("Authorization", $"Bearer {settings.OpenaiKey}");
            request.Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

            var response = await _httpClient.SendAsync(request);
            
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                throw new Exception($"OpenAI API Error: {error}");
            }

            var responseBody = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(responseBody);
            var content = doc.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();

            if (string.IsNullOrEmpty(content)) return ("HOLD", "Empty response from AI");

            try
            {
                using var resultDoc = JsonDocument.Parse(content);
                var action = resultDoc.RootElement.GetProperty("action").GetString()?.ToUpper();
                var reasoning = resultDoc.RootElement.GetProperty("reasoning").GetString();

                // Validate logical rules
                if (hasOpenPosition && action == "BUY") action = "HOLD";
                if (!hasOpenPosition && action == "SELL") action = "HOLD";
                if (action != "BUY" && action != "SELL") action = "HOLD";

                return (action ?? "HOLD", reasoning ?? "No reasoning provided");
            }
            catch
            {
                return ("HOLD", "Failed to parse AI JSON response");
            }
        }
    }
}
