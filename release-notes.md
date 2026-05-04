### Changes in 0.1.5:
* **Kanban Polish:** Introduced Canvas drag panning—freely click and drag empty board space to scroll effortlessly (configurable via Settings).
* **Kanban Fix:** Restored column bounding boxes so columns tightly wrap their contents and scroll gracefully without excess whitespace stretching.
* **UI Enhancement:** Standardized the color selection interface globally with a brand new floating \`ColorPickerDropdown\`. Goodbye chaotic inline pickers—enjoy clean popout palettes in your Sidebar, Settings, and Status configurations!
* **Project Engine Fix:** Exorcised an elusive ghost-table db migration bug that aggressively held project foreign-key locks and violently rejected users' attempts to delete projects.
* **Core Fix (Color Picker):** Smashed a nasty global mousedown vs. React event propagation clash that triggered the new Color Dropdown to prematurely destroy itself instead of logging custom color selections.
