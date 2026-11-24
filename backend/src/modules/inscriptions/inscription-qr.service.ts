// ===========================================
// Código QR de las inscripciones
// ===========================================
import { Injectable, NotFoundException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../database/prisma.service';
import { PublicInscriptionDto } from './dto';

/** Crockford base32: 32 símbolos, sin los que se confunden al tipear. */
const QR_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** 26 símbolos × 5 bits = 130 bits de entropía. */
const QR_LENGTH = 26;

/** Mismo aspecto para la credencial individual y la de cada integrante. */
const QR_RENDER_OPTIONS: QRCode.QRCodeToDataURLOptions = {
  width: 300,
  margin: 2,
  color: { dark: '#0F4C81', light: '#FFFFFF' },
};

/**
 * Única fuente del código QR: lo generan el alta individual y la de planteles,
 * lo leen la consulta pública y la credencial impresa. Una segunda
 * implementación que se desincronice rompería las dos sin tocarlas.
 */
@Injectable()
export class InscriptionQrService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * VULN-32 — `EVITA-` y 26 caracteres Crockford base32 del CSPRNG (130 bits).
   * Crockford y no base64url: la consulta pública pasa a mayúsculas lo que se
   * tipea y estos caracteres entran en el modo alfanumérico del QR. Los códigos
   * viejos ya impresos (8 hexadecimales) siguen valiendo porque `findByQr`
   * busca el código exacto.
   */
  generateCode(): string {
    let code = '';
    for (let i = 0; i < QR_LENGTH; i++) {
      code += QR_ALPHABET[randomInt(QR_ALPHABET.length)];
    }
    return `EVITA-${code}`;
  }

  /** Imagen PNG del código, como data URL. Se genera fuera de transacciones. */
  renderImage(code: string): Promise<string> {
    return QRCode.toDataURL(code, QR_RENDER_OPTIONS);
  }

  /**
   * Consulta pública por código (sin autenticación).
   *
   * Superficie mínima a propósito: quien conozca el código puede llamar a este
   * endpoint. Sólo nombre e inicial del apellido (VULN-32), disciplina,
   * categoría y estado. NO agregar dni, email, phone, birthDate, address,
   * department ni notas internas al `select` ni al objeto devuelto.
   */
  async findByQr(qrCode: string): Promise<PublicInscriptionDto> {
    const inscription = await this.prisma.inscription.findUnique({
      where: { qrCode },
      select: {
        qrCode: true,
        status: true,
        createdAt: true,
        participant: { select: { firstName: true, lastName: true } },
        category: {
          select: {
            name: true,
            discipline: { select: { name: true } },
          },
        },
      },
    });

    if (!inscription) {
      throw new NotFoundException(
        'Inscripción no encontrada para el código QR proporcionado',
      );
    }

    // Mapeo explícito: un campo nuevo en el `select` no se filtra sin revisar
    // este contrato.
    return {
      qrCode: inscription.qrCode,
      status: inscription.status,
      createdAt: inscription.createdAt,
      participant: {
        firstName: inscription.participant.firstName,
        lastInitial: lastNameInitial(inscription.participant.lastName),
      },
      category: {
        name: inscription.category.name,
        discipline: { name: inscription.category.discipline.name },
      },
    };
  }
}

/**
 * Inicial del primer apellido para la consulta pública (VULN-32): alcanza para
 * que la familia reconozca el trámite sin publicar el apellido de un menor.
 */
function lastNameInitial(lastName: string): string {
  const initial = lastName.trim().charAt(0).toLocaleUpperCase('es');
  return initial ? `${initial}.` : '';
}
