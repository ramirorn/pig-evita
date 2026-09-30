// ===========================================
// VenuePhoto — foto principal de una sede (portada o miniatura)
// ===========================================
//
// Presentacional: recibe el `imageUrl` crudo de la API y lo resuelve con
// `resolveVenueImageUrl` (origen de la API + validación). Sin foto, o si la
// foto falla al cargar, pinta un placeholder decorativo con los tokens del
// sitio — nunca una imagen inventada.
import { useState } from 'react';
import { Building2, MapPin } from 'lucide-react';
import { API_BASE_URL } from '@/lib/apiBase';
import { pickVenueImageSrc, venueImageAlt } from '@/lib/venues/venueImageRules';

interface VenuePhotoProps {
  imageUrl: string | null | undefined;
  /** Nombre de la sede: va en el `alt`. */
  name: string;
  /** `cover`: portada 16:9 a todo el ancho. `thumb`: miniatura cuadrada de tabla. */
  variant: 'cover' | 'thumb';
}

export function VenuePhoto({ imageUrl, name, variant }: VenuePhotoProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = pickVenueImageSrc(imageUrl, API_BASE_URL, failedSrc);

  if (variant === 'thumb') {
    return src ? (
      <img
        src={src}
        alt={venueImageAlt(name)}
        width={48}
        height={48}
        loading="lazy"
        decoding="async"
        onError={() => setFailedSrc(src)}
        className="size-12 shrink-0 rounded-lg border border-primary-100 bg-primary-50 object-cover"
      />
    ) : (
      <div
        aria-hidden="true"
        data-venue-photo="placeholder"
        className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-primary-100 bg-primary-50"
      >
        <Building2 className="w-5 h-5 text-primary-500" />
      </div>
    );
  }

  return src ? (
    <img
      src={src}
      alt={venueImageAlt(name)}
      width={640}
      height={360}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
      className="block aspect-video w-full bg-primary-100 object-cover"
    />
  ) : (
    // Decorativo: el nombre de la sede ya está en el h2 de la tarjeta.
    <div
      aria-hidden="true"
      data-venue-photo="placeholder"
      className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-gradient-to-br from-primary-900 via-primary-800 to-celeste-800 select-none"
    >
      <div className="pointer-events-none absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-celeste-400/15 blur-2xl" />
      <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-accent-400/15 blur-2xl" />
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
        <MapPin className="h-7 w-7 text-celeste-200" />
      </div>
    </div>
  );
}
