import { ConfigModule, ConfigService } from "@nestjs/config";
import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { DataSource, DataSourceOptions } from "typeorm";
import { addTransactionalDataSource } from "typeorm-transactional";
import { runMigrationsUnderLock } from "api-server-toolkit";
import { getDbConfig } from "@config/db.config";
import { ChatModule } from "./chat/chat.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { HealthModule } from "api-server-toolkit/health";
import { MetricsModule } from "api-server-toolkit/metrics";

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getDbConfig,
      async dataSourceFactory(option) {
        if (!option) throw new Error("Invalid options passed");
        // Serialize boot migrations across replicas (TypeORM has no
        // built-in migration locking); the helper consumes `migrationsRun`.
        const { migrationsRun, ...dsOption } = option;
        if (migrationsRun) {
          await runMigrationsUnderLock(dsOption as DataSourceOptions);
        }
        return addTransactionalDataSource(
          new DataSource(dsOption as DataSourceOptions),
        );
      },
    }),
    ChatModule,
    WebhooksModule,
    HealthModule.forRoot("chat-server"),
    MetricsModule.forRoot({ service: "chat-server" }),
  ],
  providers: [{ provide: APP_FILTER, useClass: SentryGlobalFilter }],
})
export class AppModule {}
