import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  passwordHash: string;

  @Column({ default: 'cashier' }) // 'admin' | 'spv' | 'operator' | 'cashier'
  role: string;

  @Column({ default: '[]' })
  permissions: string; // JSON string array of permissions

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('members')
export class Member {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  rfidCardNumber: string;

  // 'monthly' = member berbasis tanggal kadaluwarsa
  // 'quota'   = member berbasis jumlah masuk (kuota)
  @Column({ default: 'monthly' })
  memberType: string;

  // Used for monthly type
  @Column({ nullable: true })
  expiryDate: Date;

  // Used for quota type
  @Column({ type: 'int', default: 0 })
  quotaTotal: number;

  @Column({ type: 'int', default: 0 })
  quotaUsed: number;

  // Identity fields
  @Column({ nullable: true })
  identityCard: string; // NIK KTP

  @Column({ nullable: true })
  phoneNumber: string;

  @Column({ nullable: true })
  email: string;

  @Column({ default: 'active' }) // 'active' | 'suspended' | 'expired'
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('parking_entries')
export class ParkingEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, nullable: true })
  ticketCode: string;

  @Column({ nullable: true })
  rfidCardNumber: string;

  @Column()
  plateNumber: string;

  @Column()
  entryTime: Date;

  @Column({ type: 'text', nullable: true })
  entryCameraPhoto: string; // Base64 or Mock URL

  @Column()
  gateId: string;

  @Column({ default: 'daily' }) // 'daily' | 'member'
  type: string;

  @Column({ default: 'car' }) // 'car' | 'motorcycle' | 'truck'
  vehicleType: string;

  @Column({ type: 'boolean', default: false })
  isExited: boolean;
}

@Entity('parking_exits')
export class ParkingExit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  entryId: string;

  @Column()
  exitTime: Date;

  @Column({ type: 'text', nullable: true })
  exitCameraPhoto: string; // Base64 or Mock URL

  @Column()
  gateId: string;
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  entryId: string;

  @Column({ type: 'float' })
  amount: number;

  @Column()
  paymentMethod: string; // 'cash' | 'qris' | 'member'

  @Column()
  paymentTime: Date;

  @Column({ default: 'unpaid' }) // 'paid' | 'unpaid'
  status: string;
}

@Entity('lost_tickets')
export class LostTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  entryId: string;

  @Column({ type: 'float' })
  penaltyAmount: number;

  @Column()
  identityCard: string; // KTP number

  @Column()
  stnkNumber: string;

  @Column()
  operatorId: string;

  @Column({ nullable: true })
  approvedAt: Date;
}

@Entity('gate_configs')
export class GateConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  type: string; // 'entry' | 'exit'

  @Column({ default: '192.168.1.100' })
  ipAddress: string;

  @Column({ default: '192.168.1.150' })
  printerIp: string;

  @Column({ default: 'rtsp://192.168.1.200/h264' })
  cctvIp: string;

  @Column({ default: 'online' }) // 'online' | 'offline'
  status: string;
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId: string;

  @Column()
  action: string;

  @Column()
  timestamp: Date;

  @Column({ type: 'text', nullable: true })
  details: string;
}

@Entity('member_transactions')
export class MemberTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  memberId: string;

  @Column()
  memberName: string;

  @Column()
  rfidCardNumber: string;

  @Column()
  transactionType: string; // 'registration' | 'topup_quota' | 'renew_monthly' | 'change_type'

  @Column({ type: 'float', default: 0 })
  amount: number;

  @Column({ nullable: true })
  details: string;

  @Column()
  operatorUsername: string;

  @CreateDateColumn()
  timestamp: Date;
}

@Entity('cashier_shifts')
export class CashierShift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  operatorUsername: string;

  @Column()
  openTime: Date;

  @Column({ nullable: true })
  closeTime: Date;

  @Column({ type: 'float', default: 0 })
  startingFloat: number; // uang modal kembalian

  @Column({ type: 'float', default: 0 })
  cashRevenue: number;

  @Column({ type: 'float', default: 0 })
  nonCashRevenue: number;

  @Column({ type: 'float', default: 0 })
  depositAmount: number; // uang fisik disetor

  @Column({ type: 'float', default: 0 })
  discrepancy: number; // selisih setoran vs expected

  @Column({ default: 'open' }) // 'open' | 'closed'
  status: string;
}
