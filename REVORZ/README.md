# REVORZ — cara menjalankan

Proyek ini memiliki struktur nested dengan folder `REVORZ/REVORZ` yang berisi aplikasi sebenarnya.

Cara cepat menjalankan (direkomendasikan):

1. Buka Command Prompt (cmd) atau PowerShell.
2. Untuk menjalankan versi yang ada di folder inner:

   cd "c:\\Users\\REZY\\Downloads\\REVORZ (2)\\REVORZ\\REVORZ"
   npm install
   npm run dev

3. Untuk menjalankan dari root folder proyek (agar `npm run dev` juga bekerja di root), telah ditambahkan `nodemon` di `package.json` root. Jalankan:

   cd "c:\\Users\\REZY\\Downloads\\REVORZ (2)\\REVORZ"
   npm install
   npm run dev

Catatan PowerShell:
- Jika kamu melihat error seperti `npm.ps1 cannot be loaded because running scripts is disabled`, itu karena Execution Policy PowerShell. Kamu bisa menjalankan perintah ini (PowerShell sebagai Administrator) untuk memperbolehkan skrip pada user saat ini:

  Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

Atau jalankan npm lewat cmd dengan `cmd /c "npm.cmd run dev"`.

Jika mau, kamu bisa menggabungkan package.json supaya hanya ada satu package.json; saya sengaja mempertahankan struktur saat ini dan membuat root `dev` memakai `nodemon` untuk kenyamanan.