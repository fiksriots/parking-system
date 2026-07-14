const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, 'debug_error.log');

// Bersihkan log saat start
try {
  fs.writeFileSync(logPath, '');
} catch (e) {}

function writeToLog(type, message) {
  try {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] [${type}] ${message}\n`);
  } catch (e) {}
}

// Tangkap exceptions
process.on('uncaughtException', (err) => {
  writeToLog('CRITICAL_EXCEPTION', err.stack || err.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  writeToLog('UNHANDLED_REJECTION', reason instanceof Error ? reason.stack : String(reason));
});

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

writeToLog('SYSTEM', 'Starting application via debug wrapper (Sync)...');

// Log environment variables
writeToLog('ENV_PORT', String(process.env.PORT));
writeToLog('ENV_NODE_ENV', String(process.env.NODE_ENV));
writeToLog('ENV_PASSENGER', String(process.env.PASSENGER_APP_ENV));
writeToLog('ENV_VERCEL', String(process.env.VERCEL));

try {
  require('./dist/main.js');
  writeToLog('SYSTEM', 'Required main.js successfully.');
} catch (err) {
  writeToLog('REQUIRE_ERROR', err.stack || err.message);
}
