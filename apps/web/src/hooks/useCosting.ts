import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  EventServiceCostInput,
  EventSupplyLineInput,
  FixedCostCategoryInput,
  ServiceCostCategoryInput,
  SupplyCategoryInput,
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'cost-config'] }),
  });
}

export function useSupplyCategories() {
  return useQuery({ queryKey: ['admin', 'supply-categories'], queryFn: api.listSupplyCategories });
}

export function useCreateSupplyCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SupplyCategoryInput) => api.createSupplyCategory(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'supply-categories'] }),
  });
}

export function useDeleteSupplyCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSupplyCategory(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'supply-categories'] }),
  });
}

export function useServiceCostCategories() {
  return useQuery({
    queryKey: ['admin', 'service-cost-categories'],
    queryFn: api.listServiceCostCategories,
  });
}

export function useCreateServiceCostCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ServiceCostCategoryInput) => api.createServiceCostCategory(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'service-cost-categories'] }),
  });
}

export function useDeleteServiceCostCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteServiceCostCategory(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'service-cost-categories'] }),
  });
}

export function useFixedCostCategories() {
  return useQuery({
    queryKey: ['admin', 'fixed-cost-categories'],
    queryFn: api.listFixedCostCategories,
  });
}

export function useCreateFixedCostCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FixedCostCategoryInput) => api.createFixedCostCategory(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'fixed-cost-categories'] }),
  });
}

export function useUpdateFixedCostCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: FixedCostCategoryInput }) =>
      api.updateFixedCostCategory(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'fixed-cost-categories'] }),
  });
}

export function useDeleteFixedCostCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteFixedCostCategory(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'fixed-cost-categories'] }),
  });
}

export function useEventCosting(eventId: string | undefined, guestCount?: number) {
  return useQuery({
    queryKey: ['admin', 'events', eventId, 'costing', guestCount],
    queryFn: () => api.getEventCosting(eventId!, guestCount),
    enabled: Boolean(eventId),
  });
}

function invalidateCosting(queryClient: ReturnType<typeof useQueryClient>, eventId: string) {
  queryClient.invalidateQueries({ queryKey: ['admin', 'events', eventId, 'costing'] });
}

export function useCreateSupplyLine(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EventSupplyLineInput) => api.createEventSupplyLine(eventId, input),
    onSuccess: () => invalidateCosting(queryClient, eventId),
  });
}

export function useDeleteSupplyLine(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteEventSupplyLine(id),
    onSuccess: () => invalidateCosting(queryClient, eventId),
  });
}

export function useCreateServiceCost(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EventServiceCostInput) => api.createEventServiceCost(eventId, input),
    onSuccess: () => invalidateCosting(queryClient, eventId),
  });
}

export function useDeleteServiceCost(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteEventServiceCost(id),
    onSuccess: () => invalidateCosting(queryClient, eventId),
  });
}
