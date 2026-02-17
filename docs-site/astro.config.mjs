import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://allymurray.github.io',
  base: '/comic-vine',
  integrations: [
    starlight({
      title: 'Comic Vine SDK',
      customCss: ['./src/styles/custom.css'],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/AllyMurray/comic-vine',
        },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', slug: 'getting-started/introduction' },
            { label: 'Installation', slug: 'getting-started/installation' },
            { label: 'Quick Start', slug: 'getting-started/quick-start' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Field Selection', slug: 'guides/field-selection' },
            { label: 'Filtering', slug: 'guides/filtering' },
            { label: 'Pagination', slug: 'guides/pagination' },
            { label: 'Error Handling', slug: 'guides/error-handling' },
            { label: 'Caching', slug: 'guides/caching' },
            { label: 'Rate Limiting', slug: 'guides/rate-limiting' },
          ],
        },
        {
          label: 'API Reference',
          items: [
            { label: 'Resources', slug: 'api/resources' },
            { label: 'Configuration', slug: 'api/configuration' },
            { label: 'Errors', slug: 'api/errors' },
          ],
        },
        {
          label: 'Examples',
          items: [
            { label: 'Basic Usage', slug: 'examples/basic-usage' },
            { label: 'Advanced Usage', slug: 'examples/advanced-usage' },
          ],
        },
      ],
    }),
  ],
});
