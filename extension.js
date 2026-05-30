const vscode = require('vscode');

function activate(context) {
    // Structural state cache mapped via custom unique text document tracking tokens
    const paneStates = new Map();
    
    // Tracks which documents have already received an automatic continuous viewing split
    const autoSplitFiles = new Set();

    /**
     * STABLE SPATIAL GUARD: Compares the active editor's grid placement 
     * directly against all other visible layouts on screen.
     */
    function isActiveEditorRightmost(activeEditor) {
        if (!activeEditor) return false;
        
        const activeColumn = activeEditor.viewColumn;
        // If the viewColumn is undefined (e.g., custom webviews), skip safety checks
        if (!activeColumn) return false;

        let isRightmost = true;
        // Evaluate against all active editors to ensure no pane is further to the right
        vscode.window.visibleTextEditors.forEach(editor => {
            if (editor && editor.viewColumn && editor.viewColumn > activeColumn) {
                isRightmost = false;
            }
        });
        
        return isRightmost;
    }

    // ==========================================
    // FEATURE 1: DUAL-PANE VIEWING MODE (ON FILE OPEN)
    // ==========================================
    let openDisposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (!editor) return;

        // Ensure this only operates when launching a file into a clean single-pane space
        const totalVisibleEditors = vscode.window.visibleTextEditors.length;
        if (totalVisibleEditors > 1) return;

        const docUri = editor.document.uri.toString();
        if (autoSplitFiles.has(docUri)) return;

        autoSplitFiles.add(docUri);

        // Allow VS Code engine layout thread to finish paint cycles
        setTimeout(() => {
            const visibleRanges = editor.visibleRanges;
            if (!visibleRanges || visibleRanges.length === 0) return;

            const lastVisibleLineOnOpen = visibleRanges[0].end.line;

            vscode.commands.executeCommand('workbench.action.splitEditorRight').then(() => {
                const newEditor = vscode.window.activeTextEditor;
                if (newEditor) {
                    const nextLineToReveal = lastVisibleLineOnOpen + 1;
                    
                    // Push view bounds to show next consecutive line blocks cleanly
                    const range = new vscode.Range(nextLineToReveal, 0, nextLineToReveal, 0);
                    newEditor.revealRange(range, vscode.TextEditorRevealType.AtTop);

                    // Drop the selection marker down into view on the right
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
        // Drop background selection events to filter noise
        if (event.kind !== vscode.TextEditorSelectionChangeKind.Keyboard && 
            event.kind !== vscode.TextEditorSelectionChangeKind.Mouse) {
            return;
        }

        const editor = event.textEditor;
        if (!editor) return;

        // FIXED SPATIAL GUARD CHECK
        // Exits immediately if typing occurs in any left or middle pane
        if (!isActiveEditorRightmost(editor)) {
            return;
        }

        // Build a concrete compound string key using valid API tokens
        const docUri = editor.document.uri.toString();
        const columnToken = editor.viewColumn ? editor.viewColumn.toString() : "1";
        const editorKey = `${columnToken}_${docUri}`;

        if (!paneStates.has(editorKey)) {
            paneStates.set(editorKey, { lastSplitTime: 0, lastSplitLine: -1 });
        }
        const state = paneStates.get(editorKey);

        const now = Date.now();
        // Cooldown cushion optimized for layout changes
        if (now - state.lastSplitTime < 2200) return; 

        const position = editor.selection.active;
        const currentLine = position.line;
        const visibleRanges = editor.visibleRanges;

        if (!visibleRanges || visibleRanges.length === 0) return;

        const lastVisibleLine = visibleRanges[0].end.line;

        // Dynamic pre-slide bounds calculations
        const editorConfig = vscode.workspace.getConfiguration('editor');
        const userSurroundingLines = editorConfig.get('cursorSurroundingLines', 0);
        const preSlideBuffer = Math.max(userSurroundingLines, 4);

        const isApproachingSlideZone = (currentLine >= lastVisibleLine - preSlideBuffer);

        if (isApproachingSlideZone && state.lastSplitLine !== currentLine) {
            state.lastSplitTime = now;
            state.lastSplitLine = currentLine;

            // Enforce explicit direction rules to prevent layout inversion
            vscode.commands.executeCommand('workbench.action.splitEditorRight').then(() => {
                const newEditor = vscode.window.activeTextEditor;
                if (newEditor) {
                    const nextColumnToken = newEditor.viewColumn ? newEditor.viewColumn.toString() : "2";
                    const newEditorKey = `${nextColumnToken}_${docUri}`;
                    paneStates.set(newEditorKey, { lastSplitTime: now, lastSplitLine: currentLine });

                    // Position cursor cleanly at the top of the new panel view
                    const range = new vscode.Range(position, position);
                    newEditor.revealRange(range, vscode.TextEditorRevealType.AtTop);
                }

                // Configuration-driven layout cleanups
                const config = vscode.workspace.getConfiguration('split-at-reaching-bottom');
                const autoDeleteEnabled = config.get('enableAutoDelete', false);
                const maxTabsAllowed = config.get('maxTabsAllowed', 4);

                if (autoDeleteEnabled) {
                    manageTabOverload(maxTabsAllowed);
                }
            });
        }
    });

    let closeDisposable = vscode.workspace.onDidCloseTextDocument(() => {
        paneStates.clear();
    });

    context.subscriptions.push(openDisposable, selectionDisposable, closeDisposable);
}

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