import React, { useEffect, useState } from 'react';
import { Shield, Radio, Activity, RefreshCw, Users, DollarSign, Disc } from 'lucide-react';

interface Gate {
  id: string;
  name: string;
  type: string;
  ipAddress: string;
  status: string;
}

interface GateEvent {
  gateId: string;
  gateName: string;
  event: string;
  timestamp: string;
  message: string;
}

interface MonitorDashboardProps {
  socket: any;
  gates: Gate[];
  stats: {
    totalEntriesToday: number;
    totalExitsToday: number;
    occupancyCount: number;
    totalRevenueToday: number;
    paymentMethods: { cash: number; qris: number; member: number };
  };
  refreshStats: () => void;
}

export const MonitorDashboard: React.FC<MonitorDashboardProps> = ({
  socket,
  gates,
  stats,
  refreshStats,
}) => {
  const [events, setEvents] = useState<GateEvent[]>([]);
  const [gateStates, setGateStates] = useState<Record<string, { lastAction: string; lastPlate: string; isBarringOpen: boolean; lastPhoto: string }>>({});
  const totalSlots = 150;
  const availableSlots = Math.max(0, totalSlots - stats.occupancyCount);
  const occupancyPercentage = Math.min(100, Math.round((stats.occupancyCount / totalSlots) * 100));

  useEffect(() => {
    if (!socket) return;

    const handleGateEvent = (data: any) => {
      setEvents((prev) => [
        {
          ...data,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 29), // keep last 30 events
      ]);

      if (data.event === 'car_arrived') {
        setGateStates((prev) => ({
          ...prev,
          [data.gateId]: {
            ...prev[data.gateId],
            lastAction: 'Mobil Terdeteksi',
            isBarringOpen: prev[data.gateId]?.isBarringOpen || false,
            lastPlate: prev[data.gateId]?.lastPlate || '',
            lastPhoto: prev[data.gateId]?.lastPhoto || '',
          },
        }));
      }
    };

    const handleGateAction = (data: any) => {
      let detailMessage = '';
      let plate = '';
      let photo = '';

      if (data.action.includes('open_barrier')) {
        detailMessage = 'Gate Terbuka';
      }

      if (data.ticket) {
        plate = data.ticket.plateNumber;
        detailMessage = `Tiket ${data.ticket.ticketCode} Dicetak`;
      } else if (data.member) {
        plate = `MEMBER: ${data.member.name}`;
        detailMessage = `RFID Tap - Member Valid`;
      } else if (data.receipt) {
        plate = data.receipt.plateNumber;
        detailMessage = `Selesai - Struk Dicetak`;
      }

      setGateStates((prev) => ({
        ...prev,
        [data.gateId]: {
          lastAction: detailMessage || data.action,
          isBarringOpen: data.action.includes('open_barrier'),
          lastPlate: plate || prev[data.gateId]?.lastPlate || '',
          lastPhoto: photo || prev[data.gateId]?.lastPhoto || '',
        },
      }));

      // Automatically close barrier gate simulation after 4 seconds
      if (data.action.includes('open_barrier')) {
        setTimeout(() => {
          setGateStates((prev) => ({
            ...prev,
            [data.gateId]: {
              ...prev[data.gateId],
              isBarringOpen: false,
              lastAction: 'Gate Tertutup',
            },
          }));
        }, 4000);
      }

      refreshStats();
    };

    socket.on('gate_event', handleGateEvent);
    socket.on('gate_action', handleGateAction);

    return () => {
      socket.off('gate_event', handleGateEvent);
      socket.off('gate_action', handleGateAction);
    };
  }, [socket, refreshStats]);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Upper Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-5 relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-zinc-400 font-medium">Okupansi Kendaraan</p>
              <h3 className="text-3xl font-bold mt-1 text-white">{stats.occupancyCount} / {totalSlots}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-zinc-800 rounded-full h-1.5">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${occupancyPercentage}%` }}
              ></div>
            </div>
            <p className="text-xs text-zinc-500 mt-1">{occupancyPercentage}% area terisi</p>
          </div>
        </div>

        <div className="glass rounded-xl p-5 relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-zinc-400 font-medium">Slot Kosong</p>
              <h3 className="text-3xl font-bold mt-1 text-white">{availableSlots}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Disc className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center space-x-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <p className="text-xs text-zinc-500">Menerima kedatangan baru</p>
          </div>
        </div>

        <div className="glass rounded-xl p-5 relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-zinc-400 font-medium">Total Kendaraan Masuk</p>
              <h3 className="text-3xl font-bold mt-1 text-white">{stats.totalEntriesToday}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs text-zinc-500">Akumulasi transaksi hari ini</p>
          </div>
        </div>

        <div className="glass rounded-xl p-5 relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-zinc-400 font-medium">Pendapatan Hari Ini</p>
              <h3 className="text-3xl font-bold mt-1 text-emerald-400">{formatRupiah(stats.totalRevenueToday)}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex justify-between items-center text-xs text-zinc-500">
            <span>Cash: {formatRupiah(stats.paymentMethods.cash)}</span>
            <span>QRIS: {formatRupiah(stats.paymentMethods.qris)}</span>
          </div>
        </div>
      </div>

      {/* Main Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Gate status list & live view */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-400" />
              Monitoring Gerbang Real-time
            </h2>
            <button
              onClick={refreshStats}
              className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gates.map((gate) => {
              const state = gateStates[gate.id] || {
                lastAction: 'Standby',
                lastPlate: 'Belum terdeteksi',
                isBarringOpen: false,
                lastPhoto: '',
              };

              return (
                <div
                  key={gate.id}
                  className={`glass rounded-xl p-4 transition-all duration-300 ${
                    state.isBarringOpen
                      ? 'glass-glow-emerald border-emerald-500/30'
                      : gate.status === 'online'
                      ? 'border-white/10'
                      : 'border-rose-500/20'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-white">{gate.name}</h4>
                      <p className="text-xs text-zinc-500">{gate.ipAddress}</p>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1.5 ${
                        gate.status === 'online'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          gate.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                        }`}
                      ></span>
                      {gate.status.toUpperCase()}
                    </span>
                  </div>

                  {/* CCTV Screen Emulation */}
                  <div className="relative mt-4 aspect-video bg-zinc-950 rounded-lg overflow-hidden border border-white/5 flex items-center justify-center">
                    {/* Visual schematic of gate state */}
                    <div className="absolute inset-0 grid-bg opacity-30"></div>

                    {/* Camera snapshot mockup */}
                    <div className="text-center z-10 p-4">
                      <p className="text-xs text-zinc-600 font-mono absolute top-2 left-2">CCTV_{gate.name.replace(/\s+/g, '_').toUpperCase()}</p>
                      <p className="text-[10px] text-zinc-600 font-mono absolute top-2 right-2">{new Date().toISOString().split('T')[0]}</p>

                      {/* Schematic Representation of Vehicle and Gate */}
                      <svg className="w-24 h-24 mx-auto text-zinc-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                        <rect x="2" y="14" width="10" height="6" rx="2" className={state.lastAction.includes('Mobil') || state.lastAction.includes('Tiket') || state.lastAction.includes('RFID') ? 'text-zinc-400 fill-zinc-800/40' : 'text-zinc-800'} />
                        <circle cx="4.5" cy="18.5" r="1.5" className={state.lastAction.includes('Mobil') || state.lastAction.includes('Tiket') || state.lastAction.includes('RFID') ? 'text-zinc-300' : 'text-zinc-900'} />
                        <circle cx="9.5" cy="18.5" r="1.5" className={state.lastAction.includes('Mobil') || state.lastAction.includes('Tiket') || state.lastAction.includes('RFID') ? 'text-zinc-300' : 'text-zinc-900'} />
                        {/* Barrier Gate Arm */}
                        <line
                          x1="14"
                          y1="19"
                          x2="22"
                          y2={state.isBarringOpen ? "9" : "19"}
                          className={`stroke-2 transition-all duration-700 ${state.isBarringOpen ? 'stroke-emerald-400' : 'stroke-rose-500'}`}
                        />
                        <rect x="13" y="17" width="2" height="4" fill="currentColor" className="text-zinc-600" />
                      </svg>

                      {state.lastPlate && (
                        <div className="mt-2 inline-block bg-white text-zinc-950 font-bold px-2 py-0.5 rounded text-xs font-mono border border-black shadow">
                          {state.lastPlate}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                      <span className="text-zinc-400">Status Palang:</span>
                      <span
                        className={`font-semibold ${
                          state.isBarringOpen ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {state.isBarringOpen ? 'TERBUKA (UP)' : 'TERTUTUP (DOWN)'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Aksi Terakhir:</span>
                      <span className="font-semibold text-white">{state.lastAction}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: Event Logs Streaming */}
        <div className="glass rounded-xl p-5 flex flex-col h-[520px]">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Radio className="h-5 w-5 text-purple-400" />
            Aktivitas Sensor
          </h2>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {events.length === 0 ? (
              <div className="h-full flex items-center justify-center flex-col text-zinc-600 p-4 text-center">
                <span className="h-2 w-2 rounded-full bg-zinc-700 animate-ping mb-2"></span>
                <p className="text-xs">Menunggu sinyal sensor dari gate controller...</p>
              </div>
            ) : (
              events.map((ev, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border text-xs transition duration-300 ${
                    ev.event.includes('arrived')
                      ? 'bg-amber-500/5 border-amber-500/10'
                      : ev.event.includes('departed')
                      ? 'bg-zinc-800/20 border-zinc-700/20'
                      : 'bg-emerald-500/5 border-emerald-500/10'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-zinc-300">{ev.gateName}</span>
                    <span className="text-[10px] text-zinc-500">{ev.timestamp}</span>
                  </div>
                  <p className="text-zinc-400">{ev.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
