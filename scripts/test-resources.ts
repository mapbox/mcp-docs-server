/**
 * Manual integration test for PR #7 resources.
 * Run with: npx tsx scripts/test-resources.ts
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const RESOURCES_TO_TEST = [
  {
    uri: 'resource://mapbox-api-reference',
    // Sections: "Data loading & access APIs", "Tiling & rendering APIs", "Navigation APIs", "Search APIs", "Tokens API"
    expectedSections: ['docs.mapbox.com/api', 'APIs'],
    notExpected: ['GL JS', 'Studio Manual', 'Tilesets']
  },
  {
    uri: 'resource://mapbox-sdk-docs',
    // Sections: "Maps client libraries & SDKs", "Navigation client SDKs", "Search client libraries & SDKs", etc.
    expectedSections: ['GL JS', 'iOS', 'Android'],
    notExpected: ['Studio Manual', 'Tilesets']
  },
  {
    uri: 'resource://mapbox-guides',
    // Sections: "Map design", "Map Design"
    expectedSections: ['Studio', 'Style Specification'],
    notExpected: []
  },
  {
    uri: 'resource://mapbox-examples',
    // Sections: "API Playgrounds", "Demos & Projects", "Open Code"
    expectedSections: ['Playground', 'Demos'],
    notExpected: []
  },
  {
    uri: 'resource://mapbox-reference',
    // Sections: "Mapbox Tilesets", "Specialty data products", "Accounts and Pricing", "Atlas", etc.
    expectedSections: ['Tilesets', 'Accounts'],
    notExpected: ['GL JS', 'Studio Manual']
  },
  {
    uri: 'resource://mapbox-documentation',
    // All sections combined
    expectedSections: ['GL JS', 'APIs', 'Studio', 'Tilesets'],
    notExpected: []
  }
];

async function main() {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', 'tsx', 'src/index.ts']
  });

  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(transport);

  console.log('Connected to MCP server\n');

  // List all resources
  const { resources } = await client.listResources();
  console.log(`Found ${resources.length} resources:`);
  resources.forEach((r) => console.log(`  - ${r.uri}`));
  console.log();

  let passed = 0;
  let failed = 0;

  for (const test of RESOURCES_TO_TEST) {
    process.stdout.write(`Testing ${test.uri}... `);
    try {
      const result = await client.readResource({ uri: test.uri });
      const text =
        result.contents[0] && 'text' in result.contents[0]
          ? (result.contents[0].text as string)
          : '';

      if (!text || text.trim().length === 0) {
        console.log('FAIL — empty content');
        failed++;
        continue;
      }

      const missing = test.expectedSections.filter(
        (keyword) => !text.includes(keyword)
      );
      const unexpected = test.notExpected.filter((keyword) =>
        text.includes(keyword)
      );

      if (missing.length > 0) {
        console.log(`FAIL — missing expected content: ${missing.join(', ')}`);
        failed++;
      } else if (unexpected.length > 0) {
        console.log(
          `WARN — contains unexpected content: ${unexpected.join(', ')}`
        );
        passed++;
      } else {
        console.log(`PASS (${Math.round(text.length / 1024)}KB)`);
        passed++;
      }
    } catch (err) {
      console.log(`FAIL — ${err}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  await client.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
