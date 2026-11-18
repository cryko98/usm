# $UTP — Up Too Much

Landing page for **$UTP** on Solana. FOMO was the fear. COPE was the aftermath. UTP is what you say when it actually happens.

Static site (plain HTML/CSS/JS), no build step. Drop it on Vercel, Netlify or GitHub Pages as-is.

## Going live

Open `main.js` and fill in the config at the top:

```js
const UTP = {
  X_URL: "https://x.com/...", // X / Twitter link
  CA: "..."                    // Solana contract address
};
```

Until they are set, the X buttons and the CA fields show a "coming soon" toast.

## Files

- `index.html` — page structure and copy
- `styles.css` — design
- `main.js` — altimeter, parallax, split-flap board, "say it" button, config
- `assets/cat.png` — cat cut out from the logo
- `assets/sky.jpg` — logo background with the cat removed
- `logo.jpg` — original logo (favicon / share image)
