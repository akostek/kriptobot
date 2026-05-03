import { useEffect, useState } from 'react';
import axios from 'axios';
import { Activity, Brain, CandlestickChart, DollarSign, Wallet, Settings, X, Save, CheckCircle, XCircle, ListFilter, TrendingUp, RefreshCw, Eye, ArrowRightLeft } from 'lucide-react';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API_URL = 'http://localhost:5001/api';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [stats, setStats] = useState({ balance: 0, openTrades: 0, totalTrades: 0, totalPnl: 0, history: [] });
  const [logs, setLogs] = useState([]);
  const [trades, setTrades] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [coins, setCoins] = useState([]);
  const [wallet, setWallet] = useState([]);
  
  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOpenTradesModalOpen, setIsOpenTradesModalOpen] = useState(false);
  const [manualTradeModal, setManualTradeModal] = useState<{isOpen: boolean, symbol: string, type: 'buy'|'sell'}>({isOpen: false, symbol: '', type: 'buy'});

  // Manual Trade State
  const [tradeForm, setTradeForm] = useState({
    orderType: 'market', // 'market' | 'limit'
    amount: '',
    price: ''
  });

  const [settings, setSettings] = useState({
    binanceKey: '',
    binanceSecret: '',
    openaiKey: '',
    symbol: 'BTC/USDT',
    tradeAmount: 100,
    isManualApproval: true,
    maxTradesPerDay: 5,
    scanInterval: 5
  });

  const fetchData = async () => {
    try {
      const [statsRes, logsRes, tradesRes, approvalsRes, coinsRes, walletRes, settingsRes] = await Promise.all([
        axios.get(`${API_URL}/stats`),
        axios.get(`${API_URL}/logs`),
        axios.get(`${API_URL}/trades`),
        axios.get(`${API_URL}/approvals`),
        axios.get(`${API_URL}/coins`),
        axios.get(`${API_URL}/wallet`),
        axios.get(`${API_URL}/settings`)
      ]);
      setStats(statsRes.data);
      setLogs(logsRes.data);
      setTrades(tradesRes.data);
      setApprovals(approvalsRes.data);
      setCoins(coinsRes.data);
      setWallet(walletRes.data);
      
      if (settingsRes.data && !isSettingsOpen) {
        setSettings(settingsRes.data);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); 
    return () => clearInterval(interval);
  }, [isSettingsOpen]);

  const handleSaveSettings = async () => {
    try {
      await axios.post(`${API_URL}/settings`, settings);
      await axios.post(`${API_URL}/restart-cron`); // Restart backend cron
      setIsSettingsOpen(false);
      alert('Ayarlar başarıyla kaydedildi! Bot yeni ayarlarla devam edecek.');
    } catch (error) {
      alert('Ayarlar kaydedilirken hata oluştu.');
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await axios.post(`${API_URL}/approvals/${id}/approve`);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || "Hata oluştu.");
    }
  };

  const handleReject = async (id: number) => {
    try {
      await axios.post(`${API_URL}/approvals/${id}/reject`);
      fetchData();
    } catch (error) {
      alert("Hata oluştu.");
    }
  };

  const handleToggleCoin = async (symbol: string) => {
    try {
      await axios.post(`${API_URL}/coins/${symbol.replace('/', '-')}/toggle`);
      fetchData();
    } catch (error) {
      alert("Hata oluştu.");
    }
  };

  const handleSyncCoins = async () => {
    try {
      await axios.post(`${API_URL}/coins/sync`);
      alert("Borsadan coinler başarıyla çekildi!");
      fetchData();
    } catch (error) {
      alert("Hata oluştu.");
    }
  };

  const handleForceRun = async () => {
    if (!settings.binanceKey || !settings.openaiKey) {
      alert("Lütfen önce ayarlardan API şifrelerini girin!");
      return;
    }
    try {
      await axios.post(`${API_URL}/force-run`);
      alert("Tetiklendi! Bekleyin...");
      setTimeout(fetchData, 3000);
    } catch (error) {
      alert("Bot tetiklenirken hata oluştu.");
    }
  };

  const submitManualTrade = async () => {
    try {
      await axios.post(`${API_URL}/wallet/trade`, {
        symbol: manualTradeModal.symbol,
        side: manualTradeModal.type,
        type: tradeForm.orderType,
        amount: tradeForm.amount,
        price: tradeForm.orderType === 'limit' ? tradeForm.price : undefined
      });
      alert('İşlem başarıyla gönderildi!');
      setManualTradeModal({ isOpen: false, symbol: '', type: 'buy' });
      setTradeForm({ orderType: 'market', amount: '', price: '' });
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'İşlem başarısız.');
    }
  };

  const isBotActive = settings.binanceKey && settings.openaiKey;
  const openTradesList = trades.filter((t: any) => t.status === 'OPEN');

  return (
    <div className="min-h-screen bg-[#0f1115] text-slate-200 p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <Brain className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">
                Kripto AI v4
              </h1>
              <p className="text-slate-400 text-sm mt-1">Tam Otomatik Profesyonel Al-Sat Botu</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleForceRun}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)]"
            >
              🚀 Hemen Tetikle (Test)
            </button>
            <div className={`flex items-center space-x-2 text-sm px-4 py-2 rounded-full border ${
              isBotActive ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-orange-400 bg-orange-400/10 border-orange-400/20'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isBotActive ? 'bg-emerald-400 animate-pulse' : 'bg-orange-400'}`} />
              <span>{isBotActive ? 'Bot Aktif' : 'API Bekleniyor'}</span>
            </div>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors"
            >
              <Settings className="w-5 h-5 text-slate-300" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-2 bg-slate-900/50 p-1.5 rounded-xl border border-slate-800/50 w-fit backdrop-blur-md">
          {[
            { id: 'dashboard', icon: Activity, label: 'Dashboard' },
            { id: 'wallet', icon: Wallet, label: 'Cüzdanım & Manuel' },
            { id: 'approvals', icon: CheckCircle, label: `Onay Bekleyenler (${approvals.length})` },
            { id: 'coins', icon: ListFilter, label: 'Karantina' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-lg' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.id === 'approvals' && approvals.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/50 rounded-2xl p-6 flex items-center space-x-4 hover:border-slate-700 transition-colors group">
                <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-400 group-hover:scale-110 transition-transform">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">Sanal Bakiye</p>
                  <h3 className="text-2xl font-bold tracking-tight">${stats.balance?.toFixed(2) || '0.00'}</h3>
                </div>
              </div>

              <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/50 rounded-2xl p-6 flex items-center space-x-4 hover:border-slate-700 transition-colors group">
                <div className="p-4 bg-indigo-500/10 rounded-2xl text-indigo-400 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">Net Kâr / Zarar</p>
                  <h3 className={`text-2xl font-bold tracking-tight ${stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl?.toFixed(2) || '0.00'}
                  </h3>
                </div>
              </div>

              <div 
                onClick={() => setIsOpenTradesModalOpen(true)}
                className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/50 rounded-2xl p-6 flex items-center justify-between hover:border-slate-600 transition-all group cursor-pointer"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-4 bg-orange-500/10 rounded-2xl text-orange-400 group-hover:scale-110 transition-transform">
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Botun Açık İşlemleri</p>
                    <h3 className="text-2xl font-bold tracking-tight">{stats.openTrades || 0}</h3>
                  </div>
                </div>
                <Eye className="w-5 h-5 text-slate-600 group-hover:text-slate-400" />
              </div>

              <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/50 rounded-2xl p-6 flex items-center space-x-4 hover:border-slate-700 transition-colors group">
                <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-400 group-hover:scale-110 transition-transform">
                  <CandlestickChart className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">Toplam Bot İşlemi</p>
                  <h3 className="text-2xl font-bold tracking-tight">{stats.totalTrades || 0}</h3>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* AI Logs */}
              <div className="bg-slate-900/40 border border-slate-800/50 rounded-2xl overflow-hidden flex flex-col shadow-xl h-[400px]">
                <div className="p-6 border-b border-slate-800/50 bg-slate-900/60 flex items-center space-x-3">
                  <Brain className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-semibold text-slate-200">Yapay Zeka Karar Defteri</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {logs.length === 0 ? (
                    <p className="text-slate-500 text-center mt-10">Kayıt yok...</p>
                  ) : logs.map((log: any) => (
                    <div key={log.id} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.action === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' :
                            log.action === 'SELL' ? 'bg-rose-500/20 text-rose-400' :
                            'bg-slate-700 text-slate-300'
                          }`}>
                            {log.action}
                          </span>
                          <span className="font-bold text-slate-300 text-sm">{log.symbol}</span>
                        </div>
                        <span className="text-xs text-slate-500">{format(new Date(log.createdAt), 'HH:mm')}</span>
                      </div>
                      <p className="text-sm text-slate-400 leading-relaxed">{log.reasoning}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Son İşlemler */}
              <div className="bg-slate-900/40 border border-slate-800/50 rounded-2xl overflow-hidden flex flex-col shadow-xl h-[400px]">
                <div className="p-6 border-b border-slate-800/50 bg-slate-900/60 flex items-center space-x-3">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-semibold text-slate-200">Bot İşlem Geçmişi</h2>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <tbody className="divide-y divide-slate-800/50">
                      {trades.length === 0 ? (
                        <tr><td colSpan={3} className="text-center py-8 text-slate-500">Kayıt yok...</td></tr>
                      ) : trades.map((trade: any) => {
                        const isClosed = trade.status === 'CLOSED';
                        const percent = isClosed && trade.price > 0 ? ((trade.sellPrice - trade.price) / trade.price) * 100 : 0;
                        
                        return (
                        <tr key={trade.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-medium text-slate-200">{trade.symbol}</div>
                            <div className="text-xs text-slate-500">{format(new Date(trade.createdAt), 'dd MMM HH:mm')}</div>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              trade.side === 'BUY' ? 'text-emerald-400 bg-emerald-400/10' : 'text-rose-400 bg-rose-400/10'
                            }`}>
                              {isClosed ? 'KAPANDI' : trade.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="font-mono text-slate-300">
                              Alış: ${trade.price.toLocaleString()}
                            </div>
                            {isClosed && (
                              <>
                                <div className="font-mono text-slate-400 text-xs mt-1">
                                  Satış: ${trade.sellPrice?.toLocaleString()}
                                </div>
                                <div className={`text-xs font-bold mt-1 ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {trade.pnl >= 0 ? '+' : ''}${trade.pnl?.toFixed(2)} ({trade.pnl >= 0 ? '+' : ''}{percent.toFixed(2)}%)
                                </div>
                              </>
                            )}
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Bakiye Grafiği */}
              <div className="bg-slate-900/40 border border-slate-800/50 rounded-2xl p-6 lg:col-span-2 shadow-xl">
                <h2 className="text-lg font-semibold text-slate-200 mb-6 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-400" /> Bakiye Geçmişi
                </h2>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(val) => format(new Date(val), 'dd MMM')} 
                        stroke="#475569" 
                        tick={{fill: '#94a3b8', fontSize: 12}}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        domain={['auto', 'auto']} 
                        stroke="#475569" 
                        tick={{fill: '#94a3b8', fontSize: 12}}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) => `$${val}`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f1115', borderColor: '#1e293b', borderRadius: '8px' }}
                        labelFormatter={(val) => format(new Date(val), 'dd MMM yyyy HH:mm')}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="balance" 
                        stroke="#818cf8" 
                        strokeWidth={3} 
                        dot={{ r: 4, fill: '#818cf8', strokeWidth: 0 }} 
                        activeDot={{ r: 6, stroke: '#6366f1', strokeWidth: 2 }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Wallet Tab */}
        {activeTab === 'wallet' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-900/40 border border-slate-800/50 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-6 border-b border-slate-800/50 bg-slate-900/60 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-semibold text-slate-200">Gerçek Borsa Cüzdanınız</h2>
                </div>
                <button 
                  onClick={() => {
                    setManualTradeModal({ isOpen: true, symbol: 'BTC/USDT', type: 'buy' });
                  }}
                  className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                >
                  <ArrowRightLeft className="w-4 h-4" /> Manuel Emir Gir
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-800/50 text-slate-400">
                    <tr>
                      <th className="px-6 py-4 font-medium">Coin</th>
                      <th className="px-6 py-4 font-medium text-right">Miktar</th>
                      <th className="px-6 py-4 font-medium text-right">Ort. Alış / Güncel Fiyat</th>
                      <th className="px-6 py-4 font-medium text-right">Kâr / Zarar (%)</th>
                      <th className="px-6 py-4 font-medium text-right">Toplam Değer (USDT)</th>
                      <th className="px-6 py-4 font-medium text-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {wallet.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-slate-500">Cüzdanınızda varlık bulunamadı.</td></tr>
                    ) : wallet.map((item: any) => (
                      <tr key={item.coin} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-200 text-base">{item.coin}</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="font-mono text-slate-300">{item.amount.toLocaleString(undefined, {maximumFractionDigits: 6})}</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {item.coin !== 'USDT' && item.avgBuyPrice > 0 ? (
                             <div className="font-mono text-slate-500 text-xs line-through mb-1">${item.avgBuyPrice?.toLocaleString()}</div>
                          ) : null}
                          <div className="font-mono text-slate-200 font-medium">${item.price ? item.price.toLocaleString() : '1.00'}</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {item.coin !== 'USDT' && item.pnlPercent !== undefined ? (
                            <div className={`font-mono font-bold ${item.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {item.pnlPercent > 0 ? '+' : ''}{item.pnlUsdt?.toFixed(2)}$ 
                              <span className="text-xs ml-1 opacity-70">({item.pnlPercent > 0 ? '+' : ''}{item.pnlPercent?.toFixed(2)}%)</span>
                            </div>
                          ) : (
                            <div className="text-slate-500">-</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="font-mono font-bold text-emerald-400">${item.valueUsdt ? item.valueUsdt.toLocaleString(undefined, {maximumFractionDigits: 2}) : '0.00'}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {item.coin !== 'USDT' && (
                            <div className="flex justify-center space-x-2">
                              <button 
                                onClick={() => setManualTradeModal({ isOpen: true, symbol: `${item.coin}/USDT`, type: 'buy' })}
                                className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg font-medium text-xs transition-colors"
                              >
                                AL
                              </button>
                              <button 
                                onClick={() => setManualTradeModal({ isOpen: true, symbol: `${item.coin}/USDT`, type: 'sell' })}
                                className="px-3 py-1.5 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-lg font-medium text-xs transition-colors"
                              >
                                SAT
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Onay Bekleyenler Tab */}
        {activeTab === 'approvals' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-200">Onay Bekleyen İşlemler</h2>
                <p className="text-slate-400 text-sm mt-1">Manuel onay modundasınız. Yapay zeka sizin onayınız olmadan alım/satım yapmaz.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {approvals.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-800/50 rounded-2xl p-12 flex flex-col items-center justify-center text-slate-500">
                  <CheckCircle className="w-12 h-12 mb-3 text-slate-700" />
                  <p>Onay bekleyen hiçbir işlem yok.</p>
                </div>
              ) : approvals.map((item: any) => (
                <div key={item.id} className="bg-slate-900/60 border border-indigo-500/30 rounded-2xl p-6 shadow-lg shadow-indigo-500/5 flex flex-col md:flex-row gap-6 items-start md:items-center">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                        item.action === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {item.action}
                      </span>
                      <span className="text-xl font-bold text-white">{item.symbol}</span>
                      <span className="text-slate-400 font-mono text-sm">${item.price.toLocaleString()}</span>
                      <span className="text-slate-500 text-xs ml-auto">{format(new Date(item.createdAt), 'dd MMM HH:mm')}</span>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                      <span className="text-indigo-400 font-medium block mb-1">Yapay Zeka Analizi:</span>
                      {item.reasoning}
                    </p>
                  </div>
                  <div className="flex w-full md:w-auto md:flex-col gap-3">
                    <button 
                      onClick={() => handleApprove(item.id)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                    >
                      <CheckCircle className="w-5 h-5" /> Onayla
                    </button>
                    <button 
                      onClick={() => handleReject(item.id)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-300 font-medium rounded-xl border border-slate-700 hover:border-rose-500/50 transition-all"
                    >
                      <XCircle className="w-5 h-5" /> Reddet
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Coins Tab */}
        {activeTab === 'coins' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-4 bg-slate-900/40 p-6 rounded-2xl border border-slate-800/50">
              <div>
                <h2 className="text-xl font-bold text-slate-200">Karantina Yönetimi</h2>
                <p className="text-slate-400 text-sm mt-1">Hangi coinlerin taranıp hangilerinin taranmayacağını (Karantina) belirleyin.</p>
              </div>
              <button 
                onClick={handleSyncCoins}
                className="flex items-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
              >
                <RefreshCw className="w-4 h-4" /> Borsadan Eşitle
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {coins.length === 0 ? (
                <div className="col-span-full text-center py-10 text-slate-500">Coin listesi boş. "Borsadan Eşitle" butonuna basın.</div>
              ) : coins.map((coin: any) => (
                <div key={coin.symbol} className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                  coin.isActive ? 'bg-slate-800/40 border-slate-700 hover:border-slate-500' : 'bg-red-950/20 border-red-900/50 opacity-60 grayscale'
                }`}>
                  <div>
                    <div className="font-bold text-slate-200">{coin.symbol}</div>
                    <div className="text-xs mt-1 font-medium">
                      {coin.isActive ? <span className="text-emerald-400">Aktif Taranıyor</span> : <span className="text-rose-500">Karantinada</span>}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleToggleCoin(coin.symbol)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      coin.isActive ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                    }`}
                  >
                    {coin.isActive ? 'Durdur' : 'Aktifleştir'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Manual Trade Modal */}
      {manualTradeModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-800/30">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-indigo-400" /> Manuel İşlem
              </h2>
              <button onClick={() => setManualTradeModal({...manualTradeModal, isOpen: false})} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              
              <div className="grid grid-cols-2 gap-2 bg-slate-800 p-1 rounded-xl">
                <button 
                  onClick={() => setManualTradeModal({...manualTradeModal, type: 'buy'})}
                  className={`py-2 rounded-lg font-bold text-sm transition-all ${manualTradeModal.type === 'buy' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                >AL (BUY)</button>
                <button 
                  onClick={() => setManualTradeModal({...manualTradeModal, type: 'sell'})}
                  className={`py-2 rounded-lg font-bold text-sm transition-all ${manualTradeModal.type === 'sell' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                >SAT (SELL)</button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">İşlem Paritesi</label>
                <input 
                  type="text" 
                  value={manualTradeModal.symbol} 
                  onChange={e => setManualTradeModal({...manualTradeModal, symbol: e.target.value.toUpperCase()})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500 text-slate-200 font-bold"
                  placeholder="BTC/USDT"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setTradeForm({...tradeForm, orderType: 'market'})}
                  className={`py-3 rounded-xl border ${tradeForm.orderType === 'market' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                >Piyasa (Market)</button>
                <button 
                  onClick={() => setTradeForm({...tradeForm, orderType: 'limit'})}
                  className={`py-3 rounded-xl border ${tradeForm.orderType === 'limit' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                >Özel Fiyat (Limit)</button>
              </div>

              <div className="space-y-4">
                {tradeForm.orderType === 'limit' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Fiyat (USDT)</label>
                    <input 
                      type="number" 
                      value={tradeForm.price} 
                      onChange={e => setTradeForm({...tradeForm, price: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500 text-slate-200"
                      placeholder="0.00"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Miktar ({manualTradeModal.symbol.split('/')[0]})</label>
                  <input 
                    type="number" 
                    value={tradeForm.amount} 
                    onChange={e => setTradeForm({...tradeForm, amount: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500 text-slate-200"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <button 
                onClick={submitManualTrade}
                className={`w-full py-3 rounded-xl font-bold text-lg text-white shadow-lg transition-colors ${
                  manualTradeModal.type === 'buy' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20' : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20'
                }`}
              >
                İşlemi Gönder
              </button>

            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-800/30">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-400" /> Profesyonel Bot Ayarları
              </h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Otomasyon & Güvenlik</h3>
                
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-200">Manuel Onay Modu</h4>
                    <p className="text-xs text-slate-400 mt-1">Açıksa, yapay zeka işlem yapmadan önce sizden "Onay" bekler.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={settings.isManualApproval}
                      onChange={e => setSettings({...settings, isManualApproval: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-200">Yapay Zeka Modeli</h4>
                    <p className="text-xs text-slate-400 mt-1">Daha ucuz veya daha zeki modelleri seçebilirsiniz.</p>
                  </div>
                  <select 
                    value={settings.aiModel || 'gpt-4o-mini'}
                    onChange={e => setSettings({...settings, aiModel: e.target.value})}
                    className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none font-medium"
                  >
                    <option value="gpt-4o-mini">GPT-4o-Mini (Çok Ucuz & Hızlı)</option>
                    <option value="gpt-4o">GPT-4o (En Zeki & Pahalı)</option>
                    <option value="gpt-3.5-turbo">GPT-3.5-Turbo (Eski)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Günlük İşlem Limiti</label>
                    <input 
                      type="number" 
                      value={settings.maxTradesPerDay} 
                      onChange={e => setSettings({...settings, maxTradesPerDay: Number(e.target.value)})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500 text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Tarama Sıklığı (Dakika)</label>
                    <input 
                      type="number" 
                      value={settings.scanInterval} 
                      onChange={e => setSettings({...settings, scanInterval: Number(e.target.value)})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500 text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">İşlem Bütçesi ($)</label>
                    <input 
                      type="number" 
                      value={settings.tradeAmount} 
                      onChange={e => setSettings({...settings, tradeAmount: Number(e.target.value)})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500 text-slate-200"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-800">
                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">API Bağlantıları</h3>
                
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">OpenAI API Key</label>
                  <input 
                    type="password" 
                    value={settings.openaiKey} 
                    onChange={e => setSettings({...settings, openaiKey: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500 text-slate-200 font-mono text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Binance Testnet API Key</label>
                  <input 
                    type="text" 
                    value={settings.binanceKey} 
                    onChange={e => setSettings({...settings, binanceKey: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500 text-slate-200 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Binance Testnet Secret Key</label>
                  <input 
                    type="password" 
                    value={settings.binanceSecret} 
                    onChange={e => setSettings({...settings, binanceSecret: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500 text-slate-200 font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-800/30 flex justify-end">
              <button 
                onClick={handleSaveSettings}
                className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20"
              >
                <Save className="w-5 h-5" /> Kaydet ve Yeniden Başlat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Open Trades Modal */}
      {isOpenTradesModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-800/30">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Activity className="w-5 h-5 text-orange-400" /> Botun Açık İşlemleri
              </h2>
              <button onClick={() => setIsOpenTradesModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {openTradesList.length === 0 ? (
                <div className="text-center py-10 text-slate-500">Şu anda açık hiçbir işleminiz bulunmuyor.</div>
              ) : (
                <div className="space-y-4">
                  {openTradesList.map((trade: any) => (
                    <div key={trade.id} className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-200 text-lg">{trade.symbol}</div>
                        <div className="text-sm text-slate-400 mt-1">Alış Fiyatı: <span className="font-mono text-white">${trade.price}</span></div>
                        <div className="text-xs text-slate-500 mt-1">{format(new Date(trade.createdAt), 'dd MMM yyyy HH:mm:ss')}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-400 mb-1">Miktar</div>
                        <div className="font-mono text-emerald-400 font-bold">{trade.amount.toFixed(6)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
