import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Search from 'resource:///org/gnome/shell/ui/search.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const SEPARATOR_REGEX = /[;+]/;

export default class MultiLaunchExtension extends Extension {
    enable() {
        try {
            this._provider = new MultiLaunchProvider(this);
            Main.overview.searchController.addProvider(this._provider);
        } catch (err) {
            console.error('[MultiLaunch] Failed to enable search provider:', err);
        }
    }

    disable() {
        if (this._provider) {
            Main.overview.searchController.removeProvider(this._provider);
            this._provider.destroy();
            this._provider = null;
        }
    }
}

class MultiLaunchProvider {
    constructor(extension) {
        this.extension = extension;
        this.id = 'multi-launch-provider';
        this.appSystem = Shell.AppSystem.get_default();
        this._pendingMatches = [];
        this._groupCache = {};
        this._timeoutIds = new Set();
        this._settingsChangedId = null;

        // Provide a valid AppInfo so GNOME Shell's search controller accepts this provider
        this.appInfo = Gio.DesktopAppInfo.new('org.gnome.Extensions.desktop') || Gio.DesktopAppInfo.new('org.gnome.Settings.desktop');

        this._initSettings();
    }

    _initSettings() {
        try {
            this._settings = this.extension.getSettings('org.gnome.shell.extensions.multilaunch');
            this._loadGroupsFromSettings();
            this._settingsChangedId = this._settings.connect('changed::config-json', () => this._loadGroupsFromSettings());
        } catch (e) {
            console.error('[MultiLaunch] Failed to load settings. Proceeding with empty groups.', e);
            this._groupCache = {};
        }
    }

    _loadGroupsFromSettings() {
        try {
            const rawJson = this._settings.get_string('config-json');
            this._groupCache = JSON.parse(rawJson);
        } catch (e) {
            console.error('[MultiLaunch] Invalid JSON in settings:', e);
            this._groupCache = {};
        }
    }

    getInitialResultSet(terms) {
        this._pendingMatches = [];
        const query = terms.join(' ').trim();

        if (!query) return Promise.resolve([]);

        let targets = [];
        let isGroup = false;

        if (this._groupCache && this._groupCache[query]) {
            targets = this._groupCache[query];
            isGroup = true;
        } else if (SEPARATOR_REGEX.test(query)) {
            targets = query.split(SEPARATOR_REGEX)
                .map(s => s.trim())
                .filter(s => s.length > 0);
        } else {
            return Promise.resolve([]);
        }

        if (targets.length < 1) return Promise.resolve([]);

        const results = [];
        const allApps = this.appSystem.get_installed();

        for (const target of targets) {
            const parts = target.split(' ');
            const searchName = parts[0].toLowerCase();
            const launchArgs = parts.slice(1);

            const matches = allApps.filter(app => {
                const appId = app.get_id().toLowerCase();
                const appName = app.get_name().toLowerCase();
                return appId.includes(searchName) || appName.includes(searchName);
            });

            matches.sort((a, b) => {
                const nameA = a.get_name().toLowerCase();
                const nameB = b.get_name().toLowerCase();
                
                if (nameA.startsWith(searchName) && !nameB.startsWith(searchName)) return -1;
                if (!nameA.startsWith(searchName) && nameB.startsWith(searchName)) return 1;
                
                return nameA.length - nameB.length;
            });

            if (matches.length > 0) {
                results.push({ app: matches[0], args: launchArgs, rawInput: target });
            }
        }

        this._pendingMatches = results;

        if (this._pendingMatches.length > 0) {
            if (isGroup || this._pendingMatches.length > 1) {
                return Promise.resolve([this.id]);
            }
        }

        return Promise.resolve([]);
    }

    getSubsearchResultSet(prev, terms) {
        return this.getInitialResultSet(terms);
    }

    getResultMetas(resultIds) {
        const metas = resultIds.map(id => {
            const combinedNames = this._pendingMatches.map(m => m.rawInput).join(' + ');

            return {
                id: id,
                name: 'Multi Launch',
                description: `Launch: ${combinedNames}`,
                createIcon: (size) => {
                    if (this._pendingMatches.length > 0) {
                        return this._pendingMatches[0].app.create_icon_texture(size);
                    }
                    return new St.Icon({
                        icon_name: 'system-run-symbolic',
                        width: size,
                        height: size
                    });
                }
            };
        });
        return Promise.resolve(metas);
    }

    createResultObject(resultMeta) {
        return new Search.ListSearchResult(this, resultMeta);
    }

    filterResults(results, max) {
        return results.slice(0, max);
    }

    activateResult(id, terms) {
        let delayMs = 0;
        if (this._settings) {
            delayMs = this._settings.get_int('launch-delay');
        }

        this._pendingMatches.forEach((match, idx) => {
            const performLaunch = () => {
                if (match.args && match.args.length > 0) {
                    try {
                        const appInfo = match.app.get_app_info();
                        appInfo.launch_uris(match.args, null);
                    } catch (err) {
                        console.error('[MultiLaunch] Warning: failed to pass args, launching normally.', err);
                        match.app.launch([], -1, -1);
                    }
                } else {
                    match.app.launch([], -1, -1);
                }
            };

            if (delayMs > 0 && idx > 0) {
                const timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs * idx, () => {
                    performLaunch();
                    this._timeoutIds.delete(timerId);
                    return GLib.SOURCE_REMOVE;
                });
                this._timeoutIds.add(timerId);
            } else {
                performLaunch();
            }
        });
    }

    destroy() {
        if (this._settings && this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        for (const timerId of this._timeoutIds) {
            GLib.source_remove(timerId);
        }
        this._timeoutIds.clear();

        this._settings = null;
        this._groupCache = null;
        this._pendingMatches = null;
        this.extension = null;
        this.appSystem = null;
    }
}
