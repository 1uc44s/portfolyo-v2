// API yanıtları için sıkı başlıklar. Public sayfa CSP'si statik
// sunum katmanında (Caddy) uygulanır; API JSON döndürdüğü için default-src 'none' yeterli.
import helmet from 'helmet';
import { isProd } from '../config/env.js';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"] },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
  hsts: isProd ? { maxAge: 31_536_000, includeSubDomains: true } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});
