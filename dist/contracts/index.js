"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatContracts = exports.AuthExpiredDto = exports.WsErrorDto = exports.SyncAckDto = exports.ChannelUpdatedDto = exports.MemberEventDto = exports.PresenceEventDto = exports.TypingEventDto = exports.MessageDeletedDto = exports.MessageUpdatedDto = exports.MessageNewDto = exports.SyncDto = exports.ReadDto = exports.TypingDto = exports.ChannelLeaveDto = exports.ChannelJoinDto = exports.MessageDeleteDto = exports.MessageEditDto = exports.MessageSendDto = exports.AuthorDto = exports.MessageAttachmentDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class MessageAttachmentDto {
}
exports.MessageAttachmentDto = MessageAttachmentDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Ключ объекта в file-server" }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 1024),
    __metadata("design:type", String)
], MessageAttachmentDto.prototype, "key", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Готовый URL для скачивания" }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 2048),
    __metadata("design:type", String)
], MessageAttachmentDto.prototype, "url", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 255),
    __metadata("design:type", String)
], MessageAttachmentDto.prototype, "mime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], MessageAttachmentDto.prototype, "size", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 255),
    __metadata("design:type", String)
], MessageAttachmentDto.prototype, "name", void 0);
class AuthorDto {
}
exports.AuthorDto = AuthorDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], AuthorDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AuthorDto.prototype, "username", void 0);
class MessageSendDto {
}
exports.MessageSendDto = MessageSendDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "ID канала или лички" }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MessageSendDto.prototype, "channelId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Клиентский id для идемпотентности" }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 64),
    __metadata("design:type", String)
], MessageSendDto.prototype, "clientId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 4096),
    __metadata("design:type", String)
], MessageSendDto.prototype, "body", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [MessageAttachmentDto], maxItems: 10 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], MessageSendDto.prototype, "attachments", void 0);
class MessageEditDto {
}
exports.MessageEditDto = MessageEditDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MessageEditDto.prototype, "channelId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MessageEditDto.prototype, "messageId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 4096),
    __metadata("design:type", String)
], MessageEditDto.prototype, "body", void 0);
class MessageDeleteDto {
}
exports.MessageDeleteDto = MessageDeleteDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MessageDeleteDto.prototype, "channelId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MessageDeleteDto.prototype, "messageId", void 0);
class ChannelJoinDto {
}
exports.ChannelJoinDto = ChannelJoinDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ChannelJoinDto.prototype, "channelId", void 0);
class ChannelLeaveDto {
}
exports.ChannelLeaveDto = ChannelLeaveDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ChannelLeaveDto.prototype, "channelId", void 0);
class TypingDto {
}
exports.TypingDto = TypingDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], TypingDto.prototype, "channelId", void 0);
class ReadDto {
}
exports.ReadDto = ReadDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ReadDto.prototype, "channelId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Последнее увиденное сообщение" }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ReadDto.prototype, "lastMessageId", void 0);
class SyncDto {
}
exports.SyncDto = SyncDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        type: Object,
        example: { "42": 1001 },
        description: "channelId → последний полученный message id",
    }),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], SyncDto.prototype, "channels", void 0);
class MessageNewDto {
}
exports.MessageNewDto = MessageNewDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MessageNewDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MessageNewDto.prototype, "channelId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AuthorDto }),
    __metadata("design:type", AuthorDto)
], MessageNewDto.prototype, "author", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MessageNewDto.prototype, "body", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [MessageAttachmentDto] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], MessageNewDto.prototype, "attachments", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Клиентский id отправителя (корреляция)" }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MessageNewDto.prototype, "clientId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "ISO 8601" }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MessageNewDto.prototype, "createdAt", void 0);
class MessageUpdatedDto {
}
exports.MessageUpdatedDto = MessageUpdatedDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MessageUpdatedDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MessageUpdatedDto.prototype, "channelId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MessageUpdatedDto.prototype, "body", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "ISO 8601" }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MessageUpdatedDto.prototype, "editedAt", void 0);
class MessageDeletedDto {
}
exports.MessageDeletedDto = MessageDeletedDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MessageDeletedDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MessageDeletedDto.prototype, "channelId", void 0);
class TypingEventDto {
}
exports.TypingEventDto = TypingEventDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], TypingEventDto.prototype, "channelId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AuthorDto }),
    __metadata("design:type", AuthorDto)
], TypingEventDto.prototype, "author", void 0);
class PresenceEventDto {
}
exports.PresenceEventDto = PresenceEventDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PresenceEventDto.prototype, "accountId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ["online", "offline"] }),
    (0, class_validator_1.IsEnum)(["online", "offline"]),
    __metadata("design:type", String)
], PresenceEventDto.prototype, "status", void 0);
class MemberEventDto {
}
exports.MemberEventDto = MemberEventDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MemberEventDto.prototype, "channelId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AuthorDto }),
    __metadata("design:type", AuthorDto)
], MemberEventDto.prototype, "account", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ["owner", "moderator", "member"] }),
    (0, class_validator_1.IsEnum)(["owner", "moderator", "member"]),
    __metadata("design:type", String)
], MemberEventDto.prototype, "role", void 0);
class ChannelUpdatedDto {
}
exports.ChannelUpdatedDto = ChannelUpdatedDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ChannelUpdatedDto.prototype, "channelId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ChannelUpdatedDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ChannelUpdatedDto.prototype, "isPublic", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: "Задан при soft-delete канала" }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ChannelUpdatedDto.prototype, "deletedAt", void 0);
class SyncAckDto {
}
exports.SyncAckDto = SyncAckDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [MessageNewDto] }),
    __metadata("design:type", Array)
], SyncAckDto.prototype, "messages", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SyncAckDto.prototype, "truncated", void 0);
class WsErrorDto {
}
exports.WsErrorDto = WsErrorDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: [
            "unauthorized",
            "forbidden",
            "not_found",
            "validation",
            "rate_limited",
            "conflict",
            "internal",
        ],
    }),
    (0, class_validator_1.IsEnum)([
        "unauthorized",
        "forbidden",
        "not_found",
        "validation",
        "rate_limited",
        "conflict",
        "internal",
    ]),
    __metadata("design:type", String)
], WsErrorDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], WsErrorDto.prototype, "message", void 0);
class AuthExpiredDto {
}
exports.AuthExpiredDto = AuthExpiredDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Access-токен истёк — переподключитесь" }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AuthExpiredDto.prototype, "reason", void 0);
exports.ChatContracts = {
    client: {
        "channel.join": ChannelJoinDto,
        "channel.leave": ChannelLeaveDto,
        "message.send": MessageSendDto,
        "message.edit": MessageEditDto,
        "message.delete": MessageDeleteDto,
        typing: TypingDto,
        read: ReadDto,
        sync: SyncDto,
    },
    server: {
        "message.new": MessageNewDto,
        "message.updated": MessageUpdatedDto,
        "message.deleted": MessageDeletedDto,
        typing: TypingEventDto,
        "presence.updated": PresenceEventDto,
        "member.joined": MemberEventDto,
        "member.left": MemberEventDto,
        "channel.updated": ChannelUpdatedDto,
        "auth.expired": AuthExpiredDto,
        error: WsErrorDto,
    },
};
//# sourceMappingURL=index.js.map