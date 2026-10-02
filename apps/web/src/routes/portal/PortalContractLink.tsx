import { API_URL } from '../../lib/api';
import { usePortalContract } from '../../hooks/useContracts';

export function PortalContractLink({ eventId }: { eventId: string }) {
  const { data } = usePortalContract(eventId);
  if (!data?.contract) return null;

  return (
    <a
      href={`${API_URL}/api/v1/portal/events/${eventId}/contract/file`}
      target="_blank"
      rel="noreferrer"
      className="mt-3 inline-flex items-center gap-1.5 text-sm text-gold hover:underline"
    >
      Ver contrato
    </a>
  );
}
