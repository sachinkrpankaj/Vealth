# Vealth branding

`logo.png` is the exact supplied **White Growth Arrow on Blue Gradient** artwork and the single source for the app's branding. The shared `VealthLogo` component uses it on in-app brand surfaces.

Run `npm run brand:sync` after replacing it to export the 1024 px app icon, favicon, splash artwork, adaptive foreground, and all checked-in Android launcher/splash densities. The script uses Expo's image utilities to resize and pad the original artwork without redrawing it.

The adaptive foreground keeps the complete supplied badge in the 66/108 dp safe region; its white background matches the supplied corners. The native splash centers the badge on a light/dark theme background. Expo's splash-screen config plugin provides the same branding for future Android/iOS prebuilds.

Launcher and native splash changes require a new native build; a JavaScript reload cannot update an installed launcher icon.
