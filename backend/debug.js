const fs = require('fs');
const path = require('path');

// Buat stream untuk menulis log ke file debug_error.log
const logPath = path.join(__dirname, 'debug_error.log');
const logStream = fs.createWriteStream(logPath, { flags: 'w' });

function writeToLog(type, message) {
  const timestamp = new Date().toISOString();
  logStream.write(`[${timestamp}] [${type}] ${message}\n`);
}

// Tangkap uncaught exceptions (error yang membuat aplikasi crash)
process.on('uncaughtException', (err) => {
  writeToLog('CRITICAL_EXCEPTION', err.stack || err.message);
  logStream.end(() => {
    process.exit(1);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  writeToLog('UNHANDLED_REJECTION', reason instanceof Error ? reason.stack : String(reason));
});

// Override console.log dan console.error bawaan Node.js
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
  const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
  writeToLog('LOG', msg);
  originalLog.apply(console, args);
};

console.error = function(...args) {
  const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
  writeToLog('ERROR', msg);
  originalError.apply(console, args);
};

writeToLog('SYSTEM', 'Starting application via debug wrapper...');

// Load file utama NestJS
try {
  require('./dist/main.js');
} catch (err) {
  writeToLog('REQUIRE_ERROR', err.stack || err.message);
}
