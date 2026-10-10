import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CommissionAdvanceInput,
  EmployeeInput,
  EmployeeTimeEntryInput,
  EventStaffAssignmentInput,
  PayrollConfirmInput,
} from '@raphael-eventos/shared';
import { api } from '../lib/api';

export function useEmployees() {
  return useQuery({ queryKey: ['admin', 'employees'], queryFn: api.listEmployees });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EmployeeInput) => api.createEmployee(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'employees'] }),
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: EmployeeInput }) =>
      api.updateEmployee(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'employees'] }),
  });
}

export function useGrantDoorAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (employeeId: string) => api.grantDoorAccess(employeeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'employees'] }),
  });
}

export function useEventStaff(eventId: string) {
  return useQuery({
    queryKey: ['admin', 'events', eventId, 'staff'],
    queryFn: () => api.listEventStaff(eventId),
  });
}

export function useAssignStaff(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EventStaffAssignmentInput) => api.assignStaff(eventId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events', eventId, 'staff'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'events', eventId, 'costing'] });
    },
  });
}

export function useUnassignStaff(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) => api.unassignStaff(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events', eventId, 'staff'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'events', eventId, 'costing'] });
    },
  });
}

export function useTimeEntries(employeeId: string) {
  return useQuery({
    queryKey: ['admin', 'employees', employeeId, 'time-entries'],
    queryFn: () => api.listTimeEntries(employeeId),
  });
}

export function useRecordTimeEntry(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EmployeeTimeEntryInput) => api.recordTimeEntry(employeeId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'employees', employeeId, 'time-entries'],
      });
      // Cambia lo que sugiere el borrador de liquidación.
      queryClient.invalidateQueries({
        queryKey: ['admin', 'employees', employeeId, 'payroll-preview'],
      });
    },
  });
}

export function usePayrollEntries(employeeId: string) {
  return useQuery({
    queryKey: ['admin', 'employees', employeeId, 'payroll'],
    queryFn: () => api.listPayrollEntries(employeeId),
  });
}

export function usePayrollPreview(employeeId: string, period: string) {
  return useQuery({
    queryKey: ['admin', 'employees', employeeId, 'payroll-preview', period],
    queryFn: () => api.previewPayroll(employeeId, period),
    select: (data) => data.preview,
    enabled: /^\d{4}-\d{2}$/.test(period),
  });
}

export function useConfirmPayroll(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PayrollConfirmInput) => api.confirmPayroll(employeeId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'employees', employeeId] });
      // La liquidación genera un gasto del mes: cambia el costeo.
      queryClient.invalidateQueries({ queryKey: ['admin', 'expenses'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
    },
  });
}

export function useCommissionAdvances(employeeId: string) {
  return useQuery({
    queryKey: ['admin', 'employees', employeeId, 'commission-advances'],
    queryFn: () => api.listCommissionAdvances(employeeId),
  });
}

export function useRecordCommissionAdvance(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CommissionAdvanceInput) => api.recordCommissionAdvance(employeeId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'employees', employeeId, 'commission-advances'],
      });
      // Cambia lo que sugiere el borrador de liquidación.
      queryClient.invalidateQueries({
        queryKey: ['admin', 'employees', employeeId, 'payroll-preview'],
      });
    },
  });
}
