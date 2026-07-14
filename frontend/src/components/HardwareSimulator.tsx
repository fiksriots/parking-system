import React, { useState, useEffect } from 'react';
import { Play, LogIn, LogOut, Ticket, Smartphone, CreditCard, Award } from 'lucide-react';

const Barcode: React.FC<{ code: string }> = ({ code }) => {
  const lines: number[] = [];
  lines.push(1, 0, 1); // start guard

  for (let i = 0; i < code.length; i++) {
    const val = code.charCodeAt(i);
    for (let bit = 0; bit < 7; bit++) {
      const isBar = (val >> bit) & 1;
      lines.push(isBar, 0); // bar or space
    }
  }

  lines.push(1, 0, 1); // end guard

  return (
    <div className="flex flex-col items-center my-2">
      <svg width="145" height="40" className="bg-white">
        <g>
          {lines.map((bit, idx) => {
            const width = 1.3;
            const fill = bit === 1 ? '#000000' : '#ffffff';
            return (
              <rect
                key={idx}
                x={idx * width}
                y="0"
                width={width}
                height="40"
                fill={fill}
              />
            );
          })}
        </g>
      </svg>
      <span className="text-[10px] tracking-[0.2em] font-black font-mono mt-1 text-zinc-900">{code}</span>
    </div>
  );
};

interface Gate {
  id: string;
  name: string;
  type: string;
  ipAddress: string;
  status: string;
}

interface Member {
  id: string;
  name: string;
  rfidCardNumber: string;
  status: string;
}

interface ActiveCar {
  id: string;
  ticketCode: string;
  plateNumber: string;
  entryTime: string;
}

interface HardwareSimulatorProps {
  socket: any;
  gates: Gate[];
}

export const HardwareSimulator: React.FC<HardwareSimulatorProps> = ({ socket, gates }) => {
  const [selectedGateId, setSelectedGateId] = useState('');
  const [carAtGate, setCarAtGate] = useState(false);
  const [plateNumber, setPlateNumber] = useState('');
  const [selectedRfid, setSelectedRfid] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [activeCars, setActiveCars] = useState<ActiveCar[]>([]);
  const [isBarringOpen, setIsBarringOpen] = useState(false);
  const [gateActionLog, setGateActionLog] = useState('');

  // Ticket printing & receipt variables
  const [printedTicket, setPrintedTicket] = useState<any>(null);
  const [printedReceipt, setPrintedReceipt] = useState<any>(null);
  const [vehicleType, setVehicleType] = useState('car');

  // Exit gate variables
  const [scannedTicketCode, setScannedTicketCode] = useState('');
  const [exitFeeDetails, setExitFeeDetails] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('QRIS');
  const [cashAmountPaid, setCashAmountPaid] = useState('');
  const [showQrisCode, setShowQrisCode] = useState(false);

  const selectedGate = gates.find((g) => g.id === selectedGateId) || gates[0];

  useEffect(() => {
    if (gates.length > 0 && !selectedGateId) {
      setSelectedGateId(gates[0].id);
    }
  }, [gates, selectedGateId]);

  useEffect(() => {
    fetchMembers();
    fetchActiveCars();
  }, [carAtGate]);

  const fetchMembers = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/members`);
      const data = await res.json();
      setMembers(data);
      if (data.length > 0 && !selectedRfid) {
        setSelectedRfid(data[0].rfidCardNumber);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchActiveCars = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/reports/active-entries`);
      const data = await res.json();
      setActiveCars(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!socket) return;

    const handleGateAction = (data: any) => {
      if (data.gateId !== selectedGateId) return;

      setIsBarringOpen(true);
      setGateActionLog(`AKSI GATE: Buka Barrier (${data.action})`);

      if (data.ticket) {
        setPrintedTicket(data.ticket);
        setPrintedReceipt(null);
      } else if (data.receipt) {
        setPrintedReceipt(data.receipt);
        setPrintedTicket(null);
        setExitFeeDetails(null);
        setShowQrisCode(false);
      } else if (data.member) {
        setPrintedTicket(null);
        setPrintedReceipt(null);
        setGateActionLog(`AKSI GATE: Member ${data.member.name} Lewat`);
      }
    };

    const handleGateError = (data: any) => {
      if (data.gateId !== selectedGateId) return;
      setGateActionLog(`ERROR GATE: ${data.message}`);
    };

    socket.on('gate_action', handleGateAction);
    socket.on('gate_error', handleGateError);

    return () => {
      socket.off('gate_action', handleGateAction);
      socket.off('gate_error', handleGateError);
    };
  }, [socket, selectedGateId]);

  // Simulate Car Arrived (Loop Detector)
  const triggerCarArrival = () => {
    setCarAtGate(true);
    setIsBarringOpen(false);
    setPrintedTicket(null);
    setPrintedReceipt(null);
    setExitFeeDetails(null);
    setGateActionLog('Mobil mendekati sensor loop...');
    socket.emit('car_arrived', { gateId: selectedGateId });
  };

  // Simulate Car Departed (Barrier closes)
  const triggerCarDeparture = () => {
    setCarAtGate(false);
    setIsBarringOpen(false);
    setPlateNumber('');
    setScannedTicketCode('');
    setExitFeeDetails(null);
    setGateActionLog('Mobil melintasi gerbang, palang diturunkan...');
    socket.emit('car_departed', { gateId: selectedGateId });
  };

  // Press ticket button (Entry Gate)
  const pressTicketButton = () => {
    socket.emit(
      'press_ticket_button',
      {
        gateId: selectedGateId,
        plateNumber: plateNumber,
        cameraPhoto: 'MOCK_PHOTO_ENTRY_BASE64',
        vehicleType: vehicleType,
      },
      (res: any) => {
        if (res?.success) {
          setGateActionLog('Karcis dicetak, palang dibuka!');
        } else {
          setGateActionLog(`Gagal: ${res?.message}`);
        }
      },
    );
  };

  // Tap RFID card
  const tapRfidCard = () => {
    socket.emit(
      'tap_rfid',
      {
        gateId: selectedGateId,
        rfidCardNumber: selectedRfid,
        cameraPhoto: 'MOCK_PHOTO_RFID_BASE64',
        vehicleType: vehicleType,
      },
      (res: any) => {
        if (res?.success) {
          setGateActionLog('Kartu valid, palang dibuka!');
        } else {
          setGateActionLog(`Gagal: ${res?.message}`);
        }
      },
    );
  };

  // Scan exit ticket
  const verifyExitTicket = () => {
    socket.emit(
      'verify_ticket',
      { ticketCode: scannedTicketCode },
      (res: any) => {
        if (res?.success) {
          setExitFeeDetails(res);
          setGateActionLog(`Karcis valid. Tagihan: Rp ${res.fee}`);
          if (res.fee === 0) {
            // Free duration, open gate immediately
            handlePaymentSuccess(res.entry.ticketCode, 'Free (Grace)', 0);
          } else {
            setShowQrisCode(paymentMethod === 'QRIS');
          }
        } else {
          setGateActionLog(`Gagal: ${res?.message}`);
        }
      },
    );
  };

  const handlePaymentSuccess = (ticketCode: string, method: string, amount: number) => {
    socket.emit(
      'make_payment',
      {
        gateId: selectedGateId,
        ticketCode,
        paymentMethod: method,
        amount,
        cameraPhoto: 'MOCK_PHOTO_EXIT_BASE64',
      },
      (res: any) => {
        if (res?.success) {
          setGateActionLog('Pembayaran sukses, palang keluar dibuka!');
        } else {
          setGateActionLog(`Gagal memproses pembayaran: ${res?.message}`);
        }
      },
    );
  };

  const calculateChange = () => {
    if (!exitFeeDetails) return 0;
    const change = parseFloat(cashAmountPaid) - exitFeeDetails.fee;
    return isNaN(change) ? 0 : Math.max(0, change);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left panel: Simulator Controllers */}
      <div className="lg:col-span-2 space-y-6">
        <div className="glass rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Play className="h-5 w-5 text-emerald-400" />
              Kontrol Sensor Hardware
            </h3>
            <div className="flex gap-2">
              {gates.map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    setSelectedGateId(g.id);
                    setCarAtGate(false);
                    setIsBarringOpen(false);
                    setPrintedTicket(null);
                    setPrintedReceipt(null);
                    setExitFeeDetails(null);
                  }}
                  className={`text-xs px-3 py-1.5 rounded transition font-semibold ${
                    selectedGateId === g.id
                      ? 'bg-emerald-500 text-zinc-950 shadow-lg'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-white/5 bg-zinc-950/40 rounded-lg p-5 flex flex-col items-center justify-center min-h-[160px] relative overflow-hidden">
            <div className="absolute inset-0 grid-bg opacity-20"></div>

            {/* Visual Road Gate representation */}
            <div className="z-10 text-center space-y-3">
              <div className="flex justify-center items-center gap-12 relative">
                {/* Visual Car */}
                <div
                  className={`transition-all duration-700 transform ${
                    carAtGate ? 'translate-x-0 opacity-100' : '-translate-x-16 opacity-0'
                  }`}
                >
                  <div className="bg-zinc-800 text-zinc-300 border border-zinc-700 px-4 py-2 rounded-lg font-bold shadow-lg">
                    {vehicleType === 'motorcycle' ? '🏍️ MOTOR' : vehicleType === 'truck' ? '🚛 TRUCK' : vehicleType === 'bus' ? '🚌 BUS' : '🚗 MOBIL'}
                    {plateNumber && <span className="block text-[10px] font-mono bg-zinc-950 px-1 py-0.5 mt-1 rounded text-white">{plateNumber}</span>}
                  </div>
                </div>

                {/* Gate barrier arm */}
                <div className="relative flex flex-col items-center">
                  <div className="h-16 w-3 bg-zinc-700 rounded-t"></div>
                  {/* Barrier Arm rotates up when open */}
                  <div
                    className="absolute bottom-0 w-24 h-2 bg-gradient-to-r from-red-500 via-white to-red-500 origin-left transition-transform duration-700"
                    style={{
                      transform: isBarringOpen ? 'rotate(-90deg)' : 'rotate(0deg)',
                      left: '4px',
                    }}
                  ></div>
                  <div className="text-[10px] text-zinc-500 mt-1">PALANG</div>
                </div>
              </div>

              {gateActionLog && (
                <p className="text-xs text-amber-400 font-mono mt-4 bg-zinc-950 px-3 py-1 rounded border border-white/5">
                  {gateActionLog}
                </p>
              )}
            </div>
          </div>

          {/* Trigger Sensors */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={triggerCarArrival}
              disabled={carAtGate}
              className="py-3 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogIn className="h-5 w-5 text-emerald-400" />
              1. Mobil Datang (Loop)
            </button>
            <button
              onClick={triggerCarDeparture}
              disabled={!isBarringOpen || !carAtGate}
              className="py-3 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogOut className="h-5 w-5 text-rose-400" />
              3. Mobil Lewat (Loop)
            </button>
          </div>
        </div>

        {/* Entry / Exit Action Panels depending on Selected Gate Type */}
        {carAtGate && selectedGate && (
          <div className="glass rounded-xl p-5 space-y-4 animate-fadeIn">
            <h4 className="font-bold text-white text-md border-b border-white/5 pb-2">
              {selectedGate.type === 'entry' 
                ? `Skenario Gate: ${selectedGate.name} (Masuk Otomatis)` 
                : `Pos Petugas Kasir: ${selectedGate.name} (Pintu Keluar)`
              }
            </h4>

            {selectedGate.type === 'entry' ? (
              <div className="space-y-4">
                {/* Vehicle Type Selector */}
                <div className="bg-zinc-900/30 p-4 rounded-lg border border-white/5">
                  <label className="block text-xs text-zinc-400 font-semibold mb-3 uppercase tracking-wider">
                    🚗 Jenis Kendaraan
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { key: 'motorcycle', emoji: '🏍️', label: 'Motor', color: 'sky' },
                      { key: 'car', emoji: '🚗', label: 'Mobil', color: 'emerald' },
                      { key: 'truck', emoji: '🚛', label: 'Truck', color: 'orange' },
                      { key: 'bus', emoji: '🚌', label: 'Bus', color: 'violet' },
                    ].map((vt) => (
                      <button
                        key={vt.key}
                        type="button"
                        onClick={() => setVehicleType(vt.key)}
                        className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all duration-150 ${
                          vehicleType === vt.key
                            ? 'bg-emerald-500/15 border-emerald-500/50 shadow-lg'
                            : 'bg-zinc-900 border-white/5 hover:border-white/15 hover:bg-zinc-800'
                        }`}
                      >
                        <span className="text-xl leading-none">{vt.emoji}</span>
                        <span className={`text-[10px] font-bold ${vehicleType === vt.key ? 'text-emerald-300' : 'text-zinc-500'}`}>
                          {vt.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Scenario A: Daily visitor ticket printing */}
                <div className="space-y-3 bg-zinc-900/30 p-4 rounded-lg border border-white/5">
                  <div className="flex items-center gap-2 text-zinc-300 font-semibold text-sm">
                    <Ticket className="h-4 w-4 text-emerald-400" />
                    Skenario Karcis Harian
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Simulasi Input Plat (ANPR OCR):</label>
                    <input
                      type="text"
                      placeholder="Contoh: B 1234 ABC"
                      value={plateNumber}
                      onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                      className="w-full bg-zinc-950 border border-white/10 rounded px-3 py-2 text-sm text-white font-mono placeholder-zinc-700 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <button
                    onClick={pressTicketButton}
                    className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded transition text-sm flex items-center justify-center gap-1.5"
                  >
                    Tekan Tombol Karcis
                  </button>
                </div>

                {/* Scenario B: RFID Member Tapping */}
                <div className="space-y-3 bg-zinc-900/30 p-4 rounded-lg border border-white/5">
                  <div className="flex items-center gap-2 text-zinc-300 font-semibold text-sm">
                    <Award className="h-4 w-4 text-amber-400" />
                    Skenario RFID Member
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Pilih Kartu RFID Member:</label>
                    <select
                      value={selectedRfid}
                      onChange={(e) => setSelectedRfid(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    >
                      {members.map((m) => (
                        <option key={m.id} value={m.rfidCardNumber}>
                          {m.name} ({m.rfidCardNumber}) - {m.status}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={tapRfidCard}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded transition text-sm flex items-center justify-center gap-1.5"
                  >
                    Tap Kartu RFID Member
                  </button>
                </div>
                </div>
              </div>
            ) : (
              // Exit Gate simulation
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Scenario A: Ticket Payment Scan */}
                <div className="space-y-3 bg-zinc-900/30 p-4 rounded-lg border border-white/5">
                  <div className="flex items-center gap-2 text-zinc-300 font-semibold text-sm">
                    <Ticket className="h-4 w-4 text-emerald-400" />
                    Layanan POS: Scan Karcis Kendaraan
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Pilih Karcis Aktif di Area Parkir:</label>
                    <select
                      value={scannedTicketCode}
                      onChange={(e) => setScannedTicketCode(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="">-- Pilih Karcis Terparkir --</option>
                      {activeCars
                        .filter((c) => c.ticketCode)
                        .map((c) => (
                          <option key={c.id} value={c.ticketCode}>
                            {c.ticketCode} ({c.plateNumber})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Atau Ketik Kode Karcis..."
                      value={scannedTicketCode}
                      onChange={(e) => setScannedTicketCode(e.target.value.toUpperCase())}
                      className="flex-1 bg-zinc-950 border border-white/10 rounded px-3 py-1.5 text-xs text-white font-mono"
                    />
                    <button
                      onClick={verifyExitTicket}
                      className="px-3 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded text-xs transition"
                    >
                      Scan
                    </button>
                  </div>
                </div>

                {/* Scenario B: RFID Member Exit */}
                <div className="space-y-3 bg-zinc-900/30 p-4 rounded-lg border border-white/5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-zinc-300 font-semibold text-sm mb-2">
                      <Award className="h-4 w-4 text-amber-400" />
                      Layanan POS: Tap RFID Member
                    </div>
                    <label className="block text-xs text-zinc-500 mb-2">Petugas melakukan tap kartu RFID member untuk keluar gratis.</label>
                    <select
                      value={selectedRfid}
                      onChange={(e) => setSelectedRfid(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      {members.map((m) => (
                        <option key={m.id} value={m.rfidCardNumber}>
                          {m.name} ({m.rfidCardNumber})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={tapRfidCard}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded transition text-xs mt-2"
                  >
                    Tap Member Keluar
                  </button>
                </div>

                {/* Sub Panel: Exit Calculations & Payment Gate */}
                {exitFeeDetails && (
                  <div className="col-span-1 md:col-span-2 bg-zinc-900/40 p-4 rounded-lg border border-emerald-500/20 space-y-4">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <div>
                        <span className="text-[10px] text-zinc-500 font-mono">Karcis: {exitFeeDetails.entry.ticketCode}</span>
                        <h5 className="font-bold text-white text-sm">Plat Nomor: {exitFeeDetails.entry.plateNumber}</h5>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-zinc-400">Total Tarif:</span>
                        <h4 className="text-md font-extrabold text-emerald-400">Rp {exitFeeDetails.fee.toLocaleString('id-ID')}</h4>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Select Payment Method */}
                      <div className="space-y-2">
                        <label className="block text-xs text-zinc-400 font-medium">Metode Pembayaran:</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setPaymentMethod('QRIS');
                              setShowQrisCode(true);
                            }}
                            className={`flex-1 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 border transition ${
                              paymentMethod === 'QRIS'
                                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                                : 'bg-zinc-950 border-white/10 text-zinc-500'
                            }`}
                          >
                            <Smartphone className="h-3.5 w-3.5" />
                            QRIS (Mock)
                          </button>
                          <button
                            onClick={() => {
                              setPaymentMethod('CASH');
                              setShowQrisCode(false);
                            }}
                            className={`flex-1 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 border transition ${
                              paymentMethod === 'CASH'
                                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                                : 'bg-zinc-950 border-white/10 text-zinc-500'
                            }`}
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            Tunai (Cash)
                          </button>
                        </div>
                      </div>

                      {/* Cash handling or QRIS QR Display */}
                      {paymentMethod === 'CASH' ? (
                        <div className="space-y-2">
                          <label className="block text-xs text-zinc-400">Uang Diterima dari Pengendara (Rp):</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={cashAmountPaid}
                              onChange={(e) => setCashAmountPaid(e.target.value)}
                              placeholder="Nominal Uang..."
                              className="flex-1 bg-zinc-950 border border-white/10 rounded px-2.5 py-1 text-xs text-white focus:outline-none"
                            />
                            <div className="bg-zinc-800 border border-white/5 rounded px-2.5 py-1 text-xs text-zinc-400 flex items-center font-bold">
                              Kembalian: Rp {calculateChange().toLocaleString('id-ID')}
                            </div>
                          </div>
                        </div>
                      ) : (
                        showQrisCode && (
                          <div className="bg-white p-2.5 rounded border border-zinc-200 flex items-center justify-between gap-3 text-zinc-950">
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase tracking-wider font-extrabold text-zinc-500">QRIS MANDIRI</span>
                              <p className="text-xs font-bold leading-tight">Rp {exitFeeDetails.fee.toLocaleString('id-ID')}</p>
                              <span className="text-[9px] text-zinc-500">Pindai kode QR untuk membayar</span>
                            </div>
                            {/* Visual dummy QR code */}
                            <div className="h-14 w-14 bg-zinc-200 border-2 border-zinc-950 flex flex-wrap p-1">
                              <div className="h-4 w-4 bg-zinc-950"></div>
                              <div className="h-4 w-4 bg-zinc-200"></div>
                              <div className="h-4 w-4 bg-zinc-950"></div>
                              <div className="h-4 w-4 bg-zinc-200"></div>
                              <div className="h-4 w-4 bg-zinc-950"></div>
                              <div className="h-4 w-4 bg-zinc-200"></div>
                              <div className="h-4 w-4 bg-zinc-200"></div>
                              <div className="h-4 w-4 bg-zinc-950"></div>
                              <div className="h-4 w-4 bg-zinc-950"></div>
                            </div>
                          </div>
                        )
                      )}
                    </div>

                    <button
                      onClick={() =>
                        handlePaymentSuccess(
                          exitFeeDetails.entry.ticketCode,
                          paymentMethod,
                          exitFeeDetails.fee,
                        )
                      }
                      disabled={
                        paymentMethod === 'CASH' &&
                        (!cashAmountPaid || parseFloat(cashAmountPaid) < exitFeeDetails.fee)
                      }
                      className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-lg transition text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Proses Transaksi POS, Cetak Struk & Buka Pintu
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right panel: Receipt / Ticket Output emulation */}
      <div className="space-y-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Ticket className="h-5 w-5 text-emerald-400" />
          Output Printer Struk
        </h3>

        {/* Emulate Ticket printer output */}
        {printedTicket && (
          <div className="bg-white text-zinc-900 font-mono p-5 rounded-lg border-b-4 border-dashed border-zinc-300 shadow-2xl relative max-w-sm mx-auto animate-ticketDown">
            <div className="text-center border-b-2 border-dashed border-zinc-300 pb-3">
              <h4 className="font-extrabold text-md tracking-wider">MANLESS PARKING</h4>
              <p className="text-[10px] text-zinc-500">{printedTicket.gateName}</p>
            </div>
            <div className="py-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span>WAKTU MASUK:</span>
                <span className="font-bold">{new Date(printedTicket.entryTime).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span>PLAT NOMOR:</span>
                <span className="font-bold">{printedTicket.plateNumber}</span>
              </div>
              <div className="pt-2 border-t border-zinc-200 mt-2 text-center">
                <span className="text-[10px] text-zinc-400 block mb-1 font-semibold uppercase">BARCODE TIKET MASUK</span>
                <Barcode code={printedTicket.ticketCode} />
              </div>
            </div>
            <div className="border-t-2 border-dashed border-zinc-300 pt-3 text-center text-[9px] text-zinc-500 leading-tight">
              HARAP SIMPAN TIKET INI<br />
              DIPAKAI KEMBALI KETIKA KELUAR<br />
              KARCIS HILANG DIKENAKAN DENDA
            </div>
          </div>
        )}

        {/* Emulate Receipt printer output */}
        {printedReceipt && (
          <div className="bg-white text-zinc-900 font-mono p-5 rounded-lg border-b-4 border-dashed border-zinc-300 shadow-2xl relative max-w-sm mx-auto animate-ticketDown">
            <div className="text-center border-b-2 border-dashed border-zinc-300 pb-3">
              <h4 className="font-extrabold text-md tracking-wider">BUKTI BAYAR PARKIR</h4>
              <p className="text-[10px] text-zinc-500">{printedReceipt.gateName}</p>
            </div>
            <div className="py-4 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span>KARCIS:</span>
                <span>{printedReceipt.ticketCode}</span>
              </div>
              <div className="flex justify-between">
                <span>PLAT NOMOR:</span>
                <span className="font-bold">{printedReceipt.plateNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>JAM MASUK:</span>
                <span>{new Date(printedReceipt.entryTime).toLocaleTimeString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span>JAM KELUAR:</span>
                <span>{new Date(printedReceipt.exitTime).toLocaleTimeString('id-ID')}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-1.5">
                <span>METODE:</span>
                <span className="font-bold">{printedReceipt.paymentMethod.toUpperCase()}</span>
              </div>
              <div className="flex justify-between border-b-2 border-zinc-900 pb-1 font-bold text-sm">
                <span>TOTAL:</span>
                <span>Rp {printedReceipt.amount.toLocaleString('id-ID')}</span>
              </div>
            </div>
            <div className="text-center text-[9px] text-zinc-500 leading-tight">
              TERIMA KASIH ATAS KUNJUNGAN ANDA<br />
              SEMOGA SELAMAT SAMPAI TUJUAN
            </div>
          </div>
        )}

        {!printedTicket && !printedReceipt && (
          <div className="border border-dashed border-white/10 rounded-xl p-8 text-center text-zinc-600 text-xs min-h-[220px] flex flex-col items-center justify-center">
            <Ticket className="h-8 w-8 mb-2 opacity-30 text-zinc-500" />
            <p>Menunggu aktivitas gate untuk mencetak tiket atau struk pembayaran...</p>
          </div>
        )}
      </div>
    </div>
  );
};
