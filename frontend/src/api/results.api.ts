// ===========================================
// Results API
// ===========================================
import apiClient from './client';
import type { Result } from '@/types';

export interface MatchResultPayload {
  participantId?: string;
  teamId?: string;
  scoreData: Record<string, unknown>;
  ranking?: number;
  isWinner?: boolean;
}

export interface RankingEntry {
  position: number;
  participantId?: string;
  teamId?: string;
  participant?: { firstName: string; lastName: string; dni: string };
  team?: { name: string; locality: string };
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  scoreFor?: number;
  scoreAgainst?: number;
}

export const resultsApi = {
  /** Update/load results for a match */
  async updateMatchResults(matchId: string, results: MatchResultPayload[]): Promise<Result[]> {
    const { data } = await apiClient.patch<Result[]>(`/results/match/${matchId}`, results);
    return data;
  },

  /** Get rankings for a competition */
  async getRankings(competitionId: string): Promise<RankingEntry[]> {
    const { data } = await apiClient.get<RankingEntry[]>(`/results/rankings/competition/${competitionId}`);
    return data;
  },
};
