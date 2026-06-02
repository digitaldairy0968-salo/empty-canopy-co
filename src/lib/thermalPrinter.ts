// Web Bluetooth ESC/POS Thermal Printer Utility
// Silent, direct printing - no browser print dialog
//
// Compatible with most 58mm/80mm BLE thermal printers (RPP02, MTP-II, etc.)
// that expose the common nordic/printer service.

// Common BLE printer services (we attempt them in order)
const PRINTER_SERVICES: any[] = [
  0x18f0,
  0xff00,
  0xfee7,
  0xffe0,
  0xfff0,
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000fff0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
];

interface PrinterRef {
  device: any;
  characteristic: any;
}

let printerRef: PrinterRef | null = null;

const STORAGE_KEY = 'thermal_printer_device_name';
const DEVICE_ID_KEY = 'thermal_printer_device_id';
const CONNECT_TIMEOUT_MS = 12000;

const enc = new TextEncoder();

// ESC/POS commands
const ESC = 0x1b;
const GS = 0x1d;
const INIT = new Uint8Array([ESC, 0x40]);
const LF = new Uint8Array([0x0a]);
const ALIGN_CENTER = new Uint8Array([ESC, 0x61, 0x01]);
const ALIGN_LEFT = new Uint8Array([ESC, 0x61, 0x00]);
const BOLD_ON = new Uint8Array([ESC, 0x45, 0x01]);
const BOLD_OFF = new Uint8Array([ESC, 0x45, 0x00]);
const DOUBLE_ON = new Uint8Array([GS, 0x21, 0x11]);
const DOUBLE_OFF = new Uint8Array([GS, 0x21, 0x00]);
const FEED_AND_CUT = new Uint8Array([0x0a, 0x0a, 0x0a, 0x0a, GS, 0x56, 0x00]);

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

async function findWritableCharacteristic(server: any): Promise<any> {
  // Try known services first
  for (const svc of PRINTER_SERVICES) {
    try {
      const service = await server.getPrimaryService(svc);
      const chars = await service.getCharacteristics();
      for (const ch of chars) {
        if (ch.properties.write || ch.properties.writeWithoutResponse) {
          return ch;
        }
      }
    } catch (_) { /* try next */ }
  }
  // Fallback: enumerate all
  try {
    const services = await server.getPrimaryServices();
    for (const service of services) {
      const chars = await service.getCharacteristics();
      for (const ch of chars) {
        if (ch.properties.write || ch.properties.writeWithoutResponse) return ch;
      }
    }
  } catch (_) { /* ignore */ }
  return null;
}

async function wait(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function rememberDevice(device: any) {
  try {
    localStorage.setItem(STORAGE_KEY, device.name || 'printer');
    if (device?.id) localStorage.setItem(DEVICE_ID_KEY, device.id);
  } catch {}
}

function getStoredDeviceId(): string | null {
  try {
    return localStorage.getItem(DEVICE_ID_KEY);
  } catch {
    return null;
  }
}

async function getPreviouslyGrantedDevice(): Promise<any | null> {
  const bt: any = (navigator as any).bluetooth;
  if (!bt?.getDevices) return null;

  try {
    const devices = await bt.getDevices();
    if (!Array.isArray(devices) || devices.length === 0) return null;

    const storedId = getStoredDeviceId();
    if (storedId) {
      const exact = devices.find((device: any) => device?.id === storedId);
      if (exact) return exact;
    }

    const storedName = getStoredPrinterName();
    if (storedName) {
      const byName = devices.find((device: any) => device?.name === storedName);
      if (byName) return byName;
    }

    return devices[0] ?? null;
  } catch (e) {
    console.warn('[printer] getDevices failed', e);
    return null;
  }
}

async function connectGattWithRetry(device: any, attempts = 4): Promise<any> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      // Android BLE printers often need a brief settle time after picker/pair.
      await wait(i === 0 ? 900 : 900 + 700 * i);
      try {
        if (device.gatt?.connected) device.gatt.disconnect();
      } catch {}

      const server = await withTimeout(
        device.gatt.connect(),
        CONNECT_TIMEOUT_MS,
        'gatt_connect_timeout'
      );
      return server;
    } catch (e) {
      console.warn('[printer] gatt.connect attempt', i + 1, 'failed', e);
      lastErr = e;
      try { device.gatt.disconnect(); } catch {}
    }
  }
  throw lastErr || new Error('gatt_connect_failed');
}

async function openPrinterPicker(): Promise<any> {
  const bt: any = (navigator as any).bluetooth;
  if (!bt) throw new Error('bluetooth_unsupported');

  try {
    return await bt.requestDevice({
      acceptAllDevices: true,
      optionalServices: PRINTER_SERVICES,
    });
  } catch (e: any) {
    if (e?.name === 'NotFoundError') throw new Error('cancelled');
    throw new Error(e?.message || 'picker_failed');
  }
}

export async function connectThermalPrinter(): Promise<{ ok: boolean; name?: string; error?: string }> {
  const bt: any = (navigator as any).bluetooth;
  if (!bt) return { ok: false, error: 'bluetooth_unsupported' };

  let device: any = printerRef?.device ?? await getPreviouslyGrantedDevice();
  const usingRememberedDevice = !!device;

  if (!device) {
    try {
      device = await openPrinterPicker();
    } catch (e: any) {
      return { ok: false, error: e?.message || 'picker_failed' };
    }
  }

  if (!device) return { ok: false, error: 'no_device' };

  try {
    const server = await connectGattWithRetry(device);
    const characteristic = await findWritableCharacteristic(server);
    if (!characteristic) {
      try { device.gatt.disconnect(); } catch {}
      return { ok: false, error: 'no_writable_characteristic' };
    }

    printerRef = { device, characteristic };
    rememberDevice(device);

    device.addEventListener('gattserverdisconnected', () => {
      console.warn('[printer] gatt disconnected');
    });

    return { ok: true, name: device.name };
  } catch (e: any) {
    if (usingRememberedDevice) {
      try {
        const pickedDevice = await openPrinterPicker();
        const server = await connectGattWithRetry(pickedDevice);
        const characteristic = await findWritableCharacteristic(server);

        if (!characteristic) {
          try { pickedDevice.gatt.disconnect(); } catch {}
          return { ok: false, error: 'no_writable_characteristic' };
        }

        printerRef = { device: pickedDevice, characteristic };
        rememberDevice(pickedDevice);

        pickedDevice.addEventListener('gattserverdisconnected', () => {
          console.warn('[printer] gatt disconnected');
        });

        return { ok: true, name: pickedDevice.name };
      } catch (retryError: any) {
        if (retryError?.message === 'cancelled') return { ok: false, error: 'cancelled' };
        e = retryError;
      }
    }

    console.error('[printer] connect failed', e);
    const msg = String(e?.message || e?.name || '');
    if (/GATT|Network|connection/i.test(msg)) {
      return { ok: false, error: 'gatt_failed: ' + msg };
    }
    return { ok: false, error: msg || 'connect_failed' };
  }
}

async function ensureConnected(): Promise<boolean> {
  if (!printerRef) return false;
  try {
    if (!printerRef.device.gatt.connected) {
      const server = await connectGattWithRetry(printerRef.device, 2);
      printerRef.characteristic = await findWritableCharacteristic(server);
    }
    return !!printerRef.characteristic;
  } catch (e) {
    console.error('[printer] ensureConnected failed', e);
    return false;
  }
}

export function isPrinterReady(): boolean {
  return !!printerRef && !!printerRef.device?.gatt?.connected;
}

export function isPrinterPaired(): boolean {
  return !!printerRef;
}

async function writeBytes(data: Uint8Array): Promise<void> {
  if (!printerRef?.characteristic) throw new Error('not_connected');
  const ch = printerRef.characteristic;
  // Most BLE printers accept up to 100-180 bytes per write
  const CHUNK = 100;
  for (let i = 0; i < data.length; i += CHUNK) {
    const slice = data.slice(i, i + CHUNK);
    if (ch.properties.writeWithoutResponse) {
      await ch.writeValueWithoutResponse(slice);
    } else {
      await ch.writeValue(slice);
    }
    // small delay so printer buffer doesn't overflow
    await new Promise(r => setTimeout(r, 20));
  }
}

export interface ReceiptLine {
  text: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  double?: boolean;
}

// Width in characters for 58mm printers
const LINE_WIDTH = 32;

function padBetween(left: string, right: string, width = LINE_WIDTH): string {
  const space = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(space) + right;
}

function divider(char = '-'): string {
  return char.repeat(LINE_WIDTH);
}

export interface MilkReceiptInput {
  dairyName?: string;
  date: string;
  time?: string;
  supplierCode?: string;
  supplierName: string;
  milkType?: string;
  shift: 'morning' | 'evening';
  quantity: number;
  fat?: number | null;
  snf?: number | null;
  lr?: number | null;
  rate: number;
  amount: number;
}

export async function printMilkReceipt(r: MilkReceiptInput): Promise<{ ok: boolean; error?: string }> {
  if (!(await ensureConnected())) return { ok: false, error: 'not_connected' };

  const chunks: Uint8Array[] = [];
  chunks.push(INIT);

  // Header
  chunks.push(ALIGN_CENTER);
  chunks.push(DOUBLE_ON);
  chunks.push(enc.encode((r.dairyName || 'DAIRY') + '\n'));
  chunks.push(DOUBLE_OFF);
  chunks.push(enc.encode('Milk Receipt\n'));
  chunks.push(enc.encode(divider() + '\n'));

  // Body
  chunks.push(ALIGN_LEFT);
  chunks.push(enc.encode(padBetween('Date', r.date) + '\n'));
  if (r.time) chunks.push(enc.encode(padBetween('Time', r.time) + '\n'));
  if (r.supplierCode) chunks.push(enc.encode(padBetween('Code', r.supplierCode) + '\n'));
  chunks.push(enc.encode(padBetween('Name', (r.supplierName || '').slice(0, 22)) + '\n'));
  chunks.push(enc.encode(padBetween('Shift', r.shift) + '\n'));
  if (r.milkType) chunks.push(enc.encode(padBetween('Type', r.milkType) + '\n'));
  chunks.push(enc.encode(divider() + '\n'));

  chunks.push(enc.encode(padBetween('Qty (L)', r.quantity.toFixed(2)) + '\n'));
  if (r.fat != null) chunks.push(enc.encode(padBetween('FAT %', String(r.fat)) + '\n'));
  if (r.snf != null) chunks.push(enc.encode(padBetween('SNF %', String(r.snf)) + '\n'));
  if (r.lr != null) chunks.push(enc.encode(padBetween('LR', String(r.lr)) + '\n'));
  chunks.push(enc.encode(padBetween('Rate', String(r.rate)) + '\n'));
  chunks.push(enc.encode(divider('=') + '\n'));

  chunks.push(BOLD_ON);
  chunks.push(DOUBLE_ON);
  chunks.push(enc.encode(padBetween('TOTAL', 'Rs ' + Math.round(r.amount), 16) + '\n'));
  chunks.push(DOUBLE_OFF);
  chunks.push(BOLD_OFF);

  chunks.push(enc.encode(divider() + '\n'));
  chunks.push(ALIGN_CENTER);
  chunks.push(enc.encode('Thank you!\n'));

  chunks.push(FEED_AND_CUT);

  try {
    await writeBytes(concat(chunks));
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'write_failed' };
  }
}

export function getStoredPrinterName(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

export function forgetPrinter() {
  try {
    if (printerRef?.device?.gatt?.connected) printerRef.device.gatt.disconnect();
  } catch {}
  printerRef = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(DEVICE_ID_KEY);
  } catch {}
}
