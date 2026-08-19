// ===========================================
// React Query Hooks — Results
// ===========================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  resultsApi, 
  type MatchResultPayload
} from '@/api/results.api';
import { STALE_TIME } from '@/lib/queryClient';
import { toast } from 'sonner';

export const RESULT_KEYS = {
  all: ['results'] as const,
  rankings: (competitionId: string) => [...RESULT_KEYS.all, 'rankings', competitionId] as const,
};

export function useRankings(competitionId: string) {
  return useQuery({
    queryKey: RESULT_KEYS.rankings(competitionId),
    queryFn: () => resultsApi.getRankings(competitionId),
    enabled: !!competitionId,
    staleTime: STALE_TIME.LIVE,
  });
}

export function useSubmitMatchResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ matchId, results }: { matchId: string; results: MatchResultPayload[] }) => 
      resultsApi.updateMatchResults(matchId, results),
    onSuccess: () => {
      toast.success('Resultados cargados exitosamente');
      // Invalidate both matches and rankings
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: RESULT_KEYS.all });
    },
    onError: () => {
      toast.error('Error al cargar los resultados del partido');
    },
  });
}
