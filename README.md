# Recruiting 8 Ball

A real-time 3D Magic 8 Ball for recruiting fortunes: glossy black shell, recessed window, glowing blue die, spring shake physics, and a camera push-in reveal.

Tap, drag, or shake your phone. Tap again to reset.

**Live:** [https://levonl22.github.io/recruiting-8ball/](https://levonl22.github.io/recruiting-8ball/)

## Run it locally

No build step. Serve the folder:

```bash
cd recruiting-8ball
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080) on your laptop, or `http://YOUR_LAN_IP:8080` on your phone (same Wi‑Fi).

Opening `index.html` with `file://` will not work — ES modules need HTTP.

Note: Chrome/Brave often block phone-shake sensors on plain `http://` LAN URLs. Firefox is usually fine. Tap always works. After GitHub Pages (HTTPS), shake works more broadly.

## How it is put together

| File | Role |
| --- | --- |
| `src/main.js` | Renderer, camera, lights, bloom, state machine, input |
| `src/eightBall.js` | Shell, bezel, chrome ring, glass cap, die meshes |
| `src/environment.js` | Emissive studio baked into an environment map |
| `src/textures.js` | Canvas-drawn triangle, `?` mark, fortune text, glow sprite |
| `src/physics.js` | Damped spring used for shake, wobble, and die tumble |
| `vendor/three/` | Vendored three.js build plus the bloom passes |

Notes on a few choices:

- The shell is a `LatheGeometry` profile, not a sphere, so the window is an actual recess in the geometry with a bezel wall and a cavity floor.
- Fortune text is baked into a canvas texture, wrapped line by line against the triangle's taper, so long fortunes never cross the edges.
- three.js is vendored under `vendor/` instead of loaded from a CDN, so the deploy is self-contained. `node_modules` is only there to refresh those vendored files.

## Edit fortunes

Change the `FORTUNES` array at the top of `src/main.js`.

## Accessibility and fallbacks

- Tap, click, drag, `Enter`, `Space`, or a physical phone shake all trigger a fortune.
- `prefers-reduced-motion` skips the shake and reveals with a quick fade.
- If WebGL is unavailable, a plain text version takes over so the link still works.

## Refresh the vendored three.js

```bash
npm install three@latest
cp node_modules/three/build/three.module.js node_modules/three/build/three.core.js vendor/three/build/
cp node_modules/three/examples/jsm/postprocessing/{EffectComposer,MaskPass,OutputPass,Pass,RenderPass,ShaderPass,UnrealBloomPass}.js vendor/three/addons/postprocessing/
cp node_modules/three/examples/jsm/shaders/{CopyShader,LuminosityHighPassShader,OutputShader}.js vendor/three/addons/shaders/
```

## Deploy to GitHub Pages

1. Push this folder to a repo (do not commit `node_modules`).
2. Settings → Pages → Deploy from a branch → `main`, folder `/ (root)`.
3. Share `https://<your-username>.github.io/<repo>/`.
