# Vealth branding

`logo.png` is the exact supplied **White Growth Arrow on Blue Gradient** artwork with transparent outside corners, and the single source for the app's branding. The shared `VealthLogo` component uses it on in-app brand surfaces.

Run `npm run brand:sync` after replacing it to export the 1024 px app icon, favicon, splash artwork, adaptive foreground, and all checked-in Android launcher/splash densities. The script uses Expo's image utilities to resize and pad the artwork with transparency without redrawing it.

The adaptive foreground keeps the complete supplied badge in the 66/108 dp safe region with transparent padding and transparent outside corners. The native splash centers the badge on a light/dark theme background with zero white corner artifacts. Expo's splash-screen config plugin provides the same branding for future Android/iOS prebuilds.

Launcher and native splash changes require a new native build; a JavaScript reload cannot update an installed launcher icon.
