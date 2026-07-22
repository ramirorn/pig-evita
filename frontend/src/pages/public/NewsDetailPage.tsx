import { useParams, useNavigate } from 'react-router';
import { Newspaper, ArrowLeft, Loader2, Calendar, Share2 } from 'lucide-react';
import { useNewsBySlug } from '@/hooks/useNews';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function NewsDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const { data: news, isLoading } = useNewsBySlug(slug || '');

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="w-12 h-12 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!news) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold text-primary-800 mb-4">Noticia no encontrada</h2>
        <Button onClick={() => navigate('/noticias')}>Volver a Noticias</Button>
      </div>
    );
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: news.title,
        text: news.excerpt || undefined,
        url: window.location.href,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Enlace copiado al portapapeles');
    }
  };

  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
      <Button variant="ghost" className="mb-8 -ml-4" onClick={() => navigate('/noticias')}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver a Noticias
      </Button>

      <div className="mb-10 text-center">
        <Badge variant="outline" className="mb-4 bg-primary-50 text-primary-700 border-primary-200">
          Actualidad
        </Badge>
        <h1 className="text-4xl md:text-5xl font-bold text-primary-900 mb-6 leading-tight">
          {news.title}
        </h1>
        {news.excerpt && (
          <p className="text-xl text-primary-600 max-w-3xl mx-auto font-light">
            {news.excerpt}
          </p>
        )}
        <div className="flex items-center justify-center gap-6 mt-8 text-sm text-primary-500">
          <span className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {new Date(news.createdAt).toLocaleDateString('es-AR', {
              year: 'numeric', month: 'long', day: 'numeric'
            })}
          </span>
          <button 
            onClick={handleShare}
            className="flex items-center gap-2 hover:text-primary-700 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Compartir
          </button>
        </div>
      </div>

      {news.imageKey ? (
        <div className="w-full h-[400px] md:h-[500px] rounded-2xl overflow-hidden mb-12 shadow-lg">
          <img 
            src={news.imageKey} 
            alt={news.title} 
            className="w-full h-full object-cover" 
          />
        </div>
      ) : (
        <div className="w-full h-[300px] rounded-2xl bg-primary-100 flex items-center justify-center mb-12">
          <Newspaper className="w-24 h-24 text-primary-300" />
        </div>
      )}

      <div className="prose prose-lg prose-primary max-w-3xl mx-auto text-primary-800">
        <div dangerouslySetInnerHTML={{ __html: news.content.replace(/\n/g, '<br/>') }} />
      </div>
    </article>
  );
}
