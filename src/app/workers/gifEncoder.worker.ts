/**
 * GIF Encoder Web Worker
 * Offloads the expensive quantize + palette + frame encoding from the main thread.
 * Receives raw RGBA frame data via postMessage and returns encoded GIF bytes.
 */
import { GIFEncoder, applyPalette, quantize } from "gifenc";

interface GifWorkerInput {
  /** Array of raw RGBA Uint8ClampedArray per frame */
  frames: Uint8ClampedArray[];
  width: number;
  height: number;
  delay: number;
}

interface GifWorkerOutput {
  bytes: Uint8Array;
}

self.onmessage = (event: MessageEvent<GifWorkerInput>) => {
  const { frames, width, height, delay } = event.data;

  try {
    const gif = GIFEncoder();

    for (const rgba of frames) {
      const palette = quantize(rgba, 128);
      const indexed = applyPalette(rgba, palette);
      gif.writeFrame(indexed, width, height, { palette, delay, repeat: 0 });
    }

    gif.finish();
    const bytes = new Uint8Array(gif.bytes());
    const buffer = bytes.buffer.slice(0) as ArrayBuffer;

    // Transfer ownership of the buffer back to the main thread (zero-copy)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (self as any).postMessage({ bytes: new Uint8Array(buffer) }, [buffer]);
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (self as any).postMessage({ error: err instanceof Error ? err.message : "GIF encoding gagal." });
  }
};
