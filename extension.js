import St from 'gi://St';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const SEPARATOR_REGEX = /[;+]/;

class MultiLaunchProvider {
    constructor(extension) {
        this.extension = extension;
        this.id = 'multi-launch-provider';
        this.appSystem = Shell.AppSystem.get_default();
        this._pendingApps = []; 
    }

    getInitialResultSet(terms) {
        this._pendingApps = [];
        const query = terms.join(' ');

        if (!SEPARATOR_REGEX.test(query)) {
            return Promise.resolve([]);
        }

        const appNames = query.split(SEPARATOR_REGEX)
                              .map(s => s.trim())
                              .filter(s => s.length > 0);

        if (appNames.length < 2) {
            return Promise.resolve([]);
        }

        const foundApps = [];
        const installedApps = this.appSystem.get_installed(); 

        for (const name of appNames) {
            const lowerQuery = name.toLowerCase();
            
            // LÓGICA DE AUTOCOMPLETE INTELIGENTE
            // Filtramos todos os possíveis candidatos
            const candidates = installedApps.filter(app => {
                const id = app.get_id().toLowerCase();
                const displayName = app.get_name().toLowerCase();
                return id.includes(lowerQuery) || displayName.includes(lowerQuery);
            });

            // Ordenamos para encontrar o melhor candidato
            candidates.sort((a, b) => {
                const nameA = a.get_name().toLowerCase();
                const nameB = b.get_name().toLowerCase();
                
                // 1. Prioridade máxima: Começa exatamente com o termo digitado
                const startA = nameA.startsWith(lowerQuery);
                const startB = nameB.startsWith(lowerQuery);

                if (startA && !startB) return -1;
                if (!startA && startB) return 1;

                // 2. Critério de desempate: Menor nome (se digito 'term', prefiro 'Terminal' a 'Terminal Emulator Viewer')
                return nameA.length - nameB.length;
            });

            // Pegamos o vencedor (o primeiro da lista ordenada)
            if (candidates.length > 0) {
                foundApps.push(candidates[0]);
            }
        }

        this._pendingApps = foundApps;

        if (this._pendingApps.length > 0) {
            return Promise.resolve(['multi-launch-result']);
        }

        return Promise.resolve([]);
    }

    getSubsearchResultSet(previousResults, terms) {
        return this.getInitialResultSet(terms);
    }

    getResultMetas(resultIds) {
        const metas = resultIds.map(id => {
            // Mostra visualmente quais apps foram escolhidos
            const appNames = this._pendingApps.map(app => app.get_name()).join(' + ');
            
            return {
                id: id,
                name: 'Multi Launch',
                // A descrição agora serve como confirmação visual do "Autocomplete"
                description: `Open: ${appNames}`,
                createIcon: (size) => {
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
        this._provider = new MultiLaunchProvider(this);
        if (Main.overview.searchController) {
             Main.overview.searchController.addProvider(this._provider);
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
