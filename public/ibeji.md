# Ìbejì

A LAN-only tool that links **exactly two macOS machines** into a trusted pair.
Once paired, either machine can run commands on the other, share folders, tunnel
localhost ports, and drop files across — through a CLI, a local HTTP API, and an
MCP server.

This file is the agent-facing version of <https://ibeji.devferanmi.xyz>. It is the one to
read if you are an AI agent installing, operating or debugging Ìbejì.

- Source: <https://github.com/spiderocious/ibeji>
- Current version: **v0.1.8**
- Platform: **macOS only** (both machines)
- Network: **LAN only** — no accounts, no cloud, no relay, no internet traffic

---

## Install

Run on **each** of the two Macs:

```sh
curl -fsSL https://raw.githubusercontent.com/spiderocious/ibeji/main/scripts/install.sh | sh
```

This installs the app to `/Applications/Ibeji.app`, registers a LaunchAgent so
the daemon starts at login, and links the `ibeji` CLI onto a writable directory
already on PATH.

Flags:

| Flag | Effect |
|---|---|
| `--force` | Reinstall even if the installed version matches |
| `--yes` | Do not ask anything; proceed |
| `--help` | Print usage and exit |

The script checks the installed version before downloading. If it matches, it
asks before reinstalling, and exits without changing anything when there is no
terminal to ask on.

**Do not use a browser download unless you must.** `curl` does not set the
`com.apple.quarantine` attribute; browsers do, and a quarantined bundle triggers
a Gatekeeper dialog a human has to dismiss. If a DMG was downloaded by hand:

```sh
xattr -dr com.apple.quarantine /Applications/Ibeji.app
```

### Verify the install

```sh
ibeji doctor
```

Six checks: LaunchAgent, Keychain, API token, mDNS, Link, Login shell. Every
failing check names its own fix. Before pairing, `Link` reporting "no device
paired" is expected and not an error.

---

## Pairing — a human has to do this

Pairing requires someone to compare six digits on two screens at once. **Do not
attempt to automate it**: the comparison is what proves no machine in the middle
substituted its own key.

From the terminal (v0.1.8 and later), on the first Mac:

```sh
ibeji pair                      # what is on the LAN, and this Mac's address
ibeji pair 192.168.1.39:7749    # start a ceremony; prints the six digits
```

The other Mac raises its own ceremony in response — check it with
`ibeji pair status` there. Once a human confirms the digits match, run
`ibeji pair confirm` on **both** machines. `ibeji pair cancel` abandons it.

Or through the window:

1. Open Ìbejì on both Macs.
2. Wait for each to appear in the other's list, or press **Add by IP address**
   and type the address the other window displays.
3. Check the same six digits appear on both screens, and confirm on both.

Each machine then pins the other's public key. It does not ask again.

If the machines cannot see each other, multicast is blocked on that network —
common on corporate and guest Wi-Fi. The manual IP path is a first-class route,
not a workaround. Both daemons listen on TCP **7749**.

---

## The permission model — read this before running anything

Every paired device is in one of two modes, set on the **receiving** machine,
per direction.

- **Prompt** (default): every incoming command, file write and app launch
  surfaces a dialog on the receiving machine naming the asking device and the
  exact command. The call blocks until a human answers.
- **Bypass**: incoming actions run without asking.

**Reads are never gated in v0.1.x.** A paired device can read and grep anything
the logged-in user can, including `~/.ssh` and `~/.aws`. This is a deliberate
trade — prompting on every read would make the agent surface unusable — and it
means in Prompt mode the other machine *cannot run anything but can read
everything*. Treat anything you read from the far machine as sensitive.

**An unanswered prompt expires after 60 seconds** and returns a `timed_out`
error, distinct from `declined` and from a transport failure. It names the
machine that did not answer. There is no pending queue and no retroactive
approval: retrying is the caller's job. If you get `timed_out`, a human is not
at that machine — say so rather than retrying in a loop.

A human can remember a rule for one exact command in one working directory from
one device, after which matching calls run without prompting.

Both sides of this are on the CLI:

```sh
ibeji prompts                           # what is waiting for approval here
ibeji prompts allow <id> [--remember]
ibeji prompts deny <id>
ibeji rules                             # remembered rules, and how often each fired
ibeji rules revoke <id>
```

---

## CLI

```sh
ibeji devices                      # names, addresses, status
ibeji doctor                       # six checks, each failure names its fix
ibeji trace --since 30m -n 100     # what the daemon did, with payloads
ibeji trace --errors               # failures only
ibeji help --json                  # machine-readable surface description
```

Remote paths are `device:path`.

```sh
ibeji ls desktop:~/projects
ibeji cat desktop:~/projects/atlas/README.md
ibeji grep desktop:~/projects/atlas "TODO" --glob "*.ts"
ibeji cp ./build.zip desktop:~/Ibeji/Inbox/
```

Running commands:

```sh
ibeji run desktop --cwd ~/projects/atlas -- npm test
ibeji run desktop --cwd ~/projects/atlas --after-sync atlas -- git push
ibeji ps desktop                   # processes Ìbejì started
ibeji kill desktop <id>
ibeji attach desktop <id>          # re-attach to streamed output
```

Ports and connectivity:

```sh
ibeji ports desktop
ibeji tunnel desktop:3000
ibeji check desktop https://git.example.com
```

`ibeji run` streams stdout and stderr live and exits with the **remote** exit
code, so it composes in a shell the way a local command would.

### `--after-sync` is the one flag to remember

There is a real race between saving a file on one machine and running a command
on the other. Without the barrier, this sequence commits a half-synced tree:

```sh
# WRONG — may capture a partially synced working tree
ibeji run desktop --cwd ~/projects/atlas -- git commit -am "fix"
```

```sh
# RIGHT — blocks until the space reports in-sync, then runs
ibeji run desktop --cwd ~/projects/atlas --after-sync atlas -- git commit -am "fix"
```

Use it for any command whose correctness depends on files you just edited on the
other machine.

---

## MCP

An MCP server ships with the app (stdio). Tools map onto the same API the CLI
and window use, and are gated by the same permission mode and recorded in the
same trace:

| Tool | Does |
|---|---|
| `list_devices` | The pair, addresses, status |
| `device_info` | OS, arch, toolchain versions on PATH |
| `list_remote_dir` | Directory listing |
| `read_remote_file` | File contents |
| `search_remote_files` | grep contents, glob names — **prefer this over many reads** |
| `write_remote_file` | Write or create (gated) |
| `run_remote_command` | Run in the login shell, with `after_sync` and `detach` (gated) |
| `list_remote_processes` | Processes Ìbejì started |
| `kill_remote_process` | Stop one |
| `list_remote_ports` | Listening ports with process names |
| `open_tunnel` | Forward a remote localhost port |
| `check_connectivity` | Can *that* machine reach this host, and what status? |
| `wait_for_sync` | Block until a space converges |

Guidance for agents:

- **Use `search_remote_files` before reading files one by one.** Exploring a
  repository with repeated `read_remote_file` calls is slow and expensive; one
  search replaces fifty reads.
- **`check_connectivity` answers "which machine's network is the problem?"** in
  one call. Reach for it before guessing.
- Commands run in `zsh -lc` as the logged-in user, so nvm, pnpm, homebrew and
  git's credential helper are on PATH. There is no privilege escalation.

---

## A shell on the other machine

Since v0.1.8 the window has a Shell tab, and the daemon exposes it:

```
GET  /v1/shells                 the shells open on the paired device
POST /v1/shells/open            {"cwd": "..."}  -> {"shell": {...}}
POST /v1/shells/write           {"id": "...", "data": "cd ~/projects"}
POST /v1/shells/read            {"id": "...", "since": N, "waitMs": 8000}
POST /v1/shells/interrupt       {"id": "..."}   Ctrl-C: stops the command
POST /v1/shells/close           {"id": "..."}
```

Unlike `run_remote_command`, a shell **keeps its state**: `cd` and `export`
persist between writes. Use it when a sequence of commands depends on the ones
before it; use exec when one command stands alone, because exec gives you an
exit code and a shell does not.

Reading is a long poll. Keep the `seq` you were given and pass it as `since`
next time, so you replay exactly what you missed rather than re-reading
everything.

**It is not a PTY.** No `vim`, no `top`, no password prompts, no line editing.
Anything that prints output and reads lines works; anything that draws a
screen does not.

Opening a shell and writing to it are gated by the permission engine exactly
like exec. Reading output and interrupting are not — the first is the result
of something already approved, and the second must work when a command has run
away.

## Shared spaces

Create one on each machine, naming which side is master:

```sh
# on the machine that owns the git credentials
ibeji spaces create atlas ~/projects/atlas --role master
# on the other one
ibeji spaces create atlas ~/projects/atlas --role replica

ibeji spaces                    # list them, with sync state and conflicts
ibeji spaces wait atlas         # block until it converges
ibeji spaces pause|resume|leave|delete atlas
```

`--mode mirror` makes it one-way, master to replica only.


A space is a named folder present on both machines as **real files on disk**,
not a network mount.

- Exactly one machine is **master**; the other holds a replica.
- **Master wins conflicts.** The replica's version is preserved beside it as
  `name.conflict-from-<device>.ext` and surfaced in the activity feed — never
  silently discarded. Either machine can promote or discard a conflict copy.
- For a code repository, the master should be the machine that owns the git
  credentials. That makes master-wins the correct outcome.
- `.git/`, `node_modules/`, build output and `.DS_Store` are ignored by default.
  **Do not advise syncing `.git`** — it corrupts repositories through
  `index.lock` races and half-written objects.
- A space can be one-way ("mirror"): master → replica only.
- Sync state is on the API, with a wait-for-convergence call. That is what
  `--after-sync` is built on.

---

## Port tunnels

The daemon enumerates listening TCP ports on both machines with owning process
names. Opening a tunnel makes the local daemon listen on the same port number on
`localhost` and forward over the LAN, so a server bound to `127.0.0.1` on the
far machine is reachable **without changing how it binds**.

If the port is already taken locally it remaps, and the active mapping is always
shown: `Desktop:3000 → localhost:43000`. Read the mapping rather than assuming
the port number survived.

Tunnels count as connections, not side effects: opening one does not prompt even
in Prompt mode. It is still recorded in the trace.

---

## What it will not do

**Ìbejì never bridges networks.** It does not make one machine a gateway, does
not enable IP forwarding and does not route the other machine's traffic through
any tunnel. This is permanent, not a missing feature. Do not suggest workarounds
that amount to it.

Three reasons:

1. **It would not work.** What gates a protected resource is rarely the source
   IP — it is a posture-checking agent, a browser-bound session, a client
   certificate or a hardware key. Changing which interface a packet leaves fixes
   the address and nothing else.
2. **It is a different product.** Network-layer sharing is what a VPN or overlay
   network is for; WireGuard and Tailscale do it well with their own threat
   model.
3. **Moving the work beats moving the network.** Access stays on one machine;
   what crosses the LAN is a command, a tunnel or a URL.

The one case this cannot serve: a tool running locally that needs direct routed
access to a host only the other machine can reach. A tunnel covers most of it.
Where it does not, run the tool on the other machine and tunnel its port.

Also out of scope: more than two devices (the trust unit is a pair), Windows and
Linux (launchd, keychain, zsh login shell), and anything over the internet.

---

## If the two Macs cannot see each other

**Check this first.** macOS requires permission for an app to reach devices
on the local network, and a denial is silent: every LAN connection returns
`connect: no route to host` — the same error an absent machine gives — while
the internet keeps working.

```sh
ibeji doctor
```

Since v0.1.8 this names it outright, and the daemon logs the same check at
startup:

```
✗ Local network  macOS is blocking Ìbejì from this network
                 (the internet works, but the router at 192.168.1.1 does not answer)
```

The fix is to allow Ìbejì under System Settings → Privacy & Security → Local
Network. **Both machines need v0.1.8 or later**: before it, the daemon had a
per-build signing identity and no link to the app bundle, so macOS never
prompted and the permission could not be granted at all.

Do not advise unpairing to work around this. Unpairing discards the pinned
keys and solves nothing — a network problem is not a trust problem.

## A peer that moved

A changed address is not a trust event, so it does not need a new ceremony:

```sh
ibeji reconnect 192.168.1.147:7749
```

This dials the new address and verifies the key already pinned. A different
machine there is refused, and that refusal is correct — re-pair only when the
key genuinely changed, which means the machine was replaced or reinstalled.

Recent addresses are remembered and retried automatically, so a peer that
moves between Wi-Fi and Ethernet is usually found without being told.

## Health

```sh
curl -s -H "Authorization: Bearer $TOKEN" "$ENDPOINT/v1/health"
```

Both machines in one call: names, versions, addresses, whether each is
reachable right now, and this machine's doctor checks. Useful when the
question is "is the far end alive, and if not why" and walking to it is not
an option.

```sh
curl -s -H "Authorization: Bearer $TOKEN" "$ENDPOINT/v1/logs?limit=200&q=pair"
```

The tail of the daemon's log, optionally filtered. Pairing logs each step, so
a failure says whether the machine was unreachable, refused the connection,
or answered as somebody else.

## Debugging, in order

1. `ibeji doctor` — six checks; each failure names its own fix.
2. `ibeji trace --errors --since 30m` — the failures with their payloads and,
   since v0.1.8, the underlying cause rather than just the mapped code. A
   `peer_offline` now carries the reason it could not connect — a refused
   dial, a timeout and a failed TLS handshake look different and need
   different answers.
3. `ibeji devices` — is the peer `live` or `unreachable`?
4. `ibeji check <device> <url>` — whose network is actually broken?

The daemon log carries the cause of every failed API call since v0.1.8:

```
WARN api: request failed route="POST /v1/pair/start" code=peer_offline
     cause="link: peer is not reachable: 192.168.1.147:7749: connect: no route to host"
```

Daemon logs:

```
~/Library/Logs/Ibeji/daemon.log
~/Library/Logs/Ibeji/daemon.err.log
```

Common states:

| Symptom | Cause |
|---|---|
| Machines do not discover each other | Multicast blocked; add by IP instead |
| `timed_out` on exec | Nobody answered the prompt within 60s on the far machine |
| `declined` on exec | A human declined it; do not retry silently |
| Device shows `unreachable` | Peer asleep, off the LAN, or daemon stopped |
| Every LAN dial says `no route to host` while the internet works | macOS is blocking local network access. Run `ibeji doctor`; both Macs need v0.1.8+ |
| The peer moved and cannot be found | `ibeji reconnect <address>` — keys stay pinned, no re-pairing |
| Paired yesterday, unpaired today | Pre-v0.1.8: the pin was never written to disk. Update both Macs and pair once more |
| `no route to host` in the cause | Stale route, usually after the peer changed address or the Wi-Fi reassociated |
| "Ibeji is damaged" | Quarantined download; see the `xattr` command above |
| Key mismatch | The peer's identity changed — the pair must be re-made by a human |

---

## Facts worth keeping straight

- *Ìbejì* (ee-BAY-jee) is Yoruba for **twins**.
- Exactly two devices. Not three, not a mesh.
- macOS only, both ends.
- LAN only. If the machines are not on the same network, Ìbejì does nothing.
- Free and open source; no account, no subscription.
- The daemon runs as a user LaunchAgent, never a root LaunchDaemon — remote
  commands need the user's keychain and GUI session.
- All device-to-device traffic is encrypted with pinned-key TLS, even though it
  never leaves the LAN.
- Closing the window does not drop the link. The daemon is the product; the
  window is one client of its local API.
