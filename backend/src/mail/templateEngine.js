// CMS.md §5.2 — mantıksız şablon motoru: yalnızca {{degisken}}; kanal bazlı kaçış.
// Şablon kod çalıştıramaz; admin HTML yazamaz (şablon metni de escape edilir).

export const TEMPLATE_VARIABLES = Object.freeze({
  PASSWORD_RESET: {
    allowed: ['siteName', 'adminName', 'resetUrl', 'expiresInMinutes'],
    required: ['resetUrl'],
  },
  CONTACT_NOTIFICATION: {
    allowed: [
      'siteName',
      'senderFullName',
      'senderEmail',
      'senderPhone',
      'subject',
      'message',
      'adminUrl',
    ],
    required: [],
  },
  SMTP_TEST: { allowed: ['siteName', 'sentAt'], required: [] },
  CONTACT_REPLY_EMAIL: {
    allowed: ['siteName', 'ownerName', 'firstName', 'lastName', 'subject'],
    required: [],
  },
});

const VARIABLE = /\{\{\s*([a-zA-Z][a-zA-Z0-9]*)\s*\}\}/g;
// eslint-disable-next-line no-control-regex -- kontrol karakterlerini bilerek temizliyoruz
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const stripControl = (value) => String(value ?? '').replace(CONTROL_CHARS, '');

export const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** @param {string} text */
export const findVariables = (text) => [...String(text ?? '').matchAll(VARIABLE)].map((m) => m[1]);

/**
 * Kayıt anında doğrulama (CMS.md §5.2): bilinmeyen değişken yok, zorunlular mevcut.
 * @returns {{ path: string, message: string }[]}
 */
export function validateTemplate(key, { subject, body }) {
  const spec = TEMPLATE_VARIABLES[key];
  if (!spec) return [{ path: 'key', message: 'Bilinmeyen şablon.' }];
  const issues = [];
  for (const [path, text] of [
    ['subject', subject],
    ['body', body],
  ]) {
    for (const name of findVariables(text)) {
      if (!spec.allowed.includes(name)) {
        issues.push({ path, message: `Bilinmeyen değişken: {{${name}}}` });
      }
    }
  }
  const used = new Set([...findVariables(subject), ...findVariables(body)]);
  for (const name of spec.required) {
    if (!used.has(name)) {
      issues.push({ path: 'body', message: `Zorunlu değişken eksik: {{${name}}}` });
    }
  }
  return issues;
}

/**
 * Şablonu parçalara ayırıp her parçaya kaçış uygular.
 * @param {string} template
 * @param {Record<string, unknown>} vars
 * @param {{ literal?: (s: string) => string, value?: (s: string) => string }} [escape]
 */
export function render(template, vars, escape = {}) {
  const source = String(template ?? '');
  const literal = escape.literal ?? ((s) => s);
  const value = escape.value ?? ((s) => s);
  let output = '';
  let last = 0;
  for (const match of source.matchAll(VARIABLE)) {
    output += literal(stripControl(source.slice(last, match.index)));
    output += value(stripControl(vars[match[1]]));
    last = match.index + match[0].length;
  }
  return output + literal(stripControl(source.slice(last)));
}

const htmlFrame = (siteName, inner) =>
  [
    '<!doctype html><html lang="tr"><head><meta charset="utf-8"></head>',
    '<body style="margin:0;padding:24px;background:#f5f5fa;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#22202e">',
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;line-height:1.6">',
    `<p style="margin:0 0 16px;font-weight:600;color:#5a3fd6">${escapeHtml(siteName)}</p>`,
    `<div>${inner}</div>`,
    '</div></body></html>',
  ].join('');

/**
 * E-posta: konu (CR/LF temiz, ≤200), düz metin ve HTML gövde.
 * @param {{ subject?: string|null, body: string }} template
 * @param {Record<string, unknown>} vars
 */
export function renderEmail(template, vars) {
  const subject = render(template.subject ?? '', vars)
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, 200);
  const text = render(template.body, vars);
  const htmlBody = render(template.body, vars, { literal: escapeHtml, value: escapeHtml }).replace(
    /\n/g,
    '<br>',
  );
  return { subject, text, html: htmlFrame(String(vars.siteName ?? ''), htmlBody) };
}
