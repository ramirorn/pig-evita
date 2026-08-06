import { z } from 'zod';
import { UserRole, Sex, DisciplineType, ResultType, CompetitionStage, CompetitionFormat } from '@/types';

// ==========================================
// Auth Schemas
// ==========================================

export const loginSchema = z.object({
  email: z.string().email('Debe ser un email válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

// ==========================================
// User Schemas
// ==========================================

export const createUserSchema = z.object({
  email: z.string().email('Debe ser un email válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  firstName: z.string().min(2, 'El nombre es obligatorio'),
  lastName: z.string().min(2, 'El apellido es obligatorio'),
  role: z.nativeEnum(UserRole, { message: 'Rol inválido' }),
  department: z.string().optional(),
  zone: z.string().optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email('Debe ser un email válido'),
  password: z
    .string()
    .refine((val) => !val || val.length >= 8, {
      message: 'La nueva contraseña debe tener al menos 8 caracteres',
    })
    .optional(),
  firstName: z.string().min(2, 'El nombre es obligatorio'),
  lastName: z.string().min(2, 'El apellido es obligatorio'),
  role: z.nativeEnum(UserRole, { message: 'Rol inválido' }),
  department: z.string().optional(),
  zone: z.string().optional(),
  isActive: z.boolean().default(true),
});

// ==========================================
// Participant Schemas
// ==========================================

export const participantSchema = z.object({
  dni: z.string().regex(/^\d{7,8}$/, 'El DNI debe tener 7 u 8 números'),
  firstName: z.string().min(2, 'El nombre es obligatorio'),
  lastName: z.string().min(2, 'El apellido es obligatorio'),
  birthDate: z.string().refine((date) => !isNaN(Date.parse(date)), 'Fecha inválida'),
  sex: z.nativeEnum(Sex, { message: 'Sexo inválido' }),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  locality: z.string().min(2, 'La localidad es obligatoria'),
  department: z.string().min(2, 'El departamento es obligatorio'),
  address: z.string().optional(),
});

// ==========================================
// Discipline Schemas
// ==========================================

export const disciplineSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  type: z.nativeEnum(DisciplineType),
  resultType: z.nativeEnum(ResultType),
  rules: z.string().optional(),
  minPlayers: z.number().int().min(1).optional(),
  maxPlayers: z.number().int().min(1).optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

// ==========================================
// Category Schemas
// ==========================================

export const categorySchema = z.object({
  disciplineId: z.string().uuid('ID de disciplina inválido'),
  name: z.string().min(2, 'El nombre de categoría es obligatorio (ej. Sub 14)'),
  minAge: z.number().int().min(5, 'Edad mínima inválida'),
  maxAge: z.number().int().max(99, 'Edad máxima inválida'),
  sex: z.nativeEnum(Sex),
  isActive: z.boolean().default(true),
}).refine((data) => data.maxAge >= data.minAge, {
  message: 'La edad máxima debe ser mayor o igual a la mínima',
  path: ['maxAge'],
});

// ==========================================
// Team Schemas
// ==========================================

export const teamSchema = z.object({
  name: z.string().min(3, 'El nombre del equipo es obligatorio'),
  disciplineId: z.string().uuid('Debe seleccionar una disciplina'),
  categoryId: z.string().uuid('Debe seleccionar una categoría'),
  locality: z.string().min(2, 'La localidad es obligatoria'),
  department: z.string().min(2, 'El departamento es obligatorio'),
});

// ==========================================
// Competition Schemas
// ==========================================

export const competitionSchema = z.object({
  disciplineId: z.string().uuid('Debe seleccionar una disciplina'),
  categoryId: z.string().uuid('Debe seleccionar una categoría'),
  stage: z.nativeEnum(CompetitionStage),
  format: z.nativeEnum(CompetitionFormat),
  name: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// ==========================================
// Calendar Event Schemas
// ==========================================

export const calendarEventSchema = z.object({
  title: z.string().min(2, 'El título es obligatorio'),
  description: z.string().optional().nullable().or(z.literal('')),
  startDate: z.string().min(1, 'La fecha de inicio es obligatoria'),
  startTime: z.string().min(1, 'La hora de inicio es obligatoria'),
  hasEndDate: z.boolean().default(false),
  endDate: z.string().optional().nullable().or(z.literal('')),
  endTime: z.string().optional().nullable().or(z.literal('')),
  stage: z.nativeEnum(CompetitionStage).optional().nullable().or(z.literal('')).or(z.literal('none')),
  disciplineId: z.string().optional().nullable().or(z.literal('')),
  venueId: z.string().optional().nullable().or(z.literal('')),
  isPublished: z.boolean().default(true),
});


