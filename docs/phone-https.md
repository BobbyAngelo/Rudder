# Phone audio over HTTPS (5-minute setup)

The phone capture client at **`/m.html`** lets you record a session and send it to your
brain. **Typed** sessions work over plain `http://` on your LAN right now. **Audio**
recording needs one extra thing: a *secure context*.

## Why

Browsers only grant microphone access (`getUserMedia`) over **HTTPS** or `localhost` —
never over a plain `http://192.168.x.x` LAN address. So to record audio *from your
phone*, your phone has to reach Rudder over HTTPS.

The sovereign way to do that — no public exposure, data still only ever goes to your own
machine — is **Tailscale Serve**. It puts an HTTPS front door on Rudder that's reachable
only by *your* devices on *your* private network (your "tailnet").

> Use **Serve**, not **Funnel**. Serve = private to your devices. Funnel = public
> internet. You want Serve.

## One command

Once Tailscale is installed and you're signed in, from the repo root:

```bash
./phone-https.sh        # serves Rudder over HTTPS and prints your phone URL
./phone-https.sh off    # tears it down
```

That script does the steps below for you (and prints the exact
`https://<your-mac>.<tailnet>.ts.net/m.html` to open on your phone). The manual
version:

## Setup (recommended: Tailscale Serve)

1. **Install Tailscale** on your Mac and your phone, signed into the **same account**:
   <https://tailscale.com/download>. (Free for personal use.)

2. **Enable HTTPS certificates** for your tailnet once, in the admin console:
   DNS → enable **MagicDNS**, then enable **HTTPS Certificates**.

3. **Run Rudder** on the Mac as usual:

   ```bash
   npm --prefix app run dev      # serves http://localhost:3000
   ```

4. **Put an HTTPS front door on it** (in another terminal):

   ```bash
   tailscale serve --bg 3000     # proxies https://<your-mac>.<tailnet>.ts.net → 127.0.0.1:3000
   ```

   Find the exact URL with:

   ```bash
   tailscale serve status
   ```

5. **On your phone** (same tailnet), open:

   ```
   https://<your-mac>.<tailnet>.ts.net/m.html
   ```

   Add it to your home screen. Mic access now works — pick a kind, **record**, tag, send.

### Turn it off

```bash
tailscale serve --https=443 off
```

## Optional: lock the door

Tailscale already restricts access to your devices. For defense-in-depth, set an ingest
token so only clients that know it can write to memory:

```bash
# in app/.env.local
RUDDER_INGEST_TOKEN=some-long-random-string
```

Then enter the same token in the phone client's ⚙︎ panel. (On a trusted home LAN you can
skip this.)

## Alternatives (if you don't use Tailscale)

- **`next dev --experimental-https`** — Next.js generates a self-signed cert. Works great
  on the laptop; on a phone you must manually install and trust the certificate profile,
  which is fiddly. Fine for testing, not for everyday use.
- **A reverse proxy with a local CA** (Caddy, mkcert) — more setup, same idea: terminate
  HTTPS in front of `localhost:3000`.

All of these keep Rudder sovereign — the audio is still transcribed and stored only on
your machine. HTTPS here is about satisfying the browser's mic-permission rule, not about
sending your data anywhere.
