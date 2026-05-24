'use client';
import { useEffect } from 'react';

export default function AdminRedirect() {
  useEffect(() => { window.location.href = '/gestao'; }, []);
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <p className="text-slate-400">Redirecionando para portal de gestão...</p>
    </div>
  );
}
