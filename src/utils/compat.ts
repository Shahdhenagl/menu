// توافق مع الأجهزة والمتصفحات القديمة (ويندوز 7 — آخر كروم عليه 109، وآخر فايرفوكس ESR 115).
//
// لازم يتحمّل قبل أي كود تاني في main.tsx.

// crypto.randomUUID موجود من كروم 92 وبس على اتصال آمن (HTTPS أو localhost).
// السيستم بيستخدمه في كل عملية إضافة (أوردر/مصروف/تقفيل...)، فلو مش موجود
// الأبلكيشن بيقع. البديل ده بيولّد UUID v4 صالح بنفس الشكل.
if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID !== 'function') {
  (crypto as any).randomUUID = function randomUUID(): string {
    // نستخدم getRandomValues لو موجود (أعشوائية سليمة)، وإلا Math.random كحل أخير
    const bytes = new Uint8Array(16);
    if (typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // النسخة 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // الـ variant
    const hex: string[] = [];
    for (let i = 0; i < 16; i++) hex.push(bytes[i].toString(16).padStart(2, '0'));
    return (
      hex.slice(0, 4).join('') + '-' +
      hex.slice(4, 6).join('') + '-' +
      hex.slice(6, 8).join('') + '-' +
      hex.slice(8, 10).join('') + '-' +
      hex.slice(10, 16).join('')
    );
  };
}

export {};
