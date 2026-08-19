// ===========================================
// Categories Controller
// ===========================================
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto, CategoryFilterDto } from './dto';
import {
  Roles,
  Public,
  CacheControl,
  CACHE_TTL,
} from '../../common/decorators';
import { Role } from '../../common/constants';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN_PROVINCIAL)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Crear categoría' })
  @ApiResponse({ status: 201, description: 'Categoría creada' })
  async create(@Body() createDto: CreateCategoryDto) {
    return this.categoriesService.create(createDto);
  }

  @Get()
  @Public() // Público para los combos de inscripción
  @CacheControl(CACHE_TTL.CATALOG)
  @ApiOperation({
    summary: 'Listar categorías',
    description:
      'Endpoint público. Paginado y filtrado por disciplina, sexo, etc.',
  })
  @ApiResponse({ status: 200, description: 'Lista de categorías' })
  async findAll(@Query() filterDto: CategoryFilterDto) {
    return this.categoriesService.findAll(filterDto);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Obtener categoría' })
  @ApiResponse({ status: 200, description: 'Datos de la categoría' })
  @ApiResponse({ status: 404, description: 'No encontrada' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN_PROVINCIAL)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Actualizar categoría' })
  @ApiResponse({ status: 200, description: 'Categoría actualizada' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN_PROVINCIAL)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Eliminar categoría' })
  @ApiResponse({ status: 200, description: 'Categoría eliminada' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.remove(id);
  }
}
