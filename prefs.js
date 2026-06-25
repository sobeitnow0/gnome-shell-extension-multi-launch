import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class MultiLaunchPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this.settings = this.getSettings('org.gnome.shell.extensions.multilaunch');

        const page = new Adw.PreferencesPage();
        
        // 1. General Settings
        const settingsGroup = new Adw.PreferencesGroup({
            title: _('General Settings'),
        });
        
        const delayRow = new Adw.SpinRow({
            title: _('Launch Delay (ms)'),
            subtitle: _('Delay between launching multiple applications'),
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 5000,
                step_increment: 50,
                page_increment: 500,
            }),
        });
        
        this.settings.bind('launch-delay', delayRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        
        settingsGroup.add(delayRow);
        page.add(settingsGroup);

        // 2. Groups Manager
        const group = new Adw.PreferencesGroup({
            title: _('Groups Manager'),
            description: _('Define the keyword and app list (comma separated).')
        });

        page.add(group);
        window.add(page);

        this._groupContainer = group;
        this._widgetRows = [];

        // Load existing
        this._loadFromSettings();

        // Add Button
        this._addButtonRow = new Adw.ActionRow({
            title: _('Create new group'),
            subtitle: _('Click to add a new row'),
            activatable: true
        });
        const addIcon = new Gtk.Image({ icon_name: 'list-add-symbolic' });
        this._addButtonRow.add_suffix(addIcon);

        this._addButtonRow.connect('activated', () => {
            this._groupContainer.remove(this._addButtonRow);
            this._createRow('', '');
            this._groupContainer.add(this._addButtonRow);
            this._saveSettings();
        });

        this._groupContainer.add(this._addButtonRow);

        window.connect('close-request', () => {
            this.settings = null;
            this._groupContainer = null;
            this._widgetRows = null;
            this._addButtonRow = null;
        });
    }

    _loadFromSettings() {
        let jsonGroups = {};
        try {
            jsonGroups = JSON.parse(this.settings.get_string('config-json'));
        } catch (e) {
            console.error('Erro JSON:', e);
        }

        for (const [key, apps] of Object.entries(jsonGroups)) {
            const appsStr = Array.isArray(apps) ? apps.join(', ') : apps.toString();
            this._createRow(key, appsStr);
        }
    }

    _createRow(initialKey, initialApps) {
        const expander = new Adw.ExpanderRow({
            title: initialKey || _('New Group'),
            subtitle: initialApps || '...',
            show_enable_switch: false
        });

        const keyEntry = new Adw.EntryRow({
            title: _('Keyword'),
            text: initialKey
        });

        const appsEntry = new Adw.EntryRow({
            title: _('Applications'),
            text: initialApps
        });
        appsEntry.add_suffix(new Gtk.Label({ label: _('(ex: firefox, calc)'), css_classes: ['dim-label'] }));

        const removeRow = new Adw.ActionRow();
        const removeBtn = new Gtk.Button({
            label: _('Remove'),
            css_classes: ['destructive-action']
        });
        removeBtn.set_valign(Gtk.Align.CENTER);

        removeRow.add_suffix(removeBtn);
        expander.add_row(keyEntry);
        expander.add_row(appsEntry);
        expander.add_row(removeRow);

        this._groupContainer.add(expander);

        const rowController = {
            expander: expander,
            getKey: () => keyEntry.get_text(),
            getApps: () => appsEntry.get_text()
        };

        this._widgetRows.push(rowController);

        const updateAndSave = () => {
            expander.set_title(keyEntry.get_text() || _('No name'));
            expander.set_subtitle(appsEntry.get_text() || '...');
            this._saveSettings();
        };

        keyEntry.connect('changed', updateAndSave);
        appsEntry.connect('changed', updateAndSave);

        removeBtn.connect('clicked', () => {
            this._groupContainer.remove(expander);
            const idx = this._widgetRows.indexOf(rowController);
            if (idx > -1) this._widgetRows.splice(idx, 1);
            this._saveSettings();
        });
    }

    _saveSettings() {
        const config = {};

        for (const row of this._widgetRows) {
            const key = row.getKey().trim();
            const appsStr = row.getApps();

            if (key) {
                const appList = appsStr.split(',')
                    .map(s => s.trim())
                    .filter(s => s.length > 0);

                config[key] = appList;
            }
        }

        this.settings.set_string('config-json', JSON.stringify(config));
    }
}