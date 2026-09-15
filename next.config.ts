import type { NextConfig } from "next";

// Google Identity Services needs its script, iframe, styles and XHR allowed.
// https://developers.google.com/identity/gsi/web/guides/csp
const GSI_SCRIPT = "https://accounts.google.com/gsi/client";
const GSI_FRAME = "https://accounts.google.com/gsi/";
const GSI_CONNECT = "https://accounts.google.com/gsi/";
const GSI_STYLE = "https://accounts.google.com/gsi/style";

// Firebase Authentication habla con estas dos por XHR: identitytoolkit para el
// alta, el ingreso y el envio de correos, y securetoken para renovar el ID
// token cuando vence. Sin las dos en connect-src el navegador bloquea la
// llamada y el error que se ve es "No se pudo conectar", que apunta al lugar
// equivocado.
const FIREBASE_CONNECT =
  "https://identitytoolkit.googleapis.com https://securetoken.googleapis.com";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: process.cwd()
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              `script-src 'self' 'unsafe-inline' ${GSI_SCRIPT}`,
              `style-src 'self' 'unsafe-inline' ${GSI_STYLE}`,
              "img-src 'self' data: blob: https://*.basemaps.cartocdn.com",
              `connect-src 'self' ${GSI_CONNECT} ${FIREBASE_CONNECT}`,
              `frame-src 'self' ${GSI_FRAME}`,
              "font-src 'self' data:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
