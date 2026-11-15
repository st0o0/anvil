// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: 'https://anvil.st0o0.net',
	integrations: [
		starlight({
			title: 'Anvil',
			description: 'Opinionated .NET & Akka.NET conventions - forged from real projects.',
			defaultLocale: 'en',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/st0o0/anvil' },
			],
			editLink: {
				baseUrl: 'https://github.com/st0o0/anvil/edit/astro/',
			},
			disable404Route: true,
			head: [
				{
					tag: 'meta',
					attrs: {
						name: 'description',
						content: 'Opinionated .NET & Akka.NET conventions - forged from real projects.',
					},
				},
			],
			sidebar: [
				{
					label: 'Getting Started',
					items: [{ autogenerate: { directory: 'getting-started' } }],
				},
				{
					label: 'C# Conventions',
					items: [{ autogenerate: { directory: 'csharp' } }],
				},
				{
					label: 'Akka.NET',
					items: [{ autogenerate: { directory: 'akka' } }],
				},
				{
					label: 'API Design',
					items: [{ autogenerate: { directory: 'api' } }],
				},
				{
					label: 'Testing',
					items: [{ autogenerate: { directory: 'testing' } }],
				},
				{
					label: 'DI & Configuration',
					items: [{ autogenerate: { directory: 'config' } }],
				},
				{
					label: 'Observability',
					items: [{ autogenerate: { directory: 'observability' } }],
				},
				{
					label: 'CI/CD',
					items: [{ autogenerate: { directory: 'ci' } }],
				},
			],
		}),
	],
});
