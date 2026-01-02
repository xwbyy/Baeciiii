export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const targetUrl = "https://api.digiflazz.com";

    // Daftar IP Cloudflare yang perlu di-whitelist di Digiflazz (IP tunggal dari range /20 dan /22)
    const staticIPs = [
      "173.245.48.1",
      "103.21.244.1",
      "103.22.200.1",
      "103.31.4.1",
      "141.101.64.1",
      "108.162.192.1",
      "190.93.240.1",
      "188.114.96.1",
      "197.234.240.1",
      "198.41.128.1",
      "162.158.0.1",
      "104.16.0.1",
      "172.64.0.1",
      "131.0.72.1"
    ];

    // Jika akses root, tampilkan instruksi whitelist
    if (url.pathname === "/" || url.pathname === "") {
      const html = `
        <body style="background:#0f172a;color:#f8fafc;font-family:sans-serif;padding:50px;line-height:1.6">
          <div style="max-width:600px;margin:0 auto;background:#1e293b;padding:30px;border-radius:12px;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1)">
            <h1 style="color:#38bdf8;margin-bottom:20px">BAECI Proxy Gateway</h1>
            <p>Masukkan salah satu atau semua IP berikut ke <b>Production IP</b> di Digiflazz:</p>
            <div style="background:#0f172a;padding:15px;border-radius:8px;font-family:monospace;border:1px solid #334155;margin:20px 0">
              ${staticIPs.join('<br>')}
            </div>
            <p style="font-size:14px;color:#94a3b8">Note: Pastikan mode Worker adalah 'HTTP Proxy'</p>
          </div>
        </body>
      `;
      return new Response(html, { headers: { "content-type": "text/html" } });
    }

    // Proxy request ke Digiflazz
    try {
      const proxyUrl = targetUrl + url.pathname + url.search;
      const newRequest = new Request(proxyUrl, {
        method: request.method,
        headers: request.headers,
        body: request.method !== "GET" && request.method !== "HEAD" ? await request.blob() : null,
      });

      return await fetch(newRequest);
    } catch (e) {
      return new Response("Proxy Error: " + e.message, { status: 500 });
    }
  }
};