const vscode = require('vscode');

function activate(context) {
    let isCooldown = false;

    let disposable = vscode.window.onDidChangeTextEditorSelection((event) => {
        const editor = event.textEditor;
        if (!editor || isCooldown) return;

        const position = editor.selection.active;
        const visibleRanges = editor.visibleRanges;

        if (visibleRanges.length > 0) {
            const lastVisibleLine = visibleRanges[0].end.line;

            if (position.line === lastVisibleLine) {
                isCooldown = true;

                // 1. Trigger the split screen command
                vscode.commands.executeCommand('workbench.action.splitEditor').then(() => {
                    // 2. Fetch the user's custom choices dynamically using the corrected configuration namespace
                    const config = vscode.workspace.getConfiguration('split-at-reaching-bottom');
                    const autoDeleteEnabled = config.get('enableAutoDelete');
                    const maxTabsAllowed = config.get('maxTabsAllowed');

                    // 3. Execute tab management if the user enabled it
                    if (autoDeleteEnabled) {
                        manageTabOverload(maxTabsAllowed);
                    }
                });

                setTimeout(() => {
                    isCooldown = false;
                }, 1000);
            }
        }
    });

    context.subscriptions.push(disposable);
}

/**
 * Counts open tab panels and systematically closes old ones
 * if they breach the configured threshold.
 */
function manageTabOverload(limit) {
    // Flatten all open tabs across every split pane window into a single array
    const allTabs = [];
    
    vscode.window.tabGroups.all.forEach(group => {
        group.tabs.forEach(tab => {
            allTabs.push(tab);
        });
    });

    // If total tab windows exceed the user's limit, close the oldest ones
    if (allTabs.length > limit) {
        const excessCount = allTabs.length - limit;
        
        // Loop through and close the tabs sitting at the front of the array
        for (let i = 0; i < excessCount; i++) {
            vscode.window.tabGroups.close(allTabs[i]);
        }
    }
}

function deactivate() {}

module.exports = { activate, deactivate };