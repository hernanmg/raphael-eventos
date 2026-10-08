import { useRef } from 'react';
import { API_URL } from '../../../lib/api';
import {
  useAdminContract,
  useDeleteContract,
  useUploadContract,
} from '../../../hooks/useContracts';
import { formatTimestamp } from '../../../lib/format';

export function AdminContractSection({ eventId }: { eventId: string }) {
  const { data, isLoading } = useAdminContract(eventId);
  const upload = useUploadContract(eventId);
  const remove = useDeleteContract(eventId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) upload.mutate(file);
  }

  if (isLoading) return null;

  return (
    <div className="mt-10 rounded-2xl border border-line bg-paper p-5">
      <h2 className="font-serif text-xl font-semibold">Contrato</h2>
      {data?.contract ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink">{data.contract.fileName}</p>
            <p className="text-xs text-muted">
              Subido el {formatTimestamp(data.contract.uploadedAt)}
            </p>
          </div>
          <div className="flex gap-3">
            <a
              href={`${API_URL}/api/v1/admin/events/${eventId}/contract/file`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-ink px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:bg-ink hover:text-white"
            >
              Descargar
            </a>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-muted hover:text-ink"
            >
              Reemplazar
            </button>
            <button
              type="button"
              onClick={() => remove.mutate()}
              className="text-xs text-muted hover:text-red-600"
            >
              Eliminar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-muted">Todavía no hay contrato cargado para este evento.</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={upload.isPending}
            className="mt-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
          >
            {upload.isPending ? 'Subiendo…' : 'Subir PDF'}
          </button>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />
      {upload.isError && <p className="mt-2 text-sm text-red-600">No pudimos subir el archivo.</p>}
    </div>
  );
}
