# Slash

Slash is a static website published on [GitHub Pages](https://odhasu.github.io/slash/). Updates pushed to `main` deploy through GitHub Actions.

Run the local preview from the repository root.

```sh
uv run --script splashwallet-homepage-capture/serve.py
```

Open [http://localhost:8765/](http://localhost:8765/). To build the GitHub Pages version locally, run the following command from the repository root.

```sh
uv run --script splashwallet-homepage-capture/build_pages.py public
```
