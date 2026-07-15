import { Controller } from '@nestjs/common';
import { EntityController } from '@src/common/entity.controller';
import { RoomsDto } from './rooms.dto';
import { RoomsEntity } from './rooms.entity';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController extends EntityController({
  name: 'Комнаты подключений по сокетам',
  dto: RoomsDto,
  entity: RoomsEntity,
})<RoomsDto, RoomsEntity, RoomsService> {
  constructor(readonly service: RoomsService) {
    super();
  }
}
