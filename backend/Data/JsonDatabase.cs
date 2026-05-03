using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using KriptoBot.API.Models;

namespace KriptoBot.API.Data
{
    public class JsonDatabase
    {
        private readonly string _dataDir;
        private readonly object _lock = new object();

        public ConcurrentDictionary<string, User> Users { get; } = new();
        public ConcurrentDictionary<string, Setting> Settings { get; } = new();
        public ConcurrentDictionary<string, Trade> Trades { get; } = new();
        public ConcurrentDictionary<string, TradeLog> TradeLogs { get; } = new();
        public ConcurrentDictionary<string, ApprovalQueue> ApprovalQueues { get; } = new();
        // userId_symbol as key for CoinSettings
        public ConcurrentDictionary<string, CoinSettings> CoinSettings { get; } = new(); 
        public ConcurrentDictionary<string, BalanceHistory> BalanceHistories { get; } = new();

        public JsonDatabase()
        {
            _dataDir = Path.Combine(Directory.GetCurrentDirectory(), "Data", "JSON");
            if (!Directory.Exists(_dataDir))
            {
                Directory.CreateDirectory(_dataDir);
            }

            LoadData();
        }

        private void LoadData()
        {
            LoadCollection("Users.json", Users);
            LoadCollection("Settings.json", Settings);
            LoadCollection("Trades.json", Trades);
            LoadCollection("TradeLogs.json", TradeLogs);
            LoadCollection("ApprovalQueues.json", ApprovalQueues);
            LoadCollection("CoinSettings.json", CoinSettings);
            LoadCollection("BalanceHistories.json", BalanceHistories);
            
            // If no user exists, create a default admin
            if (Users.IsEmpty)
            {
                var admin = new User { Username = "admin", PasswordHash = "admin" }; // Replace with real hash later
                Users.TryAdd(admin.Id, admin);
                
                var setting = new Setting { UserId = admin.Id };
                Settings.TryAdd(setting.UserId, setting);
                
                SaveChanges();
            }
        }

        private void LoadCollection<T>(string fileName, ConcurrentDictionary<string, T> dict)
        {
            var path = Path.Combine(_dataDir, fileName);
            if (File.Exists(path))
            {
                try
                {
                    var json = File.ReadAllText(path);
                    var list = JsonSerializer.Deserialize<Dictionary<string, T>>(json);
                    if (list != null)
                    {
                        foreach (var kvp in list)
                        {
                            dict.TryAdd(kvp.Key, kvp.Value);
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error loading {fileName}: {ex.Message}");
                }
            }
        }

        public void SaveChanges()
        {
            lock (_lock)
            {
                SaveCollection("Users.json", Users);
                SaveCollection("Settings.json", Settings);
                SaveCollection("Trades.json", Trades);
                SaveCollection("TradeLogs.json", TradeLogs);
                SaveCollection("ApprovalQueues.json", ApprovalQueues);
                SaveCollection("CoinSettings.json", CoinSettings);
                SaveCollection("BalanceHistories.json", BalanceHistories);
            }
        }

        private void SaveCollection<T>(string fileName, ConcurrentDictionary<string, T> dict)
        {
            var path = Path.Combine(_dataDir, fileName);
            try
            {
                var json = JsonSerializer.Serialize(dict.ToDictionary(k => k.Key, v => v.Value), new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(path, json);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error saving {fileName}: {ex.Message}");
            }
        }
    }
}
