import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class MultiLaunchPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this.settings = this.getSettings('org.gnome.shell.extensions.multilaunch');

        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({
            title: 'Gerenciador de Grupos',
            description: 'Defina o atalho e a lista de apps (separados por vírgula).'
        });

        page.add(group);
        window.add(page);

        // Container onde as linhas de grupos vão ficar
        this._groupContainer = group;
        this._widgetRows = []; // Guarda referências para podermos salvar depois

        // 1. Carrega dados existentes
        this._loadFromSettings();

        // 2. Botão "Adicionar Grupo" (Fixo no topo ou fim)
        const addButtonRow = new Adw.ActionRow({
            title: 'Criar novo grupo',
            subtitle: 'Clique para adicionar uma nova linha',
            activatable: true
        });
        const addIcon = new Gtk.Image({ icon_name: 'list-add-symbolic' });
        addButtonRow.add_suffix(addIcon);

        addButtonRow.connect('activated', () => {
            this._createRow('', '');
            this._saveSettings(); // Salva o estado vazio
        });

        group.add(addButtonRow);
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
            title: initialKey || 'Novo Grupo',
            subtitle: initialApps || '...',
            show_enable_switch: false
        });

        // Entrada do Atalho
        const keyEntry = new Adw.EntryRow({
            title: 'Atalho',
            text: initialKey
        });

        // Entrada dos Apps
        const appsEntry = new Adw.EntryRow({
            title: 'Aplicativos',
            text: initialApps
        });
        appsEntry.add_suffix(new Gtk.Label({ label: '(ex: firefox, calc)', css_classes: ['dim-label'] }));

        // Botão de Remover
        const removeRow = new Adw.ActionRow();
        const removeBtn = new Gtk.Button({
            label: 'Remover',
            css_classes: ['destructive-action']
        });
        removeBtn.set_valign(Gtk.Align.CENTER);

        removeRow.add_suffix(removeBtn);
        expander.add_row(keyEntry);
        expander.add_row(appsEntry);
        expander.add_row(removeRow);

        // Adiciona à tela (antes do botão de adicionar se possível, mas aqui vai pro fim da lista)
        // Nota: No AdwPreferencesGroup, a ordem é de inserção. O botão "Adicionar" foi inserido no init.
        // Infelizmente no GTK4 inserir "antes" requer acesso interno. 
        // Para simplificar, novos grupos aparecem no final da lista.
        this._groupContainer.add(expander);

        // Objeto de controle dessa linha
        const rowController = {
            expander: expander,
            getKey: () => keyEntry.get_text(),
            getApps: () => appsEntry.get_text()
        };

        this._widgetRows.push(rowController);

        // Eventos
        const updateAndSave = () => {
            expander.set_title(keyEntry.get_text() || 'Sem nome');
            expander.set_subtitle(appsEntry.get_text() || '...');
            this._saveSettings();
        };

        keyEntry.connect('changed', updateAndSave);
        appsEntry.connect('changed', updateAndSave);

        removeBtn.connect('clicked', () => {
            this._groupContainer.remove(expander);
            // Remove do array de controle
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
                // Converte "firefox, calc" em ["firefox", "calc"]
                const appList = appsStr.split(',')
                    .map(s => s.trim())
                    .filter(s => s.length > 0);

                config[key] = appList;
            }
        }

        // Salva no banco de dados
        this.settings.set_string('config-json', JSON.stringify(config));
    }
}