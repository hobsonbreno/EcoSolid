'use client';

import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

export default function SejaParceiroPage() {
  const [form, setForm] = useState({
    nomeEstabelecimento: '', cnpj: '', segmento: '',
    nomeResponsavel: '', email: '', whatsapp: '', cidade: 'Fortaleza',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}/partners/interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) setSubmitted(true);
      else alert(json.error);
    } catch (e) { alert('Erro ao enviar. Tente novamente.'); }
    setLoading(false);
  };

  const planos = [
    { nome: 'Básico', preco: 'R$ 200/mês', destaque: false, itens: ['Até 50 resgates/mês', 'Painel de validação', 'Suporte por email', 'Selo EcoSolid', 'Relatório mensal'] },
    { nome: 'Profissional', preco: 'R$ 500/mês', destaque: true, itens: ['Até 200 resgates/mês', 'Painel de validação', 'QR Code personalizado', 'Suporte WhatsApp', 'Relatório ESG', 'Selo EcoSolid', '1 anúncio na rede'] },
    { nome: 'Institucional', preco: 'R$ 1.500/mês', destaque: false, itens: ['Resgates ilimitados', 'Painel de validação', 'QR Code personalizado', 'Suporte VIP 24h', 'Relatório ESG completo', 'Selo EcoSolid', '5 anúncios na rede', 'API de integração'] },
  ];

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="text-center max-w-sm space-y-4">
          <span className="text-6xl">🎉</span>
          <h1 className="text-2xl font-black">Recebemos seu cadastro!</h1>
          <p className="text-slate-400">Nossa equipe entrará em contato em até 48h úteis.</p>
          <p className="text-xs text-slate-600">Enquanto isso, conheça o app em <a href="/" className="text-emerald-400">ecosolid.vercel.app</a></p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-900/40 to-slate-950 py-20 px-6 text-center">
        <span className="text-5xl">🤝</span>
        <h1 className="text-4xl font-black mt-6 max-w-2xl mx-auto">
          Seja um parceiro EcoSolid e transforme cidadania em desconto fiscal
        </h1>
        <p className="text-lg text-slate-300 mt-4 max-w-md mx-auto">
          Ofereça benefícios, ganhe visibilidade e converta ações cidadãs em abatimento fiscal
        </p>
        <a href="#planos" className="inline-block mt-8 px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 font-bold hover:scale-105 transition-transform">
          Ver Planos
        </a>
      </section>

      {/* Como Funciona */}
      <section className="py-16 px-6 max-w-4xl mx-auto">
        <h2 className="text-2xl font-black text-center mb-10">Como Funciona</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { step: '1', icon: '🎁', title: 'Ofereça Desconto', desc: 'Crie benefícios que cidadãos resgatam com SOLID. Estacionamento, saúde, alimentação, energia.' },
            { step: '2', icon: '🔄', title: 'Cidadãos Resgatam', desc: 'Usuários trocam pontos por seus benefícios. Você valida com QR Code no painel do parceiro.' },
            { step: '3', icon: '📊', title: 'Abatimento Fiscal', desc: 'Cada resgate gera registro blockchain. Converta em desconto fiscal e relatórios ESG.' },
          ].map(item => (
            <div key={item.step} className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center hover:border-emerald-500/50 transition-colors">
              <span className="text-3xl">{item.icon}</span>
              <div className="mt-3 text-xs font-bold text-emerald-400">Passo {item.step}</div>
              <h3 className="font-bold mt-2">{item.title}</h3>
              <p className="text-sm text-slate-400 mt-2">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefícios para o parceiro */}
      <section className="py-16 px-6 max-w-4xl mx-auto bg-white/5 rounded-3xl my-10">
        <h2 className="text-2xl font-black text-center mb-10">Benefícios para o Parceiro</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: '👁️', title: 'Visibilidade', desc: 'Destaque na rede EcoSolid para milhares de cidadãos' },
            { icon: '📉', title: 'Desconto Fiscal', desc: 'Abatimento no ISS municipal proporcional aos resgates' },
            { icon: '📄', title: 'Relatório ESG', desc: 'Relatórios de impacto automáticos para compliance' },
            { icon: '🌐', title: 'Rede de Parceiros', desc: 'Acesso à rede exclusiva de parceiros EcoSolid' },
          ].map(b => (
            <div key={b.title} className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
              <span className="text-2xl">{b.icon}</span>
              <h3 className="font-bold text-sm mt-2">{b.title}</h3>
              <p className="text-xs text-slate-400 mt-1">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="py-16 px-6 max-w-4xl mx-auto">
        <h2 className="text-2xl font-black text-center mb-10">Planos</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {planos.map(p => (
            <div key={p.nome} className={`p-6 rounded-2xl border ${p.destaque ? 'border-emerald-500 bg-emerald-500/5 scale-105' : 'border-white/10 bg-white/5'}`}>
              {p.destaque && <p className="text-xs text-emerald-400 font-bold mb-2">✨ MAIS POPULAR</p>}
              <h3 className="font-black text-xl">{p.nome}</h3>
              <p className="text-3xl font-black text-emerald-400 mt-2">{p.preco}</p>
              <ul className="mt-6 space-y-2">
                {p.itens.map(i => (
                  <li key={i} className="text-sm text-slate-400 flex gap-2"><span className="text-emerald-400">✓</span> {i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Formulário */}
      <section className="py-16 px-6 max-w-md mx-auto">
        <h2 className="text-2xl font-black text-center mb-6">Cadastre seu Interesse</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input required placeholder="Nome do Estabelecimento" value={form.nomeEstabelecimento}
            onChange={e => setForm({...form, nomeEstabelecimento: e.target.value})}
            className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500" />
          <input required placeholder="CNPJ" value={form.cnpj}
            onChange={e => setForm({...form, cnpj: e.target.value})}
            className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500" />
          <select required value={form.segmento}
            onChange={e => setForm({...form, segmento: e.target.value})}
            className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500 text-slate-400">
            <option value="">Segmento</option>
            <option value="Saúde">Saúde</option>
            <option value="Alimentação">Alimentação</option>
            <option value="Mobilidade">Mobilidade</option>
            <option value="Energia">Energia</option>
            <option value="Educação">Educação</option>
            <option value="Varejo">Varejo</option>
            <option value="Outro">Outro</option>
          </select>
          <input required placeholder="Nome do Responsável" value={form.nomeResponsavel}
            onChange={e => setForm({...form, nomeResponsavel: e.target.value})}
            className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500" />
          <input required type="email" placeholder="Email" value={form.email}
            onChange={e => setForm({...form, email: e.target.value})}
            className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500" />
          <input required placeholder="WhatsApp (85 99999-9999)" value={form.whatsapp}
            onChange={e => setForm({...form, whatsapp: e.target.value})}
            className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500" />
          <button type="submit" disabled={loading}
            className="w-full p-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 font-bold hover:scale-105 disabled:opacity-50">
            {loading ? 'Enviando...' : 'Enviar Cadastro'}
          </button>
        </form>

        {/* WhatsApp */}
        <div className="mt-6 text-center">
          <a href="https://wa.me/5585999999999?text=Ol%C3%A1%20EcoSolid!%20Quero%20ser%20um%20parceiro." target="_blank"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-600 font-bold hover:bg-green-500 text-sm">
            💬 Falar com Consultor via WhatsApp
          </a>
        </div>
      </section>

      <footer className="text-center py-10 text-xs text-slate-600">
        EcoSolid — Cidadania tokenizada em Fortaleza • {new Date().getFullYear()}
      </footer>
    </div>
  );
}
