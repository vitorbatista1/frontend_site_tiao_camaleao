import { useEffect, useState } from 'react';
import AlbumManager from './AlbumManager';

interface User {
  id: string;
  email: string;
  name: string;
}

type Section = 'albums';

const API_URL = import.meta.env.PUBLIC_API_URL;

export default function AdminPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>('albums');

  // Função para renovar o token
  async function refreshAccessToken(): Promise<string | null> {
    const refreshToken = sessionStorage.getItem('refreshToken');
    
    if (!refreshToken) {
      return null;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      const json = await response.json();

      if (response.ok && json.success) {
        const { accessToken } = json.data;
        sessionStorage.setItem('accessToken', accessToken);
        document.cookie = `auth_token=${accessToken}; path=/; SameSite=Strict`;
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
    
    // Função para fazer a requisição com o token atual
    const makeRequest = async (token: string) => {
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${token}`,
        },
      });
    };

    // Primeira tentativa
    let response = await makeRequest(accessToken!);

    // Se não autorizado, tenta renovar o token
    if (response.status === 401) {
      const newToken = await refreshAccessToken();
      
      if (newToken) {
        // Tenta novamente com o novo token
        response = await makeRequest(newToken);
      } else {
        // Não conseguiu renovar, redireciona para login
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('refreshToken');
        sessionStorage.removeItem('user');
        window.location.href = '/admin/login';
        throw new Error('Sessão expirada');
      }
    }

    return response;
  }

  useEffect(() => {
    const token = sessionStorage.getItem('accessToken');
    const stored = sessionStorage.getItem('user');

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
  }, []);

  function logout() {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
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
    { id: 'albums', label: 'Álbuns', icon: '🎵' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
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

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">
        {activeSection === 'albums' && (
          <AlbumManager authenticatedFetch={authenticatedFetch} />
        )}
      </main>
    </div>
  );
}