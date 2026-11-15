/**
 * Generates /llms.txt (index) and /llms-full.txt (all content)
 * from the Markdown source files in src/content/docs/.
 *
 * Run: node scripts/generate-llms-txt.mjs
 * Output: public/llms.txt, public/llms-full.txt
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';

const SITE = 'https://anvil.st0o0.net';
const DOCS_DIR = 'src/content/docs';
const OUT_DIR = 'public';

const sections = [
	{
		label: 'Getting Started',
		dir: 'getting-started',
		files: ['project-scaffolding.md', 'solution-structure.md', 'dev-environment.md'],
	},
	{
		label: 'C# Conventions',
		dir: 'csharp',
		files: ['coding-standards.md', 'type-design.md', 'enum-conventions.md', 'async-patterns.md'],
	},
	{
		label: 'Akka.NET',
		dir: 'akka',
		files: [
			'actor-design.md',
			'state-management.md',
			'messaging.md',
			'persistence.md',
			'streams.md',
			'cluster.md',
			'supervision.md',
		],
	},
	{
		label: 'API Design',
		dir: 'api',
		files: ['minimal-api.md', 'models-and-mapping.md'],
	},
	{
		label: 'Testing',
		dir: 'testing',
		files: [
			'philosophy.md',
			'assertions.md',
			'actor-testing.md',
			'mutation-testing.md',
			'architecture-tests.md',
		],
	},
	{
		label: 'DI & Configuration',
		dir: 'config',
		files: ['dependency-injection.md', 'options-pattern.md'],
	},
	{
		label: 'Observability',
		dir: 'observability',
		files: ['metrics.md', 'logging.md'],
	},
	{
		label: 'CI/CD',
		dir: 'ci',
		files: ['build.md', 'github-actions.md'],
	},
];

function parseFrontmatter(content) {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
	if (!match) return { title: '', body: content };
	const fm = match[1];
	const titleMatch = fm.match(/title:\s*"([^"]+)"/);
	const titleMatchUnquoted = fm.match(/title:\s*([^\n]+)/);
	const descMatch = fm.match(/description:\s*"([^"]+)"/);
	const descMatchUnquoted = fm.match(/description:\s*([^\n]+)/);
	return {
		title: titleMatch?.[1]?.trim() ?? titleMatchUnquoted?.[1]?.trim() ?? '',
		description: descMatch?.[1]?.trim() ?? descMatchUnquoted?.[1]?.trim() ?? '',
		body: content.slice(match[0].length).trim(),
	};
}

function fileToSlug(dir, file) {
	return `/${dir}/${basename(file, '.md')}/`;
}

function generateIndex() {
	const lines = [
		'# Anvil',
		'',
		'> Opinionated .NET & Akka.NET conventions - forged from real projects.',
		'',
		`This file is a machine-readable index of all conventions on [${SITE}](${SITE}).`,
		`For the complete content in a single file, see [llms-full.txt](${SITE}/llms-full.txt).`,
		'',
	];

	for (const section of sections) {
		lines.push(`## ${section.label}`, '');
		for (const file of section.files) {
			const path = join(DOCS_DIR, section.dir, file);
			if (!existsSync(path)) continue;
			const content = readFileSync(path, 'utf-8');
			const { title, description } = parseFrontmatter(content);
			const url = `${SITE}${fileToSlug(section.dir, file)}`;
			const desc = description || extractFirstLine(parseFrontmatter(content).body);
			lines.push(`- [${title}](${url}): ${desc}`);
		}
		lines.push('');
	}

	return lines.join('\n');
}

function extractFirstLine(body) {
	const line = body
		.split('\n')
		.find((l) => l.trim() && !l.startsWith('#') && !l.startsWith('|') && !l.startsWith(':::'));
	return line?.trim().slice(0, 200) ?? '';
}

function generateFull() {
	const lines = [
		'# Anvil - Complete .NET & Akka.NET Conventions Reference',
		'',
		'> Opinionated .NET & Akka.NET conventions - forged from real projects.',
		`> Source: ${SITE}`,
		'',
		'---',
		'',
	];

	for (const section of sections) {
		lines.push(`# ${section.label}`, '', '---', '');
		for (const file of section.files) {
			const path = join(DOCS_DIR, section.dir, file);
			if (!existsSync(path)) continue;
			const content = readFileSync(path, 'utf-8');
			const { title, body } = parseFrontmatter(content);
			lines.push(`## ${title}`, '', body, '', '---', '');
		}
	}

	return lines.join('\n');
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const index = generateIndex();
const full = generateFull();

writeFileSync(join(OUT_DIR, 'llms.txt'), index, 'utf-8');
writeFileSync(join(OUT_DIR, 'llms-full.txt'), full, 'utf-8');

const indexKb = (Buffer.byteLength(index) / 1024).toFixed(1);
const fullKb = (Buffer.byteLength(full) / 1024).toFixed(1);
const pageCount = sections.reduce((n, s) => n + s.files.length, 0);

console.log(`llms.txt     ${indexKb} KB (${pageCount} pages indexed)`);
console.log(`llms-full.txt  ${fullKb} KB (all content)`);
