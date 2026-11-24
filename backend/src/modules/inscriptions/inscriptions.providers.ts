// ===========================================
// Providers del módulo de inscripciones
// ===========================================
//
// Lista única que usan el módulo y los tests que arman el controller a mano:
// sumar un servicio al módulo no obliga a tocar cada spec.
import { InscriptionQrService } from './inscription-qr.service';
import { InscriptionReviewService } from './inscription-review.service';
import { InscriptionsService } from './inscriptions.service';
import { TeamInscriptionsService } from './team-inscriptions.service';

export const INSCRIPTION_PROVIDERS = [
  InscriptionsService,
  InscriptionQrService,
  InscriptionReviewService,
  TeamInscriptionsService,
];
