import { Controller, Get, Post, Delete, Body, Param, HttpStatus, HttpException, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { User, CashierShift, Payment, MemberTransaction, ParkingEntry } from '../database/entities';

@Controller('api/users')
export class UserController {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(CashierShift)
    private readonly shiftRepo: Repository<CashierShift>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(MemberTransaction)
    private readonly memberTxRepo: Repository<MemberTransaction>,
    @InjectRepository(ParkingEntry)
    private readonly entryRepo: Repository<ParkingEntry>,
  ) {}

  // Key: gateId, Value: username
  public static occupiedGates = new Map<string, string>();

  @Post('login')
  async login(@Body() body: { username: string; passwordHash: string; gateId?: string }) {
    const user = await this.userRepo.findOne({
      where: { username: body.username },
    });

    if (!user || user.passwordHash !== body.passwordHash) {
      throw new HttpException(
        { success: false, message: 'Username atau password salah' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Cashier gate occupancy validation
    if (user.role === 'cashier') {
      if (!body.gateId || body.gateId.trim() === '') {
        throw new HttpException(
          { success: false, message: 'Pintu gate keluar wajib dipilih untuk peran Kasir!' },
          HttpStatus.BAD_REQUEST,
        );
      }
      
      const occupant = UserController.occupiedGates.get(body.gateId);
      if (occupant && occupant !== user.username) {
        throw new HttpException(
          { success: false, message: `Pintu gate keluar tersebut sedang aktif digunakan oleh kasir: ${occupant}!` },
          HttpStatus.BAD_REQUEST,
        );
      }
      
      // Clean up any other gates this cashier might have left occupied
      for (const [gId, uName] of UserController.occupiedGates.entries()) {
        if (uName === user.username) {
          UserController.occupiedGates.delete(gId);
        }
      }

      // Set new occupation
      UserController.occupiedGates.set(body.gateId, user.username);
    } else {
      // If not a cashier, clear any gates they might have occupied
      for (const [gId, uName] of UserController.occupiedGates.entries()) {
        if (uName === user.username) {
          UserController.occupiedGates.delete(gId);
        }
      }
    }

    let parsedPermissions = [];
    try {
      parsedPermissions = JSON.parse(user.permissions || '[]');
    } catch (e) {
      parsedPermissions = [];
    }

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions: parsedPermissions,
        gateId: user.role === 'cashier' ? body.gateId : null,
      },
    };
  }

  @Post('logout')
  async logout(@Body() body: { username: string; gateId?: string }) {
    if (body.gateId) {
      if (UserController.occupiedGates.get(body.gateId) === body.username) {
        UserController.occupiedGates.delete(body.gateId);
      }
    }
    for (const [gId, uName] of UserController.occupiedGates.entries()) {
      if (uName === body.username) {
        UserController.occupiedGates.delete(gId);
      }
    }
    return { success: true };
  }

  @Get()
  async getUsers() {
    const users = await this.userRepo.find({
      select: {
        id: true,
        username: true,
        role: true,
        permissions: true,
        createdAt: true,
      },
      order: { username: 'ASC' },
    });

    return users.map((u) => {
      let parsed = [];
      try {
        parsed = JSON.parse(u.permissions || '[]');
      } catch (e) {
        parsed = [];
      }
      return {
        ...u,
        permissions: parsed,
      };
    });
  }

  @Post()
  async createUser(@Body() userData: any) {
    const existing = await this.userRepo.findOne({
      where: { username: userData.username },
    });
    if (existing) {
      throw new HttpException(
        { success: false, message: 'Username sudah digunakan' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (userData.permissions && Array.isArray(userData.permissions)) {
      userData.permissions = JSON.stringify(userData.permissions);
    }

    const user = this.userRepo.create(userData as Partial<User>) as User;
    await this.userRepo.save(user);

    let parsed = [];
    try {
      parsed = JSON.parse(user.permissions || '[]');
    } catch (e) {
      parsed = [];
    }

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      permissions: parsed,
    };
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (user && user.username === 'admin') {
      throw new HttpException(
        { success: false, message: 'User admin bawaan tidak dapat dihapus' },
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.userRepo.delete(id);
    return { success: true };
  }

  @Get('shift/active/:username')
  async getActiveShift(@Param('username') username: string) {
    const shift = await this.shiftRepo.findOne({
      where: { operatorUsername: username, status: 'open' },
    });
    return shift || { success: false, message: 'Tidak ada shift aktif' };
  }

  @Post('shift/open')
  async openShift(@Body() body: { username: string; startingFloat: number }) {
    const existing = await this.shiftRepo.findOne({
      where: { operatorUsername: body.username, status: 'open' },
    });
    if (existing) {
      return { success: false, message: 'Operator sudah memiliki shift yang aktif!', shift: existing };
    }

    const newShift = await this.shiftRepo.save({
      operatorUsername: body.username,
      openTime: new Date(),
      startingFloat: body.startingFloat || 0,
      cashRevenue: 0,
      nonCashRevenue: 0,
      depositAmount: 0,
      discrepancy: 0,
      status: 'open',
    });

    return { success: true, shift: newShift };
  }

  @Get('shift/summary/:shiftId')
  async getShiftSummary(@Param('shiftId') shiftId: string) {
    const shift = await this.shiftRepo.findOne({ where: { id: shiftId } });
    if (!shift) {
      throw new HttpException({ success: false, message: 'Shift tidak ditemukan' }, HttpStatus.NOT_FOUND);
    }

    const start = shift.openTime;
    const end = shift.closeTime || new Date();

    const payments = await this.paymentRepo.find({
      where: { paymentTime: Between(start, end), status: 'paid' },
    });

    const memberTxs = await this.memberTxRepo.find({
      where: { operatorUsername: shift.operatorUsername, timestamp: Between(start, end) },
    });

    let cashRevenue = 0;
    let nonCashRevenue = 0;

    memberTxs.forEach((m) => {
      cashRevenue += m.amount;
    });

    payments.forEach((p) => {
      const method = p.paymentMethod.toLowerCase();
      if (method.includes('cash')) {
        cashRevenue += p.amount;
      } else if (method.includes('qris')) {
        nonCashRevenue += p.amount;
      }
    });

    const expectedCash = shift.startingFloat + cashRevenue;

    const entryIds = payments.map(p => p.entryId).filter(id => !!id);
    const entriesMap = new Map<string, ParkingEntry>();
    if (entryIds.length > 0) {
      const entries = await this.entryRepo.find({
        where: { id: In(entryIds) }
      });
      entries.forEach(e => entriesMap.set(e.id, e));
    }

    const txs: any[] = [];
    memberTxs.forEach((m) => {
      txs.push({
        id: m.id,
        timestamp: m.timestamp,
        type: 'MEMBER',
        description: `Member ${m.memberName} (${m.details})`,
        paymentMethod: 'CASH',
        amount: m.amount,
      });
    });

    payments.forEach((p) => {
      const entry = entriesMap.get(p.entryId);
      const ticket = entry ? entry.ticketCode : '-';
      const plate = entry ? entry.plateNumber : '-';
      const isLost = p.paymentMethod.toLowerCase().includes('denda') || p.amount === 50000;
      
      txs.push({
        id: p.id,
        timestamp: p.paymentTime,
        type: isLost ? 'DENDA' : 'PARKIR',
        description: isLost 
          ? `Denda Tiket Hilang - Plat ${plate}`
          : `Parkir Harian (${entry?.vehicleType?.toUpperCase() || 'CAR'}) - Karcis ${ticket} - Plat ${plate}`,
        paymentMethod: p.paymentMethod.toUpperCase(),
        amount: p.amount,
      });
    });

    txs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      shift,
      cashRevenue,
      nonCashRevenue,
      expectedCash,
      transactions: txs,
    };
  }

  @Get('shift/transactions/:shiftId')
  async getShiftTransactions(@Param('shiftId') shiftId: string) {
    const shift = await this.shiftRepo.findOne({ where: { id: shiftId } });
    if (!shift) {
      throw new HttpException({ success: false, message: 'Shift tidak ditemukan' }, HttpStatus.NOT_FOUND);
    }

    const start = shift.openTime;
    const end = shift.closeTime || new Date();

    const payments = await this.paymentRepo.find({
      where: { paymentTime: Between(start, end), status: 'paid' },
      order: { paymentTime: 'DESC' },
    });

    const memberTxs = await this.memberTxRepo.find({
      where: { operatorUsername: shift.operatorUsername, timestamp: Between(start, end) },
      order: { timestamp: 'DESC' },
    });

    // Build entries map for plate/ticket lookup
    const entryIds = payments.map(p => p.entryId).filter(id => !!id);
    const entriesMap = new Map<string, ParkingEntry>();
    if (entryIds.length > 0) {
      const entries = await this.entryRepo.find({ where: { id: In(entryIds) } });
      entries.forEach(e => entriesMap.set(e.id, e));
    }

    const txs: any[] = [];

    payments.forEach((p) => {
      const entry = entriesMap.get(p.entryId);
      const isLost = p.paymentMethod.toLowerCase().includes('denda') || p.paymentMethod.toLowerCase().includes('lost');
      txs.push({
        id: p.id,
        exitTime: p.paymentTime,
        createdAt: p.paymentTime,
        plateNumber: entry?.plateNumber || '-',
        ticketCode: isLost ? 'HILANG' : (entry?.ticketCode || '-'),
        description: isLost
          ? `Denda Tiket Hilang`
          : `Parkir ${entry?.vehicleType?.toUpperCase() || 'CAR'}`,
        paymentMethod: p.paymentMethod,
        amount: p.amount,
        type: isLost ? 'DENDA' : 'PARKIR',
      });
    });

    memberTxs.forEach((m) => {
      txs.push({
        id: m.id,
        exitTime: m.timestamp,
        createdAt: m.timestamp,
        plateNumber: '-',
        ticketCode: `MEMBER`,
        description: `${m.details} - ${m.memberName}`,
        paymentMethod: 'CASH',
        amount: m.amount,
        type: 'MEMBER',
      });
    });

    txs.sort((a, b) => new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime());

    return txs;
  }

  @Post('shift/close')
  async closeShift(@Body() body: { shiftId: string; depositAmount: number }) {
    const shift = await this.shiftRepo.findOne({ where: { id: body.shiftId, status: 'open' } });
    if (!shift) {
      throw new HttpException({ success: false, message: 'Shift aktif tidak ditemukan' }, HttpStatus.BAD_REQUEST);
    }

    const start = shift.openTime;
    const end = new Date();

    const payments = await this.paymentRepo.find({
      where: { paymentTime: Between(start, end), status: 'paid' },
    });

    const memberTxs = await this.memberTxRepo.find({
      where: { operatorUsername: shift.operatorUsername, timestamp: Between(start, end) },
    });

    let cashRevenue = 0;
    let nonCashRevenue = 0;

    memberTxs.forEach((m) => {
      cashRevenue += m.amount;
    });

    payments.forEach((p) => {
      const method = p.paymentMethod.toLowerCase();
      if (method.includes('cash')) {
        cashRevenue += p.amount;
      } else if (method.includes('qris')) {
        nonCashRevenue += p.amount;
      }
    });

    const expectedCash = shift.startingFloat + cashRevenue;
    const discrepancy = body.depositAmount - expectedCash;

    shift.closeTime = end;
    shift.cashRevenue = cashRevenue;
    shift.nonCashRevenue = nonCashRevenue;
    shift.depositAmount = body.depositAmount;
    shift.discrepancy = discrepancy;
    shift.status = 'closed';

    const closedShift = await this.shiftRepo.save(shift);

    const entryIds = payments.map(p => p.entryId).filter(id => !!id);
    const entriesMap = new Map<string, ParkingEntry>();
    if (entryIds.length > 0) {
      const entries = await this.entryRepo.find({
        where: { id: In(entryIds) }
      });
      entries.forEach(e => entriesMap.set(e.id, e));
    }

    const txs: any[] = [];
    memberTxs.forEach((m) => {
      txs.push({
        id: m.id,
        timestamp: m.timestamp,
        type: 'MEMBER',
        description: `Member ${m.memberName} (${m.details})`,
        paymentMethod: 'CASH',
        amount: m.amount,
      });
    });

    payments.forEach((p) => {
      const entry = entriesMap.get(p.entryId);
      const ticket = entry ? entry.ticketCode : '-';
      const plate = entry ? entry.plateNumber : '-';
      const isLost = p.paymentMethod.toLowerCase().includes('denda') || p.amount === 50000;
      
      txs.push({
        id: p.id,
        timestamp: p.paymentTime,
        type: isLost ? 'DENDA' : 'PARKIR',
        description: isLost 
          ? `Denda Tiket Hilang - Plat ${plate}`
          : `Parkir Harian (${entry?.vehicleType?.toUpperCase() || 'CAR'}) - Karcis ${ticket} - Plat ${plate}`,
        paymentMethod: p.paymentMethod.toUpperCase(),
        amount: p.amount,
      });
    });

    txs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      success: true,
      shift: closedShift,
      expectedCash,
      discrepancy,
      transactions: txs,
    };
  }
}
