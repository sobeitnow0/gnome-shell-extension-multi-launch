import St from 'gi://St';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

// O caractere separador. Pode mudar para ',' ou '+' se preferir no futuro.
const SEPARATOR = ';';

class MultiLaunchProvider {
    constructor(extension) {
        this.extension = extension;
        this.id = 'multi-launch-provider';
        this.appSystem = Shell.AppSystem.get_default();
        this._pendingApps = []; 
    }

    /**
     * Chamado quando o usuário digita na barra de pesquisa.
     * Converte os termos de volta para string e divide pelo separador.
     */
    getInitialResultSet(terms) {
        this._pendingApps = [];
        const query = terms.join(' ');

        // Só ativamos se o usuário digitar o separador (ex: "firefox ; terminal")
        if (!query.includes(SEPARATOR)) {
            return Promise.resolve([]);
        }

        // Separa pelo caractere e limpa espaços em branco
        const appNames = query.split(SEPARATOR).map(s => s.trim()).filter(s => s.length > 0);

        // Se tiver menos de 2 itens, ignoramos (comportamento padrão de pesquisa)
        if (appNames.length < 2) {
            return Promise.resolve([]);
        }

        // Busca os apps instalados
        const foundApps = [];
        const installedApps = this.appSystem.get_installed(); // Retorna lista de GAppInfo

        for (const name of appNames) {
            const lowerName = name.toLowerCase();
            
            // Lógica de busca simples (Fuzzy): procura se o ID ou o Nome contém o texto
            const match = installedApps.find(app => {
                const id = app.get_id().toLowerCase();
                const displayName = app.get_name().toLowerCase();
                return id.includes(lowerName) || displayName.includes(lowerName);
            });

            if (match) {
                foundApps.push(match);
            }
        }

        this._pendingApps = foundApps;

        // Se encontrou apps, retorna um ID para exibir o resultado
        if (this._pendingApps.length > 0) {
            return Promise.resolve(['multi-launch-result']);
        }

        return Promise.resolve([]);
    }

    getSubsearchResultSet(previousResults, terms) {
        return this.getInitialResultSet(terms);
    }

    /**
     * Define como o resultado aparece na lista (ícone e texto).
     */
    getResultMetas(resultIds) {
        const metas = resultIds.map(id => {
            const appNames = this._pendingApps.map(app => app.get_name()).join(' + ');
            
            return {
                id: id,
                name: 'Multi Launch',
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

    /**
     * O que acontece quando o usuário clica ou aperta Enter.
     */
    activateResult(resultId, terms) {
        // Abre todos os apps encontrados sequencialmente
        this._pendingApps.forEach(app => {
            app.launch([], null);
        });
    }
}

export default class MultiLaunchExtension extends Extension {
    enable() {
        this._provider = new MultiLaunchProvider(this);
        // Registra o provedor na visão geral (Overview)
        Main.overview.viewSelector._searchResults.addProvider(this._provider);
    }

    disable() {
        if (this._provider) {
            Main.overview.viewSelector._searchResults.removeProvider(this._provider);
            this._provider = null;
        }
    }
}
