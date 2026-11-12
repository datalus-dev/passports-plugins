// Reads a plugin's registry.ts as DATA. The file must be `export default { … }` (optionally `as const`)
// made only of literals: nothing is executed, so a contributed registry can't run code in CI or in the app's build.

import ts from 'typescript';

/**
 * @param {string} source
 * @returns {{ value?: any, errors: string[] }}
 */
export function parseRegistry(source) {
	const sf = ts.createSourceFile('registry.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const errors = [];
	const at = (node) => `line ${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`;

	if (sf.statements.length !== 1 || !ts.isExportAssignment(sf.statements[0]) || sf.statements[0].isExportEquals) {
		return { errors: ['registry.ts must contain only `export default { … }` (no imports, no other statements)'] };
	}

	/** @param {ts.Expression} node */
	const lit = (node) => {
		if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
			return lit(node.expression);
		}
		if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
		if (ts.isNumericLiteral(node)) return Number(node.text);
		if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
		if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
		if (node.kind === ts.SyntaxKind.NullKeyword) return null;
		if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) {
			return -Number(node.operand.text);
		}
		if (ts.isArrayLiteralExpression(node)) return node.elements.map((e) => lit(e));
		if (ts.isObjectLiteralExpression(node)) {
			const out = {};
			for (const p of node.properties) {
				if (!ts.isPropertyAssignment(p)) {
					errors.push(`${at(p)}: only \`key: value\` properties are allowed (no spread, methods or shorthand)`);
					continue;
				}
				const n = p.name;
				const key = ts.isIdentifier(n) || ts.isStringLiteral(n) ? n.text : null;
				if (key == null) {
					errors.push(`${at(p)}: property names must be plain identifiers or strings`);
					continue;
				}
				out[key] = lit(p.initializer);
			}
			return out;
		}
		errors.push(`${at(node)}: only literal values are allowed in registry.ts (found \`${node.getText(sf).slice(0, 40)}\`)`);
		return undefined;
	};

	const value = lit(sf.statements[0].expression);
	return errors.length ? { errors } : { value, errors };
}
