# Multi Launch Search Provider
![Multi Launch Logo](logo.png)

A GNOME Shell extension that allows launching multiple applications simultaneously from the Overview search, either manually or via custom groups.

**Author:** Sobeitnow

## ✨ Features

- **🚀 Custom App Groups (New!):** Create shortcuts (e.g., type `work`) to launch a preset list of apps (e.g., Brave + Terminal + Slack).
- **⚙️ Graphical Settings (New!):** Easy-to-use preferences window to manage your groups. No JSON editing required!
- **⌨️ Smart Search:** Automatically detects installed apps even if you use abbreviations or don't know the full Flatpak ID.
- **⚡ Manual Batch Launching:** Type app names separated by `;` or `+` (e.g., `firefox + calc`).

## 🚀 Usage

### Method 1: Groups (Recommended)
1. Open the extension settings (via Extensions app).
2. Create a new group (e.g., Keyword: `1`, Apps: `brave, terminal`).
3. Press **Super**, type `1`, and hit **Enter**.
   * *Result:* All apps in the group launch instantly.

### Method 2: Manual Mode
1. Press **Super**.
2. Type app names separated by `+`.
   * *Example:* `firefox + spotify`
3. Hit **Enter**.

## 📦 Installation

1. Clone this repository or download the source code.
2. Copy the folder to your local extensions directory:
   ```bash
   # Make sure the folder name matches the UUID exactly
   cp -r . ~/.local/share/gnome-shell/extensions/multilaunch@sobeitnow0
