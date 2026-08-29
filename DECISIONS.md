# DECISIONS

Short, durable notes on choices and hazards that are not obvious from the code and
would otherwise be rediscovered the hard way. One line each where possible.

## Tooling

- **Screenshot and browser scripts use `waitUntil: 'domcontentloaded'`, never `networkidle`**, because the console's `/api/v1/agents` request proxies to TrueForge and hangs forever when TrueForge is down — `networkidle` then never fires and every script times out at 45s looking like a console bug.
