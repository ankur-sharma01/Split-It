const vscode = require('vscode');

function activate(context) {
    // Independent state matrix tracking metadata per individual pane layout
    const paneStates = new Map();
    
    // Tracks which files have already received an automatic continuous viewing split
    const autoSplitFiles = new Set();

    // ==========================================
    // FEATURE 1: DUAL-PANE VIEWING MODE (ON FILE OPEN)
    // ==========================================
    let openDisposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (!editor || editor.viewColumn !== 1) return;

        const docUri = editor.document.uri.toString();
        if (autoSplitFiles.has(docUri)) return;

        autoSplitFiles.add(docUri);

        // Allow VS Code a brief moment to render its layout window parameters
        setTimeout(() => {
            const visibleRanges = editor.visibleRanges;
            if (!visibleRanges || visibleRanges.length === 0) return;

            const lastVisibleLineOnOpen = visibleRanges[0].end.line;

            vscode.commands.executeCommand('workbench.action.splitEditor').then(() => {
                const newEditor = vscode.window.activeTextEditor;
                if (newEditor) {
                    const nextLineToReveal = lastVisibleLineOnOpen + 1;
                    
                    // Instantly scroll the right tab to show the next continuous chunk of code
                    const range = new vscode.Range(nextLineToReveal, 0, nextLineToReveal, 0);
                    newEditor.revealRange(range, vscode.TextEditorRevealType.AtTop);

                    // Sync cursor position to the top line of the secondary continuous view pane
                    const newPos = new vscode.Position(nextLineToReveal, 0);
                    newEditor.selection = new vscode.Selection(newPos, newPos);
                }
            });
        }, 250);
    });

    // ==========================================
    // FEATURE 2: PREEMPTIVE WRITING SPLIT ON APPROACH
    // ==========================================
    let selectionDisposable = vscode.window.onDidChangeTextEditorSelection((event) => {
        // Enforce strict filter: Ignore automated background engine cursor clones
        if (event.kind !== vscode.TextEditorSelectionChangeKind.Keyboard && 
            event.kind !== vscode.TextEditorSelectionChangeKind.Mouse) {
            return;
        }

        const editor = event.textEditor;
        if (!editor) return;

        // CRITICAL NESTED GUARD: Check if there is already a pane open to the right!
        // If your current column position is less than the total visible columns,
        // it means the next tab pane already exists, so we halt immediately.
        const currentColumn = editor.viewColumn;
        const totalOpenColumns = vscode.window.tabGroups.all.length;
        if (currentColumn < totalOpenColumns) {
            return; 
        }

        const docUri = editor.document.uri.toString();
        const editorKey = `${currentColumn}_${docUri}`;

        // Initialize unique state isolation matrix for this specific tab if missing
        if (!paneStates.has(editorKey)) {
            paneStates.set(editorKey, { lastSplitTime: 0, lastSplitLine: -1 });
        }
        const state = paneStates.get(editorKey);

        const now = Date.now();
        if (now - state.lastSplitTime < 1200) return; // Isolated pane cooldown protection

        const position = editor.selection.active;
        const currentLine = position.line;
        const visibleRanges = editor.visibleRanges;

        if (!visibleRanges || visibleRanges.length === 0) return;

        const lastVisibleLine = visibleRanges[0].end.line;

        // Dynamic pre-slide threshold evaluation
        const editorConfig = vscode.workspace.getConfiguration('editor');
        const userSurroundingLines = editorConfig.get('cursorSurroundingLines', 0);
        const preSlideBuffer = Math.max(userSurroundingLines, 4);

        const isApproachingSlideZone = (currentLine >= lastVisibleLine - preSlideBuffer);

        if (isApproachingSlideZone && state.lastSplitLine !== currentLine) {
            state.lastSplitTime = now;
            state.lastSplitLine = currentLine;

            vscode.commands.executeCommand('workbench.action.splitEditor').then(() => {
                const newEditor = vscode.window.activeTextEditor;
                if (newEditor) {
                    // Seed the new tab pane instantly with its own independent tracking properties
                    const newEditorKey = `${newEditor.viewColumn}_${docUri}`;
                    paneStates.set(newEditorKey, { lastSplitTime: now, lastSplitLine: currentLine });

                    // Pin the code at the top of the new split tab
                    const range = new vscode.Range(position, position);
                    newEditor.revealRange(range, vscode.TextEditorRevealType.AtTop);
                }

                // Process custom tab capacity rules
                const config = vscode.workspace.getConfiguration('split-at-reaching-bottom');
                const autoDeleteEnabled = config.get('enableAutoDelete', false);
                const maxTabsAllowed = config.get('maxTabsAllowed', 4);

                if (autoDeleteEnabled) {
                    manageTabOverload(maxTabsAllowed);
                }
            });
        }
    });

    // Clear tracked memory references when documents are closed
    let closeDisposable = vscode.workspace.onDidCloseTextDocument((doc) => {
        const docUri = doc.uri.toString();
        autoSplitFiles.delete(docUri);
        paneStates.delete(`1_${docUri}`);
        paneStates.delete(`2_${docUri}`);
        paneStates.delete(`3_${docUri}`);
        paneStates.delete(`4_${docUri}`);
    });

    context.subscriptions.push(openDisposable, selectionDisposable, closeDisposable);
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