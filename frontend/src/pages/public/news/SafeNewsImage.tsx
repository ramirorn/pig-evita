// ===========================================
// SafeNewsImage — imagen de noticia con fallback visual
// ===========================================
import { useState } from "react";
import { Newspaper } from "lucide-react";
import { safeImageSrc } from "@/lib/utils";

// Fallback visual elegante cuando no hay imagen o falla la carga
function NewsImagePlaceholder({
  title,
  isLarge = false,
}: {
  title: string;
  isLarge?: boolean;
}) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-celeste-900 p-6 text-center relative overflow-hidden select-none">
      {/* Patrón decorativo de fondo */}
      <div className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-celeste-400/10 blur-2xl pointer-events-none" />
      <div className="absolute -left-10 -top-10 w-48 h-48 rounded-full bg-accent-400/10 blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center mb-3 shadow-inner">
          <Newspaper className="w-7 h-7 text-celeste-300" />
        </div>
        <span className="text-white/80 font-bold uppercase tracking-wider text-[11px]">
          Juegos Evita Formosa
        </span>
        {isLarge && (
          <span className="text-white/60 text-xs mt-1 max-w-xs line-clamp-1 font-medium">
            {title}
          </span>
        )}
      </div>
    </div>
  );
}

// Componente de Imagen con manejo seguro de errores
export function SafeNewsImage({
  src,
  alt,
  isLarge = false,
}: {
  src?: string | null;
  alt: string;
  isLarge?: boolean;
}) {
  // Se guarda **qué** src falló, no un booleano (hallazgo R30): con un
  // `hasError` suelto, reutilizar el componente con otra imagen sin
  // desmontarlo seguía mostrando el placeholder de la anterior. Hoy no se
  // dispara porque los padres keyean por `news.id`, pero deja de depender de
  // eso el día que alguien agregue paginación o keyee por índice.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  // `imageKey` es texto libre del backend y acá es la URL entera, no un
  // parámetro dentro de una base fija: hay que validar el schema antes de usarla.
  const safeSrc = safeImageSrc(src);

  const hasError = failedSrc !== null && failedSrc === safeSrc;

  if (!safeSrc || hasError) {
    return <NewsImagePlaceholder title={alt} isLarge={isLarge} />;
  }

  return (
    <img
      src={safeSrc}
      alt={alt}
      onError={() => setFailedSrc(safeSrc)}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
    />
  );
}
