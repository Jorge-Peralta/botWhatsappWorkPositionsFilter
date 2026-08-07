import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from '@whiskeysockets/baileys';
import qrcodeTerminal from 'qrcode-terminal';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { logAllParticipatingGroups } from './groupDiscovery.js';
import { registerMessageHandler } from './messageHandler.js';

const log = logger.child({ module: 'connection' });

/** Minimal structural shape of a Boom-like error, without depending on @hapi/boom directly. */
interface BoomLikeError {
  output?: {
    statusCode?: number;
  };
}

export async function startConnection(): Promise<WASocket> {
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir);
  const { version, isLatest } = await fetchLatestBaileysVersion();

  log.info({ version, isLatest }, 'starting WhatsApp connection');

  const sock = makeWASocket({
    version,
    auth: state,
    // Baileys' internal logger is very chatty at 'info' (history sync, media
    // re-uploads, etc.) — pin it to 'warn' so it doesn't drown out our own
    // application logs (e.g. the participating-groups list).
    logger: logger.child({ module: 'baileys' }, { level: 'warn' }),
    browser: Browsers.ubuntu('Chrome'),
  });

  sock.ev.on('creds.update', saveCreds);

  let pairingCodeRequested = false;

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      if (config.usePairingCode) {
        if (!pairingCodeRequested) {
          pairingCodeRequested = true;
          if (!config.pairingPhoneNumber) {
            log.error('USE_PAIRING_CODE is true but PAIRING_PHONE_NUMBER is not set');
          } else {
            sock
              .requestPairingCode(config.pairingPhoneNumber)
              .then((code) => log.info({ code }, 'pairing code — enter this on your phone'))
              .catch((err) => log.error({ err }, 'failed to request pairing code'));
          }
        }
      } else {
        qrcodeTerminal.generate(qr, { small: true });
      }
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as BoomLikeError | undefined)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        log.error(
          'session logged out — delete the data/auth directory and restart to re-scan the QR code',
        );
        return;
      }

      log.warn({ statusCode }, 'connection closed — reconnecting');
      void startConnection();
      return;
    }

    if (connection === 'open') {
      pairingCodeRequested = false;
      log.info('connection open');
      void logAllParticipatingGroups(sock);
      registerMessageHandler(sock);
    }
  });

  return sock;
}
