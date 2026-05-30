# Split It

**Split It** is a productive (and beautifully chaotic) VS Code extension that automatically splits your editor screen vertically the exact moment your cursor touches the bottom visible line of your viewport. 

No more manually reaching for screen-split shortcuts when your files get long—just keep typing, and let the editor dynamically adapt to your workflow.

---

## Features

* **Intelligent Bottom Detection:** Monitors your active viewport and fires a screen split the exact millisecond your cursor hits the final visible line.
* **Built-in Chaos Cooldown:** Implements a strict 1-second system cooldown immediately after a split to prevent unintended, infinite layout explosions.
* **Smart Tab Overload Management:** (Optional) Systematically counts active tab panes and gracefully closes the oldest workspaces if your layout crosses your threshold.

---

## Extension Settings

You can customize **Split It** directly from your standard VS Code Settings (`Ctrl+,` or `Cmd+,`):

* `split-at-reaching-bottom.enableAutoDelete`: Toggle `true/false` to enable or disable the automatic closing of old workspace panes. *(Default: `false`)*
* `split-at-reaching-bottom.maxTabsAllowed`: Set the maximum number of split columns allowed on your screen before the cleanup utility starts managing your layout. *(Default: `4`)*

---

## Installation & Local Usage

### The Standard Search Method (Recommended)
1. Open Visual Studio Code.
2. Click on the **Extensions** icon on the Activity Bar on the left side of the window (or press `Ctrl+Shift+X` / `Cmd+Shift+X`).
3. In the search box, type exactly: **`split-at-reaching-bottom`**
4. Click the blue **Install** button on the extension card.

### Manual Installation
1. Compile the extension package using `npx @vscode/vsce package`.
2. Open VS Code, navigate to the Extensions tab (`Ctrl+Shift+X`), click the `...` menu in the top right, and choose **Install from VSIX...**.
3. Select the compiled `.vsix` file.

### For Developers
1. Clone this repository.
2. Run `npm install` inside the directory.
3. Press `F5` to open the **Extension Development Host** window to debug and test updates live.

---

**Developed by Anks**