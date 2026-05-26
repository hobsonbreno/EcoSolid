"use client";
import React, { useState, useRef, useEffect, useMemo } from 'react';
import QRCodeLib from 'qrcode';
import { jsPDF } from 'jspdf';
import confetti from 'canvas-confetti';

declare global {
  interface Window { ethereum?: any; PublicKeyCredential?: any; }
}

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
const SEPOLIA_RPC = process.env.NEXT_PUBLIC_SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com';
const isRealHash = (hash: string) => hash && hash.startsWith('0x') && hash.length === 66;
const formatHashDisplay = (hash: string) => hash ? `${hash.slice(0, 10)}...${hash.slice(-8)}` : '';
const formatAddress = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function InputField({ label, value, onChange, type, placeholder, maxLength }: { label: string; value: string; onChange: (e: any) => void; type?: string; placeholder?: string; maxLength?: number }) {
  return (
    <div className="mb-2">
      <p className="text-xs text-slate-500 uppercase font-bold mb-1">{label}</p>
      <input type={type || 'text'} value={value} onChange={onChange} placeholder={placeholder} maxLength={maxLength}
        className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 outline-none focus:border-cyan-500 text-sm text-slate-200" />
    </div>
  );
}

function QRCodeDisplay({ address }: { address: string }) {
  const [qrData, setQrData] = useState<string | null>(null);
  useEffect(() => {
    QRCodeLib.toDataURL(address || '0x', { width: 160, margin: 2, color: { dark: '#000', light: '#fff' } })
      .then(setQrData).catch(() => {});
  }, [address]);
  return qrData ? <img src={qrData} alt="QR Code" className="mx-auto rounded-xl border border-white/10" /> : null;
}

// ErrorBoundary para isolar crash de uma aba sem derrubar o app todo
class TabErrorBoundary extends React.Component<{ children: React.ReactNode; fallback?: React.ReactNode }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any, info: any) { console.error('[TabErrorBoundary]', error, info); }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div className="p-6 text-center text-slate-400 text-sm">Erro ao carregar esta seção. <button className="underline text-amber-400" onClick={() => this.setState({ hasError: false })}>Tentar novamente</button></div>;
    }
    return this.props.children;
  }
}

const apiFetch = (path: string, options?: RequestInit) =>
  fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

// Utilitários para conversão ArrayBuffer <-> Base64
const bufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
};

const base64ToBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

export default function EcoSolidApp() {
  const [view, setView] = useState<'LOGIN' | 'REGISTER' | 'DASHBOARD'>('LOGIN');
  const [dashboardTab, setDashboardTab] = useState<'OVERVIEW' | 'BENEFITS' | 'CONTAS' | 'PROFILE' | 'EXTRATO'>('OVERVIEW');
  const [contasWalletInput, setContasWalletInput] = useState('');
  // NOVOS: PIX, crypto e cotações
  const [pixKeyInput, setPixKeyInput] = useState('');
  const [pixKeyType, setPixKeyType] = useState('cpf');
  const [pixQrModal, setPixQrModal] = useState<{ type: 'send' | 'receive'; value?: string; key?: string; description?: string } | null>(null);
  const [cryptoModal, setCryptoModal] = useState<{ type: 'send' | 'receive' } | null>(null);
  const [quotes, setQuotes] = useState<{ eth: number | null; btc: number | null }>({ eth: null, btc: null });
  const [metaMaskBal, setMetaMaskBal] = useState<string | null>(null);
  const [evmBal, setEvmBal] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<{eth: string; brl: string} | null>(null);
  const [extrato, setExtrato] = useState<any[]>([]);
  // Edição de perfil
  const [editProfile, setEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<any>({});
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const openProfileEdit = () => {
    setProfileForm({
      name: citizen?.name || '', email: citizen?.email || '', phone: citizen?.phone || '',
      birthDate: citizen?.birthDate || '', bloodType: citizen?.bloodType || '',
      cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
      address: citizen?.address || '',
    });
    setProfilePhoto(citizen?.facePhotoUrl || null);
    setEditProfile(true);
  };
  const buscarCep = async (cep: string) => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setProfileForm((prev: any) => ({ ...prev, logradouro: data.logradouro || '', bairro: data.bairro || '', cidade: data.localidade || '', uf: data.uf || '', complemento: data.complemento || '' }));
      }
    } catch {}
  };
  // Paginação histórico de resgates
  const [histRedempPage, setHistRedempPage] = useState(1);
  const [histRedempFilter, setHistRedempFilter] = useState('todos');
  const [histRedempBusca, setHistRedempBusca] = useState('');
  const HIST_REDEMP_PAGE_SIZE = 50;
  // Extrato PWA (aba Extrato)
  const [extratoSubTab, setExtratoSubTab] = useState<'tudo'|'pix'|'crypto'>('tudo');
  const [extratoData, setExtratoData] = useState<any[]>([]);
  const [extratoResumo, setExtratoResumo] = useState<any>(null);
  const [extratoPeriodo, setExtratoPeriodo] = useState('todos');
  const [extratoDirecao, setExtratoDirecao] = useState('todos');
  const [extratoBusca, setExtratoBusca] = useState('');
  const [extratoPagina, setExtratoPagina] = useState(1);
  const [extratoTotal, setExtratoTotal] = useState(0);
  const [extratoTotalPages, setExtratoTotalPages] = useState(1);
  const [extratoPolling, setExtratoPolling] = useState(0);
  const [redeemStatus, setRedeemStatus] = useState<string | null>(null);
  const [redeemCreatedAt, setRedeemCreatedAt] = useState<string | null>(null);
  const [redeemTxHash, setRedeemTxHash] = useState<string | null>(null);
  const [redeemCountdown, setRedeemCountdown] = useState(0);
  const [redeemDuracao, setRedeemDuracao] = useState(0);
  const [redeemExpiresAt, setRedeemExpiresAt] = useState<string | null>(null);
  const [citizenRedemptions, setCitizenRedemptions] = useState<any[]>([]);
  const [bloodAlert, setBloodAlert] = useState<{bloodType: string; hospital: string; message: string; createdAt: string} | null>(null);
  // Modal de agendamento de doação
  const [showAgendamento, setShowAgendamento] = useState(false);
  const [agendamentoData, setAgendamentoData] = useState('');
  const [agendamentoHora, setAgendamentoHora] = useState('');
  const [agendamentoNome, setAgendamentoNome] = useState('');
  const [agendamentoTelefone, setAgendamentoTelefone] = useState('');
  const [agendamentoLoading, setAgendamentoLoading] = useState(false);
  const [citizen, setCitizen] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [txHistory, setTxHistory] = useState<any[]>([]);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [showPermissionSetup, setShowPermissionSetup] = useState(false);
  const [permissions, setPermissions] = useState({ location: false, camera: false });
  // Última localização conhecida (obtida no setup de permissões ou em ação anterior)
  const [lastKnownLocation, setLastKnownLocation] = useState<{ lat: number; lng: number } | null>(null);
  const lastKnownAddress = useRef<string | null>(null);

  // Verifica se é primeiro acesso (nunca passou pelo setup de permissões)
  const isFirstAccess = typeof window !== 'undefined' && !localStorage.getItem('ecosolid_permissions_done');

  // Formulário com a carteira (walletAddress) recebida do MetaMask
  const [formData, setFormData] = useState({ name: '', cpf: '', birthDate: '', bloodType: '', cep: '', address: '', number: '', complement: '', phone: '', email: '', walletAddress: '' });

  // Campos separados da data de nascimento (experiência melhor que type="date")
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const updateBirthDate = (day: string, month: string, year: string) => {
    if (day && month && year) {
      const d = String(day).padStart(2, '0');
      const m = String(month).padStart(2, '0');
      setFormData(prev => ({ ...prev, birthDate: `${year}-${m}-${d}` }));
    }
  };

  // Câmera Nativa (WebRTC) para Selfie
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Modal Ação
  const [actionModal, setActionModal] = useState<{ open: boolean, type: string, points: number, icon: string, title: string } | null>(null);
  const [actionBloodType, setActionBloodType] = useState('');
  const [certificateModal, setCertificateModal] = useState<{ action: any; citizenName: string } | null>(null);
  const [redeemModal, setRedeemModal] = useState<{ code: string; partnerName: string; benefitDescription: string; solidCost: number } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Sistema de níveis
  const getLevel = (points: number) => {
    if (points >= 3000) return { level: 5, name: 'Guardião da Cidade', badge: '🌟', min: 3000, next: Infinity };
    if (points >= 1000) return { level: 4, name: 'Cidadão Exemplar', badge: '🏆', min: 1000, next: 3000 };
    if (points >= 500) return { level: 3, name: 'Cidadão Engajado', badge: '🌿', min: 500, next: 1000 };
    if (points >= 100) return { level: 2, name: 'Cidadão Consciente', badge: '♻️', min: 100, next: 500 };
    return { level: 1, name: 'Cidadão Iniciante', badge: '🌱', min: 0, next: 100 };
  };

  // Toast system (substitui alert())
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Push notification subscription
  useEffect(() => {
    if (!citizen || view !== 'DASHBOARD') return;
    const subscribe = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          const vapidRes = await apiFetch('/push/vapid-public-key');
          const { data } = await vapidRes.json();
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(data.publicKey),
          });
        }
        await apiFetch(`/citizens/${citizen.id}/push-token`, {
          method: 'PATCH',
          body: JSON.stringify({ pushToken: subscription }),
        });
      } catch {}
    };
    subscribe();
  }, [citizen, view]);

  // Tempo relativo para alertas
  const getRelativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 0) return `há ${h}h ${m}min`;
    return `há ${m} minutos`;
  };

  // Recarrega dados do cidadão
  const refreshData = async () => {
    if (!citizen) return;
    setSkeletonLoading(true);
    try {
      const res = await apiFetch(`/citizens/${citizen.id}`);
      const json = await res.json();
      if (json.success) setCitizen(json.data);
    } catch {}
    setSkeletonLoading(false);
  };

  // Onboarding — mostra uma vez após cadastro
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [skeletonLoading, setSkeletonLoading] = useState(false);
  const prevLevelRef = useRef(0);

  // Confetti ao subir de nível
  useEffect(() => {
    if (!citizen) return;
    const currentLevel = getLevel(citizen.totalPoints || 0).level;
    if (prevLevelRef.current && currentLevel > prevLevelRef.current) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      showToast(`🎉 Parabéns! Você subiu para ${getLevel(citizen.totalPoints || 0).badge} ${getLevel(citizen.totalPoints || 0).name}!`, 'success');
    }
    prevLevelRef.current = currentLevel;
  }, [citizen?.totalPoints]);
  useEffect(() => {
    if (view === 'DASHBOARD' && !localStorage.getItem('ecosolid_onboarding_done')) {
      setShowOnboarding(true);
      localStorage.setItem('ecosolid_onboarding_done', '1');
    }
  }, [view]);

  // Sessão persistente: restaura cidadão após refresh (apenas Google)
  useEffect(() => {
    const saved = localStorage.getItem('ecosolid_citizen');
    const method = localStorage.getItem('ecosolid_login_method');
    // MetaMask NUNCA é restaurado automaticamente — reconexão deve ser explícita
    if (saved && method === 'google' && !citizen) {
      const c = JSON.parse(saved);
      const endpoint = `/citizens/by-email/${encodeURIComponent(c.email || '')}`;
      apiFetch(endpoint)
        .then(r => r.json())
        .then(json => {
          if (json?.success && json?.data) {
            setCitizen(json.data);
            loadHistory(json.data.id);
            setView('DASHBOARD');
          } else {
            localStorage.removeItem('ecosolid_citizen');
            localStorage.removeItem('ecosolid_login_method');
          }
        })
        .catch(() => {
          localStorage.removeItem('ecosolid_citizen');
          localStorage.removeItem('ecosolid_login_method');
        });
    }
  }, []);

  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [locationAddress, setLocationAddress] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Verifica se há biometria salva no dispositivo para exibir botão
  const hasStoredBiometric = typeof window !== 'undefined' && !!localStorage.getItem('ecosolid_credentialId');

  // Google OAuth — completamente independente do MetaMask
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
  const [googleReady, setGoogleReady] = useState(false);

  // Processa callback do Google OAuth redirect (token no hash da URL)
  useEffect(() => {
    if (typeof window === 'undefined' || !googleClientId) return;
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      if (token) {
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(r => r.json())
          .then(data => {
            const name = data.name || '';
            const email = data.email || '';
            setFormData(prev => ({ ...prev, name, email }));
            return apiFetch(`/citizens/by-email/${encodeURIComponent(email)}`).then(r => r.json());
          })
          .then(json => {
            if (json?.success && json?.data) {
              setCitizen(json.data);
              loadHistory(json.data.id);
              setView('DASHBOARD');
              localStorage.setItem('ecosolid_citizen', JSON.stringify(json.data));
              localStorage.setItem('ecosolid_login_method', 'google');
            } else {
              setView('REGISTER');
            }
          })
          .catch(() => {
            setView('REGISTER');
          });
      }
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [googleClientId]);

  // Carrega Google Identity Services para popup nativo
  useEffect(() => {
    if (!googleClientId || typeof window === 'undefined') return;
    if (document.getElementById('gsi-script')) return;
    const script = document.createElement('script');
    script.id = 'gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => setGoogleReady(true);
    document.body.appendChild(script);
  }, [googleClientId]);

  // Inicializa Google GIS para One Tap / popup rápido
  useEffect(() => {
    if (!googleReady || !googleClientId) return;
    const w = window as any;
    try {
      w.google?.accounts?.id?.initialize({
        client_id: googleClientId,
        callback: (resp: any) => {
          try {
            const payload = JSON.parse(atob(resp.credential.split('.')[1]));
            const name = payload.name || '';
            const email = payload.email || '';
            setFormData(prev => ({ ...prev, name, email }));
            apiFetch(`/citizens/by-email/${encodeURIComponent(email)}`)
              .then(r => r.json())
              .then(json => {
                if (json?.success && json?.data) {
                  setCitizen(json.data);
                  loadHistory(json.data.id);
                  setView('DASHBOARD');
                  localStorage.setItem('ecosolid_citizen', JSON.stringify(json.data));
                  localStorage.setItem('ecosolid_login_method', 'google');
                } else {
                  setFormData(prev => ({ ...prev, name, email }));
                  setView('REGISTER');
                }
              })
              .catch(() => setView('REGISTER'));
          } catch {
            alert('Erro ao processar login Google. Tente novamente.');
          }
        },
      });
    } catch {}
  }, [googleReady, googleClientId]);

  // Handler do botão customizado "Entrar com Google"
  const handleGoogleSignIn = () => {
    if (!googleClientId) {
      alert('Google Sign-In não configurado. Configure NEXT_PUBLIC_GOOGLE_CLIENT_ID no Vercel.');
      return;
    }
    // Tenta usar Google Identity Services (popup nativo)
    const w = window as any;
    if (w.google?.accounts?.id) {
      try {
        w.google.accounts.id.prompt((notification: any) => {
          if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
            // One Tap não funcionou — fallback para redirect OAuth
            const redirectUri = window.location.origin + window.location.pathname;
            const authUrl =
              'https://accounts.google.com/o/oauth2/v2/auth' +
              `?client_id=${encodeURIComponent(googleClientId)}` +
              `&redirect_uri=${encodeURIComponent(redirectUri)}` +
              '&response_type=token' +
              '&scope=email%20profile' +
              '&prompt=select_account';
            window.location.href = authUrl;
          }
        });
        return;
      } catch {}
    }
    // Fallback: redirect OAuth direto
    const redirectUri = window.location.origin + window.location.pathname;
    const authUrl =
      'https://accounts.google.com/o/oauth2/v2/auth' +
      `?client_id=${encodeURIComponent(googleClientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      '&response_type=token' +
      '&scope=email%20profile' +
      '&prompt=select_account';
    window.location.href = authUrl;
  };

  // Fallback de localização por IP (quando GPS falha)
  const fetchIpLocation = async (): Promise<{ lat: number; lng: number; address: string; approximate: true } | null> => {
    try {
      const res = await fetch('https://ip-api.com/json/?fields=city,regionName,country,lat,lon');
      const data = await res.json();
      if (data?.lat && data?.lon) {
        return {
          lat: data.lat,
          lng: data.lon,
          address: [data.city, data.regionName, data.country].filter(Boolean).join(', '),
          approximate: true,
        };
      }
    } catch {}
    return null;
  };

  // -------------------------------------------------------------------------------------------------
  // LÓGICA DE LOGIN COM METAMASK (Redireciona para Cadastro se não existir)
  // -------------------------------------------------------------------------------------------------
  const isMobileDevice = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isChromeAndroid = typeof navigator !== 'undefined' && /Android.*Chrome/i.test(navigator.userAgent);

  const openInMetaMaskApp = () => {
    // Deep link seguro: usa a origem (domínio base) em vez da URL completa
    // para evitar problemas de encoding e SSL
    const baseUrl = window.location.origin + window.location.pathname;
    const deepLink = `https://metamask.app.link/dapp/${encodeURIComponent(baseUrl)}`;
    window.open(deepLink, '_blank');
  };

  const handleConnectMetaMask = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        setLoading(true);
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const wallet = accounts[0];

        const res = await apiFetch(`/citizens/${wallet}`);
        const json = await res.json();

        if (json.success && json.data) {
          setCitizen(json.data);
          loadHistory(json.data.id);
          if (isFirstAccess) {
            setShowPermissionSetup(true);
          }
          setView('DASHBOARD');
          // MetaMask NÃO salva no localStorage — reconexão sempre explícita
          if (!json.data.credentialId && !localStorage.getItem('ecosolid_credentialId')) {
            setShowBiometricPrompt(true);
          }
        } else {
          setFormData(prev => ({ ...prev, walletAddress: wallet }));
          setView('REGISTER');
        }
      } catch (err: any) {
        console.error('MetaMask error:', err);
        // Mostra o erro específico para diagnóstico
        const msg = err?.message || err?.toString() || 'Erro desconhecido';
        if (msg.includes('User rejected') || msg.includes('user rejected')) {
          alert("Operação cancelada. Por favor, aceite a conexão com sua carteira MetaMask.");
        } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('Network')) {
          alert("Servidor offline ou sem conexão. Verifique sua internet e tente novamente.");
        } else {
          alert(`Erro ao conectar: ${msg}`);
        }
      } finally {
        setLoading(false);
      }
    } else {
      // MetaMask não detectado
      if (isMobileDevice) {
        // No mobile, o MetaMask só funciona dentro do navegador integrado do app
        // Oferece abrir via deep link
        const confirmed = window.confirm(
          "Para usar o EcoSolid no celular, é preciso abrir com o app MetaMask.\n\n" +
          "Clique em OK para abrir o MetaMask agora.\n\n" +
          "(Certifique-se de ter o app MetaMask instalado)"
        );
        if (confirmed) {
          openInMetaMaskApp();
        }
      } else {
        alert("MetaMask não encontrado! Por favor, instale a extensão MetaMask no seu navegador (Chrome, Firefox, Edge ou Brave).");
      }
    }
  };

  // -------------------------------------------------------------------------------------------------
  // SOLICITAÇÃO DE PERMISSÕES DO DISPOSITIVO (primeiro acesso)
  // -------------------------------------------------------------------------------------------------
  const requestPermissions = async () => {
    const result = { location: false, camera: false };

    // 1. Localização (GPS primeiro, fallback por IP)
    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject,
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 }
          );
        });
        result.location = true;
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLastKnownLocation(coords);
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json&accept-language=pt-BR`,
            { headers: { 'User-Agent': 'EcoSolidApp/1.0' } }
          );
          const geoData = await geoRes.json();
          if (geoData?.display_name) {
            lastKnownAddress.current = geoData.display_name + ' 📡 GPS';
          }
        } catch {}
      } catch (err: any) {
        console.warn('GPS indisponível, usando IP:', err?.message);
        // Fallback por IP
        const ipLoc = await fetchIpLocation();
        if (ipLoc) {
          result.location = true;
          setLastKnownLocation({ lat: ipLoc.lat, lng: ipLoc.lng });
          lastKnownAddress.current = `${ipLoc.address} ⚠️ Aproximada (IP)`;
        }
      }
    } else {
      // Sem API de geolocalização (ex: navegador MetaMask Mobile)
      const ipLoc = await fetchIpLocation();
      if (ipLoc) {
        result.location = true;
        setLastKnownLocation({ lat: ipLoc.lat, lng: ipLoc.lng });
        lastKnownAddress.current = `${ipLoc.address} ⚠️ Aproximada (IP)`;
      }
    }

    // 2. Câmera
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      result.camera = true;
      mediaStream.getTracks().forEach(track => track.stop());
    } catch {
      console.warn('Câmera negada.');
    }

    setPermissions(result);
    localStorage.setItem('ecosolid_permissions_done', '1');
    setShowPermissionSetup(false);
  };

  const skipPermissions = () => {
    localStorage.setItem('ecosolid_permissions_done', '1');
    setShowPermissionSetup(false);
  };

  // -------------------------------------------------------------------------------------------------
  // REGISTRO DE BIOMETRIA (chamado APÓS login/cadastro com MetaMask)
  // -------------------------------------------------------------------------------------------------
  const registerBiometric = async () => {
    if (!window.PublicKeyCredential) {
      alert("Seu dispositivo não suporta biometria nativa (TouchID/FaceID) no navegador.");
      return;
    }
    if (!citizen || !citizen.id) {
      alert("Erro: cidadão não identificado.");
      return;
    }

    try {
      setShowBiometricPrompt(false);
      setLoading(true);

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      // Prepara o user.id como o ID real do cidadão (truncado/padded para 32 bytes)
      const citizenIdBytes = new TextEncoder().encode(citizen.id);

      const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "EcoSolid", id: currentDomain },
          user: {
            id: citizenIdBytes,
            name: citizen.email || citizen.id,
            displayName: citizen.name || "Cidadão EcoSolid"
          },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }],
          authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
          timeout: 60000,
          attestation: "none"
        }
      }) as PublicKeyCredential;

      if (!credential) {
        alert("Falha ao criar credencial biométrica.");
        setLoading(false);
        return;
      }

      const credentialId = bufferToBase64(credential.rawId);
      const response = credential.response as AuthenticatorAttestationResponse;
      const publicKey = bufferToBase64(response.getPublicKey()!);

      // Envia a credencial para o backend associar ao cidadão
      const res = await apiFetch('/citizens/biometric/register', {
        method: 'POST',
        body: JSON.stringify({ citizenId: citizen.id, credentialId, credentialPublicKey: publicKey }),
      });
      const json = await res.json();

      if (json.success) {
        localStorage.setItem('ecosolid_credentialId', credentialId);
        alert("Biometria cadastrada com sucesso! Na próxima vez, use o botão de Digital para entrar rápido.");
      } else {
        alert("Erro ao salvar biometria: " + (json.error || "Tente novamente."));
      }
    } catch (err) {
      console.error(err);
      alert("Falha ao ler impressão digital ou operação cancelada.");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------------------------------
  // LOGIN BIOMÉTRICO (WebAuthn - Usa credencial já registrada no dispositivo)
  // -------------------------------------------------------------------------------------------------
  const handleBiometricLogin = async () => {
    if (!window.PublicKeyCredential) {
      alert("Seu dispositivo não suporta biometria nativa (TouchID/FaceID) no navegador.");
      return;
    }

    const storedCredentialId = localStorage.getItem('ecosolid_credentialId');
    if (!storedCredentialId) {
      alert("Nenhuma biometria cadastrada neste dispositivo. Faça login com MetaMask primeiro.");
      return;
    }

    try {
      setLoading(true);

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

      // navigator.credentials.get() — verifica a biometria no dispositivo
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: currentDomain,
          allowCredentials: [{
            type: 'public-key',
            id: base64ToBuffer(storedCredentialId),
          }],
          userVerification: 'required',
          timeout: 60000,
        }
      });

      if (!assertion) {
        alert("Falha na verificação biométrica.");
        setLoading(false);
        return;
      }

      // Biometria verificada com sucesso! Busca o cidadão no backend
      const res = await apiFetch('/citizens/biometric/login', {
        method: 'POST',
        body: JSON.stringify({ credentialId: storedCredentialId }),
      });
      const json = await res.json();

      if (json.success && json.data) {
        setCitizen(json.data);
        loadHistory(json.data.id);
        setView('DASHBOARD');
      } else {
        // Se a credencial não existe mais no backend, limpa o localStorage
        localStorage.removeItem('ecosolid_credentialId');
        alert(json.error || "Biometria não encontrada. Faça login com MetaMask primeiro.");
      }
    } catch (err) {
      console.error(err);
      alert("Falha na verificação biométrica ou operação cancelada.");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------------------------------
  // LÓGICA DE CADASTRO E CÂMERA
  // -------------------------------------------------------------------------------------------------
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setStream(mediaStream);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = mediaStream; }, 100);
    } catch (err) { alert("Permissão de câmera negada."); }
  };

  const stopCamera = () => {
    if (stream) { stream.getTracks().forEach(track => track.stop()); setStream(null); }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);
        setSelfiePreview(canvasRef.current.toDataURL('image/png'));
        stopCamera();
      }
    }
  };

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawCep = e.target.value;
    setFormData({ ...formData, cep: rawCep });
    const cep = rawCep.replace(/\D/g, '');
    if (cep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setFormData(prev => ({ ...prev, address: `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}` }));
        }
      } catch (err) { console.error(err); }
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selfiePreview) { alert("A biometria facial é obrigatória."); return; }

    setLoading(true);
    try {
      const fullAddress = `${formData.address}, Nº ${formData.number} ${formData.complement ? '- ' + formData.complement : ''} (CEP: ${formData.cep})`;
      const res = await apiFetch('/citizens', {
        method: 'POST',
        body: JSON.stringify({ ...formData, address: fullAddress, facePhotoUrl: selfiePreview }),
      });
      const json = await res.json();
      if (json.success) {
        setCitizen(json.data);
        loadHistory(json.data.id);
        if (isFirstAccess) {
          setShowPermissionSetup(true);
        }
        setView('DASHBOARD');
        // Oferece cadastro de biometria após registro bem-sucedido
        if (!json.data.credentialId) {
          setShowBiometricPrompt(true);
        }
      } else alert("Erro: " + json.error);
    } catch (e) { console.error(e); alert("Erro de comunicação com o servidor."); }
    setLoading(false);
  };

  // -------------------------------------------------------------------------------------------------
  // LÓGICA DE IMPACTO
  // -------------------------------------------------------------------------------------------------
  const openActionModal = (type: string, points: number, icon: string, title: string) => {
    setActionModal({ open: true, type, points, icon, title });
    setLocation(null);
    setLocationAddress(null);

    // Fallback imediato: usa última localização conhecida enquanto atualiza
    if (lastKnownLocation) {
      setLocation(lastKnownLocation);
      if (lastKnownAddress.current) {
        setLocationAddress(lastKnownAddress.current);
      } else {
        setLocationAddress(`${lastKnownLocation.lat.toFixed(5)}, ${lastKnownLocation.lng.toFixed(5)}`);
      }
    }

    if (navigator.geolocation) {
      setLocationLoading(true);
      let gpsResolved = false;
      const gpsPromise = new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject,
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 120000 }
        );
      });
      // Se GPS demorar mais de 5s, ativa fallback por IP
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));

      Promise.race([gpsPromise, timeoutPromise]).then(async (pos) => {
        if (pos) {
          gpsResolved = true;
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(coords);
          setLastKnownLocation(coords);
          try {
            const geoRes = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json&accept-language=pt-BR`,
              { headers: { 'User-Agent': 'EcoSolidApp/1.0' } }
            );
            const geoData = await geoRes.json();
            if (geoData?.display_name) {
              setLocationAddress(geoData.display_name + ' 📡 GPS');
              lastKnownAddress.current = geoData.display_name;
            } else {
              setLocationAddress(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} 📡 GPS`);
            }
          } catch {
            setLocationAddress(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} 📡 GPS`);
          }
        }
        // Se timeout de 5s sem GPS, tenta IP
        if (!gpsResolved) {
          const ipLoc = await fetchIpLocation();
          if (ipLoc) {
            setLocation(ipLoc);
            setLastKnownLocation({ lat: ipLoc.lat, lng: ipLoc.lng });
            setLocationAddress(`${ipLoc.address} ⚠️ Aproximada (IP)`);
            lastKnownAddress.current = `${ipLoc.address} ⚠️ Aproximada`;
          }
        }
        setLocationLoading(false);
      }).catch(async () => {
        // GPS falhou totalmente, tenta IP
        if (!lastKnownLocation) {
          const ipLoc = await fetchIpLocation();
          if (ipLoc) {
            setLocation(ipLoc);
            setLastKnownLocation({ lat: ipLoc.lat, lng: ipLoc.lng });
            setLocationAddress(`${ipLoc.address} ⚠️ Aproximada (IP)`);
            lastKnownAddress.current = `${ipLoc.address} ⚠️ Aproximada`;
          }
        }
        setLocationLoading(false);
      });
    } else {
      // Sem navigator.geolocation (MetaMask Mobile bloqueia), usa IP direto
      setLocationLoading(true);
      (async () => {
        const ipLoc = await fetchIpLocation();
        if (ipLoc) {
          setLocation(ipLoc);
          setLastKnownLocation({ lat: ipLoc.lat, lng: ipLoc.lng });
          setLocationAddress(`${ipLoc.address} ⚠️ Aproximada (IP)`);
          lastKnownAddress.current = `${ipLoc.address} ⚠️ Aproximada`;
        }
        setLocationLoading(false);
      })();
    }
  };

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // -------------------------------------------------------------------------------------------------
  // CARREGAR HISTÓRICO DO BANCO
  // -------------------------------------------------------------------------------------------------
  // Tabela de compatibilidade: quem pode doar para quem
  const bloodCompat: Record<string, string[]> = {
    'O-': ['O-','O+','A-','A+','B-','B+','AB-','AB+'],
    'O+': ['O+','A+','B+','AB+'],
    'A-': ['A-','A+','AB-','AB+'],
    'A+': ['A+','AB+'],
    'B-': ['B-','B+','AB-','AB+'],
    'B+': ['B+','AB+'],
    'AB-': ['AB-','AB+'],
    'AB+': ['AB+'],
  };
  // Polling de alertas de sangue ativos a cada 5min (todas as telas)
  useEffect(() => {
    if (!citizen?.bloodType) return;
    const compat = bloodCompat[citizen.bloodType] || [];
    const fetchAlerts = () => {
      apiFetch('/alerts/blood/active')
        .then(r => r.json())
        .then(json => {
          if (json.success && json.data.length > 0) {
            const relevant = json.data.filter((a: any) => compat.includes(a.bloodType));
            if (relevant.length > 0) {
              const latest = relevant[0];
              const dismissed = localStorage.getItem('ecosolid_alert_dismissed');
              if (dismissed && (Date.now() - parseInt(dismissed)) < 4 * 60 * 60 * 1000) return;
              setBloodAlert(latest);
            }
          }
        })
        .catch(() => {});
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [citizen?.bloodType]);

  // Extrato do cidadão (aba Extrato) — carrega + polling 30s
  useEffect(() => {
    if (dashboardTab !== 'EXTRATO' || !citizen?.id) return;
    const params = new URLSearchParams({ usuarioId: citizen.id, periodo: extratoPeriodo, direcao: extratoDirecao, pagina: String(extratoPagina), limite: '50' });
    if (citizen.walletAddress) params.set('walletAddress', citizen.walletAddress);
    if (extratoSubTab !== 'tudo') params.set('tipo', extratoSubTab);
    if (extratoBusca) params.set('busca', extratoBusca);
    const load = () => {
      Promise.all([
        fetch(`${BACKEND_URL}/extrato?${params}`).then(r => r.json()),
        fetch(`${BACKEND_URL}/extrato/resumo?usuarioId=${citizen.id}&walletAddress=${citizen.walletAddress || ''}&periodo=${extratoPeriodo}`).then(r => r.json()),
        fetch(`${BACKEND_URL}/extrato/crypto/pendentes`).then(r => r.json()).catch(() => {}),
      ]).then(([dataJson, resumoJson]) => {
        if (dataJson.success) { setExtratoData(dataJson.data); setExtratoTotal(dataJson.total); setExtratoTotalPages(dataJson.totalPages); }
        if (resumoJson.success) setExtratoResumo(resumoJson.data);
      }).catch(() => {});
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [dashboardTab, citizen?.id, extratoSubTab, extratoPeriodo, extratoDirecao, extratoBusca, extratoPagina, extratoPolling]);

  // Carrega histórico de resgates do cidadão
  useEffect(() => {
    if (!citizen?.id || dashboardTab !== 'BENEFITS') return;
    apiFetch(`/benefits/citizen/${citizen.id}`)
      .then(r => r.json())
      .then(json => { if (json.success) setCitizenRedemptions(Array.isArray(json.data) ? json.data : []); })
      .catch(() => { setCitizenRedemptions([]); });
  }, [citizen?.id, dashboardTab]);

  const loadHistory = async (citizenId: string) => {
    try {
      const res = await apiFetch(`/impact/citizen/${citizenId}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const actions = json.data.map((a: any) => ({
          title: formatActionTitle(a.actionType),
          points: `+${a.pointsEarned} SOLID`,
          date: new Date(a.timestamp).toLocaleString(),
          icon: formatActionIcon(a.actionType),
          tx: a.id?.slice(0, 10) + '...' || '0x...',
          img: a.evidenceUrl !== 'sem-foto' ? a.evidenceUrl : null,
          lat: a.latitude,
          lng: a.longitude,
          address: a.locationAddress || null,
          status: a.status || 'REGISTRADO',
          pointsEarned: a.pointsEarned || 0,
        }));
        setTxHistory(actions);
      }
    } catch (e) {
      console.error('Erro ao carregar histórico:', e);
    }
  };

  const formatActionIcon = (type: string) => {
    switch (type) {
      case 'RECYCLING': return '♻️';
      case 'BLOOD_DONATION': return '🩸';
      case 'FOOD_DONATION': return '🍱';
      case 'VOLUNTEERING': return '🤝';
      default: return '✅';
    }
  };

  const formatActionTitle = (type: string) => {
    switch (type) {
      case 'RECYCLING': return 'Reciclagem';
      case 'BLOOD_DONATION': return 'Doação de Sangue';
      case 'FOOD_DONATION': return 'Doação de Alimentos';
      case 'VOLUNTEERING': return 'Voluntariado';
      default: return 'Ação de Impacto';
    }
  };

  // -------------------------------------------------------------------------------------------------
  // LOGOUT
  // -------------------------------------------------------------------------------------------------
  const handleLogout = () => {
    localStorage.removeItem('ecosolid_citizen');
    localStorage.removeItem('ecosolid_login_method');
    setCitizen(null);
    setView('LOGIN');
    setDashboardTab('OVERVIEW');
    setTxHistory([]);
    setShowBiometricPrompt(false);
    setShowPermissionSetup(false);
  };

  const handleRedeemBenefit = async (icon: string, name: string, cost: number, description: string, duracaoMinutos: number = 0) => {
    if (!citizen || (citizen.totalPoints || 0) < cost) return;
    setLoading(true);

    // Capturar geolocalização atual
    let lat: number | undefined;
    let lng: number | undefined;
    let locationAddress: string | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, maximumAge: 60000 });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
      // Reverse geocoding via Nominatim
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
        const geoJson = await geoRes.json();
        locationAddress = geoJson?.display_name || `${lat}, ${lng}`;
      } catch {}
    } catch {}

    try {
      const res = await apiFetch('/benefits/redeem', {
        method: 'POST',
        body: JSON.stringify({ citizenId: citizen.id, partnerName: name, partnerIcon: icon, solidCost: cost, benefitDescription: description, lat, lng, locationAddress }),
      });
      const json = await res.json();
      if (json.success) {
        setRedeemDuracao(duracaoMinutos);
        const qrText = JSON.stringify({ code: json.data.code, citizenId: citizen.id, partner: name, benefit: description, timestamp: new Date().toISOString() });
        const dataUrl = await QRCodeLib.toDataURL(qrText, { width: 300, margin: 2 });
        setQrDataUrl(dataUrl);
        setRedeemModal({
          code: json.data.code,
          partnerName: name,
          benefitDescription: description,
          solidCost: cost,
        });
        setRedeemCreatedAt(json.data.createdAt || new Date().toISOString());
        setRedeemStatus('PENDENTE');
      } else alert(json.error);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // Cotações CoinGecko (ETH/BRL, BTC/BRL) a cada 60s
  useEffect(() => {
    const fetchQuotes = async () => {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin&vs_currencies=brl');
        const json = await res.json();
        setQuotes({ eth: json.ethereum?.brl || null, btc: json.bitcoin?.brl || null });
      } catch {}
    };
    fetchQuotes();
    const interval = setInterval(fetchQuotes, 60000);
    return () => clearInterval(interval);
  }, []);

  // Auto-fetch saldo ETH ao entrar na aba Contas
  useEffect(() => {
    if (dashboardTab !== 'CONTAS' || !citizen?.walletAddress) return;
    const fetchBal = async () => {
      try {
        const rpcRes = await fetch(SEPOLIA_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getBalance', params: [citizen.walletAddress, 'latest'], id: 1 }),
        });
        const rpcJson = await rpcRes.json();
        const eth = (Number(BigInt(rpcJson.result || '0')) / 1e18).toFixed(4);
        const brl = quotes.eth ? (parseFloat(eth) * quotes.eth).toFixed(2) : '0.00';
        setWalletBalance({ eth, brl });
      } catch {}
    };
    fetchBal();
  }, [dashboardTab, citizen?.walletAddress, quotes.eth]);

  // Auto-fetch extrato ao entrar na aba Contas
  useEffect(() => {
    if (dashboardTab !== 'CONTAS' || !citizen?.id) return;
    const fetchExtrato = async () => {
      try {
        const [actionsRes, redemptionsRes] = await Promise.all([
          fetch(`${BACKEND_URL}/impact/citizen/${citizen.id}`),
          fetch(`${BACKEND_URL}/benefits/citizen/${citizen.id}`),
        ]);
        const actionsJson = await actionsRes.json();
        const redemptionsJson = await redemptionsRes.json();

        const iconMap: Record<string, string> = {
          'BLOOD_DONATION': '🩸', 'RECYCLING': '♻️', 'FOOD_DONATION': '🍽️',
          'VOLUNTEERING': '🤝', 'LEGACY_MINT': '🪙',
        };
        const statusBadgeMap: Record<string, string> = {
          'REGISTRADO': 'green', 'VALIDADO': 'green', 'CONFIRMADO': 'green',
          'PENDENTE_VALIDACAO': 'yellow', 'REJEITADO': 'red', 'EXPIRADO': 'red',
        };

        const actions = (actionsJson.data || []).map((a: any) => ({
          icone: iconMap[a?.actionType] || '📋',
          descricao: a?.actionType === 'BLOOD_DONATION' ? `Doação de Sangue${a?.bloodType ? ' (' + a.bloodType + ')' : ''}` :
                    a?.actionType === 'RECYCLING' ? 'Reciclagem' :
                    a?.actionType === 'FOOD_DONATION' ? 'Doação de Alimentos' :
                    a?.actionType === 'VOLUNTEERING' ? 'Voluntariado' : a?.actionType || 'Ação',
          valor: `+${a?.pointsEarned || 0} SOLID`,
          data: (a?.timestamp || a?.createdAt) ? new Date(a.timestamp || a.createdAt).toLocaleString('pt-BR') : '—',
          status: a?.status || 'REGISTRADO',
          statusBadge: statusBadgeMap[a?.status] || 'yellow',
          txHash: a?.txHash || null,
          ts: (a?.timestamp || a?.createdAt) ? new Date(a.timestamp || a.createdAt).getTime() : 0,
        }));

        const redemptions = (redemptionsJson.data || []).map((r: any) => ({
          icone: '🎁',
          descricao: r?.benefitDescription || 'Resgate',
          valor: `-${r?.solidCost || 0} SOLID`,
          data: r?.createdAt ? new Date(r.createdAt).toLocaleString('pt-BR') : '—',
          status: r?.status || 'PENDENTE',
          statusBadge: statusBadgeMap[r?.status] || 'yellow',
          txHash: r?.txHash || null,
          ts: r?.createdAt ? new Date(r.createdAt).getTime() : 0,
        }));

        const combined = [...actions, ...redemptions].sort((a, b) => b.ts - a.ts);
        setExtrato(combined);
      } catch {}
    };
    fetchExtrato();
  }, [dashboardTab, citizen?.id]);

  // Countdown do resgate (30 min pendente OU timer de uso após confirmação)
  useEffect(() => {
    if (redeemStatus === 'PENDENTE' && redeemCreatedAt) {
      // Countdown de 30 min para aprovação
      const deadline = new Date(redeemCreatedAt).getTime() + 30 * 60 * 1000;
      const update = () => {
        const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
        setRedeemCountdown(remaining);
        if (remaining <= 0) setRedeemStatus('EXPIRADO');
      };
      update();
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    }
    if (redeemStatus === 'CONFIRMADO' && redeemDuracao > 0 && redeemCountdown > 0) {
      // Timer de uso do benefício
      const deadline = redeemExpiresAt ? new Date(redeemExpiresAt).getTime() : Date.now() + redeemCountdown * 1000;
      const update = () => {
        const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
        setRedeemCountdown(remaining);
      };
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    }
  }, [redeemCreatedAt, redeemStatus, redeemDuracao, redeemExpiresAt, redeemCountdown]);

  // Polling do resgate — status em tempo real
  useEffect(() => {
    if (!redeemModal || redeemStatus === 'CONFIRMADO' || redeemStatus === 'EXPIRADO') return;
    const checkStatus = async () => {
      try {
        const res = await apiFetch('/benefits/pending');
        const json = await res.json();
        if (json?.success) {
          const ours = json.data?.find((r: any) => r.code === redeemModal.code);
          if (!ours) {
            // Não está mais em pending — foi confirmado.
            setRedeemStatus('CONFIRMADO');
            setRedeemCountdown(0);
            refreshData();
            try {
              const allRes = await apiFetch('/admin/redemptions/all', { headers: { 'x-admin-key': 'ecosolid-admin-2026' } });
              const allJson = await allRes.json();
              if (allJson?.success) {
                const confirmed = allJson.data?.find((r: any) => r.code === redeemModal.code);
                if (confirmed) {
                  if (confirmed.txHash) setRedeemTxHash(confirmed.txHash);
                  if (confirmed.duracaoMinutos > 0 && confirmed.validatedAt) {
                    setRedeemDuracao(confirmed.duracaoMinutos);
                    setRedeemExpiresAt(confirmed.expiresAt);
                    const expiryMs = confirmed.expiresAt ? new Date(confirmed.expiresAt).getTime() : new Date(confirmed.validatedAt).getTime() + confirmed.duracaoMinutos * 60000;
                    setRedeemCountdown(Math.max(0, Math.floor((expiryMs - Date.now()) / 1000)));
                  }
                }
              }
            } catch {}
          } else if (new Date(ours.createdAt).getTime() + 30 * 60 * 1000 < Date.now()) {
            setRedeemStatus('EXPIRADO');
          }
        }
      } catch {}
    };
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [redeemModal?.code, redeemStatus]);

  const confirmAction = async () => {
    if (!citizen || !actionModal) return;
    setLoading(true);
    try {
      const res = await apiFetch('/impact/register', {
        method: 'POST',
        body: JSON.stringify({
          citizenId: citizen.id, actionType: actionModal.type, pointsEarned: actionModal.points,
          validatorId: "GOV-CREDENCIADO", evidenceUrl: imagePreview || "sem-foto",
          latitude: location?.lat, longitude: location?.lng,
          locationAddress: locationAddress || '',
          bloodType: actionModal.type === 'BLOOD_DONATION' ? actionBloodType : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setActionModal(null); setImagePreview(null); setLocation(null); setLocationAddress(null); setActionBloodType('');
        showToast('Ação registrada! Aguardando validação do parceiro.', 'info');
        refreshData();
      } else showToast(json.error, 'error');
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleAgendamento = async () => {
    if (!citizen?.id || !agendamentoData || !agendamentoHora) { showToast('Preencha data e horário', 'error'); return; }
    setAgendamentoLoading(true);
    try {
      const res = await apiFetch('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          citizenId: citizen.id,
          citizenName: citizen.name || formData.name || 'Doador',
          date: agendamentoData,
          time: agendamentoHora,
          notes: `Doação de sangue - ${bloodAlert?.bloodType || ''} - ${bloodAlert?.hospital || ''}`,
          location: bloodAlert?.hospital || 'HemoSangue CE',
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAgendamento(false);
        setAgendamentoData(''); setAgendamentoHora(''); setAgendamentoTelefone('');
        setBloodAlert(null);
        showToast('✅ Agendamento confirmado! Compareça no dia e horário escolhidos.', 'success');
      } else showToast(json.error || 'Erro ao agendar', 'error');
    } catch (e) { console.error(e); showToast('Erro de comunicação', 'error'); }
    setAgendamentoLoading(false);
  };

  // -------------------------------------------------------------------------------------------------
  // VIEWS (Telas)
  // -------------------------------------------------------------------------------------------------

  if (view === 'LOGIN') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 space-y-6">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center font-bold text-5xl shadow-[0_0_40px_rgba(52,211,113,0.5)]">E</div>
        <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-500">EcoSolid</h1>
        <p className="text-slate-400 text-center mb-8">Plataforma Auditável com Biometria Cívica.</p>

        {/* Google Sign-In — login principal */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="p-4 rounded-xl bg-white text-slate-900 font-bold w-full max-w-sm hover:bg-slate-200 shadow-xl flex items-center justify-center gap-3"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          {loading ? "Conectando..." : "Entrar com Google"}
        </button>

        {hasStoredBiometric && (
          <button onClick={handleBiometricLogin} disabled={loading} className="p-4 rounded-xl bg-slate-800 text-white font-bold w-full max-w-sm hover:bg-slate-700 flex items-center justify-center gap-2 border border-slate-700">
            <span className="text-2xl text-emerald-400">👆</span> {loading ? "Verificando..." : "Entrar com Digital / Facial"}
          </button>
        )}

        <p className="text-xs text-slate-600 text-center max-w-sm">
          Faça login com sua conta Google. As carteiras (MetaMask, Binance) podem ser vinculadas depois, dentro do app, na aba Contas.
        </p>
      </div>
    );
  }

  if (view === 'REGISTER') {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 pb-20">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-3xl">🌱</span>
            <div>
              <h2 className="text-xl font-bold text-emerald-400">Criar Identidade Cívica</h2>
              <p className="text-xs text-slate-400">Complete seu cadastro para participar</p>
            </div>
          </div>

          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 mb-4">
              <p className="text-sm font-bold text-slate-300 mb-2">Biometria Facial (Padrão Gov.br)</p>

              {!selfiePreview && !stream && (
                <div onClick={startCamera} className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-emerald-500/50 rounded-xl cursor-pointer hover:border-emerald-500 bg-emerald-500/5">
                  <span className="text-3xl mb-1">🤳</span><span className="text-xs text-emerald-400 font-bold">Ativar Câmera para Selfie</span>
                </div>
              )}

              {stream && (
                <div className="flex flex-col items-center gap-2">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-48 object-cover rounded-xl border border-emerald-500 scale-x-[-1]" />
                  <canvas ref={canvasRef} className="hidden" />
                  <button type="button" onClick={capturePhoto} className="w-full p-3 rounded-xl bg-emerald-500 font-bold">📸 Capturar Rosto</button>
                </div>
              )}

              {selfiePreview && (
                <div className="relative">
                  <img src={selfiePreview} className="w-full h-48 object-cover rounded-xl border border-emerald-500 scale-x-[-1]" />
                  <button type="button" onClick={() => setSelfiePreview(null)} className="absolute top-2 right-2 bg-black/80 px-3 py-1 rounded-full text-xs text-white">Refazer Foto</button>
                </div>
              )}
            </div>

            <input required placeholder="Nome Completo" value={formData.name} className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500" onChange={e => setFormData({...formData, name: e.target.value})} />
            <input required placeholder="CPF" className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500" onChange={e => setFormData({...formData, cpf: e.target.value})} />
            <div>
              <label className="text-xs text-slate-500 font-bold uppercase block mb-2">Data de Nascimento</label>
              <div className="flex gap-2">
                <input
                  required
                  type="number"
                  placeholder="Dia"
                  min="1" max="31"
                  value={birthDay}
                  className="w-[30%] p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500"
                  onChange={e => { const v = e.target.value; setBirthDay(v); updateBirthDate(v, birthMonth, birthYear); }}
                />
                <select
                  required
                  value={birthMonth}
                  className="w-[40%] p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500 text-slate-400 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2220%22 height=%2220%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23475569%22 stroke-width=%222%22><path d=%22M6 9l6 6 6-6%22/></svg>')] bg-no-repeat bg-[right_12px_center]"
                  onChange={e => { const v = e.target.value; setBirthMonth(v); updateBirthDate(birthDay, v, birthYear); }}
                >
                  <option value="" className="bg-slate-900">Mês</option>
                  <option value="1" className="bg-slate-900">Janeiro</option>
                  <option value="2" className="bg-slate-900">Fevereiro</option>
                  <option value="3" className="bg-slate-900">Março</option>
                  <option value="4" className="bg-slate-900">Abril</option>
                  <option value="5" className="bg-slate-900">Maio</option>
                  <option value="6" className="bg-slate-900">Junho</option>
                  <option value="7" className="bg-slate-900">Julho</option>
                  <option value="8" className="bg-slate-900">Agosto</option>
                  <option value="9" className="bg-slate-900">Setembro</option>
                  <option value="10" className="bg-slate-900">Outubro</option>
                  <option value="11" className="bg-slate-900">Novembro</option>
                  <option value="12" className="bg-slate-900">Dezembro</option>
                </select>
                <input
                  required
                  type="number"
                  placeholder="Ano"
                  min="1900" max={new Date().getFullYear()}
                  value={birthYear}
                  className="w-[30%] p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500"
                  onChange={e => { const v = e.target.value; setBirthYear(v); updateBirthDate(birthDay, birthMonth, v); }}
                />
              </div>
            </div>

            {/* Tipo Sanguíneo */}
            <div>
              <label className="text-xs text-slate-500 font-bold uppercase block mb-2">Tipo Sanguíneo</label>
              <select
                value={formData.bloodType || ''}
                className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500 text-slate-400 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2220%22 height=%2220%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23475569%22 stroke-width=%222%22><path d=%22M6 9l6 6 6-6%22/></svg>')] bg-no-repeat bg-[right_12px_center]"
                onChange={e => setFormData({...formData, bloodType: e.target.value})}
              >
                <option value="" className="bg-slate-900">Selecione</option>
                <option value="A+" className="bg-slate-900">A+</option>
                <option value="A-" className="bg-slate-900">A-</option>
                <option value="B+" className="bg-slate-900">B+</option>
                <option value="B-" className="bg-slate-900">B-</option>
                <option value="AB+" className="bg-slate-900">AB+</option>
                <option value="AB-" className="bg-slate-900">AB-</option>
                <option value="O+" className="bg-slate-900">O+</option>
                <option value="O-" className="bg-slate-900">O-</option>
              </select>
            </div>

            <div className="flex gap-2">
              <input placeholder="CEP" value={formData.cep} className="w-1/3 p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500" onChange={handleCepChange} maxLength={9} />
              <input required placeholder="Endereço (Rua/Avenida)" value={formData.address} className="w-2/3 p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500" onChange={e => setFormData({...formData, address: e.target.value})} />
            </div>

            <div className="flex gap-2">
              <input required placeholder="Número" value={formData.number} className="w-1/3 p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500" onChange={e => setFormData({...formData, number: e.target.value})} />
              <input placeholder="Complemento" value={formData.complement} className="w-2/3 p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500" onChange={e => setFormData({...formData, complement: e.target.value})} />
            </div>

            <input required placeholder="E-mail" type="email" value={formData.email} className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500" onChange={e => setFormData({...formData, email: e.target.value})} />
            <input required placeholder="Telefone" value={formData.phone} className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500" onChange={e => setFormData({...formData, phone: e.target.value})} />

            {/* Carteira (opcional — pode vincular depois na aba Contas) */}
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">💳</span>
                <p className="text-sm font-bold text-slate-300">Carteira (opcional)</p>
              </div>
              <p className="text-xs text-slate-500 mb-3">Vincule agora ou depois na aba Contas. Necessária para acumular pontos.</p>
              {formData.walletAddress ? (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <span className="text-emerald-400">✓</span>
                  <span className="text-xs font-mono text-emerald-300 truncate flex-1">{formData.walletAddress}</span>
                  <button type="button" onClick={() => setFormData(prev => ({ ...prev, walletAddress: '' }))} className="text-xs text-red-400 hover:text-red-300">✕</button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (typeof window.ethereum !== 'undefined') {
                        try {
                          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                          setFormData(prev => ({ ...prev, walletAddress: accounts[0] }));
                        } catch (e) { alert('MetaMask não autorizado.'); }
                      } else {
                        alert('MetaMask não detectado. Instale a extensão ou use a opção manual.');
                      }
                    }}
                    className="w-full p-3 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-400 font-bold text-sm hover:bg-orange-500/30 flex items-center justify-center gap-2"
                  >
                    <span>🦊</span> Conectar MetaMask
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const addr = prompt('Cole o endereço da sua carteira (MetaMask, Binance, TrustWallet, etc.):');
                      if (addr && addr.startsWith('0x') && addr.length === 42) {
                        setFormData(prev => ({ ...prev, walletAddress: addr }));
                      } else if (addr) {
                        alert('Endereço inválido. Deve começar com 0x e ter 42 caracteres.');
                      }
                    }}
                    className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 font-bold text-sm hover:bg-slate-700 flex items-center justify-center gap-1"
                  >
                    📋 Inserir Endereço Manual
                  </button>
                </div>
              )}
            </div>

            <button type="submit" disabled={loading} className="w-full p-4 rounded-xl bg-emerald-500 font-bold hover:bg-emerald-400 mt-6 shadow-[0_0_15px_rgba(52,211,113,0.3)] disabled:opacity-50">
              {loading ? "Salvando..." : "Finalizar Cadastro"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const getLevelInfo = (pts: number) => {
    if (pts >= 1000) return { name: "🌳 Floresta", next: 1000, max: true };
    if (pts >= 500) return { name: "🌲 Árvore", next: 1000, max: false };
    if (pts >= 100) return { name: "🌿 Broto", next: 500, max: false };
    return { name: "🌱 Semente", next: 100, max: false };
  };
  const levelInfo = getLevelInfo(citizen?.totalPoints || 0);

  // Componente auxiliar para exibir rede e saldo na aba Contas
  const TimerProgressBar = ({ totalSec, remainingSec }: { totalSec: number; remainingSec: number }) => {
    const pct = Math.max(0, Math.min(100, (remainingSec / totalSec) * 100));
    const mins = Math.floor(remainingSec / 60);
    const secs = remainingSec % 60;
    const isLow = remainingSec < 300; // menos de 5 min
    return (
      <div className="space-y-1">
        <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-1000 ${isLow ? 'bg-red-500' : 'bg-emerald-500'}`}
            style={{ width: `${pct}%` }} />
        </div>
        <p className={`text-xs font-mono font-bold text-center ${isLow ? 'text-red-400' : 'text-emerald-400'}`}>
          Tempo restante: {mins}:{secs.toString().padStart(2, '0')}
        </p>
      </div>
    );
  };

  const AppointmentCard = ({ citizenId }: { citizenId: string }) => {
    const [appointment, setAppointment] = useState<any>(null);
    useEffect(() => {
      if (!citizenId) return;
      apiFetch(`/appointments/citizen/${citizenId}`)
        .then(r => r.json())
        .then(json => { if (json?.success && json?.data) setAppointment(json.data); })
        .catch(() => {});
    }, [citizenId]);
    if (!appointment) return null;
    const statusColors: Record<string, string> = { agendado: 'bg-blue-500/20 text-blue-400', confirmado: 'bg-green-500/20 text-green-400', realizado: 'bg-emerald-500/20 text-emerald-400', cancelado: 'bg-red-500/20 text-red-400' };
    return (
      <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-2">
        <h3 className="text-sm font-bold text-purple-400">📅 Próximo Agendamento</h3>
        <p className="text-white font-bold">{appointment.date} às {appointment.time}</p>
        <p className="text-sm text-slate-400">{appointment.location}</p>
        {appointment.notes && <p className="text-xs text-slate-500">{appointment.notes}</p>}
        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${statusColors[appointment.status] || 'bg-slate-500/20 text-slate-400'}`}>{appointment.status}</span>
      </div>
    );
  };

  let filteredCitizenRedemptionsData = null;
  try {
    const now = new Date();
    let dateSince: Date | null = null;
    if (histRedempFilter === 'hoje') { dateSince = new Date(); dateSince.setHours(0,0,0,0); }
    else if (histRedempFilter === '7dias') dateSince = new Date(now.getTime() - 7*86400000);
    else if (histRedempFilter === '30dias') dateSince = new Date(now.getTime() - 30*86400000);
    const filtered = citizenRedemptions.filter((r: any) => {
      if (!r) return false;
      if (dateSince && new Date(r?.createdAt ?? 0) < dateSince) return false;
      if (histRedempBusca && !((r?.code ?? '').toLowerCase().includes(histRedempBusca.toLowerCase()) || (r?.benefitDescription ?? '').toLowerCase().includes(histRedempBusca.toLowerCase()))) return false;
      return true;
    });
    const tp = Math.ceil(filtered.length / HIST_REDEMP_PAGE_SIZE);
    const pg = Math.min(histRedempPage, tp);
    const pd = filtered.slice((pg-1)*HIST_REDEMP_PAGE_SIZE, pg*HIST_REDEMP_PAGE_SIZE);
    filteredCitizenRedemptionsData = { filtered, tp, pg, pd };
  } catch {
    filteredCitizenRedemptionsData = null;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-24">
      {/* Tela de configuração de permissões (primeiro acesso) */}
      {showPermissionSetup && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-6 space-y-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center font-bold text-3xl shadow-[0_0_30px_rgba(34,211,238,0.4)]">⚙️</div>
          <h2 className="text-2xl font-bold text-white text-center">Configurar Dispositivo</h2>
          <p className="text-slate-400 text-center text-sm max-w-xs">
            Para usar todos os recursos do EcoSolid, permita o acesso à localização e câmera.
          </p>

          <div className="w-full max-w-sm space-y-3">
            <div className={`p-4 rounded-xl border ${permissions.location ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 bg-slate-900'}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">📍</span>
                <div className="flex-1">
                  <p className="font-bold text-sm text-white">Localização</p>
                  <p className="text-xs text-slate-400">Para registrar o endereço das suas ações</p>
                </div>
                {permissions.location ? (
                  <span className="text-emerald-400 font-bold text-sm">✓ Permitido</span>
                ) : (
                  <span className="text-slate-500 text-sm">Pendente</span>
                )}
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${permissions.camera ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 bg-slate-900'}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">📸</span>
                <div className="flex-1">
                  <p className="font-bold text-sm text-white">Câmera</p>
                  <p className="text-xs text-slate-400">Para fotos de evidência das ações</p>
                </div>
                {permissions.camera ? (
                  <span className="text-emerald-400 font-bold text-sm">✓ Permitido</span>
                ) : (
                  <span className="text-slate-500 text-sm">Pendente</span>
                )}
              </div>
            </div>
          </div>

          <div className="w-full max-w-sm space-y-3">
            <button
              onClick={requestPermissions}
              className="w-full p-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 font-bold text-white hover:from-cyan-400 hover:to-blue-400 shadow-lg"
            >
              Permitir Tudo
            </button>
            <button
              onClick={skipPermissions}
              className="w-full p-3 rounded-xl text-slate-500 text-sm hover:text-slate-300"
            >
              Configurar depois
            </button>
          </div>
        </div>
      )}

      {/* Banner para cadastro de biometria (aparece após login MetaMask) */}
      {showBiometricPrompt && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-emerald-600 p-4 shadow-lg">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">👆</span>
              <div>
                <p className="font-bold text-sm">Deseja cadastrar biometria?</p>
                <p className="text-xs text-emerald-100">Na próxima vez, entre só com sua digital ou rosto.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={registerBiometric}
                className="px-4 py-2 bg-white text-emerald-700 rounded-lg font-bold text-sm hover:bg-emerald-50"
              >
                Sim
              </button>
              <button
                onClick={() => setShowBiometricPrompt(false)}
                className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm hover:bg-emerald-800"
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="flex sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-white/10 p-2 items-center overflow-x-auto whitespace-nowrap">
        <button onClick={() => setDashboardTab('OVERVIEW')} className={`flex-shrink-0 min-w-[60px] py-3 px-3 text-sm font-bold rounded-xl transition-colors relative ${dashboardTab === 'OVERVIEW' ? 'bg-white/10 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>👁 Visão{bloodAlert && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />}</button>
        <button onClick={() => setDashboardTab('BENEFITS')} className={`flex-shrink-0 min-w-[60px] py-3 px-3 text-sm font-bold rounded-xl transition-colors ${dashboardTab === 'BENEFITS' ? 'bg-white/10 text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}>🎁 Benefícios</button>
        <button onClick={() => setDashboardTab('CONTAS')} className={`flex-shrink-0 min-w-[60px] py-3 px-3 text-sm font-bold rounded-xl transition-colors ${dashboardTab === 'CONTAS' ? 'bg-white/10 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>💳 Contas</button>
        <button onClick={() => setDashboardTab('EXTRATO')} className={`flex-shrink-0 min-w-[60px] py-3 px-3 text-sm font-bold rounded-xl transition-colors ${dashboardTab === 'EXTRATO' ? 'bg-white/10 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}>📋 Extrato</button>
        <button onClick={() => setDashboardTab('PROFILE')} className={`flex-shrink-0 min-w-[60px] py-3 px-3 text-sm font-bold rounded-xl transition-colors ${dashboardTab === 'PROFILE' ? 'bg-white/10 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>👤 Dados</button>
        <button onClick={handleLogout} className="ml-2 px-4 py-3 text-sm font-bold rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors flex-shrink-0" title="Sair da conta">Sair</button>
      </nav>

      {dashboardTab === 'BENEFITS' && (
        <TabErrorBoundary>
        <main className="p-6 max-w-md mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h2 className="text-2xl font-bold">🎁 Benefícios</h2>

          {/* Saldo SOLID */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 text-center">
            <p className="text-xs text-slate-400 uppercase font-bold mb-1">Saldo Disponível</p>
            <p className="text-4xl font-black text-amber-400">{citizen?.totalPoints || 0} <span className="text-lg text-amber-500/70">SOLID</span></p>
          </div>

          {/* Parceiros */}
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3 hover:border-amber-500/50">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🅿️</span>
                <div className="flex-1">
                  <p className="font-bold text-white text-sm">Zona Azul Fortaleza</p>
                  <p className="text-xs text-slate-400">1 hora de estacionamento • AMC</p>
                  <p className="text-xs text-slate-500">⏱️ 60 min de uso</p>
                </div>
                <span className="text-amber-400 font-black text-lg">50</span>
              </div>
              <button onClick={() => handleRedeemBenefit('🅿️', 'Zona Azul Fortaleza', 50, '1 hora de estacionamento', 60)} disabled={loading || (citizen?.totalPoints || 0) < 50} className="w-full p-3 rounded-xl bg-amber-500 font-bold text-white text-sm hover:bg-amber-400 disabled:opacity-50">
                {(citizen?.totalPoints || 0) < 50 ? 'SOLID Insuficiente' : 'Resgatar'}
              </button>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3 hover:border-amber-500/50">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🏥</span>
                <div className="flex-1">
                  <p className="font-bold text-white text-sm">Clínica Saúde+</p>
                  <p className="text-xs text-slate-400">Consulta clínica geral</p>
                </div>
                <span className="text-amber-400 font-black text-lg">500</span>
              </div>
              <button onClick={() => handleRedeemBenefit('🏥', 'Clínica Saúde+', 500, 'Consulta clínica geral', 0)} disabled={loading || (citizen?.totalPoints || 0) < 500} className="w-full p-3 rounded-xl bg-amber-500 font-bold text-white text-sm hover:bg-amber-400 disabled:opacity-50">
                {(citizen?.totalPoints || 0) < 500 ? 'SOLID Insuficiente' : 'Resgatar'}
              </button>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3 hover:border-amber-500/50">
              <div className="flex items-center gap-3">
                <span className="text-3xl">💧</span>
                <div className="flex-1">
                  <p className="font-bold text-white text-sm">CAGECE</p>
                  <p className="text-xs text-slate-400">10% desconto na fatura</p>
                </div>
                <span className="text-amber-400 font-black text-lg">200</span>
              </div>
              <button onClick={() => handleRedeemBenefit('💧', 'CAGECE', 200, '10% desconto na fatura', 0)} disabled={loading || (citizen?.totalPoints || 0) < 200} className="w-full p-3 rounded-xl bg-amber-500 font-bold text-white text-sm hover:bg-amber-400 disabled:opacity-50">
                {(citizen?.totalPoints || 0) < 200 ? 'SOLID Insuficiente' : 'Resgatar'}
              </button>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3 hover:border-amber-500/50">
              <div className="flex items-center gap-3">
                <span className="text-3xl">⚡</span>
                <div className="flex-1">
                  <p className="font-bold text-white text-sm">Enel CE</p>
                  <p className="text-xs text-slate-400">10% desconto na fatura</p>
                </div>
                <span className="text-amber-400 font-black text-lg">200</span>
              </div>
              <button onClick={() => handleRedeemBenefit('⚡', 'Enel CE', 200, '10% desconto na fatura', 0)} disabled={loading || (citizen?.totalPoints || 0) < 200} className="w-full p-3 rounded-xl bg-amber-500 font-bold text-white text-sm hover:bg-amber-400 disabled:opacity-50">
                {(citizen?.totalPoints || 0) < 200 ? 'SOLID Insuficiente' : 'Resgatar'}
              </button>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3 hover:border-amber-500/50">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🍽️</span>
                <div className="flex-1">
                  <p className="font-bold text-white text-sm">Restaurante Verde</p>
                  <p className="text-xs text-slate-400">Refeição executiva</p>
                  <p className="text-xs text-slate-500">⏱️ 90 min de uso</p>
                </div>
                <span className="text-amber-400 font-black text-lg">300</span>
              </div>
              <button onClick={() => handleRedeemBenefit('🍽️', 'Restaurante Verde', 300, 'Refeição executiva', 90)} disabled={loading || (citizen?.totalPoints || 0) < 300} className="w-full p-3 rounded-xl bg-amber-500 font-bold text-white text-sm hover:bg-amber-400 disabled:opacity-50">
                {(citizen?.totalPoints || 0) < 300 ? 'SOLID Insuficiente' : 'Resgatar'}
              </button>
            </div>
          </div>

          {/* Meu Histórico de Resgates */}
          <div className="space-y-3 mt-8">
            <h3 className="text-lg font-bold text-slate-300">📋 Meu Histórico de Resgates</h3>
            {citizenRedemptions.length > 0 && (
              <>
              <div className="flex gap-2">
                <select value={histRedempFilter} onChange={e => { setHistRedempFilter(e.target.value); setHistRedempPage(1); }}
                  className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-300">
                  <option value="todos">Todos</option><option value="hoje">Hoje</option><option value="7dias">7 dias</option><option value="30dias">30 dias</option>
                </select>
                <input placeholder="🔍 Buscar..." value={histRedempBusca}
                  onChange={e => { setHistRedempBusca(e.target.value); setHistRedempPage(1); }}
                  className="flex-1 p-2 rounded-lg bg-slate-900 border border-slate-700 text-sm outline-none focus:border-amber-500" />
              </div>
              {!filteredCitizenRedemptionsData ? (
                <p key="error" className="text-xs text-red-400 text-center py-4 bg-red-500/10 rounded-lg border border-red-500/20">Erro ao carregar histórico. Tente novamente.</p>
              ) : filteredCitizenRedemptionsData.filtered.length === 0 ? (
                <p key="empty" className="text-xs text-slate-500 text-center py-4">Nenhum resgate encontrado.</p>
              ) : (
                <div key="list">
                  <div className="space-y-3">
                    {filteredCitizenRedemptionsData.pd.map((r: any) => {
                      if (!r || typeof r !== 'object') return null;
                      return (
                        <div key={r?._id || Math.random()} className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/50 space-y-1">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{r?.partnerIcon || '🎁'}</span>
                                <span className="font-bold text-sm">{r?.benefitDescription ?? 'Sem descrição'}</span>
                              </div>
                              <p className="text-xs font-mono text-slate-500">{r?.code ?? '—'}</p>
                              <p className="text-xs text-slate-400">{r?.partnerOrgao || r?.partnerName || 'Parceiro'} · {r?.solidCost ?? 0} SOLID</p>
                              <p className="text-xs text-slate-500">{r?.createdAt ? new Date(r.createdAt).toLocaleString('pt-BR') : '—'}</p>
                            </div>
                            <span className={'text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap '+((r?.status==='CONFIRMADO'||r?.status==='validated')?'bg-emerald-500/20 text-emerald-400':(r?.status==='EXPIRADO'||r?.status==='expired')?'bg-red-500/20 text-red-400':'bg-yellow-500/20 text-yellow-400')}>
                              {(r?.status==='CONFIRMADO'||r?.status==='validated')?'✅ Confirmado':(r?.status==='EXPIRADO'||r?.status==='expired')?'❌ Expirado':'🟡 Pendente'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {filteredCitizenRedemptionsData.filtered.length > HIST_REDEMP_PAGE_SIZE && (
                    <div key="pagi" className="flex items-center justify-between pt-2">
                      <button onClick={() => setHistRedempPage(p => Math.max(1, p-1))} disabled={filteredCitizenRedemptionsData.pg <= 1} className="text-xs px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50">Anterior</button>
                      <span className="text-xs text-slate-500">Página {filteredCitizenRedemptionsData.pg} de {filteredCitizenRedemptionsData.tp} ({filteredCitizenRedemptionsData.filtered.length} itens)</span>
                      <button onClick={() => setHistRedempPage(p => Math.min(filteredCitizenRedemptionsData.tp, p+1))} disabled={filteredCitizenRedemptionsData.pg >= filteredCitizenRedemptionsData.tp} className="text-xs px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50">Próxima</button>
                    </div>
                  )}
                </div>
              )}
          </>)}
          </div>
        </main>
        </TabErrorBoundary>
      )}

      {dashboardTab === 'CONTAS' && (
        <TabErrorBoundary>
        <main className="p-6 max-w-md mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h2 className="text-2xl font-bold">💳 Carteiras e Pagamentos</h2>

          {/* Mini ticker de cotações */}
          {(quotes.eth || quotes.btc) && (
            <div className="flex gap-3 text-xs">
              {quotes.eth && <span className="px-2 py-1 rounded-full bg-slate-800 border border-slate-700">ETH <span className="text-emerald-400 font-mono">R${quotes.eth.toFixed(0)}</span></span>}
              {quotes.btc && <span className="px-2 py-1 rounded-full bg-slate-800 border border-slate-700">BTC <span className="text-amber-400 font-mono">R${quotes.btc.toLocaleString('pt-BR')}</span></span>}
            </div>
          )}

          {/* CARD 1: Carteira Vinculada (unificado: MetaMask + manual EVM) */}
          <div className="p-4 rounded-xl bg-white/5 border border-cyan-500/30 space-y-3">
            <h3 className="text-sm font-bold text-cyan-400">
              {citizen?.walletAddress ? '🔗 Carteira Vinculada' : '🔗 Vincular Carteira'}
            </h3>

            {citizen?.walletAddress ? (
              /* Modo: carteira já vinculada */
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">Vinculada ✓</span>
                  <span className="text-xs text-slate-400">via Google / MetaMask</span>
                </div>
                <p className="font-mono text-sm text-cyan-300 break-all">{citizen.walletAddress}</p>
                {walletBalance ? (
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-slate-300">Saldo: <span className="text-emerald-400 font-bold">{walletBalance.eth} ETH</span></p>
                    {quotes.eth && <span className="text-xs text-slate-500">~R$ {walletBalance.brl}</span>}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Buscando saldo...</p>
                )}
                <div className="flex gap-2">
                  <a href={`https://sepolia.etherscan.io/address/${citizen.walletAddress}`} target="_blank" rel="noopener"
                    className="flex-1 text-center p-2 rounded-lg bg-slate-700 text-xs font-bold hover:bg-slate-600">🔍 Etherscan</a>
                  <button onClick={async () => {
                    setLoading(true);
                    try {
                      const rpcRes = await fetch(SEPOLIA_RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getBalance', params: [citizen.walletAddress, 'latest'], id: 1 }) });
                      const rpcJson = await rpcRes.json();
                      const eth = (Number(BigInt(rpcJson.result || '0')) / 1e18).toFixed(4);
                      const brl = quotes.eth ? (parseFloat(eth) * quotes.eth).toFixed(2) : '0.00';
                      setWalletBalance({ eth, brl });
                      showToast('Saldo atualizado!', 'success');
                    } catch { showToast('Erro ao buscar saldo', 'error'); }
                    setLoading(false);
                  }} disabled={loading} className="p-2 rounded-lg bg-cyan-600 text-xs font-bold hover:bg-cyan-500">🔄 Atualizar</button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setCryptoModal({ type: 'send' })}
                    className="flex-1 p-2 rounded-lg bg-orange-600 text-xs font-bold hover:bg-orange-500">📤 Enviar Cripto</button>
                  <button onClick={() => setCryptoModal({ type: 'receive' })}
                    className="flex-1 p-2 rounded-lg bg-slate-600 text-xs font-bold hover:bg-slate-500">📥 Receber Cripto</button>
                </div>
                <button
                  onClick={() => {
                    setWalletBalance(null);
                    setMetaMaskBal(null);
                    setCitizen({ ...citizen, walletAddress: '' });
                    apiFetch(`/citizens/${citizen.id}/wallet`, { method: 'PATCH', body: JSON.stringify({ walletAddress: '', type: 'remove' }) });
                  }}
                  className="w-full p-2 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/30"
                >✕ Desconectar Carteira</button>
              </div>
            ) : (
              /* Modo: sem carteira vinculada — campo manual sempre visível */
              <div className="space-y-2">
                <p className="text-xs text-slate-400">Digite seu endereço de carteira ou conecte via MetaMask. Funciona com MetaMask, Binance, Trust Wallet, Ledger ou qualquer carteira EVM.</p>
                <input placeholder="0x... (endereço da carteira)"
                  value={contasWalletInput} onChange={e => setContasWalletInput(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 outline-none focus:border-cyan-500 font-mono text-sm" />
                {evmBal && (
                  <p className="text-xs text-slate-400">Saldo consultado: <span className="text-emerald-400 font-bold">{evmBal} ETH</span> {quotes.eth ? <span className="text-slate-500">(~R$ {(parseFloat(evmBal) * quotes.eth).toFixed(2)})</span> : null}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const addr = contasWalletInput.trim();
                      if (!addr.startsWith('0x') || addr.length !== 42) { showToast('Endereço inválido (0x... 42 caracteres)', 'error'); return; }
                      setLoading(true);
                      try {
                        const rpcRes = await fetch(SEPOLIA_RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getBalance', params: [addr, 'latest'], id: 1 }) });
                        const rpcJson = await rpcRes.json();
                        setEvmBal((Number(BigInt(rpcJson.result || '0')) / 1e18).toFixed(4));
                        showToast('Saldo consultado!', 'success');
                      } catch { showToast('Erro ao buscar saldo', 'error'); }
                      setLoading(false);
                    }}
                    disabled={loading || !contasWalletInput.trim()}
                    className="flex-1 p-2 rounded-lg bg-slate-700 text-xs font-bold hover:bg-slate-600"
                  >🔍 Ver Saldo</button>
                  <button
                    onClick={async () => {
                      const addr = contasWalletInput.trim();
                      if (!addr.startsWith('0x') || addr.length !== 42) { showToast('Endereço inválido', 'error'); return; }
                      setLoading(true);
                      const res = await apiFetch(`/citizens/${citizen.id}/wallet`, { method: 'PATCH', body: JSON.stringify({ walletAddress: addr, type: 'manual' }) });
                      const json = await res.json();
                      if (json.success) { setCitizen(json.data); setContasWalletInput(''); showToast('Carteira vinculada! ✓', 'success'); }
                      else showToast(json.error, 'error');
                      setLoading(false);
                    }}
                    disabled={loading || !contasWalletInput.trim()}
                    className="p-2 rounded-lg bg-cyan-600 text-xs font-bold hover:bg-cyan-500"
                  >💾 Vincular</button>
                </div>
                {/* Botão extra MetaMask se detectado */}
                {typeof window !== 'undefined' && (window as any).ethereum && (
                  <button
                    onClick={async () => {
                      try {
                        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
                        const wallet = accounts[0];
                        setLoading(true);
                        try {
                          const balance = await (window as any).ethereum.request({ method: 'eth_getBalance', params: [wallet, 'latest'] });
                          setMetaMaskBal((Number(balance) / 1e18).toFixed(4));
                        } catch {}
                        const res = await apiFetch(`/citizens/${citizen.id}/wallet`, { method: 'PATCH', body: JSON.stringify({ walletAddress: wallet, type: 'metamask' }) });
                        const json = await res.json();
                        if (json.success) setCitizen(json.data); else showToast(json.error, 'error');
                        setLoading(false);
                      } catch { showToast('Conexão cancelada pelo usuário', 'error'); }
                    }}
                    disabled={loading}
                    className="w-full p-3 rounded-xl bg-orange-500/20 text-orange-400 font-bold text-sm hover:bg-orange-500/30"
                  >🦊 Conectar MetaMask</button>
                )}
              </div>
            )}
          </div>

          {/* CARD 2: Chave PIX */}
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 space-y-3">
            <h3 className="text-sm font-bold text-green-400">💚 Chave PIX (Dinheiro Real R$)</h3>
            {citizen?.pixKey ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded-lg bg-green-500/10">
                  <div>
                    <p className="text-xs text-slate-400">{citizen.pixKeyType?.toUpperCase() || 'Chave'}</p>
                    <p className="font-mono text-sm text-green-300 truncate w-48">{citizen.pixKey}</p>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(citizen.pixKey || ''); showToast('Chave PIX copiada!', 'success'); }}
                    className="text-xs px-2 py-1 rounded bg-green-600 font-bold hover:bg-green-500">Copiar</button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setPixQrModal({ type: 'receive' })} className="flex-1 p-2 rounded-lg bg-green-600 text-xs font-bold hover:bg-green-500">📥 Receber PIX</button>
                  <button onClick={() => setPixQrModal({ type: 'send' })} className="flex-1 p-2 rounded-lg bg-slate-700 text-xs font-bold hover:bg-slate-600">📤 Enviar PIX</button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">Cadastre sua chave PIX para receber pagamentos em dinheiro real (R$).</p>
                <select value={pixKeyType} onChange={e => setPixKeyType(e.target.value)} className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 outline-none focus:border-green-500 text-sm">
                  <option value="cpf">CPF</option>
                  <option value="email">E-mail</option>
                  <option value="phone">Telefone</option>
                  <option value="random">Chave Aleatória</option>
                </select>
                <input placeholder={pixKeyType === 'cpf' ? '000.000.000-00' : pixKeyType === 'email' ? 'seu@email.com' : pixKeyType === 'phone' ? '(85) 9XXXX-XXXX' : 'Chave aleatória'}
                  value={pixKeyInput} onChange={e => setPixKeyInput(e.target.value)} className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 outline-none focus:border-green-500 text-sm" />
                <button onClick={async () => {
                  const key = pixKeyInput.trim();
                  if (!key) { showToast('Digite sua chave PIX', 'error'); return; }
                  setLoading(true);
                  const res = await apiFetch(`/citizens/${citizen.id}`, { method: 'PATCH', body: JSON.stringify({ pixKey: key, pixKeyType }) });
                  const json = await res.json();
                  if (json.success) { setCitizen(json.data); setPixKeyInput(''); showToast('Chave PIX salva!', 'success'); }
                  else showToast(json.error, 'error');
                  setLoading(false);
                }} disabled={loading} className="w-full p-3 rounded-xl bg-green-600 font-bold text-sm hover:bg-green-500 disabled:opacity-50">💾 Salvar Chave PIX</button>
              </div>
            )}
          </div>

          {/* CARD 3: SOLID */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
            <h3 className="text-sm font-bold text-emerald-400">🪙 SOLID (Token EcoSolid)</h3>
            <div className="flex gap-4">
              <div className="flex-1 p-3 rounded-lg bg-emerald-500/10 text-center">
                <p className="text-xs text-slate-400">Confirmado</p>
                <p className="text-xl font-black text-emerald-400">{citizen?.totalPoints || 0}</p>
              </div>
              <div className="flex-1 p-3 rounded-lg bg-yellow-500/10 text-center">
                <p className="text-xs text-slate-400">Pendente</p>
                <p className="text-xl font-black text-yellow-400">
                  {txHistory.filter((tx: any) => tx.status === 'PENDENTE_VALIDACAO').reduce((s: number, tx: any) => s + (tx.pointsEarned || 0), 0)}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500 text-center">1 SOLID ≈ R$ 0,10</p>
            <button onClick={() => setDashboardTab('OVERVIEW')} className="w-full p-2 rounded-lg bg-slate-700 text-xs font-bold hover:bg-slate-600">📊 Ver Histórico</button>
          </div>

          {/* Extrato de Transações */}
          {citizen?.id && (
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <h3 className="text-sm font-bold text-slate-300">📋 Extrato de Transações</h3>
              {extrato.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">Nenhuma transação encontrada.</p>
              ) : (
                <div className="space-y-2">
                  {extrato.map((item: any, i: number) => (
                    <div key={i} className={`p-3 rounded-lg border ${item.valor.startsWith('+') ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-300">
                            <span className="mr-1">{item.icone}</span>
                            {item.descricao}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">{item.data}</p>
                        </div>
                        <span className={`text-sm font-black ml-2 ${item.valor.startsWith('+') ? 'text-emerald-400' : 'text-red-400'}`}>{item.valor}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${item.statusBadge === 'green' ? 'bg-emerald-500/20 text-emerald-400' : item.statusBadge === 'yellow' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                          {item.status}
                        </span>
                        {item.txHash && (
                          isRealHash(item.txHash) ? (
                            <a href={`https://sepolia.etherscan.io/tx/${item.txHash}`} target="_blank" rel="noopener"
                              className="text-xs text-cyan-400 hover:text-cyan-300 underline font-mono truncate">
                              Ver na blockchain ✓
                            </a>
                          ) : (
                            <span className="text-xs text-yellow-500 flex items-center gap-1">
                              ⚠️ Hash simulado
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
        </TabErrorBoundary>
      )}

      {dashboardTab === 'EXTRATO' && (
        <TabErrorBoundary>
        <main className="p-6 max-w-md mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h2 className="text-2xl font-bold">📋 Extrato</h2>

          {/* Card de Saldo */}
          {extratoResumo && (
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-slate-400">Recebido (BRL)</p>
                  <p className="text-sm font-black text-emerald-400">+R$ {extratoResumo.brl?.totalEntradas?.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Enviado (BRL)</p>
                  <p className="text-sm font-black text-red-400">-R$ {extratoResumo.brl?.totalSaidas?.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Saldo BRL</p>
                  <p className={`text-sm font-black ${extratoResumo.brl?.saldo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>R$ {extratoResumo.brl?.saldo?.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex gap-2 text-xs justify-center pt-1 border-t border-white/10">
                <span className="text-slate-500">ETH recebido: <span className="text-emerald-400">+{extratoResumo.eth?.totalEntradas?.toFixed(4)}</span></span>
                <span className="text-slate-500">ETH enviado: <span className="text-red-400">-{extratoResumo.eth?.totalSaidas?.toFixed(4)}</span></span>
              </div>
            </div>
          )}

          {/* Sub-tabs */}
          <div className="flex gap-1">
            {(['tudo','pix','crypto'] as const).map(st => (
              <button key={st} onClick={() => { setExtratoSubTab(st); setExtratoPagina(1); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${extratoSubTab === st ? 'bg-white/10 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}>
                {st === 'tudo' ? '📋 Tudo' : st === 'pix' ? '💰 PIX' : '🔗 Crypto'}
              </button>
            ))}
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-2">
            <select value={extratoPeriodo} onChange={e => { setExtratoPeriodo(e.target.value); setExtratoPagina(1); }}
              className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-300">
              <option value="hoje">Hoje</option><option value="7dias">7 dias</option><option value="30dias">30 dias</option><option value="todos">Todos</option>
            </select>
            <select value={extratoDirecao} onChange={e => { setExtratoDirecao(e.target.value); setExtratoPagina(1); }}
              className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-300">
              <option value="todos">Todos</option><option value="entrada">Só entradas</option><option value="saida">Só saídas</option>
            </select>
            <input placeholder="🔍 Buscar..." value={extratoBusca}
              onChange={e => { setExtratoBusca(e.target.value); setExtratoPagina(1); }}
              className="flex-1 min-w-[100px] p-2 rounded-lg bg-slate-900 border border-slate-700 text-sm outline-none focus:border-cyan-500" />
          </div>

          {/* Lista */}
          {extratoData.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8">Nenhuma transação encontrada.</p>
          ) : (
            <div className="space-y-1">
              {(() => {
                let lastDate = '';
                const todayStr = new Date().toLocaleDateString('pt-BR');
                const yesterdayStr = new Date(Date.now()-86400000).toLocaleDateString('pt-BR');
                return extratoData.map((item: any, i: number) => {
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
                          <span className="text-xs font-bold text-slate-500 px-2">{itemDate === todayStr ? 'Hoje' : itemDate === yesterdayStr ? 'Ontem' : itemDate}</span>
                          <div className="flex-1 border-t border-white/10" />
                        </div>
                      )}
                      <div className="p-3 rounded-lg bg-slate-800/20 border border-white/5 flex items-center gap-3">
                        <span className={`text-lg ${isEntrada ? 'text-emerald-400' : 'text-red-400'}`}>{isEntrada ? '↓' : '↑'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <p className="text-xs text-slate-300 truncate font-bold">
                              {isEntrada ? 'Recebido de' : 'Enviado para'} {item.contraparte || '—'}
                            </p>
                            <span className={`text-xs font-black ml-2 ${isEntrada ? 'text-emerald-400' : 'text-red-400'}`}>{valorStr}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${item.tipo === 'pix' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>{item.tipo === 'pix' ? 'PIX' : 'Crypto'}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${item.status === 'concluido' || item.status === 'confirmado' ? 'bg-emerald-500/20 text-emerald-400' : item.status === 'pendente' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>{item.status}</span>
                            <span className="text-xs text-slate-600">{new Date(item.createdAt).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}</span>
                          </div>
                          {item.hash && item.tipo === 'crypto' && isRealHash(item.hash) && (
                            <a href={`https://sepolia.etherscan.io/tx/${item.hash}`} target="_blank" rel="noopener"
                              className="text-xs text-cyan-400 hover:underline font-mono truncate block mt-0.5">🔗 Ver na blockchain</a>
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
          {extratoTotalPages > 1 && (
            <div className="flex justify-between items-center pt-2">
              <button onClick={() => setExtratoPagina(p => Math.max(1, p-1))} disabled={extratoPagina <= 1}
                className="text-xs px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50">Anterior</button>
              <span className="text-xs text-slate-500">Página {extratoPagina} de {extratoTotalPages} ({extratoTotal} itens)</span>
              <button onClick={() => setExtratoPagina(p => Math.min(extratoTotalPages, p+1))} disabled={extratoPagina >= extratoTotalPages}
                className="text-xs px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50">Próxima</button>
            </div>
          )}
        </main>
        </TabErrorBoundary>
      )}

      {dashboardTab === 'PROFILE' && (
        <TabErrorBoundary>
        <main className="p-6 max-w-md mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex flex-col items-center mt-6">
            <div className="relative">
              {(profilePhoto || citizen.facePhotoUrl) ? (
                <img src={profilePhoto || citizen.facePhotoUrl} className="w-32 h-32 rounded-full object-cover border-4 border-emerald-500 shadow-[0_0_20px_rgba(52,211,113,0.3)] scale-x-[-1]" />
              ) : (
                <div className="w-32 h-32 rounded-full bg-slate-800 flex items-center justify-center text-4xl">👤</div>
              )}
              {editProfile && (
                <label className="absolute bottom-0 right-0 bg-cyan-500 p-2 rounded-full border-2 border-slate-950 text-xs cursor-pointer hover:bg-cyan-400">
                  📷
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const img = new Image();
                      img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const max = 400;
                        let w = img.width, h = img.height;
                        if (w > h) { if (w > max) { h *= max/w; w = max; } }
                        else { if (h > max) { w *= max/h; h = max; } }
                        canvas.width = w; canvas.height = h;
                        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
                        setProfilePhoto(canvas.toDataURL('image/jpeg', 0.8));
                      };
                      img.src = reader.result as string;
                    };
                    reader.readAsDataURL(file);
                  }} />
                </label>
              )}
            </div>
            <h2 className="text-2xl font-bold mt-4">{citizen.name}</h2>
            <p className="text-slate-400 font-mono text-xs">{citizen.walletAddress}</p>
            {!editProfile ? (
              <button onClick={openProfileEdit} className="mt-3 px-6 py-2 rounded-xl bg-cyan-600 font-bold text-sm hover:bg-cyan-500">✏️ Editar Perfil</button>
            ) : (
              <button onClick={() => setEditProfile(false)} className="mt-3 px-6 py-2 rounded-xl bg-slate-600 font-bold text-sm hover:bg-slate-500">Cancelar</button>
            )}
          </div>

          {editProfile ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
              <p className="text-sm font-bold text-cyan-400">Editar Dados Pessoais</p>
              <InputField label="Nome completo" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} />
              <InputField label="E-mail" type="email" value={profileForm.email} onChange={e => setProfileForm({...profileForm, email: e.target.value})} />
              <InputField label="Telefone" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} placeholder="(85) 99999-9999" />
              <InputField label="Data de nascimento" value={profileForm.birthDate} onChange={e => setProfileForm({...profileForm, birthDate: e.target.value})} placeholder="1986-09-06" />
              <div className="pt-2 border-t border-white/10">
                <p className="text-xs text-slate-500 uppercase font-bold mb-1">🩸 Tipo Sanguíneo</p>
                <select value={profileForm.bloodType} onChange={e => setProfileForm({...profileForm, bloodType: e.target.value})}
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 outline-none focus:border-red-500 text-sm text-slate-300">
                  <option value="">Selecione</option>
                  {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="pt-2 border-t border-white/10">
                <p className="text-xs text-slate-500 uppercase font-bold mb-1">🏠 Endereço</p>
                <InputField label="CEP" value={profileForm.cep} onChange={e => { setProfileForm({...profileForm, cep: e.target.value}); if (e.target.value.replace(/\D/g,'').length===8) buscarCep(e.target.value); }} placeholder="00000-000" />
                <div className="flex gap-2">
                  <div className="flex-1"><InputField label="Logradouro" value={profileForm.logradouro} onChange={e => setProfileForm({...profileForm, logradouro: e.target.value})} /></div>
                  <div className="w-24"><InputField label="Número" value={profileForm.numero} onChange={e => setProfileForm({...profileForm, numero: e.target.value})} /></div>
                </div>
                <InputField label="Complemento" value={profileForm.complemento} onChange={e => setProfileForm({...profileForm, complemento: e.target.value})} />
                <div className="flex gap-2">
                  <div className="flex-1"><InputField label="Bairro" value={profileForm.bairro} onChange={e => setProfileForm({...profileForm, bairro: e.target.value})} /></div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1"><InputField label="Cidade" value={profileForm.cidade} onChange={e => setProfileForm({...profileForm, cidade: e.target.value})} /></div>
                  <div className="w-20"><InputField label="UF" value={profileForm.uf} onChange={e => setProfileForm({...profileForm, uf: e.target.value})} maxLength={2} /></div>
                </div>
              </div>
              <button
                onClick={async () => {
                  if (!profileForm.name?.trim()) { showToast('Nome é obrigatório', 'error'); return; }
                  setLoading(true);
                  const updateBody: any = {
                    name: profileForm.name, email: profileForm.email, phone: profileForm.phone,
                    birthDate: profileForm.birthDate, bloodType: profileForm.bloodType,
                    address: [profileForm.logradouro, profileForm.numero, profileForm.complemento, profileForm.bairro, profileForm.cidade, profileForm.uf, profileForm.cep].filter(Boolean).join(', ') || profileForm.address,
                  };
                  if (profilePhoto) updateBody.facePhotoUrl = profilePhoto;
                  const res = await apiFetch(`/citizens/${citizen.id}`, { method: 'PATCH', body: JSON.stringify(updateBody) });
                  const json = await res.json();
                  if (json.success) { setCitizen(json.data); setEditProfile(false); showToast('Perfil atualizado!', 'success'); }
                  else showToast(json.error, 'error');
                  setLoading(false);
                }}
                disabled={loading}
                className="w-full p-3 rounded-xl bg-cyan-600 font-bold text-sm hover:bg-cyan-500 disabled:opacity-50"
              >💾 Salvar alterações</button>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              {citizen.bloodType && (
                <div className={`p-3 rounded-xl text-center ${['AB-', 'B-', 'A-', 'O-'].includes(citizen.bloodType) ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-500/5 border border-red-500/20'}`}>
                  <p className="text-sm text-red-300 font-bold">🩸 Tipo Sanguíneo: {citizen.bloodType}</p>
                </div>
              )}
              <div><p className="text-xs text-slate-500 uppercase font-bold">CPF</p><p className="text-slate-200">{citizen.cpf}</p></div>
              <div><p className="text-xs text-slate-500 uppercase font-bold">E-mail</p><p className="text-slate-200">{citizen.email}</p></div>
              <div><p className="text-xs text-slate-500 uppercase font-bold">Telefone</p><p className="text-slate-200">{citizen.phone}</p></div>
              {citizen.birthDate && <div><p className="text-xs text-slate-500 uppercase font-bold">Nascimento</p><p className="text-slate-200">{citizen.birthDate}</p></div>}
              <div><p className="text-xs text-slate-500 uppercase font-bold">Endereço</p><p className="text-slate-200">{citizen.address}</p></div>
              <div><p className="text-xs text-slate-500 uppercase font-bold">Membro desde</p><p className="text-slate-200">{new Date(citizen.createdAt).toLocaleDateString()}</p></div>
              {citizen.credentialId && (
                <div className="pt-2 border-t border-white/10">
                  <p className="text-xs text-emerald-400 font-bold">🔐 Biometria cadastrada neste dispositivo</p>
                </div>
              )}
            </div>
          )}

          <AppointmentCard citizenId={citizen?.id} />
        </main>
        </TabErrorBoundary>
      )}

      {dashboardTab === 'OVERVIEW' && (
        <TabErrorBoundary>
        <main className="p-6 max-w-md mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <section className="p-8 rounded-3xl bg-white/5 border border-white/10 shadow-2xl relative overflow-hidden">
            {citizen.bloodType ? (
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30 mb-2">
                <span className="text-xs text-red-400 font-bold">🩸 {citizen.bloodType}</span>
              </div>
            ) : (
              <button onClick={() => setDashboardTab('PROFILE')} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/30 mb-2 text-xs text-yellow-400 font-bold hover:bg-yellow-500/30">
                ⚠️ Cadastrar tipo sanguíneo
              </button>
            )}
            <p className="text-sm text-slate-400">Saldo Consolidado</p>
            <div className="flex items-end gap-2 mb-6">
              <h2 className="text-5xl font-black">{citizen.totalPoints}</h2>
              <span className="text-emerald-400 font-bold mb-1">SOLID</span>
            </div>
            {/* SOLID Pendente */}
            {(() => {
              const pendingPoints = txHistory
                .filter((tx: any) => tx.status === 'PENDENTE_VALIDACAO')
                .reduce((sum: number, tx: any) => sum + (tx.pointsEarned || 0), 0);
              if (pendingPoints > 0) return (
                <p className="text-xs text-yellow-400 mt-1 mb-2">🟡 {pendingPoints} SOLID pendentes de validação</p>
              );
              return null;
            })()}
            {(() => {
              const level = getLevel(citizen.totalPoints || 0);
              const prog = level.next === Infinity ? 100 : Math.max(2, ((citizen.totalPoints - level.min) / (level.next - level.min)) * 100);
              return (
                <>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-emerald-300 font-bold">{level.badge} {level.name}</span>
                    {level.next < Infinity && (
                      <span className="text-slate-500">Faltam {level.next - (citizen.totalPoints || 0)} SOLID</span>
                    )}
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-4">
                    <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all duration-700" style={{ width: `${prog}%` }} />
                  </div>
                </>
              );
            })()}
            <button
              onClick={() => {
                const level = getLevel(citizen.totalPoints || 0);
                const text = `Acabei de atingir o nível ${level.badge} ${level.name} no EcoSolid! 🌱\nJá fiz ${txHistory.length} ações cidadãs em Fortaleza.\nAcumulei ${(citizen.totalPoints || 0).toLocaleString()} SOLID em recompensas.\nJunte-se a mim: https://eco-solid.vercel.app`;
                if (navigator.share) {
                  navigator.share({ title: 'EcoSolid', text });
                } else {
                  navigator.clipboard.writeText(text).then(() => showToast('Mensagem copiada!', 'success'));
                }
              }}
              className="w-full p-3 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/50 text-slate-400 hover:text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              📤 Compartilhar minha conquista
            </button>

            <button onClick={refreshData}
              className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-slate-300 font-bold text-xs flex items-center justify-center gap-2">
              🔄 Atualizar dados
            </button>
          </section>

          <section className="grid grid-cols-2 gap-4">
            <button onClick={() => openActionModal('RECYCLING', 50, '♻️', 'Reciclagem')} className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-500 flex flex-col items-center gap-2">
              <span className="text-3xl">♻️</span><span className="font-bold text-sm">Reciclar</span>
            </button>
            <button onClick={() => openActionModal('BLOOD_DONATION', 500, '🩸', 'Doação de Sangue')} className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-red-500 flex flex-col items-center gap-2">
              <span className="text-3xl">🩸</span><span className="font-bold text-sm">Sangue</span>
            </button>
          </section>

          <section>
            <h3 className="text-lg font-bold mb-4">Histórico Oficial 🔗</h3>
            <div className="space-y-4">
              {txHistory.length === 0 ? <p className="text-slate-500 text-sm">Ações aparecerão aqui.</p> :
                txHistory.map((tx, i) => (
                  <div key={i} className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex gap-2">
                        <span className="text-2xl">{tx.icon}</span>
                        <div><p className="font-bold text-sm">{tx.title}</p><p className="text-xs text-slate-400">{tx.date} <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
  tx.status === 'PENDENTE_VALIDACAO' ? 'bg-yellow-500/20 text-yellow-400' :
  tx.status === 'VALIDADO' ? 'bg-green-500/20 text-green-400' :
  tx.status === 'REJEITADO' ? 'bg-red-500/20 text-red-400' :
  'bg-slate-500/20 text-slate-400'
}`}>
  {tx.status === 'PENDENTE_VALIDACAO' ? ' Aguardando' :
   tx.status === 'VALIDADO' ? ' Validado' :
   tx.status === 'REJEITADO' ? ' Rejeitado' : ' Registrado'}
</span></p></div>
                      </div>
                      <span className="text-emerald-400 font-bold">{tx.points}</span>
                    </div>
                    {(tx.lat && tx.lng) && <p className="text-[10px] text-cyan-500 font-mono mb-2">{tx.address ? `📍 ${tx.address.substring(0, 120)}${tx.address.length > 120 ? '...' : ''}` : `GPS: ${tx.lat.toFixed(5)}, ${tx.lng.toFixed(5)}`}</p>}
                    {tx.img && <img src={tx.img} className="w-full h-24 object-cover rounded-lg mb-2 opacity-90 border border-slate-700" />}
                    <p className="text-[10px] text-slate-500 font-mono mb-2">Blockchain: {typeof tx.tx === 'string' && tx.tx.length > 20 ? tx.tx.slice(0, 14) + '...' : tx.tx}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCertificateModal({ action: tx, citizenName: citizen?.name || 'Cidadão' })}
                        className="text-xs px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 font-bold"
                      >
                        📜 Ver Certificado
                      </button>
                      <button
                        onClick={() => {
                          const certText =
`📜 CERTIFICADO DE IMPACTO — EcoSolid
━━━━━━━━━━━━━━━━━━━━━
👤 Cidadão: ${citizen?.name || 'Cidadão'}
🪪 ID: ${citizen?.id || ''}
🎯 Ação: ${tx.title}
🩸 ${tx.bloodType ? 'Tipo Sanguíneo: ' + tx.bloodType : ''}${tx.bloodType ? '\n' : ''}⭐ Pontos: ${tx.points}
📅 Data: ${tx.date}
📍 Local: ${tx.address || 'Localização registrada'}
🔗 Blockchain: ${tx.tx}
━━━━━━━━━━━━━━━━━━━━━
Verificado por EcoSolid — blockchain pública`;
                          navigator.clipboard.writeText(certText).then(() => showToast('Certificado copiado!', 'success'));
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white font-bold"
                      >
                        📋 Compartilhar
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        </main>
        </TabErrorBoundary>
      )}

      {/* Modal Fullscreen Alerta de Sangue */}
      {bloodAlert && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6 bg-red-950/95 animate-pulse">
          <div className="text-center space-y-6 max-w-sm">
            <div className="text-6xl animate-bounce">🚨</div>
            <h1 className="text-4xl font-black text-red-400 animate-pulse">URGENTE</h1>
            <p className="text-2xl font-bold text-white">
              Seu Sangue <span className="text-red-400 font-black">{bloodAlert.bloodType}</span> é Necessário!
            </p>
            <div className="bg-red-500/20 border border-red-500/40 rounded-2xl p-4">
              <p className="text-lg font-bold text-white">{bloodAlert.hospital}</p>
              <p className="text-sm text-red-200 mt-2">{bloodAlert.message}</p>
            </div>
            <div className="inline-block px-4 py-2 rounded-full bg-red-500/30 border border-red-400/50">
              <span className="text-red-300 font-bold text-sm">🩸 {bloodAlert.bloodType}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setAgendamentoNome(citizen?.name || formData.name || '');
                setAgendamentoTelefone(citizen?.phone || formData.phone || '');
                setShowAgendamento(true);
              }}
              className="w-full p-4 rounded-xl bg-green-500 font-bold text-white text-lg hover:bg-green-400 shadow-[0_0_30px_rgba(34,197,94,0.4)]"
            >
              🩸 Agendar Doação — Ganhar 1.000 SOLID
            </button>
            <button
              onClick={() => {
                localStorage.setItem('ecosolid_alert_dismissed', Date.now().toString());
                setBloodAlert(null);
              }}
              className="text-slate-400 hover:text-slate-300 text-sm underline"
            >
              Lembrar depois (2h)
            </button>
          </div>
        </div>
      )}

      {/* Modal Agendamento de Doação */}
      {showAgendamento && (
        <div className="fixed inset-0 bg-black/95 z-[10000] flex flex-col items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowAgendamento(false); }}>
          <div className="bg-slate-900 border border-emerald-500/30 p-6 rounded-3xl w-full max-w-md space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">📅 Agendar Doação</h3>
              <button onClick={() => setShowAgendamento(false)} className="text-2xl text-slate-400">&times;</button>
            </div>
            <p className="text-sm text-slate-400">Escolha o melhor dia e horário para doar sangue{bloodAlert?.hospital ? ` no ${bloodAlert.hospital}` : ''}.</p>

            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-bold">Data</label>
              <input type="date" value={agendamentoData} onChange={e => setAgendamentoData(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 outline-none focus:border-emerald-500 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-bold">Horário</label>
              <input type="time" value={agendamentoHora} onChange={e => setAgendamentoHora(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 outline-none focus:border-emerald-500 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-bold">Nome</label>
              <input type="text" value={agendamentoNome} onChange={e => setAgendamentoNome(e.target.value)}
                placeholder="Seu nome completo"
                className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 outline-none focus:border-emerald-500 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-bold">Telefone (WhatsApp)</label>
              <input type="tel" value={agendamentoTelefone} onChange={e => setAgendamentoTelefone(e.target.value)}
                placeholder="(85) 99999-9999"
                className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 outline-none focus:border-emerald-500 text-white" />
            </div>
            <button
              onClick={handleAgendamento}
              disabled={agendamentoLoading || !agendamentoData || !agendamentoHora}
              className="w-full p-4 rounded-xl bg-emerald-500 font-bold text-white text-lg hover:bg-emerald-400 disabled:opacity-50 shadow-[0_0_30px_rgba(52,211,113,0.4)]"
            >
              {agendamentoLoading ? '⏳ Agendando...' : '✅ Confirmar Agendamento'}
            </button>
          </div>
        </div>
      )}

      {actionModal && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col p-4">
          <div className="mt-auto bg-slate-900 border border-emerald-500/30 p-6 rounded-3xl w-full max-w-md mx-auto space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">Auditoria de Ação</h3>
              <button onClick={() => {setActionModal(null); setImagePreview(null)}} className="text-2xl">&times;</button>
            </div>

            {/* Tipo sanguíneo — apenas para doação de sangue */}
            {actionModal.type === 'BLOOD_DONATION' && (
              <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/30 space-y-2">
                <p className="text-sm font-bold text-red-400">🩸 Tipo Sanguíneo do Doador</p>
                <select
                  value={actionBloodType}
                  onChange={e => setActionBloodType(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-red-500 text-slate-300 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2220%22 height=%2220%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23475569%22 stroke-width=%222%22><path d=%22M6 9l6 6 6-6%22/></svg>')] bg-no-repeat bg-[right_12px_center]"
                >
                  <option value="" className="bg-slate-900">Selecione seu tipo</option>
                  <option value="A+" className="bg-slate-900">A+</option><option value="A-" className="bg-slate-900">A-</option>
                  <option value="B+" className="bg-slate-900">B+</option><option value="B-" className="bg-slate-900">B-</option>
                  <option value="AB+" className="bg-slate-900">AB+</option><option value="AB-" className="bg-slate-900">AB-</option>
                  <option value="O+" className="bg-slate-900">O+</option><option value="O-" className="bg-slate-900">O-</option>
                </select>
              </div>
            )}

            {/* Endereço fixo para doação de sangue */}
            {actionModal.type === 'BLOOD_DONATION' && (
              <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/30">
                <p className="text-xs text-red-300">📍 Local: <strong>HemoSangue CE</strong> — Av. José Bastos, 3390 — Fortaleza/CE</p>
              </div>
            )}

            <div className="bg-white/5 p-4 rounded-xl space-y-1">
              <p className="text-sm font-bold text-emerald-400">📍 Geolocalização Obrigatória</p>
              {locationLoading && <p className="text-xs text-yellow-500 animate-pulse">Obtendo localização e endereço...</p>}
              {!locationLoading && locationAddress && (
                <p className="text-xs text-slate-300 leading-relaxed">{locationAddress}</p>
              )}
              {!locationLoading && location && !locationAddress && (
                <p className="text-xs text-slate-300">Lat: {location.lat.toFixed(5)}, Lng: {location.lng.toFixed(5)}</p>
              )}
              {!locationLoading && !location && (
                <p className="text-xs text-red-400">Localização não obtida. Verifique as permissões do dispositivo.</p>
              )}
            </div>

            <div>
              <p className="text-sm font-bold mb-2">📸 Evidência Fotográfica</p>
              {!imagePreview ? (
                <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-600 rounded-xl cursor-pointer">
                  <span className="text-3xl mb-2">📷</span><span className="text-xs text-slate-400">Toque p/ abrir Câmera</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageCapture} />
                </label>
              ) : (
                <div className="relative">
                  <img src={imagePreview} className="w-full h-40 object-cover rounded-xl border border-emerald-500/50" />
                  <button onClick={() => setImagePreview(null)} className="absolute top-2 right-2 bg-black/70 p-2 rounded-full text-xs">Refazer</button>
                </div>
              )}
            </div>

            <button onClick={confirmAction} disabled={loading || !imagePreview} className="w-full p-4 rounded-xl bg-emerald-500 font-bold text-white disabled:opacity-50">
              {loading ? "Processando..." : "Registrar na Blockchain"}
            </button>
          </div>
        </div>
      )}

      {/* Modal Certificado de Impacto */}
      {certificateModal && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col p-4">
          <div className="m-auto bg-slate-900 border border-cyan-500/30 p-6 rounded-3xl w-full max-w-md space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-cyan-400">📜 Certificado de Impacto</h3>
              <button onClick={() => setCertificateModal(null)} className="text-2xl">&times;</button>
            </div>

            <div className="bg-white/5 p-4 rounded-xl space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Cidadão:</span>
                <span className="text-white font-bold">{certificateModal.citizenName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Ação:</span>
                <span className="text-white font-bold">{certificateModal.action.title}</span>
              </div>
              {certificateModal.action.bloodType && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Tipo Sanguíneo:</span>
                  <span className="text-red-400 font-bold">{certificateModal.action.bloodType}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Pontos:</span>
                <span className="text-emerald-400 font-bold">{certificateModal.action.points}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Data:</span>
                <span className="text-white">{certificateModal.action.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Local:</span>
                <span className="text-white text-right max-w-[60%]">{certificateModal.action.address || 'Registrado'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Blockchain:</span>
                <span className="text-cyan-400 font-mono text-xs">{typeof certificateModal.action.tx === 'string' ? certificateModal.action.tx.slice(0, 18) + '...' : certificateModal.action.tx}</span>
              </div>
            </div>

            <button
              onClick={async () => {
                const doc = new jsPDF();
                doc.setFontSize(22);
                doc.setTextColor(16, 185, 129);
                doc.text('ECOSOLID', 105, 20, { align: 'center' });
                doc.setTextColor(100);
                doc.setFontSize(10);
                doc.text('Certificado de Impacto Verificavel', 105, 28, { align: 'center' });
                doc.line(20, 32, 190, 32);
                doc.setFontSize(12);
                doc.setTextColor(50);
                let y = 42;
                doc.text(`Cidadao: ${certificateModal.citizenName}`, 20, y); y += 10;
                doc.text(`Acao: ${certificateModal.action.title}`, 20, y); y += 10;
                if (certificateModal.action.bloodType) { doc.text(`Tipo Sanguineo: ${certificateModal.action.bloodType}`, 20, y); y += 10; }
                doc.text(`Pontos: ${certificateModal.action.points}`, 20, y); y += 10;
                doc.text(`Data: ${certificateModal.action.date}`, 20, y); y += 10;
                doc.text(`Local: ${certificateModal.action.address || 'Registrado'}`, 20, y); y += 10;
                const txHash = certificateModal.action.tx;
                doc.setTextColor(0, 100, 200);
                doc.setFontSize(8);
                doc.text(`Blockchain: ${txHash}`, 20, y); y += 12;
                doc.setTextColor(100);
                doc.setFontSize(10);
                doc.text('Certificado verificavel na blockchain Polygon', 105, y + 5, { align: 'center' });
                doc.text(`https://polygonscan.com/tx/${txHash}`, 105, y + 12, { align: 'center' });
                // QR Code no PDF
                try {
                  const qrData = await QRCodeLib.toDataURL(`https://polygonscan.com/tx/${txHash}`, { width: 80, margin: 1 });
                  doc.addImage(qrData, 'PNG', 75, y + 18, 40, 40);
                } catch {}
                doc.save(`certificado-ecosolid-${txHash?.slice(0, 8) || 'acao'}.pdf`);
              }}
              className="w-full p-4 rounded-xl bg-slate-700 font-bold text-white hover:bg-slate-600 flex items-center justify-center gap-2 mb-2"
            >
              📥 Baixar PDF
            </button>
            <button
              onClick={() => {
                const certText =
`📜 CERTIFICADO DE IMPACTO — EcoSolid
━━━━━━━━━━━━━━━━━━━━━
👤 Cidadão: ${certificateModal.citizenName}
🎯 Ação: ${certificateModal.action.title}
${certificateModal.action.bloodType ? '🩸 Tipo Sanguíneo: ' + certificateModal.action.bloodType + '\n' : ''}⭐ Pontos: ${certificateModal.action.points}
📅 Data: ${certificateModal.action.date}
📍 Local: ${certificateModal.action.address || 'Registrado'}
🔗 Blockchain: ${certificateModal.action.tx}
━━━━━━━━━━━━━━━━━━━━━
Verificado por EcoSolid — blockchain pública`;
                navigator.clipboard.writeText(certText).then(() => showToast('Certificado copiado!', 'success'));
              }}
              className="w-full p-4 rounded-xl bg-cyan-500 font-bold text-white hover:bg-cyan-400 flex items-center justify-center gap-2"
            >
              📋 Compartilhar Certificado
            </button>
          </div>
        </div>
      )}

      {/* Modal QR Code de Resgate */}
      {redeemModal && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col p-4">
          <div className="m-auto bg-slate-900 border border-amber-500/30 p-6 rounded-3xl w-full max-w-sm space-y-4 text-center">
            <h3 className="text-xl font-bold text-amber-400">
              {redeemStatus === 'CONFIRMADO' ? '✅ Resgate Aprovado!' :
               redeemStatus === 'EXPIRADO' ? '❌ Resgate Expirado' :
               '🎁 Resgate'}
            </h3>
            <p className="text-sm text-slate-300">{redeemModal.benefitDescription} — <strong>{redeemModal.solidCost} SOLID</strong></p>
            {qrDataUrl && <img src={qrDataUrl} alt="QR Code" className="mx-auto rounded-xl border border-white/10" />}
            <div className="bg-white/5 p-3 rounded-xl">
              <p className="text-xs text-slate-400 mb-1">Código do Resgate</p>
              <p className="text-2xl font-black font-mono tracking-widest text-amber-400">{redeemModal.code}</p>
            </div>
            {/* Status em tempo real */}
            <div className={`p-3 rounded-xl ${
              redeemStatus === 'CONFIRMADO' ? 'bg-emerald-500/20 border border-emerald-500/30' :
              redeemStatus === 'EXPIRADO' ? 'bg-red-500/20 border border-red-500/30' :
              'bg-yellow-500/10 border border-yellow-500/20'
            }`}>
              {redeemStatus === 'PENDENTE' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-bold text-yellow-400">🟡 Aguardando aprovação do parceiro...</span>
                  </div>
                  {redeemCreatedAt && redeemCountdown > 0 && (
                    <p className="text-xs text-slate-400">{Math.floor(redeemCountdown / 60)}:{(redeemCountdown % 60).toString().padStart(2, '0')} restantes</p>
                  )}
                  {redeemCreatedAt && redeemCountdown <= 0 && (
                    <p className="text-xs text-red-400">Tempo esgotado</p>
                  )}
                </div>
              )}
              {redeemStatus === 'CONFIRMADO' && (
                <div className="space-y-2">
                  <span className="text-sm font-bold text-emerald-400">
                    {redeemDuracao > 0
                      ? `✅ Aprovado! Você tem ${redeemDuracao} minutos para usar.`
                      : '✅ Aprovado! Pode usar o benefício.'}
                  </span>
                  {redeemDuracao > 0 && redeemCountdown > 0 && (
                    <TimerProgressBar totalSec={redeemDuracao * 60} remainingSec={redeemCountdown} />
                  )}
                  {redeemDuracao > 0 && redeemCountdown <= 0 && (
                    <p className="text-xs font-bold text-red-400">⏰ Tempo esgotado! Benefício encerrado.</p>
                  )}
                  {redeemTxHash && (
                    <a href={`https://sepolia.etherscan.io/tx/${redeemTxHash}`} target="_blank" rel="noopener"
                      className="block text-xs text-cyan-400 hover:underline font-mono truncate">{redeemTxHash}</a>
                  )}
                </div>
              )}
              {redeemStatus === 'EXPIRADO' && (
                <span className="text-sm font-bold text-red-400">❌ Este resgate expirou após 30 minutos.</span>
              )}
            </div>
            <div className="space-y-2">
              {redeemStatus !== 'EXPIRADO' && (
                <button
                  onClick={() => {
                    if (qrDataUrl) {
                      const a = document.createElement('a');
                      a.href = qrDataUrl;
                      a.download = `resgate-${redeemModal.code}.png`;
                      a.click();
                    }
                  }}
                  className="w-full p-3 rounded-xl bg-slate-700 text-white font-bold text-sm hover:bg-slate-600"
                >💾 Salvar QR Code</button>
              )}
              <button
                onClick={() => { setRedeemModal(null); setQrDataUrl(null); setRedeemStatus(null); setRedeemCreatedAt(null); }}
                className="w-full p-3 rounded-xl bg-amber-500 font-bold text-white hover:bg-amber-400"
              >Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding pós-cadastro */}
      {/* Modal PIX */}
      {pixQrModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setPixQrModal(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold">{pixQrModal.type === 'send' ? '📤 Enviar PIX' : '📥 Receber PIX'}</h3>
            {pixQrModal.type === 'send' ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Valor (R$)</label>
                  <input type="number" step="0.01" placeholder="10,00" id="pixSendValue"
                    className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 outline-none focus:border-green-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Chave PIX destino</label>
                  <input placeholder="CPF/Email/Telefone/Chave" id="pixSendKey"
                    className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 outline-none focus:border-green-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Descrição (opcional)</label>
                  <input placeholder="Ex: Pagamento reciclagem" id="pixSendDesc"
                    className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 outline-none focus:border-green-500" />
                </div>
                <button
                  onClick={() => {
                    const value = (document.getElementById('pixSendValue') as HTMLInputElement)?.value;
                    const key = (document.getElementById('pixSendKey') as HTMLInputElement)?.value;
                    const desc = (document.getElementById('pixSendDesc') as HTMLInputElement)?.value;
                    if (!value || !key) { showToast('Preencha valor e chave PIX', 'error'); return; }
                    // Gera QR Code PIX via endpoint do backend
                    const pixPayload = `pix:${key}:R$ ${value}:${desc || 'EcoSolid'}`;
                    showToast(`PIX gerado! Chave: ${key} Valor: R$ ${value}`, 'success');
                    // Nota: QR Code PIX completo requer biblioteca pix-utils no frontend
                    // ou endpoint dedicado no backend
                  }}
                  className="w-full p-3 rounded-xl bg-green-600 font-bold hover:bg-green-500"
                >Gerar QR Code PIX</button>
              </div>
            ) : (
              <div className="space-y-3 text-center">
                <p className="text-sm text-slate-400">Mostre este QR Code para receber:</p>
                <div className="bg-white p-4 rounded-xl mx-auto w-48 h-48 flex items-center justify-center">
                  {citizen?.pixKey ? (
                    <span className="text-green-800 font-mono font-bold text-lg">PIX</span>
                  ) : (
                    <p className="text-xs text-slate-500">Cadastre sua chave PIX primeiro</p>
                  )}
                </div>
                {citizen?.pixKey && (
                  <>
                    <p className="font-mono text-sm text-green-400 break-all">{citizen.pixKey}</p>
                    <p className="text-xs text-slate-500">{citizen.pixKeyType?.toUpperCase()}</p>
                    <button onClick={() => { navigator.clipboard.writeText(citizen.pixKey || ''); showToast('Chave copiada!', 'success'); }}
                      className="w-full p-3 rounded-xl bg-slate-700 font-bold text-sm hover:bg-slate-600">📋 Copiar Chave</button>
                  </>
                )}
              </div>
            )}
            <button onClick={() => setPixQrModal(null)} className="w-full p-3 rounded-xl bg-slate-700 font-bold hover:bg-slate-600">Fechar</button>
          </div>
        </div>
      )}

      {/* Modal Crypto */}
      {cryptoModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setCryptoModal(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold">{cryptoModal.type === 'send' ? '📤 Enviar Cripto' : '📥 Receber Cripto'}</h3>
            {cryptoModal.type === 'send' ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Endereço destino (0x...)</label>
                  <input placeholder="0x..." id="cryptoSendAddr"
                    className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 outline-none focus:border-orange-500 font-mono text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Valor (ETH)</label>
                  <input type="number" step="0.0001" placeholder="0.01" id="cryptoSendVal"
                    className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 outline-none focus:border-orange-500" />
                </div>
                {typeof window !== 'undefined' && (window as any).ethereum?.isMetaMask ? (
                  <button
                    onClick={async () => {
                      const addr = (document.getElementById('cryptoSendAddr') as HTMLInputElement)?.value?.trim();
                      const val = (document.getElementById('cryptoSendVal') as HTMLInputElement)?.value;
                      if (!addr || !val) { showToast('Preencha endereço e valor', 'error'); return; }
                      try {
                        // Verificar chain Sepolia
                        const chainId = await (window as any).ethereum.request({ method: 'eth_chainId' });
                        if (chainId !== '0xaa36a7') {
                          try { await (window as any).ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xaa36a7' }] }); }
                          catch { showToast('Troque para a rede Sepolia no MetaMask', 'error'); return; }
                        }
                        const tx = await (window as any).ethereum.request({
                          method: 'eth_sendTransaction',
                          params: [{ from: citizen.walletAddress, to: addr, value: '0x' + (BigInt(Math.floor(parseFloat(val) * 1e18))).toString(16) }],
                        });
                        // Persistir no MongoDB
                        apiFetch('/extrato/crypto', {
                          method: 'POST',
                          body: JSON.stringify({ hash: tx, from: citizen.walletAddress, to: addr, valor: parseFloat(val), usuarioOrigemId: citizen.id, usuarioDestinoId: addr, nomeOrigem: citizen.name, network: 'sepolia' }),
                        }).catch(() => {});
                        // Polling para confirmar tx
                        const checkInterval = setInterval(async () => {
                          try {
                            const receipt = await (window as any).ethereum.request({ method: 'eth_getTransactionReceipt', params: [tx] });
                            if (receipt) {
                              apiFetch(`/extrato/crypto/${tx}/confirmar`, { method: 'POST' }).catch(() => {});
                              clearInterval(checkInterval);
                            }
                          } catch {}
                        }, 5000);
                        setTimeout(() => clearInterval(checkInterval), 120000);
                        const txLink = `https://sepolia.etherscan.io/tx/${tx}`;
                        showToast(`Tx enviada! ${tx.substring(0, 10)}... — ${txLink}`, 'success');
                        setCryptoModal(null);
                      } catch (e: any) { showToast('Erro: ' + (e?.message || 'Transação rejeitada'), 'error'); }
                    }}
                    className="w-full p-3 rounded-xl bg-orange-600 font-bold hover:bg-orange-500"
                  >🦊 Assinar com MetaMask</button>
                ) : (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-xs text-amber-400">MetaMask não detectada. Instale a extensão ou use o app mobile para enviar cripto.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 text-center">
                <p className="text-sm text-slate-400">Seu endereço para receber:</p>
                {citizen?.walletAddress ? (
                  <>
                    <div className="p-3 rounded-lg bg-slate-800 break-all font-mono text-xs text-cyan-300">{citizen.walletAddress}</div>
                    <QRCodeDisplay address={citizen.walletAddress} />
                    {metaMaskBal && <p className="text-xs text-slate-400">Saldo: <span className="text-emerald-400 font-bold">{metaMaskBal} ETH</span> {quotes.eth ? <span className="text-slate-500">(~R$ {(parseFloat(metaMaskBal) * quotes.eth).toFixed(2)})</span> : null}</p>}
                    <button onClick={() => { navigator.clipboard.writeText(citizen.walletAddress || ''); showToast('Endereço copiado!', 'success'); }}
                      className="w-full p-3 rounded-xl bg-slate-700 font-bold text-sm hover:bg-slate-600">📋 Copiar Endereço</button>
                  </>
                ) : (
                  <p className="text-xs text-slate-500">Conecte uma carteira primeiro (MetaMask ou EVM).</p>
                )}
              </div>
            )}
            <button onClick={() => setCryptoModal(null)} className="w-full p-3 rounded-xl bg-slate-700 font-bold hover:bg-slate-600">Fechar</button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[70] px-6 py-3 rounded-xl shadow-2xl animate-in slide-in-from-right duration-300 text-sm font-bold ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' : toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-slate-800 text-white border border-slate-700'
        }`}>
          {toast.msg}
        </div>
      )}

      {showOnboarding && (
        <div className="fixed inset-0 bg-black z-[60] flex flex-col justify-center p-6">
          <div className="max-w-sm mx-auto text-center space-y-6 animate-in fade-in zoom-in duration-500">
            <span className="text-6xl">🌱</span>
            <h1 className="text-3xl font-black text-white">Bem-vindo ao EcoSolid, {citizen.name?.split(' ')[0]}!</h1>
            <p className="text-slate-400">Sua identidade cívica foi criada com sucesso. Veja como ganhar SOLID:</p>

            <div className="grid gap-3">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-left flex gap-3 items-center">
                <span className="text-3xl">♻️</span>
                <div>
                  <p className="font-bold text-white text-sm">Recicle</p>
                  <p className="text-xs text-slate-400">Registre reciclagens e ganhe 50 SOLID por ação. Aponte a câmera para o material reciclado.</p>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-left flex gap-3 items-center">
                <span className="text-3xl">🩸</span>
                <div>
                  <p className="font-bold text-white text-sm">Doe Sangue</p>
                  <p className="text-xs text-slate-400">Doe no HemoSangue CE e ganhe 500 SOLID. Seu tipo sanguíneo pode salvar vidas.</p>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-left flex gap-3 items-center">
                <span className="text-3xl">🎁</span>
                <div>
                  <p className="font-bold text-white text-sm">Resgate Benefícios</p>
                  <p className="text-xs text-slate-400">Troque SOLID por estacionamento, consultas, desconto em água e energia.</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowOnboarding(false)}
              className="w-full p-4 rounded-xl bg-emerald-500 font-bold text-white hover:bg-emerald-400 text-lg"
            >
              Começar agora 🚀
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
