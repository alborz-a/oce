// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
/**
 * Task counts for the signed-in user (nav pills on «وظایف»).
 *
 * `overdue`: my open tasks due before today (red pill).
 * `open`: my open tasks due today or later (green pill).
 * Source: `GET /v1/tasks/my-counts/`. Returns zeros while loading or on error,
 * so the pills stay hidden instead of showing a failure.
 */

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/shared/lib/api';

export const MY_TASK_COUNTS_KEY = ['tasks-my-counts'] as const;

export interface MyTaskCounts {
  overdue: number;
  open: number;
}

const EMPTY: MyTaskCounts = { overdue: 0, open: 0 };

export function useMyTaskCounts(): MyTaskCounts {
  const { data } = useQuery({
    queryKey: MY_TASK_COUNTS_KEY,
    queryFn: () => apiGet<MyTaskCounts>('/v1/tasks/my-counts/'),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return data ?? EMPTY;
}
