# LAN Watchdog UI

Web interface for a home LAN watchdog built on an Arduino Nano + W5500.

The Nano serves a tiny page on the local network that loads `app.js` from GitHub Pages.
`app.js` renders the dashboard and talks to the Nano's JSON API on the same local address
(`/api`, `/ts`, `/g`, `/reboot`). No addresses, keys or other private data are stored here;
everything is read from the device at runtime.

Changing the design = editing `app.js` and pushing. The Nano picks it up within a minute.
