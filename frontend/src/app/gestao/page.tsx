'use client';

import { useState, useEffect } from 'react';

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
    const isPartner = partnerName && authKey !== 'ecosolid-admin-2026';
    // Tenta como admin
    fetch(`${API}/admin/metrics`, { headers: { 'x-admin-key': authKey } })
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setRole('admin');
          setAuthKey(authKey);
          fetchAdminData(authKey);
        } else if (partnerName) {
          // Tenta como parceiro
          setRole('partner');
          fetchPartnerData(partnerName);
        } else {
          alert('Credenciais inválidas.');
        }
      })
      .catch(() => alert('Erro ao conectar'));
  };

  const handleLogout = () => {
    setRole(null); setAuthKey(''); setPartnerName(''); setMetrics(null); setCitizens([]);
    setBloodStats([]); setInterests([]); setAllRedemptions([]); setPartnerRedemptions([]);
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

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-5">
          <div className="text-center space-y-2">
            <span className="text-5xl">🛡️</span>
            <h1 className="text-2xl font-black">Portal de Gestão</h1>
            <p className="text-sm text-slate-400">Área administrativa EcoSolid</p>
          </div>
          <input required placeholder="Nome do Parceiro (opcional)" value={partnerName}
            onChange={e => setPartnerName(e.target.value)}
            className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-cyan-500" />
          <input required type="password" placeholder="Chave de Acesso" value={authKey}
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
      { key: 'redeem', label: 'Resgates', icon: '🎁' },
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
              <input required placeholder="Hospital" value={alertForm.hospital}
                onChange={e => setAlertForm({ ...alertForm, hospital: e.target.value })}
                className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-red-500" />
              <input required placeholder="Mensagem de urgência" value={alertForm.message}
                onChange={e => setAlertForm({ ...alertForm, message: e.target.value })}
                className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-red-500" />
              <button type="submit" disabled={loading}
                className="w-full p-3 rounded-xl bg-red-500 font-bold hover:bg-red-400">🚨 Disparar Alerta + Push + WhatsApp</button>
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
                      const dist = d.latitude && d.longitude ? haversineKm(d.latitude, d.longitude, HEMOSANGUE_LAT, HEMOSANGUE_LNG) : Infinity;
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
                            {d._dist === Infinity ? '—' : `${d._dist.toFixed(1)} km do HemoSangue CE`}
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

            {/* Resgates */}
            <h2 className="text-lg font-bold mt-6">Histórico de Resgates</h2>
            {allRedemptions.map((r: any) => (
              <div key={r._id} className="p-3 rounded-xl bg-white/5 border border-white/10 flex justify-between text-sm">
                <div>
                  <p className="font-mono font-bold">{r.code}</p>
                  <p className="text-xs text-slate-400">{r.partnerName} | {r.benefitDescription} | {r.solidCost} SOLID | Taxa: {r.maintenanceFee || 0}</p>
                </div>
                <span className={`font-bold text-xs ${r.status === 'CONFIRMADO' || r.status === 'validated' ? 'text-emerald-400' : r.status === 'EXPIRADO' ? 'text-red-400' : 'text-amber-400'}`}>{r.status}</span>
              </div>
            ))}
          </div>
        )}

        {/* Polling de ações pendentes */}
        <PollingActions onUpdate={setPendingActions} active={role === 'admin' && tab === 'redemptions'} api={API} />
        <PollingActions onUpdate={setPendingActions} active={role === 'partner' && tab === 'redeem'} api={API} />
        <PollingRedemptions onUpdate={setPendingRedemptions} active={role === 'partner' && tab === 'redeem'} api={API} />

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

            {/* Ações pendentes de validação */}
            <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20 space-y-3">
              <div className="flex justify-between items-center">
                <p className="font-bold text-sm text-yellow-400">⏳ Ações Pendentes de Validação (tempo real)</p>
                <span className="text-xs text-slate-500">Atualiza a cada 10s</span>
              </div>
              {pendingActions.length === 0 && <p className="text-xs text-slate-500">Nenhuma ação pendente.</p>}
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
            </div>

            {/* Resgates pendentes */}
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-3">
              <div className="flex justify-between items-center">
                <p className="font-bold text-sm text-blue-400">🎫 Resgates Pendentes (tempo real)</p>
                <span className="text-xs text-slate-500">Atualiza a cada 5s</span>
              </div>
              {pendingRedemptions.length === 0 && <p className="text-xs text-slate-500">Nenhum resgate pendente.</p>}
              {pendingRedemptions.map((r: any) => (
                <div key={r._id} className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/50 flex justify-between items-center">
                  <div>
                    <p className="font-mono font-bold">{r.code}</p>
                    <p className="text-xs text-slate-400">{r.benefitDescription} — {r.solidCost} SOLID</p>
                    <p className="text-xs text-slate-500">Cidadão: {r.citizenId}</p>
                  </div>
                  <button
                    onClick={async () => {
                      setLoading(true);
                      const res = await fetch(`${API}/benefits/${r._id}/confirm`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ partnerName }),
                      });
                      const json = await res.json();
                      if (json.success) {
                        setPendingRedemptions(prev => prev.filter(x => x._id !== r._id));
                        alert(`${r.solidCost} SOLID debitados. Resgate confirmado!`);
                      } else alert(json.error);
                      setLoading(false);
                    }}
                    disabled={loading}
                    className="text-xs px-3 py-1 rounded-lg bg-green-600 font-bold hover:bg-green-500"
                  >Confirmar Resgate</button>
                </div>
              ))}
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
function PollingActions({ onUpdate, active, api }: { onUpdate: (d: any[]) => void; active: boolean; api: string }) {
  useEffect(() => {
    if (!active) return;
    const fetchPending = async () => {
      try {
        const res = await fetch(`${api}/impact/pending`);
        const json = await res.json();
        if (json?.success) onUpdate(json.data || []);
      } catch {}
    };
    fetchPending();
    const interval = setInterval(fetchPending, 10000);
    return () => clearInterval(interval);
  }, [active, api]);
  return null;
}

function PollingRedemptions({ onUpdate, active, api }: { onUpdate: (d: any[]) => void; active: boolean; api: string }) {
  useEffect(() => {
    if (!active) return;
    const fetchPending = async () => {
      try {
        const res = await fetch(`${api}/benefits/pending`);
        const json = await res.json();
        if (json?.success) onUpdate(json.data || []);
      } catch {}
    };
    fetchPending();
    const interval = setInterval(fetchPending, 5000);
    return () => clearInterval(interval);
  }, [active, api]);
  return null;
}
