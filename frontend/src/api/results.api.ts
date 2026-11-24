// ===========================================
// Results API
// ===========================================
import apiClient from './client';
import type { Result } from '@/types';

/**
 * Un `MatchResultDto` del backend: qué fila de `Result` se actualiza y con qué.
 *
 * Antes este tipo describía otra forma (`teamId`/`scoreData` sueltos) que el
 * backend rechaza; nadie lo usaba, así que nadie lo notó (F-32).
 */
export interface MatchResultPayload {
  resultId: string;
  data: {
    scoreData?: Record<string, unknown>;
    ranking?: number;
    isWinner?: boolean;
  };
}

/**
 * Una fila de `GET /results/rankings/competition/:id` (F-33).
 *
 * El backend devuelve `{ id, name, played, won, drawn, lost, points, position }`:
 * el nombre ya viene armado (equipo o "Nombre Apellido") e `id` es el del
 * equipo o el participante. `drawn` y `position` son opcionales porque una API
 * anterior no los mandaba; la página numera por índice si falta `position`.
 */
export interface RankingEntry {
  id: string;
  name: string;
  played: number;
  won: number;
  drawn?: number;
  lost: number;
  points: number;
  position?: number;
  /** Sólo en FASE_GRUPOS: la posición se reinicia en cada grupo. */
  group?: string;
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
