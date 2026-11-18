# FaceitLens browser extension (Chrome / Edge / Brave, Manifest V3)

- On a FACEIT match room: a "Scout lobby on FaceitLens" button opens the match room analyser.
- On a FACEIT player page: "Open stats on FaceitLens".
- On a Steam profile: a "FACEIT stats & trust score" button under the profile header.
- Toolbar popup: type a nickname, room link or SteamID.

It reads only the page URL (and the SteamID already in the Steam page). It does not call FACEIT,
does not read cookies, does not automate anything on faceit.com and needs no permissions.

## Load it locally
chrome://extensions → Developer mode → Load unpacked → select this folder.

## Publish
Zip the folder contents and upload to the Chrome Web Store developer dashboard (one-time $5 fee).
Before publishing, email FACEIT developer relations to describe it, since it adds a button on faceit.com.
