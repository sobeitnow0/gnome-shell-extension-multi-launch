import St from 'gi://St';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const SEPARATOR_REGEX = /[;+]/;

// BACKUP: Caso o arquivo de configuração falhe
const FALLBACK_GROUPS = {
    "1": ["firefox", "org.gnome.Terminal"],
    "work": ["writer", "calc"]
};

class MultiLaunchProvider {
    constructor(extension) {
        this.extension = extension;
        this.id = 'multi-launch-provider';
        this.appSystem = Shell.AppSystem.get_default();
        this._pendingApps = [];
        this._appGroups = {};

        // Inicializa configurações
        this._initSettings();
    }

    _initSettings() {
        try {
            this._settings = this.extension.getSettings('org.gnome.shell.extensions.multilaunch');
            this._loadGroups();
            this._settings.connect('changed::config-json', () => this._loadGroups());
        } catch (e) {
            console.error('[MultiLaunch] Erro no Schema. Usando backup.', e);
            this._appGroups = FALLBACK_GROUPS;
        }
    }

    _loadGroups() {
        try {
            const jsonString = this._settings.get_string('config-json');
            this._appGroups = JSON.parse(jsonString);
        } catch (e) {
            console.error('[MultiLaunch] Erro ao ler JSON.', e);
            this._appGroups = FALLBACK_GROUPS;
        }
    }

    getInitialResultSet(terms) {
        this._pendingApps = [];
        // Junta os termos preservando espaços para identificar a frase completa
        const query = terms.join(' ').trim();

        if (!query) return Promise.resolve([]);

        let targetAppNames = [];
        let isGroupMatch = false;

        // --- LÓGICA DE DECISÃO ---

        // 1. Verifica se é um GRUPO exato (ex: "1", "trampo")
        if (this._appGroups && this._appGroups.hasOwnProperty(query)) {
            targetAppNames = this._appGroups[query];
            isGroupMatch = true;
        }
        // 2. Se não for grupo, verifica se tem SEPARADORES (+ ou ;)
        else if (SEPARATOR_REGEX.test(query)) {
            targetAppNames = query.split(SEPARATOR_REGEX)
                .map(s => s.trim())
                .filter(s => s.length > 0);
        }
        // 3. Se não for nada disso, sai.
        else {
            return Promise.resolve([]);
        }

        if (targetAppNames.length < 1) {
            return Promise.resolve([]);
        }

        // --- BUSCA DOS APPS (Smart Matching) ---
        const foundApps = [];
        const installedApps = this.appSystem.get_installed();

        for (const name of targetAppNames) {
            const lowerQuery = name.toLowerCase();

            // Filtra candidatos (busca no ID e no Nome)
            const candidates = installedApps.filter(app => {
                const id = app.get_id().toLowerCase();
                const displayName = app.get_name().toLowerCase();
                return id.includes(lowerQuery) || displayName.includes(lowerQuery);
            });

            // Ordena (Começa com > Tamanho menor)
            candidates.sort((a, b) => {
                const nameA = a.get_name().toLowerCase();
                const nameB = b.get_name().toLowerCase();

                const startA = nameA.startsWith(lowerQuery);
                const startB = nameB.startsWith(lowerQuery);

                if (startA && !startB) return -1;
                if (!startA && startB) return 1;

                return nameA.length - nameB.length;
            });

            if (candidates.length > 0) {
                foundApps.push(candidates[0]);
            }
        }

        this._pendingApps = foundApps;

        // --- REGRA DE EXIBIÇÃO ---
        if (this._pendingApps.length > 0) {
            // Se for GRUPO: Mostra sempre (mesmo se for 1 app)
            if (isGroupMatch) {
                return Promise.resolve(['multi-launch-result']);
            }
            // Se for MANUAL: Só mostra se tiver 2 ou mais apps
            // (Isso evita duplicar o resultado da pesquisa padrão do GNOME)
            else if (this._pendingApps.length > 1) {
                return Promise.resolve(['multi-launch-result']);
            }
        }

        return Promise.resolve([]);
    }

    getSubsearchResultSet(previousResults, terms) {
        return this.getInitialResultSet(terms);
    }

    getResultMetas(resultIds) {
        const metas = resultIds.map(id => {
            const appNames = this._pendingApps.map(app => app.get_name()).join(' + ');

            return {
                id: id,
                name: 'Multi Launch',
                description: `Run: ${appNames}`, // Texto descritivo
                createIcon: (size) => {
                    return new St.Icon({
                        // ALTERAÇÃO: Ícone de engrenagem/executar
                        icon_name: 'system-run-symbolic',
                        width: size,
                        height: size
                    });
                }
            };
        });
        return Promise.resolve(metas);
    }

    filterResults(results, maxNumber) {
        return results.slice(0, maxNumber);
    }

    activateResult(resultId, terms) {
        this._pendingApps.forEach(app => {
            app.launch([], null);
        });
    }
}

export default class MultiLaunchExtension extends Extension {
    enable() {
        try {
            this._provider = new MultiLaunchProvider(this);
            if (Main.overview.searchController) {
                Main.overview.searchController.addProvider(this._provider);
            }
        } catch (e) {
            console.error('[MultiLaunch] Erro fatal:', e);
        }
    }

    disable() {
        if (this._provider) {
            if (Main.overview.searchController) {
                Main.overview.searchController.removeProvider(this._provider);
            }
            this._provider = null;
        }
    }
}
