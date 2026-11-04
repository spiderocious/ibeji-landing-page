# ibeji-landing-page

The landing page for [Ìbejì](https://github.com/spiderocious/ibeji) — a LAN-only
tool that links two Macs into one trusted pair.

Three static files and a folder of images. No build step, no dependencies, no
framework: deploy `public/` to anything that serves a directory.

```
public/
  index.html          the page
  site.js             copy buttons, scroll reveals, the demo
  ibeji.md            the same site as Markdown, written for AI agents
  styles/
    _foundation.css   vendored from the app — tokens, type, motion
    _components.css   vendored from the app — components
    site.css          the page's own chrome
  shots/              screenshots of the real app
```

## Running it locally

```sh
cd public && python3 -m http.server 8777
```

Then open <http://127.0.0.1:8777>.

## The design system is vendored, not reimplemented

`styles/_foundation.css` and `styles/_components.css` are copied verbatim from
`app/src/styles/` in the Ìbejì repo. Every colour, typeface, easing and radius
on this page is the product's own token, so the site and the app cannot drift
apart on their own.

`site.css` adds only what a page needs and an app window did not: a wide hero,
a sticky nav, section rhythm, and the demo. **Do not redefine a token in
`site.css`** — if something is missing, it belongs upstream in the design
system.

To refresh after the app's styles change:

```sh
cp ../ibeji/app/src/styles/_foundation.css public/styles/
cp ../ibeji/app/src/styles/_components.css public/styles/
```

### Light mode only

There is deliberately no dark-mode block. Do not add one.

## The screenshots are real

`shots/*.png` are captures of the actual app running against two paired
daemons, taken with `app/test/shots.js` in the Ìbejì repo, then cropped to
their content. They are not mockups, and they should not be replaced with
mockups — if the UI changes, take new ones.

## `/ibeji.md`

`public/ibeji.md` is the agent-facing version of this site: install steps,
every CLI command, the MCP tool list, the permission model and the failure
modes, with none of the pictures. It is linked from the page's `<head>` as an
alternate representation, and the page points agents at it.

Keep it in step with `index.html`. If a fact changes on one, change it on the
other.
