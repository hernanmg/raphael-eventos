import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import type { DoorAccessResult } from '@raphael-eventos/shared';
import { api } from '../../../lib/api';
import { errorText } from '../../../lib/guestLinks';
import { useClientDetail } from '../../../hooks/useAdmin';
import { ACCOUNT_ROLE_LABELS, EVENT_TYPE_LABELS, formatCurrency } from '../../../lib/format';

export default function ClientDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const { data, isLoading, isError } = useClientDetail(userId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/admin/clientes" className="text-sm text-muted hover:text-ink">
        ← Clientes
      </Link>

      {isLoading && <p className="mt-6 text-sm text-muted">Cargando…</p>}
      {isError && <p className="mt-6 text-sm text-red-600">No encontramos ese cliente.</p>}

      {data && (
        <div className="mt-4">
          <h1 className="font-serif text-3xl font-semibold">{data.client.fullName}</h1>
          <p className="mt-1 text-sm text-muted">
            {data.client.email}
            {data.client.phone && ` · ${data.client.phone}`}
          </p>
          <ResetPasswordBox userId={data.client.id} fullName={data.client.fullName} />

          <h2 className="mb-3 mt-8 font-serif text-xl font-semibold">
            Eventos ({data.client.events.length})
          </h2>

          {data.client.events.length === 0 ? (
            <p className="text-sm text-muted">Este cliente no tiene eventos vinculados todavía.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {data.client.events.map((event) => (
                <Link
                  key={event.eventAccountId}
                  to={`/admin/eventos/${event.eventId}`}
                  className="block rounded-2xl border border-line p-4 transition hover:border-ink"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-gold">
                        {EVENT_TYPE_LABELS[event.eventType]}
                      </span>
                      <p className="font-medium text-ink">{event.eventName}</p>
                      <p className="text-xs text-muted">
                        {ACCOUNT_ROLE_LABELS[event.role]}
                        {event.scope === 'aggregate' && ' · ve solo el agregado del evento'}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-muted">
                        Abonado {formatCurrency(event.totalPaid)} de{' '}
                        {formatCurrency(event.totalValue)}
                      </p>
                      <p className="font-semibold text-ink">Saldo {formatCurrency(event.saldo)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

/**
 * Contraseña temporal para un cliente que no puede entrar (no hay "olvidé mi
 * contraseña" por email todavía). Se muestra una sola vez.
 */
function ResetPasswordBox({ userId, fullName }: { userId: string; fullName: string }) {
  const [result, setResult] = useState<DoorAccessResult | null>(null);
  const [copied, setCopied] = useState(false);
  const reset = useMutation({
    mutationFn: () => api.resetClientPassword(userId),
    onSuccess: (data) => {
      setCopied(false);
      setResult(data);
    },
  });

  if (result) {
    const loginUrl = `${window.location.origin}/login`;
    const text = `Hola ${fullName}, te generamos una contraseña temporal para entrar a tu portal de Raphael Eventos.\n\nIngresá en ${loginUrl}\nEmail: ${result.email}\nContraseña temporal: ${result.temporaryPassword}\n\nAl entrar te va a pedir que elijas una propia.`;
    return (
      <div role="status" className="mt-4 rounded-xl border border-line bg-cream p-4 text-sm">
        <p className="font-medium text-ink">Contraseña temporal de {fullName}</p>
        <p className="mt-1 text-xs text-muted">
          Se muestra solo esta vez. Al entrar le va a pedir que elija una propia.
        </p>
        <p className="mt-2 font-mono text-lg tracking-wider text-ink">{result.temporaryPassword}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(result.temporaryPassword);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
            className="rounded-full bg-ink px-4 py-1.5 font-semibold text-white"
          >
            {copied ? 'Copiada ✓' : 'Copiar contraseña'}
          </button>
          <a
            href={`mailto:${result.email}?subject=${encodeURIComponent('Tu acceso a Raphael Eventos')}&body=${encodeURIComponent(text)}`}
            className="font-semibold text-ink underline"
          >
            Enviar por email
          </a>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="text-muted hover:text-ink"
          >
            Listo, ocultar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={reset.isPending}
        onClick={() => {
          if (
            window.confirm(
              `¿Generar una contraseña temporal para ${fullName}? La actual deja de funcionar.`,
            )
          ) {
            reset.mutate();
          }
        }}
        className="rounded-full border border-ink px-4 py-1.5 text-xs font-semibold text-ink transition hover:bg-ink hover:text-white disabled:opacity-60"
      >
        Generar contraseña temporal
      </button>
      {reset.error && <p className="mt-1 text-xs text-red-600">{errorText(reset.error)}</p>}
    </div>
  );
}
