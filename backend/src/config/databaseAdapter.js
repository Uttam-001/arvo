import { PrismaMariaDb } from '@prisma/adapter-mariadb';

export function createPinnedDatabaseAdapter() {
  const ca = process.env.DATABASE_CA_PEM;
  const fingerprint = process.env.DATABASE_TLS_FINGERPRINT;
  if (!ca && !fingerprint) return undefined;
  if (!ca || !/^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/i.test(fingerprint || '')) {
    throw new Error('Database TLS requires a trusted CA and a SHA-256 server certificate fingerprint.');
  }

  const url = new URL(process.env.DATABASE_URL);
  return new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    connectionLimit: 2,
    minimumIdle: 1,
    connectTimeout: 5000,
    ssl: {
      ca,
      rejectUnauthorized: true,
      checkServerIdentity(_hostname, certificate) {
        if (certificate.fingerprint256 !== fingerprint.toUpperCase()) {
          return new Error('MySQL did not present the pinned server certificate.');
        }
      }
    }
  });
}
