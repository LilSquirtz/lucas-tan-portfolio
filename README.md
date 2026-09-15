# Lucas Tan portfolio

Independent GitHub Pages copy of the published Lucas Tan engineering portfolio.

## Hosting

This website is static HTML, CSS and JavaScript. No build step, backend, server-side rendering, API keys or package installation is required.

In repository Settings → Pages, publish the `main` branch from `/ (root)`. The `.nojekyll` file serves the files directly. All local asset paths are relative, so the site works at a GitHub Pages project URL without rewriting paths.

Navigation and information panels run within the homepage; section links use URL fragments. The supplied GLB, project images, fonts, animation libraries and résumé are hosted locally in `assets`.

## Local preview

Run `python -m http.server 4175` from this directory and open `http://localhost:4175/`. Use an HTTP server rather than opening the HTML file directly so the interactive CAD module can load.

## Source preservation

The portfolio files were copied from the published version without design or content changes. GitHub hosting configuration and this README are separate from the website. The original ChatGPT-hosted site remains independently published and is not connected to this repository's deployments.
