// ===========================================
// Team Detail Page (Member Management)
// ===========================================
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { UsersRound, ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';
import { useTeam, useRemoveTeamMember } from '@/hooks/useTeams';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

function AddMemberModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir Jugador</DialogTitle>
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-primary-800">Equipo no encontrado</h2>
        <Button variant="link" onClick={() => navigate(ROUTES.TEAMS)}>Volver a equipos</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Breadcrumbs
        items={[
          { label: 'Equipos', path: ROUTES.TEAMS },
          { label: team.name },
        ]}
      />

      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate(ROUTES.TEAMS)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-primary-800">{team.name}</h1>
          <div className="flex gap-2 text-sm text-primary-500 mt-1">
            <span>{team.department}, {team.locality}</span>
            <span>•</span>
            <span>{team.discipline?.name} - {team.category?.name}</span>
          </div>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Añadir Jugador
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {/* Team Stats/Info */}
        <div className="md:col-span-1 space-y-4">
          <div className="card p-4 space-y-4">
            <h3 className="font-semibold text-primary-900 border-b border-primary-100 pb-2">Información</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-primary-500">Disciplina</span>
                <span className="font-medium text-primary-900">{team.discipline?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-500">Categoría</span>
                <span className="font-medium text-primary-900">{team.category?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-500">Jugadores</span>
                <span className="font-medium text-primary-900">
                  {team.members?.length || 0} / {team.discipline?.maxPlayers || '-'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Roster Table */}
        <div className="md:col-span-3 card">
          <div className="p-4 border-b border-primary-100">
            <h2 className="text-lg font-semibold text-primary-900 flex items-center gap-2">
              <UsersRound className="w-5 h-5 text-primary-500" />
              Lista de Buena Fe
            </h2>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>DNI</TableHead>
                <TableHead>Jugador</TableHead>
                <TableHead>Nº</TableHead>
                <TableHead>Posición</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!team.members || team.members.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-primary-500">
                    No hay jugadores registrados en este equipo
                  </TableCell>
                </TableRow>
              ) : (
                team.members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="text-primary-600">{member.participant?.dni}</TableCell>
                    <TableCell className="font-medium text-primary-900">
                      {member.participant?.lastName}, {member.participant?.firstName}
                    </TableCell>
                    <TableCell>{member.shirtNumber || '-'}</TableCell>
                    <TableCell>{member.position || '-'}</TableCell>
                    <TableCell>
                      {member.isCaptain ? (
                        <Badge className="bg-yellow-500 hover:bg-yellow-600">Capitán</Badge>
                      ) : (
                        <Badge variant="secondary">Jugador</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setMemberToRemove(member)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AddMemberModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />

      <Dialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Jugador</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar a {memberToRemove?.participant?.firstName} del equipo? Esta acción puede requerir re-verificación de la lista de buena fe.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setMemberToRemove(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={removeMemberMutation.isPending}>
              {removeMemberMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
