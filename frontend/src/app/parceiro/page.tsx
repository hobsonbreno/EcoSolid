'use client';

import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

export default function ParceiroPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [code, setCode] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [scanMode, setScanMode] = useState(false);
  const [scanInput, setScanInput] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const expected = process.env.NEXT_PUBLIC_PARTNER_CODE || 'ecosolid2026';
    if (code === expected) {
      setLoggedIn(true);
      loadDashboard(partnerName || 'Zona Azul Fortaleza');
    } else {
      alert('Código de parceiro inválido');
    }
  };

  const loadDashboard = async (name: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/benefits/partner/${encodeURIComponent(name)}`);
      const json = await res.json();
      if (json.success) setDashboard(json.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleValidate = async (codeToValidate?: string) => {
    const targetCode = codeToValidate || scanInput;
    if (!targetCode || targetCode.length < 8) { alert('Digite um código de 8 dígitos'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/benefits/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: targetCode.toUpperCase(), partnerName: dashboard?.partnerName || partnerName }),
      });
      const json = await res.json();
      setValidationResult(json);
      if (json.success) {
        loadDashboard(dashboard?.partnerName || partnerName);
        setScanInput('');
        setScanMode(false);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <span className="text-5xl">🤝</span>
            <h1 className="text-2xl font-bold mt-4">Painel do Parceiro</h1>
            <p className="text-sm text-slate-400 mt-2">Área exclusiva para parceiros EcoSolid</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              required
              placeholder="Nome do Parceiro"
              value={partnerName}
              onChange={e => setPartnerName(e.target.value)}
              className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500"
            />
            <input
              required
              type="password"
              placeholder="Código do Parceiro"
              value={code}
              onChange={e => setCode(e.target.value)}
              className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500"
            />
            <button type="submit" disabled={loading} className="w-full p-4 rounded-xl bg-emerald-500 font-bold hover:bg-emerald-400 disabled:opacity-50">
              {loading ? 'Entrando...' : 'Acessar Painel'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">🤝 {dashboard?.partnerName || partnerName}</h1>
            <p className="text-xs text-slate-400">Painel do Parceiro</p>
          </div>
          <button onClick={() => { setLoggedIn(false); setDashboard(null); }} className="text-sm text-red-400 hover:text-red-300">Sair</button>
        </div>

        {/* Estatísticas */}
        {dashboard?.stats && (
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
              <p className="text-2xl font-black text-emerald-400">{dashboard.stats.today}</p>
              <p className="text-xs text-slate-400">Hoje</p>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
              <p className="text-2xl font-black text-cyan-400">{dashboard.stats.month}</p>
              <p className="text-xs text-slate-400">Mês</p>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
              <p className="text-2xl font-black text-amber-400">{dashboard.stats.total}</p>
              <p className="text-xs text-slate-400">Total</p>
            </div>
          </div>
        )}

        {/* Validar Código */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
          <h2 className="font-bold text-sm">🔍 Validar Código</h2>
          <div className="flex gap-2">
            <input
              placeholder="Código 8 dígitos"
              value={scanInput}
              onChange={e => setScanInput(e.target.value.toUpperCase())}
              maxLength={8}
              className="flex-1 p-3 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500 font-mono text-lg tracking-widest text-center"
            />
            <button
              onClick={() => handleValidate()}
              disabled={loading || scanInput.length < 8}
              className="px-6 py-3 rounded-xl bg-emerald-500 font-bold hover:bg-emerald-400 disabled:opacity-50"
            >
              {loading ? '...' : 'Validar'}
            </button>
          </div>
          <button
            onClick={() => setScanMode(!scanMode)}
            className="w-full p-3 rounded-xl bg-slate-800 text-slate-400 font-bold text-sm hover:bg-slate-700 flex items-center justify-center gap-2"
          >
            📷 {scanMode ? 'Fechar Scanner' : 'Escanear QR Code'}
          </button>
          {scanMode && (
            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-center">
              <p className="text-xs text-cyan-300">
                Abra a câmera e escaneie o QR Code do usuário. O código será preenchido automaticamente.
              </p>
            </div>
          )}
        </div>

        {/* Resultado Validação */}
        {validationResult && (
          <div className={`p-4 rounded-xl ${validationResult.success ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
            <p className="font-bold text-sm">{validationResult.success ? '✅ Validado!' : '❌ Erro'}</p>
            <p className="text-xs mt-1 text-slate-300">{validationResult.message || validationResult.error}</p>
            {validationResult.success && (
              <p className="text-xs mt-1 text-emerald-400 font-mono">
                Código: {validationResult.data?.code}<br/>
                SOLID: {validationResult.data?.solidCost}
              </p>
            )}
            <button onClick={() => setValidationResult(null)} className="text-xs mt-2 text-slate-400 hover:text-white">Fechar</button>
          </div>
        )}

        {/* Lista de Resgates */}
        <div className="space-y-2">
          <h2 className="font-bold text-sm">📋 Resgates Recentes</h2>
          {dashboard?.redemptions?.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum resgate ainda.</p>
          ) : (
            dashboard?.redemptions?.slice(0, 20).map((r: any, i: number) => (
              <div key={i} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-sm font-mono font-bold">{r.code}</p>
                  <p className="text-xs text-slate-400">{r.benefitDescription} — {r.solidCost} SOLID</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                  r.status === 'validated' ? 'bg-emerald-500/20 text-emerald-400' :
                  r.status === 'used' ? 'bg-slate-500/20 text-slate-400' :
                  'bg-amber-500/20 text-amber-400'
                }`}>
                  {r.status === 'validated' ? '✓ Validado' : r.status === 'used' ? 'Usado' : 'Pendente'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
