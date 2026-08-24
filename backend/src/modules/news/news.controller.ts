// ===========================================
// News Controller
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
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { NewsService } from './news.service';
import { CreateNewsDto, UpdateNewsDto, NewsFilterDto } from './dto';
import {
  Roles,
  Public,
  CurrentUser,
  CacheControl,
  CACHE_TTL,
  PublicReadThrottle,
} from '../../common/decorators';
import { ADMIN_ROLES } from '../../common/constants';
import { OptionalJwtAuthGuard } from '../../common/guards';
import { puedeVerBorradores } from '../../common/content-visibility';
import type { UsuarioConRol } from '../../common/content-visibility';

@ApiTags('News')
@Controller('news')
@ApiBearerAuth('access-token')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Post()
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Crear noticia' })
  @ApiResponse({ status: 201, description: 'Noticia creada' })
  async create(
    @Body() createDto: CreateNewsDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.newsService.create(createDto, userId);
  }

  /**
   * Los tres GET son públicos pero llevan `OptionalJwtAuthGuard`: si el request
   * trae un token válido de un rol que administra contenido, ve también los
   * borradores; si no trae token (o el token no sirve), ve sólo lo publicado.
   * El guard nunca rechaza — la decisión de qué se ve la toma el service.
   */
  @Get()
  @Public() // Lista pública de noticias
  @UseGuards(OptionalJwtAuthGuard)
  @PublicReadThrottle()
  @CacheControl(CACHE_TTL.CONTENT)
  @ApiOperation({ summary: 'Listar noticias' })
  @ApiResponse({ status: 200, description: 'Lista de noticias paginada' })
  async findAll(
    @Query() filterDto: NewsFilterDto,
    @CurrentUser() user: UsuarioConRol | null,
  ) {
    return this.newsService.findAll(filterDto, puedeVerBorradores(user));
  }

  @Get('slug/:slug')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @PublicReadThrottle()
  @ApiOperation({ summary: 'Obtener noticia por slug' })
  async findBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user: UsuarioConRol | null,
  ) {
    return this.newsService.findBySlug(slug, puedeVerBorradores(user));
  }

  @Get(':id')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @PublicReadThrottle()
  @ApiOperation({ summary: 'Obtener noticia por ID' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioConRol | null,
  ) {
    return this.newsService.findOne(id, puedeVerBorradores(user));
  }

  @Patch(':id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Actualizar noticia' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateNewsDto,
  ) {
    return this.newsService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Eliminar noticia' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.newsService.remove(id);
  }
}
