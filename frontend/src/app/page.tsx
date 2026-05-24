"use client";
import React, { useState, useRef, useEffect } from 'react';

declare global {
  interface Window { ethereum?: any; PublicKeyCredential?: any; }
}

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

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
  const [dashboardTab, setDashboardTab] = useState<'OVERVIEW' | 'PROFILE'>('OVERVIEW');
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
  const [formData, setFormData] = useState({ name: '', cpf: '', birthDate: '', cep: '', address: '', number: '', complement: '', phone: '', email: '', walletAddress: '' });

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
    setCitizen(null);
    setView('LOGIN');
    setDashboardTab('OVERVIEW');
    setTxHistory([]);
    setShowBiometricPrompt(false);
    setShowPermissionSetup(false);
  };

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
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCitizen({ ...citizen, totalPoints: citizen.totalPoints + actionModal.points });
        setTxHistory([
          { title: actionModal.title, points: `+${actionModal.points} SOLID`, date: new Date().toLocaleString(), icon: actionModal.icon, tx: json.data.txHash.slice(0, 10) + "...", img: imagePreview, lat: location?.lat, lng: location?.lng, address: locationAddress },
          ...txHistory
        ]);
        setActionModal(null); setImagePreview(null); setLocation(null); setLocationAddress(null);
      } else alert(json.error);
    } catch (e) { console.error(e); }
    setLoading(false);
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

        {/* Google Sign-In — PRIORIDADE no Chrome Android */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="p-4 rounded-xl bg-white text-slate-900 font-bold w-full max-w-sm hover:bg-slate-200 shadow-xl flex items-center justify-center gap-3"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          {loading ? "Conectando..." : "Entrar com Google"}
        </button>

        <div className="flex items-center gap-3 w-full max-w-sm">
          <div className="flex-1 h-px bg-slate-800"></div>
          <span className="text-xs text-slate-600">ou</span>
          <div className="flex-1 h-px bg-slate-800"></div>
        </div>

        <button onClick={handleConnectMetaMask} disabled={loading} className="p-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 font-bold w-full max-w-sm hover:scale-[1.02] shadow-xl flex items-center justify-center gap-3">
          <span className="text-2xl">🦊</span> {loading ? "Conectando..." : "Conectar / Cadastrar com MetaMask"}
        </button>

        {hasStoredBiometric && (
          <button onClick={handleBiometricLogin} disabled={loading} className="p-4 rounded-xl bg-slate-800 text-white font-bold w-full max-w-sm hover:bg-slate-700 flex items-center justify-center gap-2 border border-slate-700">
            <span className="text-2xl text-emerald-400">👆</span> {loading ? "Verificando..." : "Entrar com Digital / Facial"}
          </button>
        )}

        {/* MetaMask App — só aparece em mobile NÃO-Chrome (onde o deep link funciona) */}
        {isMobileDevice && !isChromeAndroid && (
          <button onClick={openInMetaMaskApp} className="p-3 rounded-xl bg-slate-800 text-white font-bold w-full max-w-sm hover:bg-slate-700 flex items-center justify-center gap-2 border border-emerald-600">
            <span className="text-xl">📱</span> Abrir com MetaMask App
          </button>
        )}

        {!hasStoredBiometric && (
          <p className="text-xs text-slate-600 text-center max-w-sm">
            {isMobileDevice
              ? isChromeAndroid
                ? "Use o botão \"Entrar com Google\" acima para login rápido. Para usar MetaMask, instale o app e acesse pelo navegador integrado dele."
                : "Toque em \"Abrir com MetaMask App\" para acessar com sua carteira. O app será aberto no navegador integrado do MetaMask."
              : "Conecte sua carteira MetaMask primeiro. Após o login, você poderá cadastrar sua digital ou reconhecimento facial para acesso rápido nas próximas vezes."
            }
          </p>
        )}
      </div>
    );
  }

  if (view === 'REGISTER') {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 pb-20">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-3xl">🦊</span>
            <div>
              <h2 className="text-xl font-bold text-emerald-400">Carteira Vinculada!</h2>
              <p className="text-xs text-slate-400 font-mono truncate w-48">{formData.walletAddress}</p>
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-4 text-white">Criar Identidade Cívica</h2>
          <p className="text-sm text-slate-400 mb-6">Você conectou seu MetaMask, mas ainda não tem cadastro. Preencha os dados abaixo para finalizar.</p>

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

            <input required placeholder="Nome Completo" className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500" onChange={e => setFormData({...formData, name: e.target.value})} />
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

            <div className="flex gap-2">
              <input placeholder="CEP" value={formData.cep} className="w-1/3 p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500" onChange={handleCepChange} maxLength={9} />
              <input required placeholder="Endereço (Rua/Avenida)" value={formData.address} className="w-2/3 p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500" onChange={e => setFormData({...formData, address: e.target.value})} />
            </div>

            <div className="flex gap-2">
              <input required placeholder="Número" value={formData.number} className="w-1/3 p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500" onChange={e => setFormData({...formData, number: e.target.value})} />
              <input placeholder="Complemento" value={formData.complement} className="w-2/3 p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500" onChange={e => setFormData({...formData, complement: e.target.value})} />
            </div>

            <input required placeholder="E-mail" type="email" className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500" onChange={e => setFormData({...formData, email: e.target.value})} />
            <input required placeholder="Telefone" className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-emerald-500" onChange={e => setFormData({...formData, phone: e.target.value})} />

            <button type="submit" disabled={loading} className="w-full p-4 rounded-xl bg-emerald-500 font-bold hover:bg-emerald-400 mt-6 shadow-[0_0_15px_rgba(52,211,113,0.3)] disabled:opacity-50">
              {loading ? "Registrando e Conectando..." : "Finalizar Cadastro de Identidade"}
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

      <nav className="flex sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-white/10 p-2 items-center">
        <button onClick={() => setDashboardTab('OVERVIEW')} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-colors ${dashboardTab === 'OVERVIEW' ? 'bg-white/10 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>Visão Geral</button>
        <button onClick={() => setDashboardTab('PROFILE')} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-colors ${dashboardTab === 'PROFILE' ? 'bg-white/10 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>Dados Pessoais</button>
        <button onClick={handleLogout} className="ml-2 px-4 py-3 text-sm font-bold rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors" title="Sair da conta">Sair</button>
      </nav>

      {dashboardTab === 'PROFILE' && (
        <main className="p-6 max-w-md mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex flex-col items-center mt-6">
            <div className="relative">
              {citizen.facePhotoUrl ? (
                <img src={citizen.facePhotoUrl} className="w-32 h-32 rounded-full object-cover border-4 border-emerald-500 shadow-[0_0_20px_rgba(52,211,113,0.3)] scale-x-[-1]" />
              ) : (
                <div className="w-32 h-32 rounded-full bg-slate-800 flex items-center justify-center text-4xl">👤</div>
              )}
              <div className="absolute bottom-0 right-0 bg-emerald-500 p-2 rounded-full border-2 border-slate-950 text-xs">✅</div>
            </div>
            <h2 className="text-2xl font-bold mt-4">{citizen.name}</h2>
            <p className="text-slate-400 font-mono text-sm">{citizen.walletAddress}</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <div><p className="text-xs text-slate-500 uppercase font-bold">CPF</p><p className="text-slate-200">{citizen.cpf}</p></div>
            <div><p className="text-xs text-slate-500 uppercase font-bold">E-mail</p><p className="text-slate-200">{citizen.email}</p></div>
            <div><p className="text-xs text-slate-500 uppercase font-bold">Telefone</p><p className="text-slate-200">{citizen.phone}</p></div>
            <div><p className="text-xs text-slate-500 uppercase font-bold">Endereço Completo</p><p className="text-slate-200">{citizen.address}</p></div>
            <div><p className="text-xs text-slate-500 uppercase font-bold">Membro desde</p><p className="text-slate-200">{new Date(citizen.createdAt).toLocaleDateString()}</p></div>
            {citizen.credentialId && (
              <div className="pt-2 border-t border-white/10">
                <p className="text-xs text-emerald-400 font-bold">🔐 Biometria cadastrada neste dispositivo</p>
              </div>
            )}
          </div>
        </main>
      )}

      {dashboardTab === 'OVERVIEW' && (
        <main className="p-6 max-w-md mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <section className="p-8 rounded-3xl bg-white/5 border border-white/10 shadow-2xl relative overflow-hidden">
            <p className="text-sm text-slate-400">Saldo Consolidado</p>
            <div className="flex items-end gap-2 mb-6">
              <h2 className="text-5xl font-black">{citizen.totalPoints}</h2>
              <span className="text-emerald-400 font-bold mb-1">SOLID</span>
            </div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-emerald-300 font-bold">{levelInfo.name}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 transition-all duration-1000" style={{ width: `${levelInfo.max ? 100 : (citizen.totalPoints / levelInfo.next) * 100}%` }}></div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-4">
            <button onClick={() => openActionModal('RECYCLING', 50, '♻️', 'Reciclagem')} className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-500 flex flex-col items-center gap-2">
              <span className="text-3xl">♻️</span><span className="font-bold text-sm">Reciclar</span>
            </button>
            <button onClick={() => openActionModal('BLOOD_DONATION', 100, '🩸', 'Doar Sangue')} className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-red-500 flex flex-col items-center gap-2">
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
                        <div><p className="font-bold text-sm">{tx.title}</p><p className="text-xs text-slate-400">{tx.date}</p></div>
                      </div>
                      <span className="text-emerald-400 font-bold">{tx.points}</span>
                    </div>
                    {(tx.lat && tx.lng) && <p className="text-[10px] text-cyan-500 font-mono mb-2">{tx.address ? `📍 ${tx.address.substring(0, 120)}${tx.address.length > 120 ? '...' : ''}` : `GPS: ${tx.lat.toFixed(5)}, ${tx.lng.toFixed(5)}`}</p>}
                    {tx.img && <img src={tx.img} className="w-full h-24 object-cover rounded-lg mb-2 opacity-90 border border-slate-700" />}
                    <p className="text-[10px] text-slate-500 font-mono">Blockchain: {tx.tx}</p>
                  </div>
                ))}
            </div>
          </section>
        </main>
      )}

      {actionModal && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col p-4">
          <div className="mt-auto bg-slate-900 border border-emerald-500/30 p-6 rounded-3xl w-full max-w-md mx-auto space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">Auditoria de Ação</h3>
              <button onClick={() => {setActionModal(null); setImagePreview(null)}} className="text-2xl">&times;</button>
            </div>

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
    </div>
  );
}
