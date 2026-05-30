const vscode = require('vscode');

function activate(context) {
    // Maps unique editor panes ('viewColumn_fileURI') to the line number that triggered a split
    const splitHistory = new Map();

    let disposable = vscode.window.onDidChangeTextEditorSelection((event) => {
        const editor = event.textEditor;
        if (!editor) return;

        const position = editor.selection.active;
        const currentLine = position.line;
        const visibleRanges = editor.visibleRanges;

        if (!visibleRanges || visibleRanges.length === 0) return;

        const lastVisibleLine = visibleRanges[0].end.line;
        const isAtBottomZone = (currentLine >= lastVisibleLine - 1);
        
        // Create a unique identifier for this specific split pane window
        const editorKey = `${editor.viewColumn}_${editor.document.uri.toString()}`;

        // If the cursor leaves the bottom zone, completely clear the lock for this pane
        if (!isAtBottomZone) {
            splitHistory.delete(editorKey);
            return;
        }

        // CRITICAL: If this specific pane on this specific line already caused a split, block it!
        if (splitHistory.get(editorKey) === currentLine) {
            return; 
        }

        // Register the split lock for the originating editor pane immediately
        splitHistory.set(editorKey, currentLine);

        // 1. Trigger the split screen command
        vscode.commands.executeCommand('workbench.action.splitEditor').then(() => {
            const newEditor = vscode.window.activeTextEditor;
            
            if (newEditor) {
                const newEditorKey = `${newEditor.viewColumn}_${newEditor.document.uri.toString()}`;
                
                // 2. PRE-EMPTIVELY lock the new tab on this exact line number.
                // This stops it from instantly firing an accidental duplicate split when focus shifts!
                splitHistory.set(newEditorKey, currentLine);

                // 3. Slide the viewport up in the new tab so the cursor is at the top
                const range = new vscode.Range(currentLine, 0, currentLine, 0);
                newEditor.revealRange(range, vscode.TextEditorRevealType.AtTop);
            }

            // 4. Process custom tab capacity rules
            const config = vscode.workspace.getConfiguration('split-at-reaching-bottom');
            const autoDeleteEnabled = config.get('enableAutoDelete', false);
            const maxTabsAllowed = config.get('maxTabsAllowed', 4);

            if (autoDeleteEnabled) {
                manageTabOverload(maxTabsAllowed);
            }
        });
    });

    context.subscriptions.push(disposable);
}

/**
 * Counts open tab panels across all layout groups and systematically closes 
 * oldest windows if they breach the configured limit threshold.
 */
function manageTabOverload(limit) {
    const allTabs = [];
    
    vscode.window.tabGroups.all.forEach(group => {
        group.tabs.forEach(tab => {
            allTabs.push(tab);
        });
    });

    if (allTabs.length > limit) {
        const excessCount = allTabs.length - limit;
        for (let i = 0; i < excessCount; i++) {
            vscode.window.tabGroups.close(allTabs[i]);
        }
    }
}

function deactivate() {}

module.exports = { activate, deactivate };