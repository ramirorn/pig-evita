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

  @Get()
  @Public() // Lista pública de noticias
  @PublicReadThrottle()
  @CacheControl(CACHE_TTL.CONTENT)
  @ApiOperation({ summary: 'Listar noticias' })
  @ApiResponse({ status: 200, description: 'Lista de noticias paginada' })
  async findAll(@Query() filterDto: NewsFilterDto) {
    return this.newsService.findAll(filterDto);
  }

  @Get('slug/:slug')
  @Public()
  @PublicReadThrottle()
  @ApiOperation({ summary: 'Obtener noticia por slug' })
  async findBySlug(@Param('slug') slug: string) {
    return this.newsService.findBySlug(slug);
  }

  @Get(':id')
  @Public()
  @PublicReadThrottle()
  @ApiOperation({ summary: 'Obtener noticia por ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.newsService.findOne(id);
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
