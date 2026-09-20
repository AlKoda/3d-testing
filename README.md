# Blobbyte

A touch-first pixel-art arena game: collect glowing orbs, grow your blob, eat
smaller enemies, and escape anything larger than you.

## Play on GitHub Pages

This repository includes a GitHub Pages deployment workflow. After the changes
reach the repository's default branch:

1. Open the repository on GitHub.
2. Select **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Select the **Actions** tab and wait for **Deploy Blobbyte to GitHub Pages**
   to finish. You can also open that workflow and select **Run workflow**.
5. Open the URL shown by the deployment. It normally has this format:
   `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.
6. Press **TAP TO PLAY** on the title screen.

> If GitHub Pages is already configured to use GitHub Actions, simply merge or
> push to the default branch and open the deployment URL from the workflow run.

## Controls

- **Phone or tablet:** press **TAP TO PLAY**, then drag anywhere on the game to
  move. The lower-left joystick shows your direction.
- **Desktop:** press **TAP TO PLAY**, then use **WASD**, the **arrow keys**, or
  click and drag.
- Collect the small glowing squares to gain mass.
- You can absorb enemy blobs that are smaller than you. Larger blobs can absorb
  you, so move away when **DANGER NEARBY** appears.
- If you are eaten, select **SWIM AGAIN** to restart.

## Run locally

The game has no build step or package installation. From the repository folder,
run:

```bash
python3 -m http.server 4173
```

Then visit [http://localhost:4173](http://localhost:4173) and press
**TAP TO PLAY**.

