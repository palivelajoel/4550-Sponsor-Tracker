import { d1SelectOne } from './_gateway.js';

export default async function handler(req, res) {
  let logoUrl = '/logo.jpg';

  try {
    const row = await d1SelectOne('site_config', { filters: [{ col: 'key', op: 'eq', value: 'logo_url' }] });
    if (row?.value) logoUrl = row.value;
  } catch {}

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  res.status(200).json({
    name: "Team 4550 Something's Bruin",
    short_name: "Team 4550",
    description: "FRC Team 4550 — Member Hub, Inventory & Media",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#ef4444",
    background_color: "#080a0f",
    icons: [
      { src: logoUrl, sizes: "192x192", type: "image/jpeg" },
      { src: logoUrl, sizes: "512x512", type: "image/jpeg" },
    ],
  });
}
