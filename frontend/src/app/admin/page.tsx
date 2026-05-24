'use client';

import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [key, setKey] = useState('');
  const [metrics, setMetrics] = useState<any>(null);
  const [recentCitizens, setRecentCitizens] = useState<any[]>([]);
  const [recentRedemptions, setRecentRedemptions] = useState<any[]>([]);
  const [bloodStats, setBloodStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = async (adminKey: string) => {
    setLoading(true);
    const headers = { 'x-admin-key': adminKey };
    try {
      const [mRes, cRes, rRes, bRes] = await Promise.all([
        fetch(`${API}/admin/metrics`, { headers }),
        fetch(`${API}/admin/citizens/recent`, { headers }),
        fetch(`${API}/admin/redemptions/recent`, { headers }),
        fetch(`${API}/admin/blood-type-stats`, { headers }),
      ]);
      const [mJson, cJson, rJson, bJson] = await Promise.all([mRes.json(), cRes.json(), rRes.json(), bRes.json()]);
      if (mJson.success) setMetrics(mJson.data);
      if (cJson.success) setRecentCitizens(cJson.data);
      if (rJson.success) setRecentRedemptions(rJson.data);
      if (bJson.success) setBloodStats(bJson.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAll(key).then(() => setLoggedIn(true)).catch(() => alert('Erro ao acessar painel'));
  };

  // Gráfico de barras simples (texto)
  const maxCount = Math.max(...bloodStats.map((s: any) => s.count), 1);

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <span className="text-5xl">🛡️</span>
            <h1 className="text-2xl font-bold mt-4">Painel Administrativo</h1>
            <p className="text-sm text-slate-400 mt-2">Acesso restrito</p>
          </div>
          <input required type="password" placeholder="Chave de Administrador" value={key}
            onChange={e => setKey(e.target.value)}
            className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-cyan-500" />
          <button type="submit" disabled={loading}
            className="w-full p-4 rounded-xl bg-cyan-500 font-bold hover:bg-cyan-400 disabled:opacity-50">
            {loading ? 'Entrando...' : 'Acessar'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">🛡️ Painel Administrativo</h1>
            <p className="text-xs text-slate-400">EcoSolid — Métricas em tempo real</p>
          </div>
          <button onClick={() => { setLoggedIn(false); setMetrics(null); }} className="text-sm text-red-400 hover:text-red-300">Sair</button>
        </div>

        {metrics && (
          <>
            {/* Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card title="Cidadãos" value={metrics.totalCitizens} icon="👥" color="emerald" />
              <Card title="Ações" value={metrics.totalActions} icon="📊" color="cyan" />
              <Card title="SOLID Dist." value={metrics.solidDistributed.toLocaleString()} icon="⭐" color="amber" />
              <Card title="Resgates" value={metrics.totalRedemptions} icon="🎁" color="pink" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card title="Fundo Manutenção" value={`${metrics.maintenanceFees.toLocaleString()} SOLID`}
                subtitle={`~R$ ${(metrics.maintenanceFees * 0.10).toFixed(2)} (estimativa)`} icon="💰" color="purple" />

              {/* Breakdown ações */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-xs text-slate-400 font-bold uppercase mb-3">📊 Ações por Tipo</p>
                {Object.entries(metrics.breakdown || {}).map(([type, data]: [string, any]) => (
                  <div key={type} className="flex justify-between py-1">
                    <span className="text-sm">{type === 'RECYCLING' ? '♻️ Reciclagem' : '🩸 Doação de Sangue'}</span>
                    <span className="text-sm text-slate-400">{data.count} ações — {data.points} SOLID</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mapa de tipos sanguíneos */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-xs text-slate-400 font-bold uppercase mb-3">🩸 Tipos Sanguíneos</p>
              <div className="space-y-2">
                {bloodStats.map((s: any) => (
                  <div key={s._id} className="flex items-center gap-3">
                    <span className="text-sm font-mono font-bold w-8">{s._id}</span>
                    <div className="flex-1 h-6 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full flex items-center px-2" style={{ width: `${(s.count / maxCount) * 100}%` }}>
                        <span className="text-xs font-bold">{s.count}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {bloodStats.length === 0 && <p className="text-xs text-slate-500">Nenhum dado ainda</p>}
              </div>
            </div>

            {/* Tabelas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Últimos Cadastros */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-xs text-slate-400 font-bold uppercase mb-3">👤 Últimos 10 Cadastros</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {recentCitizens.map((c: any) => (
                    <div key={c._id} className="text-xs flex justify-between py-1 border-b border-white/5">
                      <span>{c.name}</span>
                      <span className="text-slate-500 font-mono">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '-'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Últimos Resgates */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-xs text-slate-400 font-bold uppercase mb-3">🎁 Últimos 10 Resgates</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {recentRedemptions.map((r: any) => (
                    <div key={r._id} className="text-xs flex justify-between py-1 border-b border-white/5">
                      <div>
                        <span className="font-mono">{r.code}</span>
                        <span className="text-slate-500 ml-2">{r.partnerName}</span>
                      </div>
                      <span className={`font-bold ${r.status === 'validated' ? 'text-emerald-400' : r.status === 'pending' ? 'text-amber-400' : 'text-slate-500'}`}>
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Card({ title, value, subtitle, icon, color }: any) {
  const colors: any = { emerald: 'border-emerald-500/30 bg-emerald-500/10', cyan: 'border-cyan-500/30 bg-cyan-500/10', amber: 'border-amber-500/30 bg-amber-500/10', pink: 'border-pink-500/30 bg-pink-500/10', purple: 'border-purple-500/30 bg-purple-500/10' };
  return (
    <div className={`p-4 rounded-xl border ${colors[color] || 'border-white/10'} bg-white/5`}>
      <p className="text-xs text-slate-400 uppercase font-bold">{icon} {title}</p>
      <p className="text-xl font-black mt-1">{value}</p>
      {subtitle && <p className="text-[10px] text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}
