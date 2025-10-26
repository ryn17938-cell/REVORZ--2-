// Lightweight shim so running `node app.js` from the repo root works.
// This file simply requires the actual server implementation which lives
// in the nested `REVORZ/REVORZ/server.js` path used by the project.

try {
    require('./REVORZ/REVORZ/server.js');
} catch (err) {
    console.error('Failed to start server from app.js shim:', err && err.message ? err.message : err);
    process.exit(1);
}
