import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter } from 'events';
import { ParkingEntry, ParkingExit, Member, Payment, LostTicket, GateConfig, AuditLog, User } from '../database/entities';

@Injectable()
export class GateService extends EventEmitter implements OnModuleInit {
  constructor(
    @InjectRepository(ParkingEntry) private entryRepo: Repository<ParkingEntry>,
    @InjectRepository(ParkingExit) private exitRepo: Repository<ParkingExit>,
    @InjectRepository(Member) private memberRepo: Repository<Member>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(LostTicket) private lostTicketRepo: Repository<LostTicket>,
    @InjectRepository(GateConfig) private gateRepo: Repository<GateConfig>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {
    super();
  }

  private tariffsFilePath = require('path').join(process.cwd(), 'tariffs.json');

  private loadTariffs() {
    const fs = require('fs');
    if (!fs.existsSync(this.tariffsFilePath)) {
      const defaultTariffs = {
        car: { firstHour: 5000, hourlyRate: 3000, lostTicketFine: 50000 },
        motorcycle: { firstHour: 2000, hourlyRate: 1500, lostTicketFine: 25000 },
        truck: { firstHour: 10000, hourlyRate: 5000, lostTicketFine: 100000 },
        bus: { firstHour: 8000, hourlyRate: 4000, lostTicketFine: 80000 },
        gracePeriodMins: 10,
        memberRegistrationFee: 35000,
        memberConversionFee: 15000,
        memberTopupPackages: [
          { quota: 10, price: 50000 },
          { quota: 20, price: 95000 },
          { quota: 50, price: 230000 },
          { quota: 100, price: 450000 }
        ],
        memberMonthlyPackages: [
          { months: 1, label: '1 Bulan', price: 30000 },
          { months: 3, label: '3 Bulan', price: 80000 },
          { months: 6, label: '6 Bulan', price: 150000 },
          { months: 12, label: '1 Tahun', price: 280000 }
        ]
      };
      fs.writeFileSync(this.tariffsFilePath, JSON.stringify(defaultTariffs));
      return defaultTariffs;
    }
    try {
      const data = JSON.parse(fs.readFileSync(this.tariffsFilePath, 'utf8'));
      let modified = false;
      if (!data.bus) {
        data.bus = { firstHour: 8000, hourlyRate: 4000, lostTicketFine: 80000 };
        modified = true;
      }
      if (data.memberRegistrationFee === undefined) {
        data.memberRegistrationFee = 35000;
        modified = true;
      }
      if (data.memberConversionFee === undefined) {
        data.memberConversionFee = 15000;
        modified = true;
      }
      if (!data.memberTopupPackages) {
        data.memberTopupPackages = [
          { quota: 10, price: 50000 },
          { quota: 20, price: 95000 },
          { quota: 50, price: 230000 },
          { quota: 100, price: 450000 }
        ];
        modified = true;
      }
      if (!data.memberMonthlyPackages) {
        data.memberMonthlyPackages = [
          { months: 1, label: '1 Bulan', price: 30000 },
          { months: 3, label: '3 Bulan', price: 80000 },
          { months: 6, label: '6 Bulan', price: 150000 },
          { months: 12, label: '1 Tahun', price: 280000 }
        ];
        modified = true;
      }
      if (modified) {
        fs.writeFileSync(this.tariffsFilePath, JSON.stringify(data));
      }
      return data;
    } catch (e) {
      return {
        car: { firstHour: 5000, hourlyRate: 3000, lostTicketFine: 50000 },
        motorcycle: { firstHour: 2000, hourlyRate: 1500, lostTicketFine: 25000 },
        truck: { firstHour: 10000, hourlyRate: 5000, lostTicketFine: 100000 },
        bus: { firstHour: 8000, hourlyRate: 4000, lostTicketFine: 80000 },
        gracePeriodMins: 10,
        memberRegistrationFee: 35000,
        memberConversionFee: 15000,
        memberTopupPackages: [
          { quota: 10, price: 50000 },
          { quota: 20, price: 95000 },
          { quota: 50, price: 230000 },
          { quota: 100, price: 450000 }
        ],
        memberMonthlyPackages: [
          { months: 1, label: '1 Bulan', price: 30000 },
          { months: 3, label: '3 Bulan', price: 80000 },
          { months: 6, label: '6 Bulan', price: 150000 },
          { months: 12, label: '1 Tahun', price: 280000 }
        ]
      };
    }
  }

  // Default Tariff settings (can be modified via endpoints/database in the future)
  private tariff = this.loadTariffs();

  async onModuleInit() {
    // Seed default gate configurations if empty
    const count = await this.gateRepo.count();
    if (count === 0) {
      await this.gateRepo.save([
        { name: 'Gate Masuk 1', type: 'entry', ipAddress: '192.168.1.101', printerIp: '192.168.1.151', cctvIp: 'rtsp://192.168.1.201/h264', status: 'online' },
        { name: 'Gate Masuk 2', type: 'entry', ipAddress: '192.168.1.102', printerIp: '192.168.1.152', cctvIp: 'rtsp://192.168.1.202/h264', status: 'online' },
        { name: 'Gate Keluar 1', type: 'exit', ipAddress: '192.168.1.201', printerIp: '192.168.1.251', cctvIp: 'rtsp://192.168.1.221/h264', status: 'online' },
      ]);
    }

    // Seed default admin user if empty
    const userCount = await this.userRepo.count();
    if (userCount === 0) {
      await this.userRepo.save({
        username: 'admin',
        passwordHash: 'admin123',
        role: 'admin',
        permissions: JSON.stringify([
          'can_view_dashboard',
          'can_simulate_gates',
          'can_operate_pos',
          'can_manage_members',
          'can_manage_tariffs',
          'can_manage_gates',
          'can_manage_users',
          'can_view_reports',
          'can_view_audit',
        ]),
      });
      await this.userRepo.save({
        username: 'spv',
        passwordHash: 'spv123',
        role: 'spv',
        permissions: JSON.stringify([
          'can_view_dashboard',
          'can_operate_pos',
          'can_manage_members',
          'can_view_reports',
          'can_view_audit',
        ]),
      });
      await this.userRepo.save({
        username: 'operator',
        passwordHash: 'operator123',
        role: 'operator',
        permissions: JSON.stringify([
          'can_view_dashboard',
          'can_simulate_gates',
          'can_manage_gates',
        ]),
      });
      await this.userRepo.save({
        username: 'kasir',
        passwordHash: 'kasir123',
        role: 'cashier',
        permissions: JSON.stringify([
          'can_operate_pos',
        ]),
      });
    }

    // Force update default demo users' permissions to align with restrictions
    await this.userRepo.update(
      { username: 'kasir' },
      { permissions: JSON.stringify(['can_operate_pos']), role: 'cashier' }
    );

    // Seed some mock members for testing RFID taps
    const memberCount = await this.memberRepo.count();
    if (memberCount === 0) {
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);

      const expiredDate = new Date();
      expiredDate.setMonth(expiredDate.getMonth() - 1);

      await this.memberRepo.save([
        { name: 'Budi Santoso', rfidCardNumber: 'RFID-12345', expiryDate: nextYear, status: 'active' },
        { name: 'Siti Rahma', rfidCardNumber: 'RFID-67890', expiryDate: nextYear, status: 'active' },
        { name: 'Andi Wijaya', rfidCardNumber: 'RFID-99999', expiryDate: expiredDate, status: 'expired' },
        { name: 'Dewi Lestari', rfidCardNumber: 'RFID-88888', expiryDate: nextYear, status: 'suspended' },
      ]);
    }
  }

  // Get active gates
  async getGates() {
    return this.gateRepo.find();
  }

  // Add audit log helper
  async logAction(username: string | null, action: string, details: string) {
    let userId: string | undefined;
    if (username) {
      const user = await this.userRepo.findOne({ where: { username } });
      userId = user?.id;
    }
    await this.auditRepo.save({
      userId,
      action,
      timestamp: new Date(),
      details,
    });
    this.emit('audit_log_added');
  }

  // Loop Detector: Car arrives at gate
  async handleCarArrival(gateId: string, carDetected: boolean) {
    const gate = await this.gateRepo.findOne({ where: { id: gateId } });
    if (!gate) return;

    this.emit('gate_event', {
      gateId,
      gateName: gate.name,
      event: carDetected ? 'car_arrived' : 'car_departed',
      timestamp: new Date(),
      message: carDetected ? 'Kendaraan terdeteksi di sensor loop' : 'Kendaraan meninggalkan loop detector',
    });
  }

  // Gate Entry: Ticket Button Pressed
  async handleTicketRequest(gateId: string, plateNumber: string, cameraPhoto: string, vehicleType: string = 'car') {
    const gate = await this.gateRepo.findOne({ where: { id: gateId } });
    if (!gate || gate.type !== 'entry') {
      return { success: false, message: 'Invalid entry gate' };
    }

    const ticketCode = 'P-' + Math.floor(100000 + Math.random() * 900000);
    const entryTime = new Date();

    const entry = await this.entryRepo.save({
      ticketCode,
      plateNumber: plateNumber || 'B ' + Math.floor(1000 + Math.random() * 9000) + ' MOK', // Mock license plate
      entryTime,
      entryCameraPhoto: cameraPhoto,
      gateId: gate.id,
      type: 'daily',
      vehicleType,
      isExited: false,
    });

    await this.logAction(null, 'TICKET_PRINTED', `Karcis dicetak: ${ticketCode} untuk plat ${entry.plateNumber}`);

    // Emit event to command gate open and print ticket
    this.emit('gate_action', {
      gateId: gate.id,
      action: 'open_barrier_and_print',
      ticket: {
        ticketCode,
        entryTime,
        plateNumber: entry.plateNumber,
        gateName: gate.name,
      },
    });

    // Physical hardware execution if in production mode
    const mode = this.getSystemMode();
    if (mode === 'production') {
      this.printToNetworkPrinter(gate.printerIp || '192.168.1.150', [
        'MANLESS PARKING SYSTEM',
        `GATE: ${gate.name}`,
        '----------------------',
        `TICKET: ${ticketCode}`,
        `PLATE : ${entry.plateNumber}`,
        `MASUK : ${entryTime.toLocaleString('id-ID')}`,
        '----------------------',
        'HARAP SIMPAN TIKET INI',
      ]);
      this.triggerBarrierEsp32(gate.ipAddress);
    }

    return { success: true, entry };
  }

  // Gate Entry: RFID card tapped (for Members)
  async handleRfidTap(gateId: string, rfidCardNumber: string, cameraPhoto: string) {
    const gate = await this.gateRepo.findOne({ where: { id: gateId } });
    if (!gate) {
      return { success: false, message: 'Invalid gate ID' };
    }

    // Verify RFID member status
    const member = await this.memberRepo.findOne({ where: { rfidCardNumber } });
    if (!member) {
      this.emit('gate_error', { gateId, message: 'Kartu tidak terdaftar' });
      return { success: false, message: 'Kartu tidak terdaftar' };
    }

    const now = new Date();
    if (member.status !== 'active') {
      this.emit('gate_error', { gateId, message: `Status kartu: ${member.status.toUpperCase()}` });
      return { success: false, message: `Status kartu member ${member.status}` };
    }

    const memberType = (member as any).memberType || 'monthly';

    // ─── VALIDASI MEMBER BULANAN ────────────────────────────
    if (memberType === 'monthly') {
      if (!member.expiryDate || new Date(member.expiryDate) < now) {
        member.status = 'expired';
        await this.memberRepo.save(member);
        this.emit('gate_error', { gateId, message: 'Kartu member kadaluwarsa' });
        return { success: false, message: 'Kartu member telah kadaluwarsa' };
      }
    }

    // ─── VALIDASI MEMBER KUOTA (hanya saat masuk / entry gate) ─
    if (memberType === 'quota' && gate.type === 'entry') {
      const quotaTotal = (member as any).quotaTotal || 0;
      const quotaUsed  = (member as any).quotaUsed  || 0;
      if (quotaUsed >= quotaTotal) {
        this.emit('gate_error', { gateId, message: `Kuota habis (${quotaUsed}/${quotaTotal})` });
        return { success: false, message: `Kuota masuk member sudah habis (${quotaUsed}/${quotaTotal})` };
      }
    }

    // Process entry or exit based on gate type
    if (gate.type === 'entry') {
      const entry = await this.entryRepo.save({
        rfidCardNumber,
        plateNumber: 'MEMBER-' + member.name.replace(/\s+/g, '').substring(0, 5).toUpperCase(),
        entryTime: now,
        entryCameraPhoto: cameraPhoto,
        gateId: gate.id,
        type: 'member',
        isExited: false,
      });

      // ─── Increment kuota jika member kuota ───────────────
      if (memberType === 'quota') {
        (member as any).quotaUsed = ((member as any).quotaUsed || 0) + 1;
        await this.memberRepo.save(member);
      }

      const quotaLeft = memberType === 'quota'
        ? `${(member as any).quotaTotal - (member as any).quotaUsed} sisa kuota`
        : null;

      await this.logAction(null, 'MEMBER_ENTRY',
        `Member masuk: ${member.name} (${rfidCardNumber}) [${memberType === 'quota' ? 'Kuota, ' + quotaLeft : 'Bulanan'}]`
      );

      // Emit open barrier
      this.emit('gate_action', {
        gateId: gate.id,
        action: 'open_barrier_member',
        member: {
          name: member.name,
          rfidCardNumber,
          memberType,
          quotaLeft,
        },
      });

      // Trigger physical barrier if in production mode
      const mode = this.getSystemMode();
      if (mode === 'production') {
        this.triggerBarrierEsp32(gate.ipAddress);
      }

      return { success: true, entry, member };
    } else {
      // Exit gate tap RFID member
      // Find latest entry for this RFID that hasn't exited yet
      const activeEntry = await this.entryRepo.findOne({
        where: { rfidCardNumber, isExited: false },
        order: { entryTime: 'DESC' },
      });

      if (!activeEntry) {
        // Log event, open anyway since members have pre-paid monthly access, but record entry if missing
        const dummyEntry = await this.entryRepo.save({
          rfidCardNumber,
          plateNumber: 'MEMBER-' + member.name.replace(/\s+/g, '').substring(0, 5).toUpperCase(),
          entryTime: new Date(now.getTime() - 3600000), // assumed 1 hour ago
          gateId: gate.id,
          type: 'member',
          isExited: true,
        });

        await this.exitRepo.save({
          entryId: dummyEntry.id,
          exitTime: now,
          exitCameraPhoto: cameraPhoto,
          gateId: gate.id,
        });

        await this.paymentRepo.save({
          entryId: dummyEntry.id,
          amount: 0,
          paymentMethod: 'member',
          paymentTime: now,
          status: 'paid',
        });
      } else {
        activeEntry.isExited = true;
        await this.entryRepo.save(activeEntry);

        await this.exitRepo.save({
          entryId: activeEntry.id,
          exitTime: now,
          exitCameraPhoto: cameraPhoto,
          gateId: gate.id,
        });

        await this.paymentRepo.save({
          entryId: activeEntry.id,
          amount: 0,
          paymentMethod: 'member',
          paymentTime: now,
          status: 'paid',
        });
      }

      await this.logAction(null, 'MEMBER_EXIT', `Member keluar: ${member.name} (${rfidCardNumber})`);

      this.emit('gate_action', {
        gateId: gate.id,
        action: 'open_barrier_member_exit',
        member: {
          name: member.name,
          rfidCardNumber,
        },
      });

      // Trigger physical barrier if in production mode
      const mode = this.getSystemMode();
      if (mode === 'production') {
        this.triggerBarrierEsp32(gate.ipAddress);
      }

      return { success: true, member };
    }
  }

  // Calculate parking fee — supports 'hourly' and 'daily' billing modes
  calculateParkingFee(entryTime: Date, vehicleType: string = 'car'): number {
    const tariffs = this.loadTariffs();
    const gracePeriodMins = tariffs.gracePeriodMins || 10;
    const typeConfig = tariffs[vehicleType] || tariffs['car'] || {
      billingMode: 'hourly',
      firstHour: 5000,
      hourlyRate: 3000,
      dailyRate: 30000,
    };

    const now = new Date();
    const durationMs = now.getTime() - new Date(entryTime).getTime();
    const durationMins = Math.floor(durationMs / 60000);

    // Grace period — free regardless of mode
    if (durationMins <= gracePeriodMins) {
      return 0;
    }

    // ─── DAILY MODE ─────────────────────────────────────
    if (typeConfig.billingMode === 'daily') {
      const dailyRate = typeConfig.dailyRate || 30000;
      // Each started 24-hour block is charged as 1 full day
      const durationHours = durationMins / 60;
      const days = Math.ceil(durationHours / 24);
      return days * dailyRate;
    }

    // ─── HOURLY MODE (default) ───────────────────────────
    const durationHours = Math.ceil(durationMins / 60);
    if (durationHours <= 1) {
      return typeConfig.firstHour || 5000;
    }
    return (typeConfig.firstHour || 5000) + (durationHours - 1) * (typeConfig.hourlyRate || 3000);
  }


  // Check Ticket (For Exit Gate Scanner)
  async checkTicketStatus(ticketCode: string) {
    const entry = await this.entryRepo.findOne({
      where: { ticketCode, isExited: false },
    });

    if (!entry) {
      return { success: false, message: 'Karcis tidak aktif atau tidak ditemukan' };
    }

    // Check if it's already paid (e.g. at central cashier) or needs payment
    const payment = await this.paymentRepo.findOne({
      where: { entryId: entry.id, status: 'paid' },
    });

    const fee = this.calculateParkingFee(entry.entryTime, (entry as any).vehicleType || 'car');

    return {
      success: true,
      entry,
      fee,
      isPaid: !!payment,
    };
  }

  async handlePaymentAndExit(gateId: string, ticketCode: string, paymentMethod: string, amount: number, cameraPhoto: string, plateNumber?: string) {
    const gate = await this.gateRepo.findOne({ where: { id: gateId } });
    if (!gate || gate.type !== 'exit') {
      return { success: false, message: 'Invalid exit gate' };
    }

    const entry = await this.entryRepo.findOne({
      where: { ticketCode, isExited: false },
    });

    if (!entry) {
      return { success: false, message: 'Data karcis tidak valid atau sudah keluar' };
    }

    if (plateNumber) {
      entry.plateNumber = plateNumber;
    }

    // Save payment
    await this.paymentRepo.save({
      entryId: entry.id,
      amount,
      paymentMethod,
      paymentTime: new Date(),
      status: 'paid',
    });

    // Mark as exited
    entry.isExited = true;
    await this.entryRepo.save(entry);

    // Save exit log
    const exit = await this.exitRepo.save({
      entryId: entry.id,
      exitTime: new Date(),
      exitCameraPhoto: cameraPhoto,
      gateId: gate.id,
    });

    await this.logAction(null, 'PARKING_EXIT', `Kendaraan keluar: Karcis ${ticketCode}, Plat ${entry.plateNumber}, Pembayaran ${paymentMethod} sebesar Rp ${amount}`);

    // Command open exit gate and print receipt
    this.emit('gate_action', {
      gateId: gate.id,
      action: 'open_barrier_exit_and_receipt',
      receipt: {
        ticketCode,
        entryTime: entry.entryTime,
        exitTime: exit.exitTime,
        plateNumber: entry.plateNumber,
        amount,
        paymentMethod,
        gateName: gate.name,
      },
    });

    // Trigger physical print & barrier open in production mode
    const mode = this.getSystemMode();
    if (mode === 'production') {
      this.printToNetworkPrinter(gate.printerIp || '192.168.1.250', [
        'BUKTI BAYAR PARKIR',
        `GATE: ${gate.name}`,
        '----------------------',
        `KARCIS: ${ticketCode}`,
        `PLAT  : ${entry.plateNumber}`,
        `MASUK : ${entry.entryTime.toLocaleString('id-ID')}`,
        `KELUAR: ${exit.exitTime.toLocaleString('id-ID')}`,
        `METODE: ${paymentMethod}`,
        `TOTAL : Rp ${amount.toLocaleString('id-ID')}`,
        '----------------------',
        'TERIMA KASIH',
      ]);
      this.triggerBarrierEsp32(gate.ipAddress);
    }

    return { success: true, entry, exit };
  }

  // Handle Lost Ticket Fine
  async handleLostTicketPayment(gateId: string, entryId: string, identityCard: string, stnkNumber: string, operatorUsername: string) {
    const entry = await this.entryRepo.findOne({ where: { id: entryId, isExited: false } });
    if (!entry) {
      return { success: false, message: 'Entry parkir tidak ditemukan atau sudah keluar' };
    }

    const user = await this.userRepo.findOne({ where: { username: operatorUsername } });
    const operatorId = user?.id || 'system';

    const tariffs = this.loadTariffs();
    const vehicleType = (entry as any).vehicleType || 'car';
    const penaltyAmount = (tariffs[vehicleType] || tariffs['car'] || { lostTicketFine: 50000 }).lostTicketFine;

    // Save lost ticket entry
    const lostTicket = await this.lostTicketRepo.save({
      entryId: entry.id,
      penaltyAmount,
      identityCard,
      stnkNumber,
      operatorId,
      approvedAt: new Date(),
    });

    // Save payment
    await this.paymentRepo.save({
      entryId: entry.id,
      amount: penaltyAmount,
      paymentMethod: 'cash',
      paymentTime: new Date(),
      status: 'paid',
    });

    // Mark entry as exited
    entry.isExited = true;
    await this.entryRepo.save(entry);

    // Save exit record
    await this.exitRepo.save({
      entryId: entry.id,
      exitTime: new Date(),
      exitCameraPhoto: '',
      gateId,
    });

    const gate = await this.gateRepo.findOne({ where: { id: gateId } });

    await this.logAction(operatorUsername, 'LOST_TICKET_APPROVED', `Karcis Hilang disetujui: Plat ${entry.plateNumber}, STNK ${stnkNumber}, Denda Rp ${penaltyAmount}`);

    // Trigger barrier open for exit gate
    this.emit('gate_action', {
      gateId,
      action: 'open_barrier_exit_lost_ticket',
      receipt: {
        ticketCode: entry.ticketCode || 'RFID-MEMBER',
        plateNumber: entry.plateNumber,
        amount: penaltyAmount,
        paymentMethod: 'cash (denda)',
      },
    });

    // Trigger physical print & barrier open in production mode
    const mode = this.getSystemMode();
    if (mode === 'production' && gate) {
      this.printToNetworkPrinter(gate.printerIp || '192.168.1.250', [
        'BUKTI BAYAR PARKIR (DENDA)',
        `GATE: ${gate.name}`,
        '----------------------',
        `KARCIS: ${entry.ticketCode || 'DENDA_HILANG'}`,
        `PLAT  : ${entry.plateNumber}`,
        `MASUK : ${entry.entryTime.toLocaleString('id-ID')}`,
        `KELUAR: ${new Date().toLocaleString('id-ID')}`,
        `METODE: CASH (Denda)`,
        `TOTAL : Rp ${penaltyAmount.toLocaleString('id-ID')}`,
        '----------------------',
        'TERIMA KASIH',
      ]);
      this.triggerBarrierEsp32(gate.ipAddress);
    }

    return { success: true, lostTicket };
  }

  // Tariff CRUD helpers
  getTariffConfig() {
    return this.loadTariffs();
  }

  updateTariffConfig(newTariffs: any) {
    const fs = require('fs');
    fs.writeFileSync(this.tariffsFilePath, JSON.stringify(newTariffs));
    this.tariff = newTariffs;
    return newTariffs;
  }

  getSystemMode(): string {
    const fs = require('fs');
    const path = require('path');
    const settingsFilePath = path.join(process.cwd(), 'settings.json');
    if (!fs.existsSync(settingsFilePath)) {
      return 'simulation';
    }
    try {
      return JSON.parse(fs.readFileSync(settingsFilePath, 'utf8')).systemMode;
    } catch (e) {
      return 'simulation';
    }
  }

  getOperatorPrinterIp(): string {
    const fs = require('fs');
    const path = require('path');
    const settingsFilePath = path.join(process.cwd(), 'settings.json');
    if (!fs.existsSync(settingsFilePath)) {
      return '192.168.1.150';
    }
    try {
      return JSON.parse(fs.readFileSync(settingsFilePath, 'utf8')).operatorPrinterIp || '192.168.1.150';
    } catch (e) {
      return '192.168.1.150';
    }
  }

  async printToNetworkPrinter(printerIp: string, content: string[]) {
    const net = require('net');
    const client = new net.Socket();
    client.setTimeout(2500);

    return new Promise((resolve) => {
      client.connect(9100, printerIp, () => {
        // Initialize printer (ESC @)
        client.write(Buffer.from([0x1B, 0x40]));
        // Print lines
        content.forEach((line) => {
          client.write(line + '\n');
        });
        // Paper cut (GS V 66 0)
        client.write(Buffer.from([0x1D, 0x56, 0x42, 0x00]));
        client.end();
        resolve(true);
      });

      client.on('error', (err) => {
        console.warn(`[PRINTER ERROR] Gagal cetak ke ${printerIp}:`, err.message);
        resolve(false);
      });

      client.on('timeout', () => {
        client.destroy();
        resolve(false);
      });
    });
  }

  async triggerBarrierEsp32(gateIp: string) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      await fetch(`http://${gateIp}/open-barrier`, { signal: controller.signal });
      clearTimeout(timeoutId);
      console.log(`[BARRIER ESP32] Berhasil kirim trigger open ke http://${gateIp}/open-barrier`);
    } catch (e: any) {
      console.warn(`[BARRIER ESP32 ERROR] Gagal mengirim sinyal ke http://${gateIp}/open-barrier:`, e.message);
    }
  }
}
