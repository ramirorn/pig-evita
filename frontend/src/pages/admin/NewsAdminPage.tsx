// ===========================================
// News Admin Page
// ===========================================
import { useState } from 'react';
import { Newspaper, Search, Plus, Loader2 } from 'lucide-react';
import { useNewsList } from '@/hooks/useNews';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export function NewsAdminPage() {
  const [search, setSearch] = useState('');
  const { data: newsData, isLoading } = useNewsList();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-sm">
            <Newspaper className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary-800">Noticias</h1>
            <p className="text-sm text-primary-500">Gestión de novedades y artículos públicos</p>
          </div>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Crear Noticia
        </Button>
      </div>

      <div className="card p-4 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
          <Input 
            placeholder="Buscar noticias por título..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="card p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-primary-500">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p>Cargando noticias...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-primary-500 uppercase bg-primary-50 border-b border-primary-100">
                <tr>
                  <th className="px-6 py-3">Noticia</th>
                  <th className="px-6 py-3">Fecha de Publicación</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-100">
                {newsData?.data.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-primary-500">
                      No se encontraron noticias.
                    </td>
                  </tr>
                ) : (
                  newsData?.data.map((news) => (
                    <tr key={news.id} className="hover:bg-primary-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-primary-900 line-clamp-1">{news.title}</div>
                        <div className="text-xs text-primary-500 line-clamp-1 mt-1">{news.excerpt}</div>
                      </td>
                      <td className="px-6 py-4 text-primary-600">
                        {news.publishedAt ? new Date(news.publishedAt).toLocaleDateString() : 'No publicada'}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={
                          news.isPublished ? 'text-green-600 bg-green-50 border-green-200' : 'text-orange-600 bg-orange-50 border-orange-200'
                        }>
                          {news.isPublished ? 'Publicada' : 'Borrador'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm">
                          Editar
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
