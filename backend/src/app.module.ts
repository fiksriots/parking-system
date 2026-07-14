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
      type: process.env.DATABASE_URL ? 'postgres' : ('better-sqlite3' as any),
      ...(process.env.DATABASE_URL
        ? {
            url: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
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
