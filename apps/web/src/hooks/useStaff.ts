import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CommissionAdvanceInput,
  EmployeeInput,
  EmployeeTimeEntryInput,
  EventStaffAssignmentInput,
  PayrollPeriodInput,
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
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['admin', 'employees', employeeId, 'time-entries'],
      }),
  });
}

export function usePayrollEntries(employeeId: string) {
  return useQuery({
    queryKey: ['admin', 'employees', employeeId, 'payroll'],
    queryFn: () => api.listPayrollEntries(employeeId),
  });
}

export function useComputePayroll(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PayrollPeriodInput) => api.computePayroll(employeeId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'employees', employeeId, 'payroll'] });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'employees', employeeId, 'commission-advances'],
      });
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
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['admin', 'employees', employeeId, 'commission-advances'],
      }),
  });
}
