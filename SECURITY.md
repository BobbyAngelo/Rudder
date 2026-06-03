# Security Policy

Rudder is local-first: your data is parsed, embedded, and stored only on your machine, and
the ingest pipeline makes no outbound calls. Even so, security matters — especially for a
tool that holds your most personal data.

## Supported versions

Rudder is pre-1.0 and moves quickly. Security fixes land on `main`; please test against the
latest `main` before reporting.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Use GitHub's private vulnerability reporting: on the repository's **Security** tab, choose
**Report a vulnerability**. That opens a private advisory visible only to the maintainers.
If you can't use that, email **`<add a maintainer contact email>`**.

Please include:

- what you found, and the potential impact,
- steps to reproduce,
- the affected version or commit.

We aim to acknowledge reports within a few days and will keep you posted on the fix.

## Scope

Rudder runs on your own machine and trusts your local environment. The most relevant areas:

- the optional `/api/ingest` door — lock it with `RUDDER_INGEST_TOKEN` if you expose it
  beyond `localhost`;
- the optional cloud-model fallback — off by default; only active if you set an API key;
- dependency / supply-chain issues in the build.

Out of scope: anything that requires an attacker to already have local access to your
machine or your unlocked session — Rudder trusts the local user by design.

## Our commitment

No telemetry. No outbound calls from the ingest pipeline. The only network dependency is
your local model endpoint. If that ever changes, it will be explicit and opt-in.
