// Code in this file has been adapted from y-codemirror.next
// License
// [The MIT License](./LICENSE) © Kevin Jahns

import {
	EditorView,
	ViewUpdate,
	ViewPlugin,
	PluginValue,
	KeyBinding,
} from "@codemirror/view";
import {
	Facet,
	Annotation,
	AnnotationType,
	StateCommand,
	EditorState,
} from "@codemirror/state";
import { AbstractType, UndoManager, YEvent } from "yjs";
import { mutex } from "lib0/mutex";

import { createMutex } from "lib0/mutex";
import { LiveViewManager, LiveView } from "../LiveViews";
import { YRange } from "./YRange";
import { connectionManagerFacet, ySyncAnnotation } from "./LiveEditPlugin";
import { PositionTranformer } from "./PositionTransformer";

export class YUndoManagerConfig {
	undoManager: UndoManager;
	constructor(undoManager: UndoManager) {
		this.undoManager = undoManager;
	}

	addTrackedOrigin(origin: any): void {
		this.undoManager.addTrackedOrigin(origin);
	}

	removeTrackedOrigin(origin: any): void {
		this.undoManager.removeTrackedOrigin(origin);
	}

	undo(): boolean {
		return this.undoManager.undo() != null;
	}

	redo(): boolean {
		return this.undoManager.redo() != null;
	}
}

export const yUndoManagerFacet = Facet.define<
	YUndoManagerConfig,
	YUndoManagerConfig
>({
	combine(inputs) {
		return inputs[inputs.length - 1];
	},
});

export const yUndoManagerAnnotation: AnnotationType<YUndoManagerConfig> =
	Annotation.define<YUndoManagerConfig>();

type StackItemAddedEventHandler = (args: {
	stackItem: {
		meta: Map<any, any>;
	};
	changedParentTypes: Map<AbstractType<YEvent<any>>, YEvent<any>[]>;
}) => void;

type StackItemPoppedEventHandler = (args: {
	stackItem: {
		meta: Map<any, any>;
	};
}) => void;

class YUndoManagerPluginValue implements PluginValue {
	editor: EditorView;
	view?: LiveView;
	transformer: PositionTranformer;
	conf: YUndoManagerConfig;
	connectionManager: LiveViewManager;
	_undoManager: UndoManager;
	_beforeChangeSelection: YRange | null;
	_mux: mutex;
	_onStackItemAdded: StackItemAddedEventHandler;
	_onStackItemPopped: StackItemPoppedEventHandler;
	_storeSelection: () => void;

	constructor(editor: EditorView) {
		this.editor = editor;
		this.connectionManager = this.editor.state.facet(
			connectionManagerFacet
		);
		this.view = this.connectionManager.findView(editor);
		if (!this.view) {
			return;
		}

		this.conf = editor.state.facet(yUndoManagerFacet);
		this._undoManager = this.conf.undoManager;
		this._beforeChangeSelection = null;
		this._mux = createMutex();

		this._onStackItemAdded = ({ stackItem, changedParentTypes }) => {
			// only store metadata if this type was affected
			if (
				this.view &&
				changedParentTypes.has(this.view.document.ytext) &&
				this._beforeChangeSelection &&
				!stackItem.meta.has(this)
			) {
				// do not overwrite previous stored selection
				stackItem.meta.set(this, this._beforeChangeSelection);
			}
		};
		this._onStackItemPopped = ({ stackItem }) => {
			const sel = stackItem.meta.get(this);
			if (this.view && sel) {
				const transformer = new PositionTranformer(this.view.ytext);
				const selection = transformer.fromYRange(sel);
				editor.dispatch(editor.state.update({ selection }));
				this._storeSelection();
			}
		};
		/**
		 * Do this without mutex, simply use the sync annotation
		 */
		this._storeSelection = () => {
			// store the selection before the change is applied so we can restore it with the undo manager.
			if (!this.view) {
				return;
			}
			const transformer = new PositionTranformer(this.view.ytext);
			this._beforeChangeSelection = transformer.toYRange(
				this.editor.state.selection.main
			);
		};
		this._undoManager.on("stack-item-added", this._onStackItemAdded);
		this._undoManager.on("stack-item-popped", this._onStackItemPopped);
		this._undoManager.addTrackedOrigin(this.view);
	}

	update(update: ViewUpdate) {
		if (
			update.selectionSet &&
			(update.transactions.length === 0 ||
				update.transactions[0].annotation(ySyncAnnotation) !==
					this.view)
		) {
			// This only works when YUndoManagerPlugin is included before the sync plugin
			this._storeSelection();
		}
	}

	destroy() {
		if (!this._undoManager) return;
		this._undoManager.off("stack-item-added", this._onStackItemAdded);
		this._undoManager.off("stack-item-popped", this._onStackItemPopped);
		this._undoManager.removeTrackedOrigin(this.view);
	}
}
export const yUndoManager = ViewPlugin.fromClass(YUndoManagerPluginValue);

export const undo: StateCommand = ({ state, dispatch }) =>
	state.facet(yUndoManagerFacet).undo() || true;

export const redo: StateCommand = ({ state, dispatch }) =>
	state.facet(yUndoManagerFacet).redo() || true;

export const undoDepth = (state: EditorState): number =>
	state.facet(yUndoManagerFacet).undoManager.undoStack.length;

export const redoDepth = (state: EditorState): number =>
	state.facet(yUndoManagerFacet).undoManager.redoStack.length;

export const yUndoManagerKeymap: Array<KeyBinding> = [
	{ key: "Mod-z", run: undo, preventDefault: true },
	{ key: "Mod-y", mac: "Mod-Shift-z", run: redo, preventDefault: true },
	{ key: "Mod-Shift-z", run: redo, preventDefault: true },
];
