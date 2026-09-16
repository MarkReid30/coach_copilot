# Coach Copilot

Early mobile-first PWA prototype for coach-led strength programming, workout logging and remote coaching oversight.

## Current status

This is an early prototype, not production software.

Current data storage uses browser `localStorage`, so data:
- does not sync between devices;
- can be lost if browser/site data is cleared;
- is not suitable for sensitive real-client medical information yet.

## Run locally

Open `index.html` in a browser for basic inspection.

For service-worker/PWA behaviour, serve the folder over HTTP, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Publish with GitHub Pages

1. Create a new GitHub repository, e.g. `coach-copilot`.
2. Upload all files in this folder to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Choose branch **main** and folder **/(root)**.
6. Save.
7. GitHub will publish the site at a URL similar to:
   `https://YOUR-USERNAME.github.io/coach-copilot/`

The PWA uses relative paths so it works when published from a GitHub Pages repository subfolder.

## Install on phone

### iPhone
Open the GitHub Pages URL, then use **Share → Add to Home Screen**.

### Android
Open the GitHub Pages URL in Chrome and use **Install app** or **Add to Home screen** when offered.

## Recommended next infrastructure step

Replace localStorage with a real backend before genuine coach/client testing across different devices.

Likely next requirements:
- authentication;
- coach/client roles;
- cloud database;
- synced workout logs;
- access control;
- backups;
- appropriate handling of personal/health-related data.

## Project direction

The product is intended to differentiate on coach oversight rather than simply competing with mature workout loggers. The planned coaching layer is:

client logs training → structured history → coach dashboard → surfaced changes/flags → suggested progression → coach accept/modify/reject.
