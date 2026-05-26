'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

export default function GestaoPage() {
  const [role, setRole] = useState<'admin' | 'partner' | null>(null);
  const [authKey, setAuthKey] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [tab, setTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Dados
  const [metrics, setMetrics] = useState<any>(null);
  const [citizens, setCitizens] = useState<any[]>([]);
  const [citizenSearch, setCitizenSearch] = useState('');
  const [bloodStats, setBloodStats] = useState<any[]>([]);
  const [interests, setInterests] = useState<any[]>([]);
  const [allRedemptions, setAllRedemptions] = useState<any[]>([]);
  const [partnerRedemptions, setPartnerRedemptions] = useState<any[]>([]);
  const [partnerStats, setPartnerStats] = useState<any>(null);

  // Alertas de sangue
  const [alertForm, setAlertForm] = useState({ bloodType: '', hospital: '', message: '', location: 'Fortaleza - CE' });

  const [loading, setLoading] = useState(false);

  // Doadores por tipo
  const [donorBloodType, setDonorBloodType] = useState('');
  const [donors, setDonors] = useState<any[]>([]);
  // Modal Agendar
  const [scheduleModal, setScheduleModal] = useState<{ citizenId: string; citizenName: string } | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('08:00');
  const [scheduleNotes, setScheduleNotes] = useState('');
  // Agendamentos
  const [appointments, setAppointments] = useState<any[]>([]);
  // Ações pendentes (parceiro/admin)
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [pendingRedemptions, setPendingRedemptions] = useState<any[]>([]);

  // Sprint 6: Parceiros
  const [partnerForm, setPartnerForm] = useState({ cnpj: '', nomeFantasia: '', razaoSocial: '', logradouro: '', numero: '', bairro: '', municipio: '', uf: '', cep: '', telefone: '', responsavel: '', segmento: 'Outro' });
  const [partners, setPartners] = useState<any[]>([]);
  const [partnerData, setPartnerData] = useState<any>(null); // dados do parceiro logado
  // Hospital selecionado (coord dinâmicas)
  const [selectedHospital, setSelectedHospital] = useState<{ nome: string; lat: number; lng: number } | null>(null);
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [hospitals, setHospitals] = useState<any[]>([]);
  // Histórico parceiro
  const [historiaResgates, setHistoriaResgates] = useState<any[]>([]);
  // Admin filtros
  const [adminFilterStatus, setAdminFilterStatus] = useState('');
  const [adminFilterSegmento, setAdminFilterSegmento] = useState('');
  const [adminFilterDate, setAdminFilterDate] = useState('');
  // Dashboard do parceiro
  const [dashMetrics, setDashMetrics] = useState<any>(null);
  const [dashResgates30d, setDashResgates30d] = useState<any[]>([]);
  const [dashTopBeneficios, setDashTopBeneficios] = useState<any[]>([]);
  const [dashUltimosResgates, setDashUltimosResgates] = useState<any[]>([]);
  const [dashStatus, setDashStatus] = useState<any>(null);
  const [dashPeriodo, setDashPeriodo] = useState('hoje');
  const [dashSearch, setDashSearch] = useState('');
  const [dashPolling, setDashPolling] = useState(0);
  // Filtros da aba Resgates (parceiro)
  const [redeemCodeFilter, setRedeemCodeFilter] = useState('');
  const [redeemDateFilter, setRedeemDateFilter] = useState('hoje');
  const [redeemPage, setRedeemPage] = useState(1);
  const PAGE_SIZE = 100;
  const HIST_PAGE_SIZE = 50;
  // Histórico: extrato PIX/Crypto/Extrato Geral
  const [historicoSubTab, setHistoricoSubTab] = useState<'extrato'|'pix'|'crypto'>('extrato');
  const [historicoData, setHistoricoData] = useState<any[]>([]);
  const [historicoResumo, setHistoricoResumo] = useState<any>(null);
  const [historicoTotal, setHistoricoTotal] = useState(0);
  const [historicoTotalPages, setHistoricoTotalPages] = useState(1);
  const [historicoPagina, setHistoricoPagina] = useState(1);
  const [historicoPeriodo, setHistoricoPeriodo] = useState('todos');
  const [historicoTipo, setHistoricoTipo] = useState('todos');
  const [historicoDirecao, setHistoricoDirecao] = useState('todos');
  const [historicoBusca, setHistoricoBusca] = useState('');
  // Admin stats
  const [adminStats, setAdminStats] = useState({ today: 0, solidToday: 0, feeToday: 0 });

  const apiFetch = (url: string, opts?: RequestInit) => fetch(`${API}${url}`, opts);

  // Haversine distance
  const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const HEMOSANGUE_LAT = -3.7706;
  const HEMOSANGUE_LNG = -38.5590;

  // Fetch de dados admin
  const fetchAdminData = async (key: string) => {
    const h = { 'x-admin-key': key };
    try {
      const [m, c, bs, i, r] = await Promise.all([
        fetch(`${API}/admin/metrics`, { headers: h }).then(r => r.json()),
        fetch(`${API}/admin/citizens/recent`, { headers: h }).then(r => r.json()),
        fetch(`${API}/admin/blood-type-stats`, { headers: h }).then(r => r.json()),
        fetch(`${API}/partners/admin/interests`).then(r => r.json()),
        fetch(`${API}/admin/redemptions/all`, { headers: h }).then(r => r.json()),
      ]);
      if (m.success) setMetrics(m.data);
      if (c.success) setCitizens(c.data);
      if (bs.success) setBloodStats(bs.data);
      if (i.success) setInterests(i.data);
      if (r.success) setAllRedemptions(r.data);
    } catch (e) { console.error(e); }
  };

  // Fetch dados parceiro
  const fetchPartnerData = async (name: string) => {
    try {
      const res = await fetch(`${API}/benefits/partner/${encodeURIComponent(name)}`);
      const json = await res.json();
      if (json.success) {
        setPartnerRedemptions(json.data.redemptions);
        setPartnerStats(json.data.stats);
      }
    } catch (e) { console.error(e); }
  };

  // Busca cidadãos
  const searchCitizens = async (q: string) => {
    if (!authKey) return;
    setCitizenSearch(q);
    const res = await fetch(`${API}/admin/citizens/search?q=${encodeURIComponent(q)}`, { headers: { 'x-admin-key': authKey } });
    const json = await res.json();
    if (json.success) setCitizens(json.data);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Tenta como admin
    fetch(`${API}/admin/metrics`, { headers: { 'x-admin-key': authKey } })
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setRole('admin');
          setAuthKey(authKey);
          localStorage.setItem('gestao_admin_key', authKey);
          fetchAdminData(authKey);
        } else if (partnerName.trim() || authKey.trim().length === 8) {
          // Try partner code login
          const code = authKey.trim().toUpperCase();
          console.log('[PartnerLogin] Buscando parceiro por código:', code);
          fetch(`${API}/partners/by-code/${code}`)
            .then(r => r.json())
            .then(json => {
              console.log('[PartnerLogin] Resposta by-code:', json);
              if (json.success && json.data.ativo) {
                const p = json.data;
                console.log('[PartnerLogin] Parceiro encontrado:', p.nomeFantasia, 'Segmento:', p.segmento);
                setPartnerData(p);
                localStorage.setItem('gestao_partner_id', p._id);
                localStorage.setItem('gestao_partner_name', p.nomeFantasia);
                localStorage.setItem('gestao_partner_segmento', p.segmento);
                localStorage.setItem('gestao_partner_orgao', p.razaoSocial || p.nomeFantasia);
                localStorage.setItem('gestao_partner_code', code);
                setRole('partner');
                setPartnerName(p.nomeFantasia);
                // Fetch segment pending redemptions immediately
                console.log('[PartnerLogin] Buscando redemptions do segmento:', p.segmento);
                fetch(`${API}/benefits/pending?segment=${encodeURIComponent(p.segmento)}`).then(r => r.json()).then(j => {
                  console.log('[PartnerLogin] Pending redemptions:', j.data?.length || 0, 'itens');
                  if (j.success) setPendingRedemptions(j.data);
                });
              } else {
                // Fallback: legacy fixed code
                if (code === 'ECOSOLID2026' || code === 'ecosolid2026' || code === 'ECOSOLID') {
                  console.log('[PartnerLogin] Usando código legado fixo');
                  const legacyData = { _id: 'legacy', nomeFantasia: partnerName.trim() || 'Parceiro Legacy', segmento: 'Outro', razaoSocial: partnerName.trim() || 'Parceiro Legacy' };
                  setPartnerData(legacyData);
                  localStorage.setItem('gestao_partner_id', 'legacy');
                  localStorage.setItem('gestao_partner_name', legacyData.nomeFantasia);
                  localStorage.setItem('gestao_partner_segmento', 'Outro');
                  localStorage.setItem('gestao_partner_orgao', legacyData.razaoSocial);
                  localStorage.setItem('gestao_partner_code', code);
                  setRole('partner');
                  setPartnerName(legacyData.nomeFantasia);
                  fetch(`${API}/benefits/pending`).then(r => r.json()).then(j => {
                    if (j.success) setPendingRedemptions(j.data);
                  });
                } else {
                  alert('Código de acesso inválido ou parceiro inativo. Use "ECOSOLID2026" como código legado.');
                }
              }
            })
            .catch(() => alert('Erro ao conectar'));
        } else {
          alert('Credenciais inválidas.');
        }
      })
      .catch(() => alert('Erro ao conectar'));
  };

  const handleLogout = () => {
    setRole(null); setAuthKey(''); setPartnerName(''); setMetrics(null); setCitizens([]);
    setBloodStats([]); setInterests([]); setAllRedemptions([]); setPartnerRedemptions([]);
    setPartnerData(null); setSelectedHospital(null); setPartners([]);
    localStorage.removeItem('gestao_partner_id');
    localStorage.removeItem('gestao_partner_name');
    localStorage.removeItem('gestao_partner_segmento');
    localStorage.removeItem('gestao_partner_code');
    localStorage.removeItem('gestao_admin_key');
    setSidebarOpen(false);
  };

  const handleApprovePartner = async (id: string) => {
    setLoading(true);
    const res = await fetch(`${API}/partners/admin/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    const json = await res.json();
    if (json.success) {
      setInterests(prev => prev.map(i => i._id === id ? { ...i, status: 'aprovado', partnerCode: json.data.partnerCode } : i));
    }
    setLoading(false);
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`${API}/alerts/blood`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(alertForm) });
    const json = await res.json();
    if (json.success) {
      setAlertForm({ bloodType: '', hospital: '', message: '', location: 'Fortaleza - CE' });
      alert(`Alerta criado! Notificações push enviadas para doadores ${alertForm.bloodType}.`);
    } else alert(json.error);
    setLoading(false);
  };

  const handleValidateCode = async (code: string) => {
    if (!code) { alert('Digite um código'); return; }
    setLoading(true);
    const res = await fetch(`${API}/benefits/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code.toUpperCase(), partnerName: partnerName || '' }) });
    const json = await res.json();
    if (json.success) { fetchPartnerData(partnerName); alert(`✅ Validado: ${json.data.benefitDescription} — ${json.data.solidCost} SOLID`); }
    else alert(json.error);
    setLoading(false);
  };

  const exportCSV = () => {
    const header = 'Nome,Email,CPF,Tipo Sanguineo,Total SOLID,Criado em';
    const rows = citizens.map((c: any) => `${c.name},${c.email || ''},${c.cpf || ''},${c.bloodType || ''},${c.totalPoints || 0},${c.createdAt || ''}`).join('\n');
    const csv = header + '\n' + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `ecosolid-cidadaos-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  // Redirect old routes
  useEffect(() => { if (typeof window !== 'undefined' && (window.location.pathname === '/admin' || window.location.pathname === '/parceiro')) { window.location.href = '/gestao'; } }, []);

  // Load partners list (admin)
  useEffect(() => {
    if (role === 'admin' && tab === 'partners') {
      fetch(`${API}/partners`).then(r => r.json()).then(j => { if (j.success) setPartners(j.data); });
    }
  }, [role, tab]);

  // Auto-load histórico (extrato PIX/Crypto)
  useEffect(() => {
    if (role !== 'partner' || tab !== 'historia') return;
    const pn = partnerName || '';
    const params = new URLSearchParams({ partnerName: pn, periodo: historicoPeriodo, pagina: String(historicoPagina), limite: String(HIST_PAGE_SIZE), tipo: historicoTipo, direcao: historicoDirecao });
    if (historicoBusca) params.set('busca', historicoBusca);
    const endpoint = historicoSubTab === 'extrato' ? 'extrato' : historicoSubTab;
    fetch(`${API}/historico/${endpoint}?${params}`).then(r => r.json()).then(json => {
      if (json.success) {
        setHistoricoData(json.data);
        setHistoricoTotal(json.total);
        setHistoricoTotalPages(json.totalPages);
        if (json.resumo) setHistoricoResumo(json.resumo);
      }
    }).catch(() => {});
  }, [role, tab, historicoSubTab, historicoPeriodo, historicoTipo, historicoDirecao, historicoBusca, historicoPagina, partnerName]);

  // Auto-load desempenho do parceiro
  useEffect(() => {
    if (role !== 'partner' || tab !== 'performance') return;
    const seg = partnerData?.segmento || '';
    if (!seg) return;
    // Busca todos (sem filtro de status) para calcular totais
    const url = `${API}/benefits/partner-segment/${encodeURIComponent(seg)}`;
    fetch(url).then(r => r.json()).then(json => {
      if (json.success) {
        const redemptions = json.data || [];
        setPartnerRedemptions(redemptions);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const todayCount = redemptions.filter((r: any) => new Date(r.createdAt) >= today).length;
        const monthCount = redemptions.filter((r: any) => new Date(r.createdAt) >= startOfMonth).length;
        setPartnerStats({ today: todayCount, month: monthCount, total: redemptions.length });
      }
    }).catch(() => {});
  }, [role, tab, partnerData?.segmento]);

  // Auto-load Dashboard do parceiro
  useEffect(() => {
    if (role !== 'partner' || tab !== 'dashboard') return;
    const pn = partnerName || '';
    const loadDashboard = async () => {
      try {
        const [m, r30d, top, ult, status] = await Promise.all([
          fetch(`${API}/dashboard/metricas?partnerName=${encodeURIComponent(pn)}&periodo=${dashPeriodo}`).then(r => r.json()),
          fetch(`${API}/dashboard/resgates-30dias?partnerName=${encodeURIComponent(pn)}`).then(r => r.json()),
          fetch(`${API}/dashboard/top-beneficios?partnerName=${encodeURIComponent(pn)}&periodo=${dashPeriodo}`).then(r => r.json()),
          fetch(`${API}/dashboard/ultimos-resgates?partnerName=${encodeURIComponent(pn)}`).then(r => r.json()),
          fetch(`${API}/dashboard/status-sistema`).then(r => r.json()),
        ]);
        if (m.success) setDashMetrics(m.data);
        if (r30d.success) setDashResgates30d(r30d.data);
        if (top.success) setDashTopBeneficios(top.data);
        if (ult.success) setDashUltimosResgates(ult.data);
        if (status.success) setDashStatus(status.data);
      } catch {}
    };
    loadDashboard();
  }, [role, tab, dashPeriodo, partnerName, dashPolling]);

  // Polling 15s para últimos resgates do dashboard
  useEffect(() => {
    if (role !== 'partner' || tab !== 'dashboard') return;
    const interval = setInterval(() => setDashPolling(n => n + 1), 15000);
    return () => clearInterval(interval);
  }, [role, tab]);

  // Restaurar sessão ao carregar a página
  useEffect(() => {
    if (role) return; // já autenticado
    const savedAdminKey = localStorage.getItem('gestao_admin_key');
    if (savedAdminKey) {
      fetch(`${API}/admin/metrics`, { headers: { 'x-admin-key': savedAdminKey } })
        .then(r => r.json())
        .then(json => {
          if (json.success) {
            setRole('admin');
            setAuthKey(savedAdminKey);
            fetchAdminData(savedAdminKey);
          } else {
            localStorage.removeItem('gestao_admin_key');
          }
        })
        .catch(() => {});
    } else {
      const savedPartnerCode = localStorage.getItem('gestao_partner_code');
      if (savedPartnerCode) {
        fetch(`${API}/partners/by-code/${savedPartnerCode}`)
          .then(r => r.json())
          .then(json => {
            if (json.success && json.data.ativo) {
              const p = json.data;
              setPartnerData(p);
              setRole('partner');
              setPartnerName(p.nomeFantasia);
              setAuthKey(savedPartnerCode);
              fetch(`${API}/benefits/pending?segment=${encodeURIComponent(p.segmento)}`).then(r => r.json()).then(j => {
                if (j.success) setPendingRedemptions(j.data);
              });
            } else {
              // Limpa localStorage se parceiro inválido
              ['gestao_partner_id','gestao_partner_name','gestao_partner_segmento','gestao_partner_code'].forEach(k => localStorage.removeItem(k));
            }
          })
          .catch(() => {});
      }
    }
  }, []);

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-5">
          <div className="text-center space-y-2">
            <span className="text-5xl">🛡️</span>
            <h1 className="text-2xl font-black">Portal de Gestão</h1>
            <p className="text-sm text-slate-400">Área administrativa EcoSolid</p>
          </div>
          <input placeholder="Nome do Parceiro (opcional)" value={partnerName}
            onChange={e => setPartnerName(e.target.value)}
            className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-cyan-500" />
          <input required placeholder="Código de Acesso (8 dígitos)" value={authKey}
            onChange={e => setAuthKey(e.target.value)}
            className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-cyan-500" />
          <button type="submit" disabled={loading}
            className="w-full p-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 font-bold hover:scale-105">Acessar</button>
        </form>
      </div>
    );
  }

  const sidebarItems: any = {
    admin: [
      { key: 'dashboard', label: 'Dashboard', icon: '📊' },
      { key: 'citizens', label: 'Cidadãos', icon: '👥' },
      { key: 'alerts', label: 'Alertas de Sangue', icon: '🩸' },
      { key: 'partners', label: 'Parceiros', icon: '🤝' },
      { key: 'redemptions', label: 'Resgates', icon: '🎁' },
      { key: 'reports', label: 'Relatórios', icon: '📈' },
    ],
    partner: [
      { key: 'dashboard', label: 'Dashboard', icon: '📊' },
      { key: 'redeem', label: 'Resgates', icon: '🎁' },
      { key: 'historia', label: 'Histórico', icon: '📋' },
      { key: 'performance', label: 'Meu Desempenho', icon: '📊' },
      { key: 'certificates', label: 'Meus Certificados', icon: '📜' },
    ],
  };

  const items = sidebarItems[role];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-white/10 transform transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-auto`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🌱</span>
              <div>
                <p className="font-black text-lg">EcoSolid</p>
                <p className="text-xs text-slate-500">{role === 'admin' ? 'Administrador' : partnerName}</p>
                {role === 'partner' && partnerData && (
                  <p className="text-xs text-slate-600">{partnerData.segmento}{partnerData.municipio ? ` \u00b7 ${partnerData.municipio}` : ''}</p>
                )}
              </div>
            </div>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {items.map((item: any) => (
              <button key={item.key} onClick={() => { setTab(item.key); setSidebarOpen(false); }}
                className={`w-full text-left p-3 rounded-xl flex items-center gap-3 text-sm font-bold transition-colors ${tab === item.key ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                <span className="text-lg">{item.icon}</span> {item.label}
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-white/10">
            <button onClick={handleLogout} className="w-full p-3 rounded-xl text-red-400 hover:bg-red-500/10 text-sm font-bold">🚪 Sair</button>
          </div>
        </div>
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Conteúdo principal */}
      <main className="flex-1 min-h-screen p-6">
        {/* Header mobile */}
        <div className="flex items-center gap-3 mb-6 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-3 rounded-xl bg-white/10 text-white">☰</button>
          <span className="font-black">EcoSolid Gestão</span>
        </div>

        {/* ADMIN: Dashboard */}
        {role === 'admin' && tab === 'dashboard' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-black">📊 Dashboard</h1>
            {metrics && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card title="Cidadãos" val={metrics.totalCitizens} icon="👥" c="emerald" />
                <Card title="Ações" val={metrics.totalActions} icon="📊" c="cyan" />
                <Card title="SOLID Distribuído" val={metrics.solidDistributed.toLocaleString()} icon="⭐" c="amber" />
                <Card title="Fundo Manutenção" val={`${metrics.maintenanceFees} SOLID`} icon="💰" c="purple" />
              </div>
            )}
            {/* Break-down */}
            {metrics?.breakdown && (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="font-bold text-sm mb-3">📊 Ações por Tipo</p>
                {Object.entries(metrics.breakdown).map(([k, d]: any) => (
                  <div key={k} className="flex justify-between py-1 text-sm">
                    <span>{k === 'RECYCLING' ? '♻️ Reciclagem' : '🩸 Doação'}</span>
                    <span className="text-slate-400">{d.count} ações — {d.points} SOLID</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ADMIN: Cidadãos */}
        {role === 'admin' && tab === 'citizens' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-black">👥 Cidadãos</h1>
            <input placeholder="Buscar por nome, CPF, tipo sanguíneo..." value={citizenSearch}
              onChange={e => searchCitizens(e.target.value)}
              className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-cyan-500" />
            <div className="grid gap-2">
              {citizens.map((c: any) => (
                <div key={c._id} className="p-3 rounded-xl bg-white/5 border border-white/10 text-sm flex justify-between">
                  <div>
                    <p className="font-bold">{c.name}</p>
                    <p className="text-xs text-slate-400">{c.email} {c.bloodType && `| 🩸 ${c.bloodType}`} {c.cpf && `| CPF: ${c.cpf}`}</p>
                  </div>
                  <span className="text-emerald-400 font-bold">{c.totalPoints || 0} SOLID</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ADMIN: Alertas */}
        {role === 'admin' && tab === 'alerts' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-black">🩸 Alertas de Sangue</h1>
            <form onSubmit={handleCreateAlert} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <p className="font-bold text-sm">Criar Novo Alerta</p>
              <select required value={alertForm.bloodType}
                onChange={e => setAlertForm({ ...alertForm, bloodType: e.target.value })}
                className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-red-500 text-slate-400">
                <option value="">Tipo Sanguíneo</option>
                {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input required placeholder="Buscar hospital parceiro..." value={hospitalSearch}
                onChange={async e => {
                  setHospitalSearch(e.target.value);
                  if (e.target.value.length >= 2) {
                    const res = await fetch(`${API}/partners/by-segment/Hospital`);
                    const json = await res.json();
                    if (json.success) {
                      const filtered = json.data.filter((h: any) =>
                        h.nomeFantasia.toLowerCase().includes(e.target.value.toLowerCase()) ||
                        h.municipio?.toLowerCase().includes(e.target.value.toLowerCase())
                      );
                      setHospitals(filtered);
                    }
                  } else setHospitals([]);
                }}
                className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-red-500" />
              {hospitals.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-xl bg-slate-800 border border-slate-700">
                  {hospitals.map((h: any) => (
                    <button key={h._id} type="button" onClick={() => {
                      setAlertForm({ ...alertForm, hospital: h.nomeFantasia, location: `${h.logradouro || ''} ${h.numero || ''} - ${h.bairro || ''}, ${h.municipio || ''}/${h.uf || ''}`.trim() });
                      if (h.latitude && h.longitude) setSelectedHospital({ nome: h.nomeFantasia, lat: h.latitude, lng: h.longitude });
                      setHospitalSearch(h.nomeFantasia);
                      setHospitals([]);
                    }} className="w-full text-left p-2 hover:bg-slate-700 text-sm border-b border-slate-700 last:border-0">
                      <span className="font-bold">{h.nomeFantasia}</span>
                      <span className="text-xs text-slate-400 ml-2">{h.municipio}/{h.uf}</span>
                    </button>
                  ))}
                </div>
              )}
              <input required placeholder="Mensagem de urgência" value={alertForm.message}
                onChange={e => setAlertForm({ ...alertForm, message: e.target.value })}
                className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-red-500" />
              <button type="submit" disabled={loading}
                className="w-full p-3 rounded-xl bg-red-500 font-bold hover:bg-red-400">🚨 Disparar Alerta + Push</button>
            </form>

            {/* Doadores por Tipo com Distância */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
              <p className="font-bold text-sm">📍 Doadores por Tipo</p>
              <select value={donorBloodType}
                onChange={async e => {
                  const type = e.target.value;
                  setDonorBloodType(type);
                  if (!type) { setDonors([]); return; }
                  try {
                    const res = await fetch(`${API}/citizens/blood-type/${type}`);
                    const json = await res.json();
                    if (json?.success) setDonors(json.data || []);
                  } catch {}
                }}
                className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-red-500 text-slate-400">
                <option value="">Selecione o tipo sanguíneo...</option>
                {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {donors.length > 0 && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {donors
                    .map((d: any) => {
                      const refLat = selectedHospital?.lat ?? HEMOSANGUE_LAT;
                      const refLng = selectedHospital?.lng ?? HEMOSANGUE_LNG;
                      const dist = d.latitude && d.longitude ? haversineKm(d.latitude, d.longitude, refLat, refLng) : Infinity;
                      return { ...d, _dist: dist };
                    })
                    .sort((a: any, b: any) => a._dist - b._dist)
                    .map((d: any) => (
                      <div key={d._id} className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/50 space-y-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-sm">{d.name}</p>
                            <p className="text-xs text-slate-400">{d.phone || 'Sem telefone'} | {d.address || 'Sem endereço'}</p>
                            <p className="text-xs font-mono text-red-400">🩸 {d.bloodType}</p>
                          </div>
                          <span className="text-xs font-bold text-emerald-400">
                            {d._dist === Infinity ? '—' : `${d._dist.toFixed(1)} km do ${selectedHospital?.nome ?? 'HemoSangue CE'}`}
                          </span>
                        </div>
                        <button
                          onClick={() => setScheduleModal({ citizenId: d._id, citizenName: d.name })}
                          className="text-xs text-cyan-400 hover:text-cyan-300 font-bold underline"
                        >📅 Agendar Coleta</button>
                      </div>
                    ))}
                </div>
              )}
              {donorBloodType && donors.length === 0 && (
                <p className="text-xs text-slate-500">Nenhum doador encontrado com tipo {donorBloodType}.</p>
              )}
            </div>

            {/* Agendamentos */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex justify-between items-center">
                <p className="font-bold text-sm">📋 Agendamentos</p>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(`${API}/appointments`);
                      const json = await res.json();
                      if (json?.success) setAppointments(json.data || []);
                    } catch {}
                  }}
                  className="text-xs text-cyan-400 hover:text-cyan-300 underline"
                >Atualizar</button>
              </div>
              {appointments.length === 0 && <p className="text-xs text-slate-500">Nenhum agendamento. Use a seção Doadores por Tipo para agendar.</p>}
              {appointments.map((a: any) => (
                <div key={a._id} className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/50 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-sm">{a.citizenName}</p>
                    <p className="text-xs text-slate-400">{a.date} às {a.time} — {a.location}</p>
                    {a.notes && <p className="text-xs text-slate-500">{a.notes}</p>}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      a.status === 'confirmado' ? 'bg-green-500/20 text-green-400' :
                      a.status === 'realizado' ? 'bg-emerald-500/20 text-emerald-400' :
                      a.status === 'cancelado' ? 'bg-red-500/20 text-red-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>{a.status}</span>
                  </div>
                  <div className="flex gap-1">
                    {a.status === 'agendado' && (
                      <button onClick={async () => {
                        await fetch(`${API}/appointments/${a._id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'confirmado' }) });
                        setAppointments(prev => prev.map(x => x._id === a._id ? { ...x, status: 'confirmado' } : x));
                      }} className="text-xs px-2 py-1 rounded bg-green-600 font-bold hover:bg-green-500">Confirmar</button>
                    )}
                    {(a.status === 'agendado' || a.status === 'confirmado') && (
                      <button onClick={async () => {
                        await fetch(`${API}/appointments/${a._id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'realizado' }) });
                        setAppointments(prev => prev.map(x => x._id === a._id ? { ...x, status: 'realizado' } : x));
                      }} className="text-xs px-2 py-1 rounded bg-emerald-600 font-bold hover:bg-emerald-500">Realizado</button>
                    )}
                    {a.status !== 'cancelado' && a.status !== 'realizado' && (
                      <button onClick={async () => {
                        await fetch(`${API}/appointments/${a._id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelado' }) });
                        setAppointments(prev => prev.map(x => x._id === a._id ? { ...x, status: 'cancelado' } : x));
                      }} className="text-xs px-2 py-1 rounded bg-red-600 font-bold hover:bg-red-500">Cancelar</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Agendar Coleta */}
        {scheduleModal && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setScheduleModal(null)}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold">📅 Agendar Coleta — {scheduleModal.citizenName}</h3>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Data</label>
                <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Horário</label>
                <select value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 outline-none focus:border-emerald-500 text-slate-400">
                  {['07:00','08:00','09:00','10:00','11:00','13:00','14:00','15:00','16:00'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Observações</label>
                <textarea value={scheduleNotes} onChange={e => setScheduleNotes(e.target.value)} rows={3}
                  className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 outline-none focus:border-emerald-500 resize-none" />
              </div>
              <button
                onClick={async () => {
                  if (!scheduleDate) { alert('Selecione a data'); return; }
                  setLoading(true);
                  const res = await fetch(`${API}/appointments`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ citizenId: scheduleModal.citizenId, citizenName: scheduleModal.citizenName, date: scheduleDate, time: scheduleTime, notes: scheduleNotes, location: 'HemoSangue CE' }),
                  });
                  const json = await res.json();
                  if (json.success) {
                    setAppointments(prev => [json.data, ...prev]);
                    setScheduleModal(null);
                    setScheduleDate('');
                    setScheduleNotes('');
                    alert('Agendamento criado com sucesso!');
                  } else alert(json.error);
                  setLoading(false);
                }}
                disabled={loading}
                className="w-full p-3 rounded-xl bg-emerald-600 font-bold hover:bg-emerald-500 disabled:opacity-50"
              >Confirmar Agendamento</button>
              <button onClick={() => setScheduleModal(null)} className="w-full p-3 rounded-xl bg-slate-700 font-bold hover:bg-slate-600">Cancelar</button>
            </div>
          </div>
        )}

        {/* ADMIN: Parceiros */}
        {role === 'admin' && tab === 'partners' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-black">🤝 Parceiros</h1>
            {/* Cadastrar novo parceiro */}
            <form onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              const res = await fetch(`${API}/partners`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(partnerForm) });
              const json = await res.json();
              if (json.success) {
                setPartners(prev => [json.data, ...prev]);
                setPartnerForm({ cnpj: '', nomeFantasia: '', razaoSocial: '', logradouro: '', numero: '', bairro: '', municipio: '', uf: '', cep: '', telefone: '', responsavel: '', segmento: 'Outro' });
                alert(`Parceiro cadastrado! Código de acesso: ${json.data.codigoAcesso}`);
              } else alert(json.error || 'Erro ao cadastrar');
              setLoading(false);
            }} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <p className="font-bold text-sm">Cadastrar Novo Parceiro</p>
              <input placeholder="CNPJ (XX.XXX.XXX/XXXX-XX)" value={partnerForm.cnpj} onChange={e => setPartnerForm(p => ({...p, cnpj: e.target.value}))}
                onBlur={async () => {
                  const cleanCnpj = partnerForm.cnpj.replace(/\D/g, '');
                  if (cleanCnpj.length !== 14) return;
                  try {
                    const res = await fetch(`https://publica.cnpj.ws/cnpj/${cleanCnpj}`);
                    const json = await res.json();
                    if (json.estabelecimento) {
                      const e = json.estabelecimento;
                      setPartnerForm(p => ({...p,
                        nomeFantasia: e.nome_fantasia || p.nomeFantasia,
                        razaoSocial: e.razao_social || p.razaoSocial,
                        logradouro: e.logradouro || p.logradouro,
                        numero: e.numero || p.numero,
                        bairro: e.bairro || p.bairro,
                        municipio: e.cidade?.nome || p.municipio,
                        uf: e.estado?.sigla || p.uf,
                        cep: e.cep || p.cep,
                        telefone: `${e.ddd1 || ''}${e.telefone1 || ''}`.trim() || p.telefone,
                      }));
                    }
                  } catch {}
                }}
                className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 outline-none focus:border-emerald-500 text-sm" />
              <input placeholder="Nome Fantasia" value={partnerForm.nomeFantasia} onChange={e => setPartnerForm(p => ({...p, nomeFantasia: e.target.value}))}
                className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 outline-none focus:border-emerald-500 text-sm" />
              <input placeholder="Razão Social" value={partnerForm.razaoSocial} onChange={e => setPartnerForm(p => ({...p, razaoSocial: e.target.value}))}
                className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 outline-none focus:border-emerald-500 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Logradouro" value={partnerForm.logradouro} onChange={e => setPartnerForm(p => ({...p, logradouro: e.target.value}))}
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 outline-none focus:border-emerald-500 text-sm" />
                <input placeholder="Número" value={partnerForm.numero} onChange={e => setPartnerForm(p => ({...p, numero: e.target.value}))}
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 outline-none focus:border-emerald-500 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Bairro" value={partnerForm.bairro} onChange={e => setPartnerForm(p => ({...p, bairro: e.target.value}))}
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 outline-none focus:border-emerald-500 text-sm" />
                <input placeholder="CEP" value={partnerForm.cep} onChange={e => setPartnerForm(p => ({...p, cep: e.target.value}))}
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 outline-none focus:border-emerald-500 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Município" value={partnerForm.municipio} onChange={e => setPartnerForm(p => ({...p, municipio: e.target.value}))}
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 outline-none focus:border-emerald-500 text-sm" />
                <input placeholder="UF" value={partnerForm.uf} onChange={e => setPartnerForm(p => ({...p, uf: e.target.value}))} maxLength={2}
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 outline-none focus:border-emerald-500 text-sm" />
              </div>
              <input placeholder="Telefone" value={partnerForm.telefone} onChange={e => setPartnerForm(p => ({...p, telefone: e.target.value}))}
                className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 outline-none focus:border-emerald-500 text-sm" />
              <input placeholder="Responsável" value={partnerForm.responsavel} onChange={e => setPartnerForm(p => ({...p, responsavel: e.target.value}))}
                className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 outline-none focus:border-emerald-500 text-sm" />
              <select value={partnerForm.segmento} onChange={e => setPartnerForm(p => ({...p, segmento: e.target.value}))}
                className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 outline-none focus:border-emerald-500 text-sm text-slate-400">
                {['Hospital', 'Estacionamento', 'Restaurante', 'Farmacia', 'Energia', 'Outro'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button type="submit" disabled={loading}
                className="w-full p-3 rounded-xl bg-emerald-600 font-bold text-sm hover:bg-emerald-500 disabled:opacity-50">Cadastrar Parceiro</button>
            </form>
            {/* Interesses de Parceria */}
            {interests.length > 0 && <h2 className="text-lg font-bold mt-6">Interesses de Parceria</h2>}
            {interests.map((p: any) => (
              <div key={p._id} className="p-4 rounded-xl bg-white/5 border border-white/10 flex justify-between items-center">
                <div>
                  <p className="font-bold text-sm">{p.nomeEstabelecimento}</p>
                  <p className="text-xs text-slate-400">{p.segmento} | {p.nomeResponsavel} | {p.email}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${p.status === 'aprovado' ? 'bg-emerald-500/20 text-emerald-400' : p.status === 'rejeitado' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {p.status}
                  </span>
                  {p.partnerCode && <span className="text-xs ml-2 text-cyan-400 font-mono">Código: {p.partnerCode}</span>}
                </div>
                {p.status === 'pendente' && (
                  <button onClick={() => handleApprovePartner(p._id)} disabled={loading}
                    className="px-4 py-2 rounded-xl bg-emerald-500 text-sm font-bold hover:bg-emerald-400">Aprovar</button>
                )}
              </div>
            ))}
            {/* Parceiros Cadastrados */}
            {partners.length > 0 && <h2 className="text-lg font-bold mt-6">Parceiros Cadastrados</h2>}
            {partners.map((p: any) => (
              <div key={p._id} className="p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="font-bold text-sm">{p.nomeFantasia}</p>
                <p className="text-xs text-slate-400">{p.segmento} | {p.municipio}/{p.uf}</p>
                <p className="text-xs font-mono text-emerald-400">Código: {p.codigoAcesso}</p>
                <span className={`text-xs ${p.ativo ? 'text-emerald-400' : 'text-red-400'}`}>{p.ativo ? 'Ativo' : 'Inativo'}</span>
              </div>
            ))}
          </div>
        )}

        {/* ADMIN: Resgates */}
        {role === 'admin' && tab === 'redemptions' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-black">🎁 Resgates & Validações</h1>

            {/* Ações pendentes de validação */}
            <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20 space-y-3">
              <div className="flex justify-between items-center">
                <p className="font-bold text-sm text-yellow-400">⏳ Ações Pendentes de Validação</p>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(`${API}/impact/pending`);
                      const json = await res.json();
                      if (json?.success) setPendingActions(json.data || []);
                    } catch {}
                  }}
                  className="text-xs text-cyan-400 hover:text-cyan-300 underline"
                >Atualizar</button>
              </div>
              {pendingActions.length === 0 && <p className="text-xs text-slate-500">Nenhuma ação pendente de validação.</p>}
              {pendingActions.map((a: any) => (
                <div key={a._id} className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/50 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-sm">{a.citizenId}</p>
                      <p className="text-xs text-slate-400">{a.actionType} — +{a.pointsEarned} SOLID</p>
                      <p className="text-xs text-slate-500">{new Date(a.timestamp).toLocaleString('pt-BR')}</p>
                      {a.evidenceUrl && a.evidenceUrl !== 'sem-foto' && (
                        <img src={a.evidenceUrl} alt="Evidência" className="mt-2 w-20 h-20 object-cover rounded-lg border border-slate-600" />
                      )}
                      {a.latitude && a.longitude && (
                        <a href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`} target="_blank" rel="noopener"
                          className="text-xs text-cyan-400 hover:text-cyan-300 underline block mt-1">📍 Ver local no Google Maps</a>
                      )}
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full font-bold bg-yellow-500/20 text-yellow-400">🟡 Pendente</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setLoading(true);
                        const res = await fetch(`${API}/impact/${a._id}/validate`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'x-partner-code': 'ADMIN' },
                        });
                        const json = await res.json();
                        if (json.success) {
                          setPendingActions(prev => prev.filter(x => x._id !== a._id));
                          alert('Ação validada com sucesso!');
                        } else alert(json.error);
                        setLoading(false);
                      }}
                      disabled={loading}
                      className="text-xs px-3 py-1 rounded-lg bg-green-600 font-bold hover:bg-green-500"
                    >Validar ✓</button>
                    <button
                      onClick={async () => {
                        setLoading(true);
                        const res = await fetch(`${API}/impact/${a._id}/reject`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'x-partner-code': 'ADMIN' },
                        });
                        const json = await res.json();
                        if (json.success) {
                          setPendingActions(prev => prev.filter(x => x._id !== a._id));
                          alert('Ação rejeitada.');
                        } else alert(json.error);
                        setLoading(false);
                      }}
                      disabled={loading}
                      className="text-xs px-3 py-1 rounded-lg bg-red-600 font-bold hover:bg-red-500"
                    >Rejeitar ✗</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Resgates com filtros + totalizador */}
            <h2 className="text-lg font-bold mt-6">📊 Histórico de Resgates</h2>
            {/* Totalizador */}
            <div className="flex gap-3 text-xs">
              {(() => {
                const today = new Date(); today.setHours(0,0,0,0);
                const todayRedeems = allRedemptions.filter((r: any) => new Date(r.createdAt) >= today && (r.status === 'CONFIRMADO' || r.status === 'validated'));
                const solid = todayRedeems.reduce((s: number, r: any) => s + (r.solidCost||0), 0);
                const fee = todayRedeems.reduce((s: number, r: any) => s + (r.maintenanceFee||0), 0);
                return <><span className="px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">✅ {todayRedeems.length} hoje</span><span className="px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">🪙 {solid} SOLID</span><span className="px-2 py-1 rounded-full bg-slate-500/10 border border-slate-500/20">💰 Taxa: {fee} SOLID</span></>;
              })()}
            </div>
            {/* Filtros */}
            <div className="flex gap-2 flex-wrap">
              <select value={adminFilterStatus} onChange={e => setAdminFilterStatus(e.target.value)} className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-xs outline-none focus:border-cyan-500">
                <option value="">Todos os Status</option>
                <option value="CONFIRMADO">Confirmado</option>
                <option value="PENDENTE">Pendente</option>
                <option value="EXPIRADO">Expirado</option>
              </select>
              <select value={adminFilterSegmento} onChange={e => setAdminFilterSegmento(e.target.value)} className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-xs outline-none focus:border-cyan-500">
                <option value="">Todos os Segmentos</option>
                {['Estacionamento','Hospital','Energia','Restaurante','Outro'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input type="date" value={adminFilterDate} onChange={e => setAdminFilterDate(e.target.value)} className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-xs outline-none focus:border-cyan-500" />
              <button onClick={() => {
                const filtered = allRedemptions
                  .filter((r: any) => !adminFilterStatus || r.status === adminFilterStatus)
                  .filter((r: any) => !adminFilterSegmento || r.partnerSegmento === adminFilterSegmento)
                  .filter((r: any) => !adminFilterDate || r.createdAt?.startsWith(adminFilterDate));
                const csvRows = ['Código,Cidadão,Benefício,Parceiro,Segmento,Local,Data,SOLID,Taxa,Status,txHash'];
                filtered.forEach((r: any) => {
                  csvRows.push([r.code, r.citizenId, `"${(r.benefitDescription||'').replace(/"/g,'""')}"`, r.partnerOrgao||r.partnerName, r.partnerSegmento||'', `"${(r.locationAddress||'').replace(/"/g,'""')}"`, r.createdAt, r.solidCost, r.maintenanceFee||0, r.status, r.txHash||''].join(','));
                });
                const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `resgates-ecosolid-${new Date().toISOString().slice(0,10)}.csv`;
                a.click();
              }} className="p-2 rounded-lg bg-cyan-600 text-xs font-bold hover:bg-cyan-500">📥 Exportar CSV</button>
            </div>
            {allRedemptions
              .filter((r: any) => !adminFilterStatus || r.status === adminFilterStatus)
              .filter((r: any) => !adminFilterSegmento || r.partnerSegmento === adminFilterSegmento)
              .filter((r: any) => !adminFilterDate || r.createdAt?.startsWith(adminFilterDate))
              .map((r: any) => (
              <div key={r._id} className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1 text-sm">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-mono font-bold text-xs">{r.code}</p>
                    <p className="text-xs text-slate-400">{r.citizenId} &middot; {r.benefitDescription}</p>
                    <p className="text-xs text-slate-500">{r.partnerOrgao || r.partnerName} &middot; {r.partnerSegmento || ''}</p>
                    {r.locationAddress && <p className="text-xs text-slate-500">📍 {r.locationAddress.substring(0, 60)}</p>}
                    <p className="text-xs text-slate-500">{r.createdAt ? new Date(r.createdAt).toLocaleString('pt-BR') : ''} &middot; {r.solidCost} SOLID &middot; Taxa: {r.maintenanceFee || 0}</p>
                    {r.txHash && <a href={`https://sepolia.etherscan.io/tx/${r.txHash}`} target="_blank" rel="noopener" className="text-xs text-cyan-400 hover:underline font-mono">🔗 {r.txHash.substring(0, 20)}...</a>}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-bold whitespace-nowrap ${
                    r.status === 'CONFIRMADO' || r.status === 'validated' ? 'bg-emerald-500/20 text-emerald-400' :
                    r.status === 'EXPIRADO' ? 'bg-red-500/20 text-red-400' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>{r.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Polling de ações pendentes */}
        <PollingActions onUpdate={setPendingActions} active={role === 'admin' && tab === 'redemptions'} api={API} />
        <PollingActions onUpdate={setPendingActions} active={role === 'partner' && tab === 'redeem'} api={API} segment={partnerData?.segmento || ''} />
        <PollingRedemptions onUpdate={setPendingRedemptions} active={role === 'partner' && tab === 'redeem'} api={API} segment={partnerData?.segmento || ''} />

        {/* ADMIN: Relatórios */}
        {role === 'admin' && tab === 'reports' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-black">📈 Relatórios</h1>
            <button onClick={exportCSV}
              className="w-full p-4 rounded-xl bg-cyan-500 font-bold hover:bg-cyan-400 flex items-center justify-center gap-2">
              📥 Exportar Cidadãos (CSV)
            </button>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <button onClick={() => {
                const data = `CERTIFICADO ESG — EcoSolid\n=========\nTotal Cidadãos: ${metrics?.totalCitizens || '—'}\nAções: ${metrics?.totalActions || '—'}\nSOLID Distribuído: ${metrics?.solidDistributed || '—'}\nFundo Manutenção: ${metrics?.maintenanceFees || '—'} SOLID\nResgates: ${metrics?.totalRedemptions || '—'}\n=========\nFortaleza/CE — ${new Date().getFullYear()}`;
                navigator.clipboard.writeText(data).then(() => alert('Certificado ESG copiado!'));
              }} className="w-full p-3 rounded-xl bg-white/5 border border-emerald-500/30 text-emerald-400 text-sm font-bold hover:bg-emerald-500/10">
                📜 Copiar Certificado ESG da Plataforma
              </button>
            </div>
          </div>
        )}

        {/* PARTNER: Resgates */}
        {role === 'partner' && tab === 'redeem' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-black">🎁 Validações & Resgates</h1>
            {partnerData && (
              <p className="text-sm text-slate-400">{partnerData.nomeFantasia} &middot; {partnerData.segmento}</p>
            )}

            {/* Validar código de resgate */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <p className="font-bold text-sm">Validar Código de Resgate</p>
              <div className="flex gap-2">
                <input placeholder="Código 8 dígitos" id="partnerCode"
                  className="flex-1 p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500 font-mono text-lg tracking-widest text-center"
                  maxLength={8} />
                <button onClick={() => handleValidateCode((document.getElementById('partnerCode') as HTMLInputElement)?.value)}
                  disabled={loading}
                  className="px-6 py-4 rounded-xl bg-emerald-500 font-bold hover:bg-emerald-400">Validar</button>
              </div>
              <p className="text-xs text-slate-500">Ou escaneie o QR Code do cliente</p>
            </div>

            {/* Ações e Resgates Pendentes de Validação (unificado) */}
            <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20 space-y-3">
              <div className="flex justify-between items-center">
                <p className="font-bold text-sm text-yellow-400">⏳ Pendentes de Validação (tempo real)</p>
                <span className="text-xs text-slate-500">ações 10s · resgates 5s</span>
              </div>
              {/* Filtros */}
              <div className="flex gap-2">
                <input placeholder="🔍 Filtrar por código..." value={redeemCodeFilter}
                  onChange={e => { setRedeemCodeFilter(e.target.value); setRedeemPage(1); }}
                  className="flex-1 p-2 rounded-lg bg-slate-900 border border-slate-700 outline-none focus:border-yellow-500 font-mono text-sm" />
                <select value={redeemDateFilter} onChange={e => setRedeemDateFilter(e.target.value)}
                  className="p-2 rounded-lg bg-slate-900 border border-slate-700 outline-none focus:border-yellow-500 text-sm text-slate-300">
                  <option value="hoje">Hoje</option>
                  <option value="7dias">Últimos 7 dias</option>
                  <option value="30dias">Últimos 30 dias</option>
                  <option value="todos">Todos</option>
                </select>
              </div>
              {(() => {
                const todayStart = new Date(); todayStart.setHours(0,0,0,0);
                const dateSince = redeemDateFilter === 'hoje' ? todayStart :
                  redeemDateFilter === '7dias' ? new Date(Date.now() - 7*86400000) :
                  redeemDateFilter === '30dias' ? new Date(Date.now() - 30*86400000) : null;
                const filtered = pendingRedemptions.filter((r: any) => {
                  if (redeemCodeFilter && !r.code?.toLowerCase().includes(redeemCodeFilter.toLowerCase())) return false;
                  if (dateSince && new Date(r.createdAt) < dateSince) return false;
                  return true;
                });
                const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
                const page = Math.min(redeemPage, totalPages);
                const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
                const exactOne = filtered.length === 1 && redeemCodeFilter.trim().length > 0;

                return <>
              {pendingActions.length === 0 && filtered.length === 0 && (
                <p className="text-xs text-slate-500">Nenhum item pendente de validação.</p>
              )}

              {/* Impact Actions pendentes */}
              {pendingActions.map((a: any) => (
                <div key={a._id} className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/50 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-sm">{a.citizenId}</p>
                      <p className="text-xs text-slate-400">{a.actionType} — +{a.pointsEarned} SOLID</p>
                      <p className="text-xs text-slate-500">{new Date(a.timestamp).toLocaleString('pt-BR')}</p>
                      {a.evidenceUrl && a.evidenceUrl !== 'sem-foto' && (
                        <img src={a.evidenceUrl} alt="Evidência" className="mt-2 w-20 h-20 object-cover rounded-lg border border-slate-600" />
                      )}
                      {a.latitude && a.longitude && (
                        <a href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`} target="_blank" rel="noopener"
                          className="text-xs text-cyan-400 hover:text-cyan-300 underline block mt-1">📍 Local no Google Maps</a>
                      )}
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full font-bold bg-yellow-500/20 text-yellow-400">🟡 P</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setLoading(true);
                        const res = await fetch(`${API}/impact/${a._id}/validate`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'x-partner-code': partnerName },
                        });
                        const json = await res.json();
                        if (json.success) {
                          setPendingActions(prev => prev.filter(x => x._id !== a._id));
                          alert('Ação validada + Blockchain!');
                        } else alert(json.error);
                        setLoading(false);
                      }}
                      disabled={loading}
                      className="text-xs px-3 py-1 rounded-lg bg-green-600 font-bold hover:bg-green-500"
                    >Validar ✓</button>
                    <button
                      onClick={async () => {
                        setLoading(true);
                        const res = await fetch(`${API}/impact/${a._id}/reject`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'x-partner-code': partnerName },
                        });
                        const json = await res.json();
                        if (json.success) {
                          setPendingActions(prev => prev.filter(x => x._id !== a._id));
                          alert('Ação rejeitada.');
                        } else alert(json.error);
                        setLoading(false);
                      }}
                      disabled={loading}
                      className="text-xs px-3 py-1 rounded-lg bg-red-600 font-bold hover:bg-red-500"
                    >Rejeitar ✗</button>
                  </div>
                </div>
              ))}

              {/* Benefit Redemptions pendentes (agora também aparecem aqui) */}
              {paged.map((r: any) => (
                <PendingRedemptionCard key={r._id} redemption={r} api={API} partnerName={partnerName}
                  highlight={exactOne}
                  onUpdate={(id: string, confirmed: boolean) => {
                    setPendingRedemptions(prev => prev.filter(x => x._id !== id));
                    if (confirmed) {
                      setLoading(false);
                      alert(`${r.solidCost} SOLID debitados. Timer${r.duracaoMinutos > 0 ? ` de ${r.duracaoMinutos}min` : ''} iniciado!`);
                    } else alert('Resgate rejeitado.');
                  }} setLoading={setLoading} />
              ))}
              {/* Paginação */}
              {filtered.length > PAGE_SIZE && (
                <div className="flex items-center justify-between pt-1">
                  <button onClick={() => setRedeemPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                    className="text-xs px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50">Anterior</button>
                  <span className="text-xs text-slate-500">Página {page} de {totalPages} ({filtered.length} itens)</span>
                  <button onClick={() => setRedeemPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                    className="text-xs px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50">Próxima</button>
                </div>
              )}
              </>;
              })()}
            </div>
          </div>
        )}

        {/* PARTNER: Desempenho */}
        {role === 'partner' && tab === 'performance' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-black">📊 Meu Desempenho</h1>
            {partnerStats && (
              <div className="grid grid-cols-3 gap-3">
                <Card title="Hoje" val={partnerStats.today} icon="📅" c="emerald" />
                <Card title="Mês" val={partnerStats.month} icon="📆" c="cyan" />
                <Card title="Total" val={partnerStats.total} icon="📊" c="amber" />
              </div>
            )}
            <div className="space-y-2">
              {partnerRedemptions.slice(0, 20).map((r: any, i: number) => (
                <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/10 flex justify-between text-sm">
                  <div>
                    <p className="font-mono font-bold">{r.code}</p>
                    <p className="text-xs text-slate-400">{r.benefitDescription} — {r.solidCost} SOLID</p>
                  </div>
                  <span className={`font-bold text-xs ${r.status === 'validated' ? 'text-emerald-400' : 'text-amber-400'}`}>{r.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PARTNER: Dashboard */}
        {role === 'partner' && tab === 'dashboard' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
              <div>
                <h1 className="text-2xl font-black">📊 Dashboard de Gestão</h1>
                <p className="text-sm text-slate-400">{partnerName}</p>
              </div>
              <div className="flex gap-1">
                {['hoje','7dias','30dias','todos'].map(p => (
                  <button key={p} onClick={() => setDashPeriodo(p)}
                    className={`px-3 py-1 text-xs rounded-full font-bold transition-colors ${dashPeriodo === p ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
                    {p === 'hoje' ? 'Hoje' : p === '7dias' ? '7 dias' : p === '30dias' ? '30 dias' : 'Todos'}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI Cards */}
            {dashMetrics && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Resgates', val: dashMetrics.totalResgates, c: 'slate' },
                  { label: 'Aprovados', val: `${dashMetrics.aprovados} (${dashMetrics.taxaAprovacao}%)`, c: 'emerald' },
                  { label: 'Rejeitados', val: dashMetrics.rejeitados, c: 'red' },
                  { label: 'SOLID Dist.', val: dashMetrics.solidDistribuido, c: 'amber' },
                ].map(k => (
                  <div key={k.label} className={`p-3 rounded-xl bg-white/5 border border-white/10`}>
                    <p className="text-xs text-slate-400">{k.label}</p>
                    <p className={`text-lg font-black ${k.c === 'emerald' ? 'text-emerald-400' : k.c === 'red' ? 'text-red-400' : k.c === 'amber' ? 'text-amber-400' : 'text-white'}`}>{k.val}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Charts + Top Benefícios */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Resgates 30 dias chart */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <h3 className="text-sm font-bold text-slate-300 mb-3">Resgates nos Últimos 30 Dias</h3>
                {dashResgates30d.length > 0 && (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={dashResgates30d}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="data" tick={{fontSize:10, fill:'#94a3b8'}} interval={6} />
                      <YAxis tick={{fontSize:10, fill:'#94a3b8'}} allowDecimals={false} />
                      <Tooltip contentStyle={{background:'#0f172a', border:'1px solid #334155', borderRadius:'8px', color:'#e2e8f0'}} />
                      <Line type="monotone" dataKey="aprovados" stroke="#1a7a4a" strokeWidth={2} dot={false} name="Aprovados" />
                      <Line type="monotone" dataKey="rejeitados" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Rejeitados" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Top Benefícios */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <h3 className="text-sm font-bold text-slate-300 mb-3">Top Benefícios</h3>
                {dashTopBeneficios.length === 0 ? (
                  <p className="text-xs text-slate-500">Nenhum dado no período.</p>
                ) : (
                  <div className="space-y-2">
                    {dashTopBeneficios.map((b: any, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-5">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-300 truncate">{b.beneficio}</p>
                          <div className="w-full h-1 rounded-full bg-slate-800 mt-0.5">
                            <div className="h-1 rounded-full bg-emerald-500" style={{width: `${b.barraPct}%`}} />
                          </div>
                        </div>
                        <span className="text-xs text-slate-400 whitespace-nowrap">{b.quantidade}x</span>
                        <span className="text-xs text-amber-400 font-bold w-14 text-right">{b.solidTotal} S</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Últimos resgates + Status */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Últimos resgates */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-bold text-slate-300">Últimos Resgates</h3>
                  <span className="text-xs text-slate-600">atualiza 15s</span>
                </div>
                <input placeholder="🔍 Buscar código ou nome..." value={dashSearch}
                  onChange={e => setDashSearch(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 outline-none focus:border-cyan-500 text-sm mb-2" />
                {dashUltimosResgates.filter((r: any) => !dashSearch || r.code?.toLowerCase().includes(dashSearch.toLowerCase()) || r.citizenId?.toLowerCase().includes(dashSearch.toLowerCase())).slice(0, 10).map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 truncate">{r.citizenId?.slice(0, 20) || 'N/A'}</p>
                      <p className="font-mono text-xs text-slate-500">{r.code}</p>
                      <p className="text-xs text-slate-400 truncate">{r.benefitDescription}</p>
                    </div>
                    <div className="text-right ml-2">
                      <span className="text-xs text-amber-400 font-bold">-{r.solidCost} S</span>
                      <p className={`text-xs px-1.5 py-0.5 rounded-full font-bold mt-0.5 ${
                        r.status === 'CONFIRMADO' || r.status === 'validated' ? 'bg-emerald-500/20 text-emerald-400' :
                        r.status === 'PENDENTE' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
                      }`}>{r.status}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Status do Sistema */}
              <div className="space-y-3">
                {dashStatus && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Parceiros Ativos', val: dashStatus.totalParceiros, c: 'cyan' },
                        { label: 'Usuários', val: dashStatus.totalUsuarios, c: 'purple' },
                      ].map(k => (
                        <div key={k.label} className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                          <p className="text-xs text-slate-400">{k.label}</p>
                          <p className={`text-xl font-black ${k.c === 'cyan' ? 'text-cyan-400' : 'text-purple-400'}`}>{k.val}</p>
                        </div>
                      ))}
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                      <p className="text-xs text-slate-400">SOLID em Circulação</p>
                      <p className="text-2xl font-black text-emerald-400">{dashStatus.solidCirculacao?.toLocaleString()}</p>
                    </div>
                    {dashStatus.segmentos?.length > 0 && (
                      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                        <h3 className="text-sm font-bold text-slate-300 mb-2">Parceiros por Segmento</h3>
                        <div className="space-y-1.5">
                          {dashStatus.segmentos.map((s: any, i: number) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-slate-400">{s.nome}</span>
                              <span className="text-slate-300 font-bold">{s.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PARTNER: Histórico — Extrato PIX / Crypto / Geral */}
        {role === 'partner' && tab === 'historia' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-black">📋 Histórico de Transações</h1>

            {/* Sub-tabs */}
            <div className="flex gap-1">
              {(['extrato','pix','crypto'] as const).map(st => (
                <button key={st} onClick={() => { setHistoricoSubTab(st); setHistoricoPagina(1); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                    historicoSubTab === st ? 'bg-white/10 text-slate-200' : 'text-slate-500 hover:text-slate-300'
                  }`}>
                  {st === 'extrato' ? '📋 Extrato Geral' : st === 'pix' ? '💰 PIX' : '🔗 Crypto'}
                </button>
              ))}
            </div>

            {/* Filtros comuns */}
            <div className="flex flex-wrap gap-2">
              <select value={historicoPeriodo} onChange={e => { setHistoricoPeriodo(e.target.value); setHistoricoPagina(1); }}
                className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-300">
                <option value="hoje">Hoje</option><option value="7dias">7 dias</option><option value="30dias">30 dias</option><option value="todos">Todos</option>
              </select>
              {historicoSubTab === 'extrato' && (
                <select value={historicoTipo} onChange={e => { setHistoricoTipo(e.target.value); setHistoricoPagina(1); }}
                  className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-300">
                  <option value="todos">Todos</option><option value="pix">Só PIX</option><option value="crypto">Só Crypto</option>
                </select>
              )}
              <select value={historicoDirecao} onChange={e => { setHistoricoDirecao(e.target.value); setHistoricoPagina(1); }}
                className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-300">
                <option value="todos">Todos</option><option value="entrada">Só entradas</option><option value="saida">Só saídas</option>
              </select>
              <input placeholder="🔍 Buscar..." value={historicoBusca}
                onChange={e => { setHistoricoBusca(e.target.value); setHistoricoPagina(1); }}
                className="flex-1 min-w-[120px] p-2 rounded-lg bg-slate-900 border border-slate-700 text-sm outline-none focus:border-cyan-500" />
            </div>

            {/* Extrato Geral — resumo */}
            {historicoSubTab === 'extrato' && historicoResumo && (
              <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="text-center">
                  <p className="text-xs text-slate-400">Entradas</p>
                  <p className="text-sm font-black text-emerald-400">+R$ {historicoResumo.totalEntradas?.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-400">Saídas</p>
                  <p className="text-sm font-black text-red-400">-R$ {historicoResumo.totalSaidas?.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-400">Saldo</p>
                  <p className={`text-sm font-black ${historicoResumo.saldoLiquido >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    R$ {historicoResumo.saldoLiquido?.toFixed(2)}
                  </p>
                </div>
              </div>
            )}

            {/* Lista */}
            {historicoData.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">Nenhuma transação encontrada.</p>
            ) : (
              <div className="space-y-1">
                {(() => {
                  let lastDate = '';
                  return historicoData.map((item: any, i: number) => {
                    const itemDate = new Date(item.createdAt).toLocaleDateString('pt-BR');
                    const showDateSep = itemDate !== lastDate;
                    lastDate = itemDate;
                    const isEntrada = item.direcao === 'entrada';
                    const valorStr = `${isEntrada ? '+' : '-'}${item.moeda === 'BRL' ? 'R$ ' : ''}${item.valor?.toFixed(item.moeda === 'BRL' ? 2 : 4)}${item.moeda === 'ETH' ? ' ETH' : ''}`;
                    return (
                      <div key={item._id || i}>
                        {showDateSep && (
                          <div className="flex items-center gap-2 py-2">
                            <div className="flex-1 border-t border-white/10" />
                            <span className="text-xs font-bold text-slate-500 px-2">{itemDate === new Date().toLocaleDateString('pt-BR') ? 'Hoje' : itemDate === new Date(Date.now()-86400000).toLocaleDateString('pt-BR') ? 'Ontem' : itemDate}</span>
                            <div className="flex-1 border-t border-white/10" />
                          </div>
                        )}
                        <div className="p-3 rounded-lg bg-slate-800/20 border border-white/5 flex items-center gap-3">
                          <span className={`text-lg ${isEntrada ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isEntrada ? '↓' : '↑'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <p className="text-xs text-slate-300 truncate font-bold">{item.contraparte || '—'}</p>
                              <span className={`text-xs font-black ml-2 ${isEntrada ? 'text-emerald-400' : 'text-red-400'}`}>{valorStr}</span>
                            </div>
                            <p className="text-xs text-slate-500">{item.descricao}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${item.tipo === 'pix' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                {item.tipo === 'pix' ? 'PIX' : 'Crypto'}
                              </span>
                              <span className="text-xs text-slate-600">{new Date(item.createdAt).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                                item.status === 'concluido' || item.status === 'confirmado' ? 'bg-emerald-500/20 text-emerald-400' :
                                item.status === 'pendente' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
                              }`}>{item.status}</span>
                            </div>
                            {item.hash && item.tipo === 'crypto' && (
                              <a href={`https://sepolia.etherscan.io/tx/${item.hash}`} target="_blank" rel="noopener"
                                className="text-xs text-cyan-400 hover:underline font-mono truncate block">🔗 {item.hash.slice(0,14)}...</a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}

            {/* Paginação */}
            {historicoTotalPages > 1 && (
              <div className="flex justify-between items-center pt-2">
                <button onClick={() => setHistoricoPagina(p => Math.max(1, p-1))} disabled={historicoPagina <= 1}
                  className="text-xs px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50">Anterior</button>
                <span className="text-xs text-slate-500">Página {historicoPagina} de {historicoTotalPages}</span>
                <button onClick={() => setHistoricoPagina(p => Math.min(historicoTotalPages, p+1))} disabled={historicoPagina >= historicoTotalPages}
                  className="text-xs px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50">Próxima</button>
              </div>
            )}
          </div>
        )}

        {/* PARTNER: Certificados */}
        {role === 'partner' && tab === 'certificates' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-black">📜 Meus Certificados</h1>
            <div className="p-4 rounded-xl bg-white/5 border border-emerald-500/30 space-y-3">
              <p className="text-sm font-bold text-emerald-400">Certificado ESG — {partnerName}</p>
              <p className="text-xs text-slate-400">Total de resgates validados: {partnerRedemptions.filter((r: any) => r.status === 'validated').length}</p>
              <p className="text-xs text-slate-400">SOLID movimentado: {partnerRedemptions.reduce((a: number, r: any) => a + (r.solidCost || 0), 0)}</p>
              <button onClick={() => {
                const d = `CERTIFICADO ESG — ${partnerName}\nEcoSolid Parceiro Oficial\n=========\nResgates validados: ${partnerRedemptions.filter((r: any) => r.status === 'validated').length}\nSOLID movimentado: ${partnerRedemptions.reduce((a: number, r: any) => a + (r.solidCost || 0), 0)}\nImpacto estimado: ${partnerRedemptions.reduce((a: number, r: any) => a + (r.solidCost || 0), 0) * 2} kg CO2 evitados\n=========\nFortaleza/CE — ${new Date().getFullYear()}`;
                navigator.clipboard.writeText(d).then(() => alert('Certificado copiado!'));
              }} className="w-full p-3 rounded-xl bg-emerald-500 font-bold text-sm hover:bg-emerald-400">📋 Copiar Certificado</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Card({ title, val, icon, c }: any) {
  const colors: any = { emerald: 'border-emerald-500/30 bg-emerald-500/10', cyan: 'border-cyan-500/30 bg-cyan-500/10', amber: 'border-amber-500/30 bg-amber-500/10', purple: 'border-purple-500/30 bg-purple-500/10' };
  return (
    <div className={`p-4 rounded-xl border ${colors[c] || 'border-white/10'} bg-white/5`}>
      <p className="text-xs text-slate-400 font-bold uppercase">{icon} {title}</p>
      <p className="text-xl font-black mt-1">{val}</p>
    </div>
  );
}

// Polling helpers
function PollingActions({ onUpdate, active, api, segment }: { onUpdate: (d: any[]) => void; active: boolean; api: string; segment?: string }) {
  useEffect(() => {
    if (!active) return;
    const fetchPending = async () => {
      try {
        const url = segment && segment !== 'Outro' ? `${api}/impact/pending?segment=${encodeURIComponent(segment)}` : `${api}/impact/pending`;
        console.log('[PollingActions] Buscando:', url);
        const res = await fetch(url);
        const json = await res.json();
        console.log('[PollingActions] Recebidas:', json.data?.length || 0, 'ações pendentes');
        if (json?.success) onUpdate(json.data || []);
      } catch {}
    };
    fetchPending();
    const interval = setInterval(fetchPending, 10000);
    return () => clearInterval(interval);
  }, [active, api, segment]);
  return null;
}

function PendingRedemptionCard({ redemption: r, api, partnerName, onUpdate, setLoading, highlight }: {
  redemption: any; api: string; partnerName: string;
  onUpdate: (id: string, confirmed: boolean) => void; setLoading: (v: boolean) => void;
  highlight?: boolean;
}) {
  const [citizenName, setCitizenName] = useState('');
  useEffect(() => {
    fetch(`${api}/citizens/${r.citizenId}`).then(res => res.json()).then(j => {
      if (j?.success) setCitizenName(j.data.name || 'N/A');
    }).catch(() => setCitizenName('N/A'));
  }, [r.citizenId]);
  const duracao = r.duracaoMinutos > 0 ? (r.duracaoMinutos >= 60 ? `${r.duracaoMinutos/60}h de` : `${r.duracaoMinutos}min de`) + ` ${r.benefitDescription}` : r.benefitDescription;
  return (
    <div className={`p-3 rounded-lg bg-slate-800/30 border space-y-2 ${highlight ? 'border-cyan-400 ring-2 ring-cyan-500/30' : 'border-slate-700/50'}`}>
      <div>
        <p className="font-bold text-sm">{citizenName || 'Carregando...'}</p>
        <p className="font-mono font-bold text-xs text-slate-500">{r.code}</p>
        <p className="text-xs text-slate-400">{duracao} — <span className="text-amber-400 font-bold">{r.solidCost} SOLID</span></p>
        {r.locationAddress && (
          <p className="text-xs text-slate-500 mt-1">📍 {r.locationAddress.substring(0, 80)}{r.locationAddress.length > 80 ? '...' : ''}</p>
        )}
        {r.lat && r.lng && (
          <a href={`https://www.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noopener"
            className="text-xs text-cyan-400 hover:text-cyan-300 underline block">🗺️ Ver no Google Maps</a>
        )}
        <p className="text-xs text-slate-500 mt-1">🕐 {new Date(r.createdAt).toLocaleString('pt-BR')}</p>
      </div>
      <div className="flex gap-2">
        <button onClick={async () => {
          setLoading(true);
          const res = await fetch(`${api}/benefits/${r._id}/confirm`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ partnerName }),
          });
          const json = await res.json();
          if (json.success) onUpdate(r._id, true);
          else alert(json.error);
          setLoading(false);
        }} className="text-xs px-3 py-1 rounded-lg bg-green-600 font-bold hover:bg-green-500">Aprovar ✓</button>
        <button onClick={() => onUpdate(r._id, false)}
          className="text-xs px-3 py-1 rounded-lg bg-red-600 font-bold hover:bg-red-500">Rejeitar ✗</button>
      </div>
    </div>
  );
}

function PollingRedemptions({ onUpdate, active, api, segment }: { onUpdate: (d: any[]) => void; active: boolean; api: string; segment?: string }) {
  useEffect(() => {
    if (!active) return;
    const fetchPending = async () => {
      try {
        const url = segment && segment !== 'Outro' ? `${api}/benefits/pending?segment=${encodeURIComponent(segment)}` : `${api}/benefits/pending`;
        const res = await fetch(url);
        const json = await res.json();
        if (json?.success) onUpdate(json.data || []);
      } catch {}
    };
    fetchPending();
    const interval = setInterval(fetchPending, 5000);
    return () => clearInterval(interval);
  }, [active, api, segment]);
  return null;
}
