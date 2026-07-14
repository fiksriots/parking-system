import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GateModule } from './gate/gate.module';
import { MemberModule } from './member/member.module';
import { PaymentModule } from './payment/payment.module';
import { ReportModule } from './report/report.module';
import { UserModule } from './user/user.module';
import { User, Member, ParkingEntry, ParkingExit, Payment, LostTicket, GateConfig, AuditLog, MemberTransaction, CashierShift } from './database/entities';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: (process.env.DB_TYPE || (process.env.DATABASE_URL?.startsWith('mysql') ? 'mysql' : process.env.DATABASE_URL ? 'postgres' : 'better-sqlite3')) as any,
      ...(process.env.DATABASE_URL
        ? {
            url: process.env.DATABASE_URL,
            ssl: process.env.DATABASE_URL.includes('sslmode=disable') ? false : (process.env.DATABASE_URL.startsWith('mysql') ? undefined : { rejectUnauthorized: false }),
          }
        : process.env.DB_HOST
        ? {
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT || '3306', 10),
            username: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
          }
        : {
            database: 'database.sqlite',
          }),
      entities: [
        User,
        Member,
        ParkingEntry,
        ParkingExit,
        Payment,
        LostTicket,
        GateConfig,
        AuditLog,
        MemberTransaction,
        CashierShift,
      ],
      synchronize: true,
      logging: false,
    }),
    GateModule,
    MemberModule,
    PaymentModule,
    ReportModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
