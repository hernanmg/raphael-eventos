import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useAssignStaff,
  useEmployees,
  useEventStaff,
  useUnassignStaff,
} from '../../../hooks/useStaff';

export function EventStaffSection({ eventId }: { eventId: string }) {
  const { data } = useEventStaff(eventId);
  const { data: employeesData } = useEmployees();
  const assign = useAssignStaff(eventId);
  const unassign = useUnassignStaff(eventId);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  const activeEmployees = employeesData?.employees.filter((e) => e.active) ?? [];
  const assignedIds = new Set((data?.assignments ?? []).map((a) => a.employeeId));
  const availableEmployees = activeEmployees.filter((e) => !assignedIds.has(e.id));

  function handleAssign() {
    if (!selectedEmployeeId) return;
    assign.mutate(
      { employeeId: selectedEmployeeId },
      { onSuccess: () => setSelectedEmployeeId('') },
    );
  }

  return (
    <div className="mt-10 rounded-2xl border border-line bg-paper p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold">Personal asignado</h2>
        <Link to="/admin/personal" className="text-xs text-muted hover:text-ink">
          Ver empleados →
        </Link>
      </div>

      {data && data.assignments.length === 0 && (
        <p className="mt-2 text-sm text-muted">Todavía no hay nadie asignado a este evento.</p>
      )}

      {data && data.assignments.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {data.assignments.map((assignment) => (
            <li
              key={assignment.id}
              className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm"
            >
              <span>
                {assignment.employeeName}
                {assignment.note && (
                  <span className="ml-2 text-xs text-muted">{assignment.note}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => unassign.mutate(assignment.id)}
                className="text-xs text-muted hover:text-red-600"
              >
                Desasignar
              </button>
            </li>
          ))}
        </ul>
      )}

      {availableEmployees.length > 0 && (
        <div className="mt-3 flex gap-2">
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-ink"
          >
            <option value="">Elegí un empleado…</option>
            {availableEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAssign}
            disabled={!selectedEmployeeId || assign.isPending}
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
          >
            Asignar
          </button>
        </div>
      )}
    </div>
  );
}
