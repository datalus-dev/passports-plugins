// The small CSV a dataset is written in: commas between cells, a cell in double quotes when it holds a comma
// (a double quote inside one is written twice), one row per line. A line break inside a cell is not supported,
// so a dataset stays a table anyone can read in a diff. Keep in step with src/lib/passport-datasets.ts in the app.

/**
 * @param {string} text
 * @returns {{ rows: string[][], errors: string[] }}
 */
export function parseCsv(text) {
	const errors = [];
	const rows = [];
	const lines = text.replace(/^﻿/, '').split('\n');
	if (lines.length && lines[lines.length - 1] === '') lines.pop();
	lines.forEach((raw, index) => {
		const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
		const n = index + 1;
		const cells = [];
		let cell = '';
		let quoted = false;
		let wasQuoted = false;
		for (let i = 0; i < line.length; i++) {
			const c = line[i];
			if (quoted) {
				if (c === '"') {
					if (line[i + 1] === '"') {
						cell += '"';
						i++;
					} else {
						quoted = false;
					}
				} else cell += c;
			} else if (c === '"' && cell === '' && !wasQuoted) {
				quoted = true;
				wasQuoted = true;
			} else if (c === '"') {
				errors.push(`line ${n}: a quote inside a cell must be in a quoted cell`);
				return;
			} else if (c === ',') {
				cells.push(cell);
				cell = '';
				wasQuoted = false;
			} else if (wasQuoted) {
				errors.push(`line ${n}: text after a closing quote`);
				return;
			} else cell += c;
		}
		if (quoted) {
			errors.push(`line ${n}: a quote is not closed (a cell can't hold a line break)`);
			return;
		}
		cells.push(cell);
		rows.push(cells);
	});
	return { rows, errors };
}
