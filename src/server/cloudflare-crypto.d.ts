// Cloudflare Workers extension used by the existing payment routes.
// https://developers.cloudflare.com/workers/runtime-apis/web-crypto/#timingsafeequal
interface SubtleCrypto {
  timingSafeEqual(a: ArrayBuffer | ArrayBufferView, b: ArrayBuffer | ArrayBufferView): boolean;
}
