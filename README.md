# KatalogPro - Node.js (migrated)

Proyek ini adalah versi sederhana dari katalog produk. Saya memigrasikan server ke Node.js + Express menggunakan SQLite agar bisa berjalan langsung tanpa membutuhkan MySQL.

Quick start (Windows PowerShell):

1. Install dependencies:

   npm install

2. Start the server:

   npm start

3. Open your browser at:

   http://localhost:8888

Catatan:
- Aplikasi menggunakan `database.sqlite` di root proyek. Server akan membuat tabel `users` dan `products` otomatis jika belum ada.
- Rute penting disediakan di `server.js`: `/`, `/login`, `/register`, `/home`, `/logout`, dan API `/api/products`.
- File tampilan statis ada di folder `views/` dan aset statis di `public/`.

Konfigurasi tambahan:
- Untuk mengubah port, set environment variable `PORT` sebelum menjalankan server.
- Untuk produksi: ganti `SESSION_SECRET`, aktifkan HTTPS, tambahkan validasi input, dan jangan simpan file .env di repo.

Butuh bantuan lagi? Saya bisa menambahkan skrip untuk memasukkan data produk contoh dan membuat akun tes, atau mengubah tampilan menjadi template engine (EJS) untuk halaman dinamis.

