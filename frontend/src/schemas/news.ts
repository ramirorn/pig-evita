// ===========================================
// Schemas de noticias
// ===========================================
import { z } from 'zod';
import { isValidExternalImageUrl } from '@/lib/news/newsImageRules';
import { MAX_TEXTO_LARGO, textoObligatorio, textoOpcional } from './_helpers';

// ==========================================
// News Schemas
// ==========================================

/** Título de noticia: entra completo en la tarjeta del listado y en un `<title>`. */
const MAX_TITULO_NOTICIA = 200;

/** Copete/resumen que se muestra en el listado y en las metatags. */
const MAX_EXCERPT_NOTICIA = 500;

export const newsSchema = z.object({
  title: textoObligatorio(3, MAX_TITULO_NOTICIA, 'El título es obligatorio (mínimo 3 caracteres)', 'El título'),
  excerpt: textoOpcional(MAX_EXCERPT_NOTICIA, 'El resumen'),
  // `content` es `@db.Text`: el único techo es el body parser.
  content: textoObligatorio(
    10,
    MAX_TEXTO_LARGO,
    'El contenido debe tener al menos 10 caracteres',
    'El contenido',
  ),
  /**
   * Pestaña elegida en "Imagen de la noticia". En "Subir archivo" la imagen se
   * guarda sola (`POST /news/:id/image`) y `imageUrl` no se valida ni se manda.
   */
  imageMode: z.enum(['upload', 'url']).default('upload'),
  /** "Pegar URL": sólo `https://`, igual que `@IsUrl` del backend. Vacía = sin URL. */
  imageUrl: z.string().max(2048, 'La URL de la imagen es demasiado larga').optional().or(z.literal('')),
  isPublished: z.boolean().default(false),
}).superRefine((valores, ctx) => {
  if (valores.imageMode !== 'url') return;
  const url = (valores.imageUrl ?? '').trim();
  if (url !== '' && !isValidExternalImageUrl(url)) {
    ctx.addIssue({
      code: 'custom',
      path: ['imageUrl'],
      message: 'Pegá una dirección que empiece con https:// (por ejemplo, https://sitio.gob.ar/foto.jpg).',
    });
  }
});

export type NewsFormValues = z.infer<typeof newsSchema>;
