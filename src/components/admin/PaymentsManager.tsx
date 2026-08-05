import React, { useEffect, useState, useCallback } from 'react';

interface PaymentItem {
  albumName: string;
  childName: string;
  price: number;
}

interface Payment {
  id: string;
  mpPaymentId: string;
  externalReference: string;
  status: string;
  amount: number;
  qrCode: string;
  email: string;
  createdAt: string;
  items: PaymentItem[];
}

interface Stats {
  revenue: number;
  approved: number;
  pending: number;
  rejected: number;
}

interface PaymentsManagerProps {
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const API_URL = import.meta.env.PUBLIC_API_URL;

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  approved:   { label: 'Aprovado',  classes: 'bg-green-100 text-green-700' },
  pending:    { label: 'Pendente',  classes: 'bg-yellow-100 text-yellow-700' },
  in_process: { label: 'Pendente',  classes: 'bg-yellow-100 text-yellow-700' },
  rejected:   { label: 'Recusado', classes: 'bg-red-100 text-red-700' },
  cancelled:  { label: 'Cancelado', classes: 'bg-gray-100 text-gray-600' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, classes: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}

function fmt(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function PaymentsManager({ authenticatedFetch }: PaymentsManagerProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const LIMIT = 20;

  const load = useCallback(async (p = page, s = statusFilter) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT), status: s });
      const res = await authenticatedFetch(`${API_URL}/api/payments/admin/list?${params}`);
      const json = await res.json();
      if (json.success) {
        setPayments(json.data.payments);
        setStats(json.data.stats);
        setTotal(json.data.total);
        setLastUpdated(new Date());
      }
    } catch {
      // erro silencioso — UI não quebra
    } finally {
      setIsLoading(false);
    }
  }, [authenticatedFetch, page, statusFilter]);

  useEffect(() => {
    load(page, statusFilter);
  }, [page, statusFilter]);

  useEffect(() => {
    const interval = setInterval(() => load(page, statusFilter), 30_000);
    return () => clearInterval(interval);
  }, [load, page, statusFilter]);

  function handleFilterChange(s: string) {
    setStatusFilter(s);
    setPage(1);
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pagamentos</h1>
          {lastUpdated && (
            <p className="text-xs text-gray-400 mt-0.5">
              Atualizado às {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              {' · '}atualiza automaticamente a cada 30s
            </p>
          )}
        </div>
        <button
          onClick={() => load(page, statusFilter)}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          <span className={isLoading ? 'animate-spin' : ''}>↻</span>
          Atualizar
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Faturamento</p>
            <p className="text-2xl font-bold text-green-600">{fmt(stats.revenue)}</p>
            <p className="text-xs text-gray-400 mt-0.5">pagamentos aprovados</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Aprovados</p>
            <p className="text-2xl font-bold text-gray-900">{stats.approved}</p>
            <p className="text-xs text-gray-400 mt-0.5">pedidos confirmados</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Pendentes</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            <p className="text-xs text-gray-400 mt-0.5">aguardando confirmação</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Recusados</p>
            <p className="text-2xl font-bold text-red-500">{stats.rejected}</p>
            <p className="text-xs text-gray-400 mt-0.5">não processados</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-2">
        {['all', 'approved', 'pending', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => handleFilterChange(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {{ all: 'Todos', approved: 'Aprovados', pending: 'Pendentes', rejected: 'Recusados' }[s]}
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-400">{total} resultado{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
        {isLoading && payments.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            Carregando...
          </div>
        ) : payments.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            Nenhum pagamento encontrado
          </div>
        ) : (
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Data</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">E-mail</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Método</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p) => (
                <React.Fragment key={p.id}>
                  <tr
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  >
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-900 max-w-[180px] truncate">{p.email}</td>
                    <td className="px-4 py-3">
                      <span className="text-base" title={p.qrCode ? 'PIX' : 'Cartão'}>
                        {p.qrCode ? '⚡' : '💳'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                      {fmt(p.amount)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs text-right">
                      {expandedId === p.id ? '▲' : '▼'}
                    </td>
                  </tr>
                  {expandedId === p.id && (
                    <tr className="bg-blue-50">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                            <span><strong className="text-gray-700">Ref:</strong> {p.externalReference}</span>
                            <span><strong className="text-gray-700">MP ID:</strong> {p.mpPaymentId}</span>
                          </div>
                          {p.items.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-1">
                              {p.items.map((item, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 bg-white border border-gray-200 px-2 py-1 rounded-lg text-xs text-gray-700"
                                >
                                  <span className="font-medium">{item.childName}</span>
                                  <span className="text-gray-400">·</span>
                                  <span>{item.albumName}</span>
                                  <span className="text-gray-400 ml-1">{fmt(item.price)}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            ← Anterior
          </button>
          <span className="text-sm text-gray-500">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}
