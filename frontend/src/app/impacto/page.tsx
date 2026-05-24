'use client';

import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

export default function ImpactoPage() {
  const [stats, setStats] = useState<any>(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    fetch(`${API}/public/stats`)
      .then(r => r.json())
      .then(json => { if (json.success) { setStats(json.data); setTimeout(() => setAnimated(true), 300); } })
      .catch(() => {});
  }, []);

  // Mapa simulado de bairros
  const bairros = [
    { nome: 'Jangurussu', reciclagem: 142, doacoes: 8 },
    { nome: 'Aldeota', reciclagem: 89, doacoes: 21 },
    { nome: 'Messejana', reciclagem: 117, doacoes: 5 },
    { nome: 'Centro', reciclagem: 203, doacoes: 32 },
    { nome: 'Barra do Ceará', reciclagem: 76, doacoes: 3 },
    { nome: 'Papicu', reciclagem: 95, doacoes: 15 },
  ];

  const acoesTraduzidas: any = { RECYCLING: '♻️ Reciclagem', BLOOD_DONATION: '🩸 Doação de Sangue' };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-b from-emerald-900/50 to-slate-950 py-20 px-6 text-center">
        <span className="text-6xl">🌱</span>
        <h1 className="text-4xl font-black mt-6">EcoSolid — Impacto da Cidade</h1>
        <p className="text-lg text-slate-300 mt-4 max-w-md mx-auto">
          Transformando Fortaleza com ações cidadãs na blockchain
        </p>
      </div>

      <div className="max-w-3xl mx-auto p-6 space-y-10 -mt-10">
        {/* Contadores */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <CounterCard value={stats.totalCitizens || 0} label="Cidadãos" icon="👥" animated={animated} />
            <CounterCard value={stats.totalActions || 0} label="Ações" icon="📊" animated={animated} />
            <CounterCard value={stats.solidDistributed || 0} label="SOLID Dist." icon="⭐" animated={animated} />
            <CounterCard value={(stats.totalActions || 0) * 2} label="Kg Reciclados*" icon="♻️" animated={animated} suffix="kg" />
          </div>
        )}

        {/* Mapa de calor por bairro */}
        <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
          <h2 className="text-xl font-bold mb-4">📍 Mapa de Impacto — Fortaleza</h2>
          <p className="text-xs text-slate-500 mb-4">Dados simulados por bairro (versão MVP)</p>
          <div className="space-y-3">
            {bairros.map(b => {
              const max = Math.max(...bairros.map(x => x.reciclagem + x.doacoes));
              const pct = ((b.reciclagem + b.doacoes) / max) * 100;
              return (
                <div key={b.nome} className="flex items-center gap-3">
                  <span className="text-sm font-bold w-28">{b.nome}</span>
                  <div className="flex-1 h-8 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-600 to-cyan-500 rounded-full flex items-center px-3"
                      style={{ width: `${pct}%`, minWidth: '80px' }}>
                      <span className="text-xs font-bold text-white">
                        ♻️ {b.reciclagem}  🩸 {b.doacoes}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-600 mt-3">* Dados de localização baseados em registros voluntários</p>
        </div>

        {/* Últimas ações */}
        {stats?.recentActions && (
          <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
            <h2 className="text-xl font-bold mb-4">🕐 Últimas Ações</h2>
            <div className="space-y-2">
              {stats.recentActions.map((a: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 text-sm">
                  <div>
                    <span className="text-slate-300">Cidadão {a.initial}</span>
                    <span className="text-slate-500 ml-1">fez</span>
                    <span className="text-white font-bold ml-1">{acoesTraduzidas[a.actionType] || a.actionType}</span>
                    {a.bloodType && <span className="text-red-400 ml-1">({a.bloodType})</span>}
                    <span className="text-slate-500 ml-1">em {a.locationAddress}</span>
                  </div>
                  <span className="text-emerald-400 font-bold">+{a.pointsEarned}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-slate-600 text-center pb-10">
          EcoSolid — Plataforma de impacto cidadão • Fortaleza/CE • {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

function CounterCard({ value, label, icon, animated, suffix }: any) {
  const display = suffix ? `${value.toLocaleString()} ${suffix}` : value.toLocaleString();
  return (
    <div className={`p-4 rounded-xl bg-white/5 border border-white/10 text-center transition-all duration-1000 ${animated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      <span className="text-2xl">{icon}</span>
      <p className="text-2xl font-black mt-2">{display}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}
