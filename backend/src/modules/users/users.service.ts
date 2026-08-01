// ===========================================
// Users Service
// ===========================================
import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto, UpdateUserDto, UserFilterDto } from './dto';
import { buildPaginatedResponse } from '../../common/dto';

// Campos a excluir de las respuestas
const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  department: true,
  zone: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear un nuevo usuario administrativo.
   */
  async create(createUserDto: CreateUserDto) {
    const { password, email, ...rest } = createUserDto;

    // Verificar email único
    const existing = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException('Ya existe un usuario con ese email');
    }

    // Hashear contraseña con Argon2
    const passwordHash = await argon2.hash(password);

    const user = await this.prisma.user.create({
      data: {
        ...rest,
        email: email.toLowerCase().trim(),
        passwordHash,
      },
      select: userSelect,
    });

    this.logger.log(`User created: ${user.email} (${user.role})`);
    return user;
  }

  /**
   * Listar usuarios con paginación y filtros.
   */
  async findAll(filterDto: UserFilterDto) {
    const where: Prisma.UserWhereInput = {};

    // Filtros
    if (filterDto.role) {
      where.role = filterDto.role;
    }

    if (filterDto.isActive !== undefined) {
      where.isActive = filterDto.isActive;
    }

    if (filterDto.department) {
      where.department = {
        contains: filterDto.department,
        mode: 'insensitive',
      };
    }

    // Búsqueda general
    if (filterDto.search) {
      where.OR = [
        { firstName: { contains: filterDto.search, mode: 'insensitive' } },
        { lastName: { contains: filterDto.search, mode: 'insensitive' } },
        { email: { contains: filterDto.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: userSelect,
        skip: filterDto.skip,
        take: filterDto.take,
        orderBy: {
          [filterDto.sortBy || 'createdAt']: filterDto.sortOrder || 'desc',
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return buildPaginatedResponse(users, total, filterDto);
  }

  /**
   * Buscar un usuario por ID.
   */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  /**
   * Actualizar un usuario.
   */
  async update(id: string, updateUserDto: UpdateUserDto) {
    // Verificar que existe
    await this.findOne(id);

    const { password, email, ...rest } = updateUserDto;
    const data: Prisma.UserUpdateInput = { ...rest };

    // Si se actualiza el email, verificar unicidad
    if (email) {
      const existing = await this.prisma.user.findFirst({
        where: {
          email: email.toLowerCase().trim(),
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException('Ya existe un usuario con ese email');
      }

      data.email = email.toLowerCase().trim();
    }

    // Si se actualiza la contraseña, hashear
    if (password) {
      data.passwordHash = await argon2.hash(password);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });

    this.logger.log(`User updated: ${user.email}`);
    return user;
  }

  /**
   * Eliminar un usuario (soft delete: desactivar).
   */
  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.user.update({
      where: { id },
      data: { isActive: false, refreshToken: null },
    });

    this.logger.log(`User deactivated: ${id}`);
    return { message: 'Usuario desactivado exitosamente' };
  }
}
