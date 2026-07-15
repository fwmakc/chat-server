# Chat Server

WebSocket-сервер чата: комнаты, подключения, обмен сообщениями в реальном времени.

Перенесён из [api-server](https://github.com/fwmakc/api-server) на этапе разделения монолита (Stage 1, Issue #6).

## Статус: заготовка

Код перенесён, но требует адаптации перед запуском:

- [ ] Извлечь `common/` (CommonService, EntityController, колонки, DTO) в общий npm-пакет
- [ ] Настроить JWT verification через JWKS auth-server
- [ ] Настроить WebSocket adapter в `main.ts`
- [ ] Адаптировать импорты `@src/account/` → получать account_id из JWT
- [ ] Подключить Redis для event bus

## Архитектура

См. [Issue #6](https://github.com/fwmakc/api-server/issues/6) — полная схема разделения.

## Запуск

```shell
npm install
npm run dev
```
