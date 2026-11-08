import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Newspaper, ArrowLeft, Calendar, Share2, Clock, Check, ExternalLink } from 'lucide-react';
import { useNewsBySlug, useNewsList } from '@/hooks/useNews';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ROUTES } from '@/lib/constants';
import { newsImageSrc } from '@/lib/news/newsImageRules';
import { esNoticiaExterna, fechaDeNoticia, fechaDePublicacion, hostDeLaFuente } from './news/newsSource';
import { NewsCard } from './news/NewsCard';
import { logError } from '@/lib/logger';
import { copiarAlPortapapeles, MENSAJE_COPIA_FALLIDA } from '@/lib/clipboard';
import { toast } from 'sonner';

/** Cantidad de notas sugeridas al final de la lectura. */
const RELACIONADAS = 3;
/** Palabras por minuto de lectura en pantalla (promedio en español). */
const PALABRAS_POR_MINUTO = 200;

/** Minutos de lectura calculados del texto real; nunca un número fijo. */
function minutosDeLectura(texto: string): number {
  const palabras = texto.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(palabras / PALABRAS_POR_MINUTO));
}

/** Esqueleto con la forma del artículo: título, línea de datos, imagen y párrafos. */
function ArticleSkeleton() {
  return (
    <div
      className="mx-auto max-w-3xl px-4 py-10 sm:px-6"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Cargando la noticia…</span>
      <div className="mb-8 h-5 w-32 rounded bg-primary-100 animate-shimmer" />
      <div className="mb-3 h-4 w-48 rounded bg-primary-100 animate-shimmer" />
      <div className="mb-2 h-9 w-full rounded bg-primary-100 animate-shimmer" />
      <div className="mb-8 h-9 w-2/3 rounded bg-primary-100 animate-shimmer" />
      <div className="mb-8 aspect-video w-full rounded-2xl bg-primary-100 animate-shimmer" />
      <div className="space-y-3">
        {[100, 95, 100, 80, 100, 60].map((ancho, i) => (
          <div
            key={i}
            className="h-4 rounded bg-primary-100 animate-shimmer"
            style={{ width: `${ancho}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function NewsDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [copied, setCopied] = useState(false);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const { data: news, isLoading } = useNewsBySlug(slug || '');
  // Un renglón más que lo que se muestra: si la nota actual viene en la lista,
  // igual quedan RELACIONADAS tarjetas.
  const { data: recientes } = useNewsList({ isPublished: true, limit: RELACIONADAS + 1 });

  const relacionadas = useMemo(
    () => (recientes?.data ?? []).filter((n) => n.id !== news?.id).slice(0, RELACIONADAS),
    [recientes, news?.id],
  );

  if (isLoading) return <ArticleSkeleton />;

  if (!news) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="type-h1 mb-3 text-primary-900">No encontramos esta noticia</h1>
        <p className="mb-6 text-primary-700">
          Puede que el enlace esté incompleto o que la nota ya no esté publicada. Las últimas
          novedades están en Noticias.
        </p>
        <Button asChild>
          <Link to={ROUTES.NEWS}>Ver todas las noticias</Link>
        </Button>
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
      // El tilde de "copiado" depende del resultado real de la promesa: antes
      // se prendía siempre, incluso sirviendo el sitio por `http://`, donde
      // `navigator.clipboard` ni siquiera existe (R26).
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

  const coverSrc = newsImageSrc(news.imageUrl);
  const imgError = coverSrc !== null && failedSrc === coverSrc;

  // S19 — a esta pantalla se puede llegar por URL directa con el slug de una
  // noticia del portal. De esas **no tenemos el cuerpo del artículo**: lo que
  // hay es la bajada. Mostrarla dentro del layout de "artículo completo" haría
  // parecer que la nota se termina en dos renglones; lo honesto es decir de
  // dónde viene y mandar al original.
  const externa = esNoticiaExterna(news);
  const hostFuente = hostDeLaFuente(news.sourceUrl);
  const fuente = news.sourceName || 'Portal Oficial de la Provincia de Formosa';
  // Párrafos reales: el texto viene del panel con líneas en blanco entre ellos.
  const parrafos = externa ? [] : news.content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const minutos = externa ? null : minutosDeLectura(news.content);

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        to={ROUTES.NEWS}
        className="-ml-2 mb-6 inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-primary-700 transition-colors duration-120 hover:bg-primary-50 hover:text-primary-900 pointer-coarse:min-h-11"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Volver a Noticias
      </Link>

      <header className="mb-8">
        <Badge className="mb-4 border-primary-200 bg-primary-50 text-xs font-bold tracking-wider text-primary-800 uppercase">
          {externa ? 'Portal Oficial de Formosa' : 'Actualidad'}
        </Badge>

        <h1 className="type-h1 mb-5 text-balance text-primary-950">{news.title}</h1>

        {news.excerpt && !externa && (
          <p className="mb-5 text-lg leading-relaxed text-primary-700 md:text-xl">{news.excerpt}</p>
        )}

        {/* Línea de datos: quién, cuándo y cuánto lleva leerla. */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-y border-primary-100 py-3">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-primary-700">
            <span className="font-semibold text-primary-900">
              {externa ? fuente : 'Juegos Evita Formosa'}
            </span>
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              <time dateTime={fechaDePublicacion(news)}>{fechaDeNoticia(news)}</time>
            </span>
            {minutos !== null && (
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Lectura de {minutos} min
              </span>
            )}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="cursor-pointer gap-2 text-xs font-semibold text-primary-800 pointer-coarse:min-h-11"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-success-700" aria-hidden="true" /> Enlace copiado
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" aria-hidden="true" /> Compartir
              </>
            )}
          </Button>
          <span role="status" className="sr-only">
            {copied ? 'Enlace copiado al portapapeles' : ''}
          </span>
        </div>
      </header>

      {/* Imagen principal: proporción fija (sin salto de layout) y pie con la
          fuente cuando la imagen viene de un sitio externo. `imageUrl` es una
          ruta de la API (subida) o una URL externa entera, que pasa por
          `newsImageSrc` antes de usarse. Es la imagen de apertura de la página:
          carga con prioridad. */}
      {coverSrc && !imgError ? (
        <figure className="mb-8">
          <div className="aspect-video w-full overflow-hidden rounded-2xl border border-primary-100 bg-primary-100">
            <img
              src={coverSrc}
              alt={news.title}
              width={1280}
              height={720}
              fetchPriority="high"
              decoding="async"
              onError={() => setFailedSrc(coverSrc)}
              className="h-full w-full object-cover"
            />
          </div>
          {news.imageSource === 'url' && hostFuente && (
            <figcaption className="mt-2 text-xs text-primary-700">Imagen: {hostFuente}</figcaption>
          )}
        </figure>
      ) : (
        <div
          aria-hidden="true"
          className="relative mb-8 flex aspect-video w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary-900 via-primary-800 to-celeste-900 p-6 text-center text-white"
        >
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
            <Newspaper className="h-8 w-8 text-celeste-300" />
          </div>
          <span className="text-xs font-bold tracking-wider text-white/90 uppercase">
            Juegos Evita Formosa
          </span>
        </div>
      )}

      {externa ? (
        <div className="rounded-2xl border border-primary-100 bg-white p-6 sm:p-8">
          {news.excerpt && (
            <p className="mb-6 text-lg leading-[1.65] text-primary-900">{news.excerpt}</p>
          )}
          <div className={news.excerpt ? 'border-t border-primary-100 pt-6' : ''}>
            <p className="mb-4 text-sm text-primary-700">
              Esta noticia fue publicada por{' '}
              <strong className="text-primary-900">{fuente}</strong>. La nota completa se lee en{' '}
              {hostFuente || 'formosa.gob.ar'}.
            </p>
            <a
              href={news.sourceUrl as string}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-primary-700 px-5 py-3 text-sm font-bold text-white transition-colors duration-120 hover:bg-primary-800 active:bg-primary-900 pointer-coarse:min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            >
              Leer la nota completa en el portal oficial
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">(se abre en otra pestaña)</span>
            </a>
          </div>
        </div>
      ) : (
        // Medida de lectura: ~65 caracteres por renglón, cuerpo de 17-18 px.
        <div className="mx-auto max-w-[65ch] space-y-5 text-[1.0625rem] leading-[1.65] text-primary-900 sm:text-lg sm:leading-[1.65]">
          {parrafos.length > 0 ? (
            parrafos.map((p, i) => (
              <p key={i} className="break-words whitespace-pre-line">
                {p}
              </p>
            ))
          ) : (
            <p className="text-primary-700 italic">Esta noticia todavía no tiene texto cargado.</p>
          )}
        </div>
      )}

      <div className="mx-auto mt-10 flex max-w-[65ch] flex-wrap items-center justify-between gap-3 border-t border-primary-100 pt-6">
        <Link
          to={ROUTES.NEWS}
          className="inline-flex items-center gap-2 rounded-lg py-2 text-sm font-semibold text-primary-700 transition-colors duration-120 hover:text-primary-900 pointer-coarse:min-h-11"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Todas las noticias
        </Link>
      </div>

      {relacionadas.length > 0 && (
        <section aria-labelledby="mas-noticias" className="mt-14">
          <h2 id="mas-noticias" className="type-h2 mb-6 text-primary-900">
            Más noticias
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {relacionadas.map((n) => (
              <NewsCard key={n.id} news={n} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
