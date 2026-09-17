/**
 * Web Bluetooth client for the standard Heart Rate Service (0x180D), which is
 * what Whoop's "Broadcast Heart Rate" setting exposes. Works in Chrome and
 * Edge on Android, macOS and Windows; not in Safari, so on iOS use Bluefy.
 */

export interface HeartRateHandlers {
  onRate: (bpm: number) => void;
  onStatus: (status: "connecting" | "connected" | "reconnecting" | "disconnected", detail?: string) => void;
}

export interface HeartRateConnection {
  name: string;
  disconnect: () => void;
}

export function isHeartRateSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

/** Heart Rate Measurement characteristic: flags byte, then 8- or 16-bit BPM. */
export function parseHeartRateMeasurement(view: DataView): number {
  const flags = view.getUint8(0);
  return flags & 0x01 ? view.getUint16(1, true) : view.getUint8(1);
}

/** Must be called from a user gesture: the browser shows its device picker. */
export async function connectHeartRate(handlers: HeartRateHandlers): Promise<HeartRateConnection> {
  const device = await navigator.bluetooth.requestDevice({ filters: [{ services: ["heart_rate"] }] });
  const name = device.name || "Heart rate sensor";
  let closed = false;

  const subscribe = async () => {
    const server = await device.gatt!.connect();
    const service = await server.getPrimaryService("heart_rate");
    const characteristic = await service.getCharacteristic("heart_rate_measurement");
    await characteristic.startNotifications();
    characteristic.addEventListener("characteristicvaluechanged", (event) => {
      const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
      if (value) handlers.onRate(parseHeartRateMeasurement(value));
    });
    handlers.onStatus("connected", name);
  };

  device.addEventListener("gattserverdisconnected", async () => {
    if (closed) return;
    // The strap drops out now and then; retry a few times before giving up.
    for (let attempt = 1; attempt <= 5 && !closed; attempt++) {
      handlers.onStatus("reconnecting", `attempt ${attempt}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      try {
        await subscribe();
        return;
      } catch {
        /* try again */
      }
    }
    if (!closed) handlers.onStatus("disconnected", "lost connection");
  });

  handlers.onStatus("connecting", name);
  await subscribe();

  return {
    name,
    disconnect: () => {
      closed = true;
      device.gatt?.disconnect();
      handlers.onStatus("disconnected");
    },
  };
}
