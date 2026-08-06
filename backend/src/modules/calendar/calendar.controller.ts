// ===========================================
// Calendar Controller
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
import { CalendarService } from './calendar.service';
import {
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
  CalendarFilterDto,
} from './dto';
import { Roles, Public } from '../../common/decorators';
import { ADMIN_ROLES } from '../../common/constants';

@ApiTags('Calendar')
@Controller('calendar')
@ApiBearerAuth('access-token')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post()
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Crear evento en el calendario' })
  @ApiResponse({ status: 201, description: 'Evento creado' })
  async create(@Body() createDto: CreateCalendarEventDto) {
    return this.calendarService.create(createDto);
  }

  @Get()
  @Public() // Calendario público
  @ApiOperation({ summary: 'Listar eventos del calendario' })
  @ApiResponse({ status: 200, description: 'Lista de eventos paginada' })
  async findAll(@Query() filterDto: CalendarFilterDto) {
    return this.calendarService.findAll(filterDto);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Obtener evento por ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.calendarService.findOne(id);
  }

  @Patch(':id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Actualizar evento' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateCalendarEventDto,
  ) {
    return this.calendarService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Eliminar evento' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.calendarService.remove(id);
  }
}
