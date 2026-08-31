import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  Newspaper,
  ArrowLeft,
  Loader2,
  Calendar,
  Share2,
  Clock,
  Check,
  ExternalLink,
} from 'lucide-react';
import { useNewsBySlug } from '@/hooks/useNews';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate, safeImageSrc } from '@/lib/utils';
import { PlainTextContent } from '@/components/shared/PlainTextContent';
import { esNoticiaExterna, hostDeLaFuente } from './news/newsSource';
import { logError } from '@/lib/logger';
import { copiarAlPortapapeles, MENSAJE_COPIA_FALLIDA } from '@/lib/clipboard';
import { toast } from 'sonner';

export function NewsDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);

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
      navigator
        .share({
          title: news.title,
          text: news.excerpt || undefined,
          url: window.location.href,
        })
        .catch((error: unknown) => {
          // `navigator.share` rechaza con AbortError cuando el usuario cierra
          // la hoja de compartir. Eso no es una falla: mostrar un toast ahí
          // sería ruido por una acción deliberada del usuario.
          if (error instanceof DOMException && error.name === 'AbortError') return;
          logError('NewsDetailPage.handleShare', error);
          // Este catch se tragaba el error en silencio: si compartir falla de
          // verdad, le ofrecemos al usuario la alternativa que sí funciona.
          toast.error('No pudimos abrir el menú de compartir. Copiá el enlace desde la barra del navegador.');
        });
    } else {
      // El tilde de "copiado" ahora depende del resultado real de la promesa:
      // antes se prendía siempre, incluso sirviendo el sitio por `http://`,
      // donde `navigator.clipboard` ni siquiera existe (R26).
      void copiarAlPortapapeles(window.location.href, 'NewsDetailPage.handleShare').then(
        (copiado) => {
          if (!copiado) {
            toast.error(MENSAJE_COPIA_FALLIDA);
            return;
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        },
      );
    }
  };

  const coverSrc = safeImageSrc(news.imageKey);

  // S19 — a esta pantalla se puede llegar por URL directa con el slug de una
  // noticia del portal. De esas **no tenemos el cuerpo del artículo**: lo que
  // hay es la bajada. Mostrarla dentro del layout de "artículo completo" haría
  // parecer que la nota se termina en dos renglones; lo honesto es decir de
  // dónde viene y mandar al original.
  const externa = esNoticiaExterna(news);

  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      <Button
        variant="ghost"
        className="mb-6 -ml-3 text-primary-600 hover:text-primary-900 hover:bg-primary-50 cursor-pointer"
        onClick={() => navigate('/noticias')}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver a Noticias
      </Button>

      {/* Header del Artículo */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Badge className="bg-primary-50 text-primary-800 border-primary-200 uppercase tracking-wider font-bold text-xs">
            {externa ? 'Portal Oficial de Formosa' : 'Actualidad'}
          </Badge>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-primary-500">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(news.createdAt)}
          </span>
          {!externa && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-primary-400">
              <Clock className="w-3.5 h-3.5" />
              Lectura de 3 min
            </span>
          )}
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-primary-950 mb-6 leading-tight">
          {news.title}
        </h1>

        {news.excerpt && (
          <p className="text-lg md:text-xl text-primary-600 font-normal leading-relaxed border-l-4 border-primary-500 pl-4 py-1">
            {news.excerpt}
          </p>
        )}

        <div className="flex items-center justify-end mt-6 pt-4 border-t border-primary-100">
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="gap-2 text-xs font-semibold text-primary-700 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-600" /> Enlace copiado
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" /> Compartir artículo
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Imagen Principal de Portada — `imageKey` es texto libre del backend y
          es la URL entera, así que se valida el schema antes de usarla. */}
      {coverSrc && !imgError ? (
        <div className="w-full h-[360px] md:h-[480px] rounded-3xl overflow-hidden mb-10 shadow-lg border border-primary-100 bg-primary-900">
          <img
            src={coverSrc}
            alt={news.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-full h-[240px] md:h-[300px] rounded-3xl bg-gradient-to-br from-primary-900 via-primary-800 to-celeste-900 flex flex-col items-center justify-center mb-10 text-white text-center p-6 shadow-inner relative overflow-hidden">
          <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-3">
            <Newspaper className="w-8 h-8 text-celeste-300" />
          </div>
          <span className="text-white/80 font-bold uppercase tracking-wider text-xs">
            Juegos Evita Formosa
          </span>
        </div>
      )}

      {/* Cuerpo del Artículo */}
      {externa ? (
        <div className="bg-white p-6 sm:p-10 rounded-3xl border border-primary-100 shadow-xs">
          <p className="text-primary-900 leading-relaxed mb-6">{news.excerpt}</p>
          <div className="border-t border-primary-100 pt-6">
            <p className="text-sm text-primary-600 mb-4">
              Esta noticia fue publicada por{' '}
              <strong className="text-primary-800">
                {news.sourceName || 'el Portal Oficial de la Provincia de Formosa'}
              </strong>
              . La nota completa se lee en {hostDeLaFuente(news.sourceUrl) || 'formosa.gob.ar'}.
            </p>
            <a
              href={news.sourceUrl as string}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-bold hover:bg-primary-700 transition-colors"
            >
              Leer la nota completa en el portal oficial
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      ) : (
        <div className="prose prose-lg prose-primary max-w-none text-primary-900 leading-relaxed font-normal bg-white p-6 sm:p-10 rounded-3xl border border-primary-100 shadow-xs">
          <PlainTextContent text={news.content} />
        </div>
      )}
    </article>
  );
}
