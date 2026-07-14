// test-db.js
// Jalankan script ini secara lokal dengan perintah: node test-db.js

const mysql = require('mysql2');

// TODO: Silakan lengkapi dengan kredensial database cPanel Anda
const config = {
  host: 'MASUKKAN_IP_ATAU_DOMAIN_CPANEL', 
  user: 'MASUKKAN_USER_DB_CPANEL',   
  password: 'MASUKKAN_PASSWORD_DB_CPANEL', 
  database: 'MASUKKAN_NAMA_DB_CPANEL', 
  port: 3306,
  connectTimeout: 8000 // 8 detik timeout
};

console.log('Menghubungkan ke database cPanel...');
console.log('Host:', config.host);
console.log('Database:', config.database);

const connection = mysql.createConnection(config);

connection.connect((err) => {
  if (err) {
    console.error('\n❌ GAGAL TERHUBUNG KE DATABASE!');
    console.error('----------------------------------------');
    console.error('Error Code  :', err.code);
    console.error('Error Message:', err.message);
    console.error('----------------------------------------');
    
    if (err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
      console.log('\n💡 Analisis: Koneksi timeout.');
      console.log('Kemungkinan besar port 3306 pada cPanel hosting Anda diblokir oleh Firewall hosting.');
      console.log('Hubungi penyedia hosting Anda untuk membuka port 3306 (Remote MySQL) untuk umum/IP Vercel.');
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n💡 Analisis: Kredensial salah.');
      console.log('Username atau password database yang Anda masukkan tidak sesuai.');
      console.log('Ingat bahwa cPanel biasanya menambahkan prefix nama user Anda (misal: "fiks_parkinguser").');
    }
  } else {
    console.log('\n✅ KONEKSI BERHASIL!');
    console.log('----------------------------------------');
    console.log('Remote MySQL di cPanel Anda aktif dan dapat diakses dari luar!');
  }
  connection.end();
});
