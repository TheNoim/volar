import type { ApiLanguageServiceContext } from '../types';
import type { Position } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { Location } from 'vscode-languageserver/node';
import { uriToFsPath } from '@volar/shared';

export function register({ mapper, ts }: ApiLanguageServiceContext) {

	return (document: TextDocument, position: Position): string | undefined | null => {

		for (const tsRange of mapper.ts.to(document.uri, position)) {

			if (!tsRange.data.capabilities.completion)
				continue;

			// TODO: use computed
			const sourceFile = ts.createSourceFile(uriToFsPath(tsRange.textDocument.uri), tsRange.textDocument.getText(), ts.ScriptTarget.Latest);
			if (isBlacklistNode(sourceFile, tsRange.textDocument.offsetAt(tsRange.range.start)))
				continue;

			const typeDefs = tsRange.languageService.findTypeDefinition(tsRange.textDocument.uri, tsRange.range.start);
			for (const typeDefine of typeDefs) {
				const uri = Location.is(typeDefine) ? typeDefine.uri : typeDefine.targetUri;
				const range = Location.is(typeDefine) ? typeDefine.range : typeDefine.targetSelectionRange;
				const defineDoc = tsRange.languageService.__internal__.getTextDocument(uri);
				if (!defineDoc)
					continue;
				const typeName = defineDoc.getText(range);
				if (uri.endsWith('reactivity.d.ts')) {
					switch (typeName) {
						case 'Ref':
						case 'ComputedRef':
						case 'WritableComputedRef':
							return '${1:.value}';
					}
				}
			}
		}
	}

	function isBlacklistNode(node: ts.Node, pos: number) {
		if (ts.isVariableDeclaration(node) && pos >= node.name.getFullStart() && pos <= node.name.getEnd()) {
			return true;
		}
		else if (ts.isShorthandPropertyAssignment(node)) {
			return true;
		}
		else if (ts.isImportDeclaration(node)) {
			return true;
		}
		else {
			let _isBlacklistNode = false;
			node.forEachChild(node => {
				if (_isBlacklistNode) return;
				if (pos >= node.getFullStart() && pos <= node.getEnd()) {
					if (isBlacklistNode(node, pos)) {
						_isBlacklistNode = true;
					}
				}
			});
			return _isBlacklistNode;
		}
	}
}
