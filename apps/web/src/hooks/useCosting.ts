import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CostCategoryInput,
  ExpenseInput,
  TenantCostConfigInput,
} from '@raphael-eventos/shared';
import { api } from '../lib/api';

export function useCostConfig() {
  return useQuery({ queryKey: ['admin', 'cost-config'], queryFn: api.getCostConfig });
}

export function useUpdateCostConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TenantCostConfigInput) => api.updateCostConfig(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'cost-config'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
    },
  });
}

export function useCostCategories() {
  return useQuery({ queryKey: ['admin', 'cost-categories'], queryFn: api.listCostCategories });
}

/** Cambiar un rubro mueve el costeo (montos estimados, nombres en proveedores). */
function invalidateCosting(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['admin', 'cost-categories'] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'expenses'] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
}

export function useCreateCostCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CostCategoryInput) => api.createCostCategory(input),
    onSuccess: () => invalidateCosting(queryClient),
  });
}

export function useUpdateCostCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CostCategoryInput }) =>
      api.updateCostCategory(id, input),
    onSuccess: () => invalidateCosting(queryClient),
  });
}

export function useDeleteCostCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCostCategory(id),
    onSuccess: () => invalidateCosting(queryClient),
  });
}

export function useExpenses(filter: { eventId?: string; month?: string }) {
  return useQuery({
    queryKey: ['admin', 'expenses', filter],
    queryFn: () => api.listExpenses(filter),
    select: (data) => data.list,
  });
}

export function useSaveExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
      receipt,
    }: {
      id: string | null;
      input: ExpenseInput;
      receipt: File | null;
    }) => api.saveExpense(id, input, receipt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'expenses'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'expenses'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
    },
  });
}

export function useEventCosting(eventId: string | undefined, guestCount?: number) {
  return useQuery({
    queryKey: ['admin', 'events', eventId, 'costing', guestCount],
    queryFn: () => api.getEventCosting(eventId!, guestCount),
    enabled: Boolean(eventId),
  });
}
