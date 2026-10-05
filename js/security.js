'use strict';
/*
 * Camada de segurança do protótipo, toda baseada na Web Crypto API do navegador.
 *  - Senhas: PBKDF2-SHA256 com sal aleatório (nunca guardamos a senha em si).
 *  - Zona Segura: cada usuária tem um par de chaves ECDH P-256. A chave privada fica
 *    cifrada (AES-256-GCM) com uma chave derivada da senha. Cada conversa usa uma chave
 *    AES-256-GCM derivada por ECDH + HKDF. O "servidor" (localStorage) só vê texto cifrado.
 *
 * Observação: é uma demonstração didática. Um app real deve usar um protocolo auditado
 * (ex.: Signal Protocol, com sigilo futuro e troca de chaves por dispositivo).
 */
const Sec = (() => {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const PBKDF2_ITER = 310000;

  /* ---------------- Senhas ---------------- */
  async function pbkdf2(password, salt, iter = PBKDF2_ITER) {
    const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, 256);
    return new Uint8Array(bits);
  }
  async function hashPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await pbkdf2(password, salt);
    return { alg: 'PBKDF2-SHA256', iter: PBKDF2_ITER, salt: U.toB64(salt), hash: U.toB64(hash) };
  }
  function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  }
  async function verifyPassword(password, rec) {
    if (!rec) {
      // Faz o mesmo trabalho mesmo sem conta, para não revelar pelo tempo de resposta se o e-mail existe.
      await pbkdf2(password, crypto.getRandomValues(new Uint8Array(16)));
      return false;
    }
    const h = await pbkdf2(password, U.fromB64(rec.salt), rec.iter);
    return timingSafeEqual(h, U.fromB64(rec.hash));
  }

  const COMMON = ['123456', '12345678', '123456789', '1234567890', 'password', 'senha', 'senha123', 'senha1234', 'qwerty',
    'abc123', '111111', '000000', 'iloveyou', 'admin', 'welcome', 'brasil', 'brasil123', 'mudar123', 'teste123', 'eleva',
    'eleva123', 'princesa', 'flamengo', 'corinthians', 'palmeiras', 'amor', 'deus', 'jesus', 'familia', 'liderança',
    'lideranca', 'mulher', 'qwerty123', 'asdfgh', 'zxcvbn', '1q2w3e4r', 'aaaaaa', 'abcdef', 'password1', 'letmein'];

  /* Retorna { score 0-4, ok, label, issues[] }. ok=false bloqueia o cadastro/troca de senha. */
  function passwordStrength(pw, ctx = {}) {
    const issues = [];
    const low = U.normalize(pw);
    if (pw.length < 10) issues.push('Use pelo menos 10 caracteres.');
    const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
    if (classes < 3) issues.push('Combine letras maiúsculas, minúsculas, números ou símbolos.');
    const stripped = low.replace(/[^a-z]/g, '');
    if (COMMON.some((c) => low === U.normalize(c) || (c.length >= 5 && low.includes(U.normalize(c))) || stripped === U.normalize(c))) {
      issues.push('Essa senha é muito comum e fácil de adivinhar.');
    }
    const personal = [];
    String(ctx.name || '').split(/\s+/).forEach((p) => { if (p.length >= 3) personal.push(U.normalize(p)); });
    const local = String(ctx.email || '').split('@')[0];
    if (local.length >= 3) personal.push(U.normalize(local));
    if (personal.some((p) => low.includes(p))) issues.push('Não use seu nome ou e-mail na senha.');
    if (/(.)\1{3,}/.test(pw)) issues.push('Evite repetir o mesmo caractere várias vezes.');
    if (/(0123|1234|2345|3456|4567|5678|6789|abcd|qwer|asdf)/i.test(pw)) issues.push('Evite sequências como 1234 ou abcd.');

    let score = 0;
    if (pw.length >= 10) score++;
    if (pw.length >= 14) score++;
    if (classes >= 3) score++;
    if (classes === 4 || pw.length >= 18) score++;
    if (issues.length) score = Math.min(score, 1);
    const labels = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte'];
    return { score, ok: issues.length === 0 && score >= 2, label: labels[score], issues };
  }

  async function sha256Hex(text) {
    const d = await crypto.subtle.digest('SHA-256', enc.encode(text));
    return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
  }

  /* Código numérico uniforme (sem viés de módulo) */
  function randomCode(digits = 6) {
    let out = '';
    const buf = new Uint8Array(1);
    while (out.length < digits) {
      crypto.getRandomValues(buf);
      if (buf[0] < 250) out += String(buf[0] % 10);
    }
    return out;
  }

  /* ---------------- Verificação em duas etapas (TOTP, RFC 6238) ----------------
   * Compatível com Google Authenticator, Microsoft Authenticator, Authy, 1Password etc.
   * Segredo de 160 bits, HMAC-SHA1, 6 dígitos, janelas de 30 segundos. */
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  function base32Encode(bytes) {
    let bits = 0, value = 0, out = '';
    for (const b of bytes) {
      value = (value << 8) | b; bits += 8;
      while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
    }
    if (bits > 0) out += B32[(value << (5 - bits)) & 31];
    return out;
  }
  function base32Decode(str) {
    const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
    let bits = 0, value = 0;
    const out = [];
    for (const c of clean) {
      value = (value << 5) | B32.indexOf(c); bits += 5;
      if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
    }
    return new Uint8Array(out);
  }
  const newTotpSecret = () => base32Encode(crypto.getRandomValues(new Uint8Array(20)));
  const TOTP_STEP = 30;
  const currentStep = (t = Date.now()) => Math.floor(t / 1000 / TOTP_STEP);
  async function totpAt(secret, step) {
    const key = await crypto.subtle.importKey('raw', base32Decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const counter = new Uint8Array(8);
    let n = step;
    for (let i = 7; i >= 0; i--) { counter[i] = n & 255; n = Math.floor(n / 256); }
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, counter));
    const off = mac[mac.length - 1] & 15;
    const bin = ((mac[off] & 127) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3];
    return String(bin % 1000000).padStart(6, '0');
  }
  /* Aceita a janela atual e uma antes/depois (relógio do celular um pouco adiantado ou atrasado).
     Retorna o número da janela usada, para impedir que o mesmo código seja usado duas vezes. */
  async function verifyTotp(secret, code, lastUsedStep = -1) {
    const c = String(code).replace(/\s/g, '');
    if (!/^\d{6}$/.test(c)) return null;
    const now = currentStep();
    for (const step of [now, now - 1, now + 1]) {
      if (step <= lastUsedStep) continue;
      if (await totpAt(secret, step) === c) return step;
    }
    return null;
  }
  const otpauthUri = (secret, email) => `otpauth://totp/Eleva:${encodeURIComponent(email)}?secret=${secret}&issuer=Eleva&algorithm=SHA1&digits=6&period=30`;

  /* Códigos de backup: 10 códigos de uso único, guardados só como hash */
  function newBackupCodes(n = 10) {
    const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
    const codes = [];
    while (codes.length < n) {
      const bytes = crypto.getRandomValues(new Uint8Array(8));
      const raw = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
      codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
    }
    return codes;
  }
  const normBackup = (c) => String(c).toLowerCase().replace(/[^a-z0-9]/g, '');

  /* ---------------- Chaves da Zona Segura ---------------- */
  const ECDH = { name: 'ECDH', namedCurve: 'P-256' };

  async function generateKeyPair() {
    const kp = await crypto.subtle.generateKey(ECDH, true, ['deriveBits']);
    return {
      pubJwk: await crypto.subtle.exportKey('jwk', kp.publicKey),
      privJwk: await crypto.subtle.exportKey('jwk', kp.privateKey),
    };
  }
  const importPub = (jwk) => crypto.subtle.importKey('jwk', jwk, ECDH, true, []);
  const importPriv = (jwk) => crypto.subtle.importKey('jwk', jwk, ECDH, false, ['deriveBits']);

  async function passwordKey(password, salt) {
    const raw = await pbkdf2(password, salt);
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  /* Cifra a chave privada com a senha da usuária antes de "salvar no servidor" */
  async function wrapPrivate(privJwk, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await passwordKey(password, salt);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(privJwk)));
    return { salt: U.toB64(salt), iv: U.toB64(iv), ct: U.toB64(ct) };
  }
  async function unwrapPrivate(wrapped, password) {
    const key = await passwordKey(password, U.fromB64(wrapped.salt));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: U.fromB64(wrapped.iv) }, key, U.fromB64(wrapped.ct));
    const jwk = JSON.parse(dec.decode(pt));
    return { key: await importPriv(jwk), jwk };
  }

  /* Chave da conversa: ECDH -> HKDF-SHA256 (sal = id da conversa) -> AES-256-GCM */
  const keyCache = new Map();
  async function conversationKey(myPriv, theirPubJwk, convoId) {
    const cacheKey = convoId + '|' + theirPubJwk.x + '|' + theirPubJwk.y;
    if (keyCache.has(cacheKey) && keyCache.get(cacheKey).priv === myPriv) return keyCache.get(cacheKey).key;
    const pub = await importPub(theirPubJwk);
    const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: pub }, myPriv, 256);
    const hk = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: enc.encode(convoId), info: enc.encode('eleva-zona-segura-v1') },
      hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    keyCache.set(cacheKey, { priv: myPriv, key });
    return key;
  }
  async function encrypt(key, text, aad) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, enc.encode(text));
    return { iv: U.toB64(iv), ct: U.toB64(ct) };
  }
  async function decrypt(key, msg, aad) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: U.fromB64(msg.iv), additionalData: enc.encode(aad) }, key, U.fromB64(msg.ct));
    return dec.decode(pt);
  }

  /* Código de segurança (estilo Signal): 60 dígitos derivados das duas chaves públicas */
  async function safetyCode(pubA, pubB) {
    const parts = [pubA, pubB].map((k) => `${k.x}.${k.y}`).sort();
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-512', enc.encode(parts.join('|'))));
    const groups = [];
    for (let i = 0; i < 12; i++) {
      const n = ((digest[i * 4] << 24) | (digest[i * 4 + 1] << 16) | (digest[i * 4 + 2] << 8) | digest[i * 4 + 3]) >>> 0;
      groups.push(String(n % 100000).padStart(5, '0'));
    }
    return groups;
  }

  /* ---------------- Proteção de dados pessoais ---------------- */
  /* Detecta CPF ou celular brasileiro em texto que será publicado em áreas abertas */
  function detectPII(text) {
    const found = [];
    const t = String(text || '');
    const cpfRe = /\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2}\b/g;
    let m;
    while ((m = cpfRe.exec(t))) {
      if (validCPF(m[0].replace(/\D/g, ''))) { found.push('CPF'); break; }
    }
    if (/(\+?55[\s-]?)?\(?\b\d{2}\)?[\s-]?9[\s.-]?\d{4}[\s.-]?\d{4}\b/.test(t)) found.push('número de celular');
    return found;
  }
  function validCPF(c) {
    if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
    const dv = (len) => {
      let s = 0;
      for (let i = 0; i < len; i++) s += Number(c[i]) * (len + 1 - i);
      const r = (s * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
  }

  /* Redesenha a foto num canvas: remove EXIF, localização GPS e outros metadados */
  const ALLOWED_IMG = ['image/jpeg', 'image/png', 'image/webp'];
  function stripImageMetadata(file, max = 480) {
    return new Promise((resolve, reject) => {
      if (!ALLOWED_IMG.includes(file.type)) return reject(new Error('Envie uma imagem JPG, PNG ou WebP.'));
      if (file.size > 5 * 1024 * 1024) return reject(new Error('A imagem deve ter no máximo 5 MB.'));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const side = Math.round(Math.min(img.width, img.height) * scale);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = side;
        const ctx = canvas.getContext('2d');
        // Recorte quadrado central
        const s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, side, side);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a imagem.')); };
      img.src = url;
    });
  }

  /* ---------------- Limite de frequência (anti-spam) ---------------- */
  const hits = new Map();
  /* Retorna null se permitido, ou mensagem de erro */
  function rateLimit(key, { max = 5, windowMs = 60000, minGapMs = 2000 } = {}) {
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (list.length && now - list[list.length - 1] < minGapMs) {
      return 'Calma! Aguarde alguns segundos antes de publicar de novo.';
    }
    if (list.length >= max) {
      const wait = Math.ceil((windowMs - (now - list[0])) / 1000);
      return `Você atingiu o limite de publicações. Tente novamente em ${wait}s.`;
    }
    list.push(now);
    hits.set(key, list);
    return null;
  }

  return { newTotpSecret, totpAt, currentStep, verifyTotp, otpauthUri, newBackupCodes, normBackup, TOTP_STEP, hashPassword, verifyPassword, passwordStrength, sha256Hex, randomCode, generateKeyPair, importPub,
    importPriv, wrapPrivate, unwrapPrivate, conversationKey, encrypt, decrypt, safetyCode, detectPII,
    stripImageMetadata, rateLimit };
})();
