// ===========================================
// News Admin Page
// ===========================================
import { useState } from 'react';
import { Newspaper, Search, Plus, Pencil } from 'lucide-react';
import { useNewsList } from '@/hooks/useNews';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { SkeletonTable } from '@/components/shared/SkeletonTable';
import { EmptyState } from '@/components/shared/EmptyState';

export function NewsAdminPage() {
  const [search, setSearch] = useState('');
  const { data: newsData, isLoading } = useNewsList();

  const filtered = (newsData?.data || []).filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Noticias"
        description="Gestión de novedades y artículos públicos"
        icon={<Newspaper className="w-5 h-5 text-white" />}
        actions={
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Crear Noticia
          </Button>
        }
      />

      <div className="card">
        <div className="p-4 border-b border-primary-100 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
            <Input 
              placeholder="Buscar noticias por título..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="relative">
          {isLoading ? (
            <SkeletonTable rows={5} columns={4} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Newspaper className="w-10 h-10" />}
              title="Sin noticias"
              description="No se encontraron artículos o novedades cargadas."
              action={
                <Button className="gap-2">
                  <Plus className="w-4 h-4" /> Crear Noticia
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Noticia</TableHead>
                  <TableHead>Fecha de Publicación</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[100px] text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-primary-900">
                      <div>
                        <p className="font-semibold">{item.title}</p>
                        {item.excerpt && <p className="text-xs text-primary-500 line-clamp-1">{item.excerpt}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-primary-600">
                      {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('es-AR') : 'Borrador'}
                    </TableCell>
                    <TableCell>
                      {item.isPublished ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                          Publicado
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Borrador</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
