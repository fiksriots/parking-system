import { Controller, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, Between, In } from 'typeorm';
import { ParkingEntry, ParkingExit, Payment, AuditLog, MemberTransaction, LostTicket } from '../database/entities';

@Controller('api/reports')
export class ReportController {
  constructor(
    @InjectRepository(ParkingEntry) private entryRepo: Repository<ParkingEntry>,
    @InjectRepository(ParkingExit) private exitRepo: Repository<ParkingExit>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    @InjectRepository(MemberTransaction) private memberTxRepo: Repository<MemberTransaction>,
    @InjectRepository(LostTicket) private lostTicketRepo: Repository<LostTicket>,
  ) {}

  @Get('stats')
  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalEntriesToday = await this.entryRepo.count({
      where: { entryTime: MoreThanOrEqual(today) },
    });

    // Exits today
    const totalExitsToday = await this.exitRepo.count({
      where: { exitTime: MoreThanOrEqual(today) },
    });

    // Current occupancy (total entries still inside, not exited)
    const occupancyCount = await this.entryRepo.count({
      where: { isExited: false },
    });

    // Revenue today
    const paymentsToday = await this.paymentRepo.find({
      where: { paymentTime: MoreThanOrEqual(today), status: 'paid' },
    });
    const totalRevenueToday = paymentsToday.reduce((sum, p) => sum + p.amount, 0);

    // Payment method split
    const paymentMethods = { cash: 0, qris: 0, member: 0 };
    paymentsToday.forEach((p) => {
      const method = p.paymentMethod.toLowerCase();
      if (method.includes('cash')) paymentMethods.cash += p.amount;
      else if (method.includes('qris')) paymentMethods.qris += p.amount;
      else if (method.includes('member')) paymentMethods.member += p.amount;
    });

    return {
      totalEntriesToday,
      totalExitsToday,
      occupancyCount,
      totalRevenueToday,
      paymentMethods,
    };
  }

  @Get('recent-logs')
  async getRecentLogs() {
    // Return latest 20 entries
    const entries = await this.entryRepo.find({
      order: { entryTime: 'DESC' },
      take: 20,
    });
    return entries;
  }

  @Get('active-entries')
  async getActiveEntries() {
    // Return all cars currently parked (for lost ticket lookup)
    const entries = await this.entryRepo.find({
      where: { isExited: false },
      order: { entryTime: 'DESC' },
    });
    return entries;
  }

  @Get('hourly-stats')
  async getHourlyStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const entries = await this.entryRepo.find({
      where: { entryTime: Between(today, tomorrow) },
    });

    const exits = await this.exitRepo.find({
      where: { exitTime: Between(today, tomorrow) },
    });

    // Initialize 24 hours
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: `${String(i).padStart(2, '0')}:00`,
      masuk: 0,
      keluar: 0,
    }));

    entries.forEach((e) => {
      const hour = new Date(e.entryTime).getHours();
      hourlyData[hour].masuk += 1;
    });

    exits.forEach((ex) => {
      const hour = new Date(ex.exitTime).getHours();
      hourlyData[hour].keluar += 1;
    });

    return hourlyData;
  }

  @Get('audit-logs')
  async getAuditLogs() {
    return this.auditRepo.find({
      order: { timestamp: 'DESC' },
      take: 50,
    });
  }

  @Get('financial-ledger')
  async getFinancialLedger(
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
  ) {
    let start = new Date();
    start.setHours(0, 0, 0, 0);
    let end = new Date();
    end.setHours(23, 59, 59, 999);

    if (startDateStr) {
      start = new Date(startDateStr);
      start.setHours(0, 0, 0, 0);
    }
    if (endDateStr) {
      end = new Date(endDateStr);
      end.setHours(23, 59, 59, 999);
    }

    // Fetch payments within range
    const payments = await this.paymentRepo.find({
      where: { paymentTime: Between(start, end), status: 'paid' },
      order: { paymentTime: 'DESC' },
    });

    // Fetch member transactions within range
    const memberTxs = await this.memberTxRepo.find({
      where: { timestamp: Between(start, end) },
      order: { timestamp: 'DESC' },
    });

    // Fetch lost tickets to map entries
    const lostTickets = await this.lostTicketRepo.find({
      where: { approvedAt: Between(start, end) },
    });

    const entriesMap = new Map<string, ParkingEntry>();
    const entryIds = [
      ...payments.map((p) => p.entryId),
      ...lostTickets.map((lt) => lt.entryId),
    ].filter((id) => !!id);

    if (entryIds.length > 0) {
      const entries = await this.entryRepo.find({
        where: { id: In(entryIds) }
      });
      entries.forEach((e) => entriesMap.set(e.id, e));
    }

    // Merge chronologically
    const ledgerItems: any[] = [];
    let totalParkingRevenue = 0;
    let totalMemberRevenue = 0;
    let totalLostTicketRevenue = 0;

    const paymentMethods = { cash: 0, qris: 0, member: 0 };

    // Process normal entry payments
    payments.forEach((p) => {
      const entry = entriesMap.get(p.entryId);
      const isLost = lostTickets.some((lt) => lt.entryId === p.entryId);
      
      const category = isLost ? 'Denda Tiket Hilang' : 'Parkir Mandiri';
      const typeLabel = isLost ? 'lost_ticket_penalty' : 'parking_payment';
      const plate = entry ? entry.plateNumber : '-';
      const ticket = entry ? (entry.ticketCode || 'RFID-MEMBER') : '-';
      const vehicle = entry ? entry.vehicleType.toUpperCase() : 'CAR';
      
      const description = isLost 
        ? `Denda Karcis Hilang (${vehicle}) - Plat ${plate}`
        : `Pembayaran Parkir ${vehicle} - Karcis ${ticket} - Plat ${plate}`;

      if (isLost) {
        totalLostTicketRevenue += p.amount;
      } else {
        totalParkingRevenue += p.amount;
      }

      const method = p.paymentMethod.toLowerCase();
      if (method.includes('cash')) paymentMethods.cash += p.amount;
      else if (method.includes('qris')) paymentMethods.qris += p.amount;
      else if (method.includes('member')) paymentMethods.member += p.amount;

      ledgerItems.push({
        id: p.id,
        timestamp: p.paymentTime,
        type: typeLabel,
        category,
        description,
        amount: p.amount,
        paymentMethod: p.paymentMethod.toUpperCase(),
        operator: isLost ? 'Kasir (Denda)' : 'Gate Out (Otomatis)',
      });
    });

    // Process member transactions
    memberTxs.forEach((m) => {
      totalMemberRevenue += m.amount;
      paymentMethods.cash += m.amount; // Member transactions are cash in cashier box

      let typeLabel = 'member_transaction';
      let category = 'Member RFID';
      if (m.transactionType === 'registration') {
        category = 'Registrasi Member';
        typeLabel = 'member_registration';
      } else if (m.transactionType === 'topup_quota') {
        category = 'Top-up Member';
        typeLabel = 'member_topup';
      } else if (m.transactionType === 'renew_monthly') {
        category = 'Perpanjang Member';
        typeLabel = 'member_renewal';
      } else if (m.transactionType === 'change_type') {
        category = 'Konversi Member';
        typeLabel = 'member_conversion';
      }

      ledgerItems.push({
        id: m.id,
        timestamp: m.timestamp,
        type: typeLabel,
        category,
        description: `Member ${m.memberName} (${m.rfidCardNumber}) - ${m.details}`,
        amount: m.amount,
        paymentMethod: 'CASH',
        operator: m.operatorUsername,
      });
    });

    // Sort chronologically (latest first)
    ledgerItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const grandTotalRevenue = totalParkingRevenue + totalMemberRevenue + totalLostTicketRevenue;

    return {
      stats: {
        totalParkingRevenue,
        totalMemberRevenue,
        totalLostTicketRevenue,
        grandTotalRevenue,
        paymentMethods,
      },
      ledger: ledgerItems,
    };
  }
}
