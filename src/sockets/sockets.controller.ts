import { Controller } from '@nestjs/common';
import { EntityController } from '@src/common/entity.controller';
import { SocketsDto } from './sockets.dto';
import { SocketsEntity } from './sockets.entity';
import { SocketsService } from './sockets.service';

@Controller('sockets')
export class SocketsController extends EntityController({
  name: 'Подключения по сокетам',
  dto: SocketsDto,
  entity: SocketsEntity,
  operations: {
    read: 'public',
    create: 'owner',
    update: 'owner',
    delete: 'owner',
  },
})<SocketsDto, SocketsEntity, SocketsService> {
  constructor(readonly service: SocketsService) {
    super();
  }
}
