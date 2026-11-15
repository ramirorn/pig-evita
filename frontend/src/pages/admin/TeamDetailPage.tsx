// ===========================================
// Team Detail Page (Member Management)
// ===========================================
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { UsersRound, Plus, Trash2, Loader2 } from 'lucide-react';
import { useTeam, useRemoveTeamMember } from '@/hooks/useTeams';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { TeamMember } from '@/types';
import { ROUTES } from '@/lib/constants';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { logError } from '@/lib/logger';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { DetailHeader } from './components/DetailHeader';
import { DetailLoading, DetailNotFound } from './components/DetailState';
import { FactList } from './components/FactList';

function AddMemberModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir jugador</DialogTitle>
          <DialogDescription>
            Busca y selecciona un participante registrado para añadirlo a este equipo.
          </DialogDescription>
        </DialogHeader>
        <div className="py-8 text-center text-primary-500">
          (Formulario de búsqueda de participantes pendiente)
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: team, isLoading } = useTeam(id || '');
  const removeMemberMutation = useRemoveTeamMember();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);

  const handleRemove = async () => {
    if (!team || !memberToRemove) return;
    try {
      await removeMemberMutation.mutateAsync({ teamId: team.id, participantId: memberToRemove.participantId });
      setMemberToRemove(null);
    } catch (e) {
      logError('TeamDetailPage.handleRemove', e);
    }
  };

  if (isLoading) return <DetailLoading label="Cargando el equipo…" />;

  if (!team) {
    return (
      <DetailNotFound
        title="No encontramos el equipo"
        hint="Puede que se haya eliminado o que el enlace esté incompleto."
        backLabel="Volver a equipos"
        onBack={() => navigate(ROUTES.TEAMS)}
      />
    );
  }

  const rosterColumns: DataTableColumn<TeamMember>[] = [
    {
      id: 'dni',
      header: 'DNI',
      mobile: 'secondary',
      className: 'text-primary-600 tabular-nums',
      cell: (member) => member.participant?.dni,
    },
    {
      id: 'player',
      header: 'Jugador',
      rowHeader: true,
      mobile: 'primary',
      className: 'font-medium text-primary-900',
      cell: (member) => (
        <>
          {member.participant?.lastName}, {member.participant?.firstName}
        </>
      ),
    },
    {
      id: 'number',
      header: 'Nº',
      mobile: 'secondary',
      className: 'tabular-nums',
      cell: (member) => member.shirtNumber || '-',
    },
    {
      id: 'position',
      header: 'Posición',
      mobile: 'secondary',
      cell: (member) => member.position || '-',
    },
    {
      id: 'role',
      header: 'Rol',
      mobile: 'secondary',
      cell: (member) =>
        member.isCaptain ? (
          <Badge variant="outline" className="bg-accent-50 text-accent-800 border-accent-300">
            Capitán
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-muted text-primary-700 border-primary-200">
            Jugador
          </Badge>
        ),
    },
    {
      id: 'actions',
      header: 'Quitar del equipo',
      hideHeader: true,
      interactive: true,
      mobile: 'actions',
      headClassName: 'w-[80px]',
      cell: (member) => (
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive-600 hover:text-destructive-700 hover:bg-destructive-50 active:bg-destructive-50"
          onClick={() => setMemberToRemove(member)}
          aria-label={`Quitar a ${member.participant?.lastName ?? ''} ${member.participant?.firstName ?? ''} del equipo`.replace(/s+/g, ' ')}
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Equipos', path: ROUTES.TEAMS },
          { label: team.name },
        ]}
      />

      <DetailHeader
        title={team.name}
        meta={
          <>
            {team.locality}, {team.department} · {team.discipline?.name} · {team.category?.name}
          </>
        }
        backLabel="Volver a equipos"
        onBack={() => navigate(ROUTES.TEAMS)}
        actions={
          <Button onClick={() => setIsAddModalOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" aria-hidden="true" />
            Añadir jugador
          </Button>
        }
      />

      <div className="grid gap-6 md:grid-cols-4">
        <section aria-labelledby="equipo-info" className="card p-5 space-y-4 md:col-span-1 self-start">
          <h2 id="equipo-info" className="type-h2 text-primary-900">
            Información
          </h2>
          <FactList
            className="sm:grid-cols-1"
            facts={[
              { label: 'Disciplina', value: team.discipline?.name ?? '—' },
              { label: 'Categoría', value: team.category?.name ?? '—' },
              {
                label: 'Jugadores',
                value: `${team.members?.length || 0} de ${team.discipline?.maxPlayers ?? '—'}`,
              },
            ]}
          />
        </section>

        {/* Roster Table */}
        <DataTable
          className="md:col-span-3"
          entityName="jugadores"
          columns={rosterColumns}
          rows={team.members ?? []}
          getRowId={(member) => member.id}
          isLoading={false}
          emptyIcon={<UsersRound className="w-10 h-10" />}
          emptyTitle="No hay jugadores registrados en este equipo"
          emptyDescription="Añadí jugadores para armar la lista de buena fe."
          toolbar={
            <h2 className="type-h2 text-primary-900 flex items-center gap-2">
              <UsersRound className="w-5 h-5 text-primary-500" aria-hidden="true" />
              Lista de buena fe
            </h2>
          }
        />
      </div>

      <AddMemberModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />

      <Dialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quitar jugador del equipo</DialogTitle>
            <DialogDescription>
              ¿Querés quitar a {memberToRemove?.participant?.firstName} {memberToRemove?.participant?.lastName} del equipo? Esta acción puede requerir re-verificación de la lista de buena fe.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3 mt-4">
            <Button variant="outline" onClick={() => setMemberToRemove(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={removeMemberMutation.isPending}>
              {removeMemberMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
              Quitar del equipo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
