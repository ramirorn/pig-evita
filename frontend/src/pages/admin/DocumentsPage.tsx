// ===========================================
// Documents Admin Page
// ===========================================
import { useState } from 'react';
import { FileText, CheckCircle, XCircle, Search, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
import { PageHeader } from '@/components/shared/PageHeader';
import { usePermisos } from '@/hooks/usePermisos';

export function DocumentsPage() {
  // R22 — validar o rechazar un documento es acto administrativo
  // (`DOCUMENT_REVIEW`): DELEGADO y COORDINADOR ven la pantalla pero no revisan.
  const { puede } = usePermisos();
  const puedeRevisar = puede('DOCUMENT_REVIEW');
  const [search, setSearch] = useState('');

  const pendingReviews = [
    { id: '1', participant: 'Pérez, Juan', dni: '45123456', documentType: 'DNI', submittedAt: '2026-07-20' },
    { id: '2', participant: 'López, María', dni: '46987654', documentType: 'Ficha Médica', submittedAt: '2026-07-21' },
    { id: '3', participant: 'García, Carlos', dni: '44111222', documentType: 'Autorización Menor', submittedAt: '2026-07-21' },
  ];

  const filtered = pendingReviews.filter(
    (doc) =>
      doc.participant.toLowerCase().includes(search.toLowerCase()) ||
      doc.dni.includes(search),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Documentos"
        description="Revisión y validación de documentación deportiva y médica"
        icon={<FileText className="w-5 h-5 text-white" />}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-3">
            <FileText className="w-6 h-6 text-orange-600" />
          </div>
          <h3 className="text-3xl font-bold text-primary-900">12</h3>
          <p className="text-sm text-primary-500">Pendientes de Revisión</p>
        </div>
        <div className="card p-6 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-3xl font-bold text-primary-900">845</h3>
          <p className="text-sm text-primary-500">Aprobados</p>
        </div>
        <div className="card p-6 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-3">
            <XCircle className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-3xl font-bold text-primary-900">3</h3>
          <p className="text-sm text-primary-500">Rechazados Recientemente</p>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b border-primary-100 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
            <Input 
              placeholder="Buscar por DNI o Apellido..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Participante</TableHead>
              <TableHead>DNI</TableHead>
              <TableHead>Tipo de Documento</TableHead>
              <TableHead>Fecha de Envío</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-[120px] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium text-primary-900">{doc.participant}</TableCell>
                <TableCell className="text-primary-600">{doc.dni}</TableCell>
                <TableCell>{doc.documentType}</TableCell>
                <TableCell>{doc.submittedAt}</TableCell>
                <TableCell>
                  <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200">
                    Pendiente
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {puedeRevisar && (
                    <Button variant="outline" size="sm" className="gap-2">
                      <Eye className="w-4 h-4" />
                      Revisar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
