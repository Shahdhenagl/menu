// توقيع طلبات الطباعة لـ QZ Tray.
//
// QZ Tray بيعتبر أي طلب "مش موقّع" طلبًا غير موثوق، فبيطلع رسالة تحذير قبل كل طباعة.
// وعلامة "Remember this decision" مش بتنفع دايمًا مع الطلبات غير الموقّعة — بتخلص
// بانتهاء الجلسة أو أول ما QZ يتقفل ويتفتح تاني، فالرسالة بترجع.
//
// الحل الرسمي: الموقع يوقّع كل طلب بمفتاح خاص، والشهادة العامة بتتحط في QZ عشان يثق فيها.
// وقتها QZ بيطبع من غير أي رسالة خالص.
//
// بيتفعّل بس لما المتغيرين دول يكونوا متظبطين (.env أو Vercel Environment Variables):
//   VITE_QZ_CERT  = محتوى digital-certificate.txt (الشهادة العامة)
//   VITE_QZ_KEY   = محتوى private-key.pem بصيغة PKCS#8
// من غيرهم الطباعة بتشتغل عادي زي دلوقتي (بس رسالة التحذير هتفضل موجودة).
//
// خطوات التوليد والتركيب مشروحة في QZ_SETUP.md.

import qz from 'qz-tray';

const CERT = (import.meta.env.VITE_QZ_CERT as string | undefined)?.trim();
const KEY = (import.meta.env.VITE_QZ_KEY as string | undefined)?.trim();

// يحوّل PEM (بترويسة ----BEGIN...) لـ ArrayBuffer عشان WebCrypto
const pemToArrayBuffer = (pem: string): ArrayBuffer => {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

const toBase64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

let signingKey: Promise<CryptoKey> | null = null;
const getSigningKey = (): Promise<CryptoKey> => {
  if (!signingKey) {
    signingKey = crypto.subtle.importKey(
      'pkcs8',
      pemToArrayBuffer(KEY as string),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
      false,
      ['sign']
    );
  }
  return signingKey;
};

let configured = false;

/** يظبط الشهادة والتوقيع مرة واحدة قبل أول اتصال بـ QZ. */
export const configureQzSecurity = () => {
  if (configured) return;
  configured = true;

  if (!CERT || !KEY) return; // مفيش شهادة متظبطة → نسيب QZ على وضعه الافتراضي

  const security = (qz as any).security;
  security.setCertificatePromise((resolve: (v: string) => void) => resolve(CERT));
  security.setSignatureAlgorithm('SHA512');
  security.setSignaturePromise((dataToSign: string) =>
    (resolve: (v: string) => void, reject: (e: unknown) => void) => {
      getSigningKey()
        .then(key => crypto.subtle.sign(
          'RSASSA-PKCS1-v1_5',
          key,
          new TextEncoder().encode(dataToSign)
        ))
        .then(sig => resolve(toBase64(sig)))
        .catch(err => {
          console.error('QZ: فشل توقيع الطلب — هيرجع يسأل قبل الطباعة.', err);
          reject(err);
        });
    }
  );
};
