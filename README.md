# GitHub Pages Deployment Package - MIGO Web Controller v8.8.0

This folder contains the **exact files needed to publish the MIGO Web Controller to GitHub Pages** with full **PWA (Progressive Web App)** and **Offline Blockly** support.

---

## 📂 Included Files & Folders

- `index.html` — Main robot controller app.
- `sw.js` — Service Worker for 100% offline access.
- `manifest.json` — Web App Manifest for "Install App" functionality.
- `MIGOMultiCOntrol.html` — Multi-robot control page.
- `migo_competition.html` — Competition mode controller.
- `lib/blockly/` — Offline Google Blockly libraries (`blockly_compressed.js`, `blocks_compressed.js`, `javascript_compressed.js`, `msg/en.js`).

---

## 🚀 How to Deploy to GitHub Pages

1. Create a new repository on **GitHub** (e.g. `migo-controller`).
2. Upload **all files and folders inside this `github_deploy` directory** into your GitHub repository root.
3. On GitHub, go to **Settings** -> **Pages**.
4. Under **Build and deployment** -> **Branch**, select `main` (or `master`) and folder `/ (root)`, then click **Save**.
5. After 1-2 minutes, GitHub will give you your live HTTPS link:
   `https://<your-username>.github.io/<repo-name>/`
6. Open that link on your phone, tablet, or computer. Tap **"Install App"** to install it as an offline desktop/mobile app!
