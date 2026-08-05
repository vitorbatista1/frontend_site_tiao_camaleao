import { useEffect, useState } from 'react';
import AlbumManager from './AlbumManager';
import OrderBumpManager from './OrderBumpManager';
import PaymentsManager from './PaymentsManager';

interface User {
  id: string;
  email: string;
  name: string;
}

type Section = 'albums' | 'orderbumps' | 'payments';

const API_URL = import.meta.env.PUBLIC_API_URL;

export default function AdminPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>('payments');

  async function refreshAccessToken(): Promise<string | null> {
    const refreshToken = localStorage.getItem('refreshToken');

    if (!refreshToken) return null;

    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      const json = await response.json();

      if (response.ok && json.success) {
        const { accessToken, refreshToken: newRefreshToken } = json.data;
        sessionStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        return accessToken;
      }

      return null;
    } catch (error) {
      console.error('Erro ao renovar token:', error);
      return null;
    }
  }

  // Função para fazer requisições autenticadas com refresh automático
  async function authenticatedFetch(url: string, options: RequestInit = {}) {
    let accessToken = sessionStorage.getItem('accessToken');

    const makeRequest = async (token: string) => {
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${token}`,
        },
      });
    };

    let response = await makeRequest(accessToken!);

    if (response.status === 401) {
      const newToken = await refreshAccessToken();

      if (newToken) {
        response = await makeRequest(newToken);
      } else {
        sessionStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/admin/login';
        throw new Error('Sessão expirada');
      }
    }

    return response;
  }

  useEffect(() => {
    async function init() {
      let token = sessionStorage.getItem('accessToken');
      const stored = localStorage.getItem('user');

      if (!token) {
        token = await refreshAccessToken();
      }

      if (!token || !stored) {
        window.location.href = '/admin/login';
        return;
      }

      try {
        setUser(JSON.parse(stored));
      } catch {
        window.location.href = '/admin/login';
        return;
      }

      setReady(true);
    }

    init();
  }, []);

  function logout() {
    sessionStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    window.location.href = '/admin/login';
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Carregando...</p>
      </div>
    );
  }

  const navItems: { id: Section; label: string; icon: string }[] = [
    { id: 'payments', label: 'Pagamentos', icon: '💳' },
    { id: 'albums', label: 'Álbuns', icon: '🎵' },
    { id: 'orderbumps', label: 'Order Bumps', icon: '🎁' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">

      {/* ── Sidebar desktop ── */}
      <aside className="hidden md:flex w-56 bg-white border-r border-gray-200 flex-col flex-shrink-0">
        <div className="p-5 border-b border-gray-200">
          <p className="font-bold text-gray-800 text-sm">Tião Camaleão</p>
          <p className="text-xs text-gray-500 mt-0.5">Painel Admin</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeSection === item.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-gray-800 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <span>↩</span> Sair
          </button>
        </div>
      </aside>

      {/* ── Top bar mobile ── */}
      <div className="md:hidden bg-white border-b border-gray-200 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="font-bold text-gray-800 text-sm">Tião Camaleão</p>
            <p className="text-xs text-gray-400">{user?.name}</p>
          </div>
          <button
            onClick={logout}
            className="text-xs text-red-500 font-medium px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
          >
            ↩ Sair
          </button>
        </div>
        <nav className="flex border-t border-gray-100 overflow-x-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 px-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeSection === item.id
                  ? 'border-blue-600 text-blue-700 bg-blue-50'
                  : 'border-transparent text-gray-500'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 p-4 md:p-8 overflow-auto min-w-0">
        {activeSection === 'payments' && (
          <PaymentsManager authenticatedFetch={authenticatedFetch} />
        )}
        {activeSection === 'albums' && (
          <AlbumManager authenticatedFetch={authenticatedFetch} />
        )}
        {activeSection === 'orderbumps' && (
          <OrderBumpManager authenticatedFetch={authenticatedFetch} />
        )}
      </main>
    </div>
  );
}
