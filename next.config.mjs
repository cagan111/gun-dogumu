/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];
export default {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    const privateCalendarHeaders = [{ key: "Referrer-Policy", value: "no-referrer" }];
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/api/calendar/:path*", headers: privateCalendarHeaders },
      { source: "/api/panel/staff/:id/calendar", headers: privateCalendarHeaders },
    ];
  },
};
