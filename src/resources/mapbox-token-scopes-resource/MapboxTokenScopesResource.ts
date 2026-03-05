// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { BaseResource } from '../BaseResource.js';

/**
 * Resource providing Mapbox token scope reference documentation
 * Helps users and AI understand what each token scope allows
 */
export class MapboxTokenScopesResource extends BaseResource {
  readonly name = 'Mapbox Token Scopes Reference';
  readonly uri = 'resource://mapbox-token-scopes';
  readonly description =
    'Reference guide for Mapbox access token scopes and their permissions. Use this to understand what each scope allows and which scopes are needed for different operations.';
  readonly mimeType = 'text/markdown';

  public async readCallback(uri: URL, _extra: unknown) {
    const markdown = this.generateMarkdown();

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: this.mimeType,
          text: markdown
        }
      ]
    };
  }

  private generateMarkdown(): string {
    return `# Mapbox Token Scopes Reference

Complete reference for Mapbox access token scopes. Source: https://docs.mapbox.com/accounts/guides/tokens/#scopes

## Token Types

### Public Tokens (\`pk.*\`)
Used in client-side applications (web browsers, mobile apps). Can only be assigned public scopes.

### Secret Tokens (\`sk.*\`)
Used server-side. Can be assigned any scope including write operations. Never expose in client-side code.

## Public Token Scopes

| Scope | Purpose |
|---|---|
| \`styles:tiles\` | Read style as PNG tiles and static images (Static Images and Static Tiles APIs) |
| \`styles:read\` | Initialize Mapbox map styles in GL JS and mobile SDKs |
| \`fonts:read\` | Generate fonts for map styles; retrieve glyphs via Fonts API |
| \`datasets:read\` | Retrieve dataset information through the Datasets API |

## Secret Token Scopes

| Scope | Purpose |
|---|---|
| \`scopes:list\` | List available scopes via the Tokens API |
| \`map:read\` | Access tilesets, tilestats, and legacy projects |
| \`map:write\` | Create and update tilesets and tilestats |
| \`user:read\` | Retrieve account profile details |
| \`user:write\` | Modify account information |
| \`uploads:read\` | Track upload statuses |
| \`uploads:list\` | Retrieve multiple upload statuses |
| \`uploads:write\` | Create tileset uploads |
| \`styles:write\` | Create and update styles |
| \`styles:list\` | List account styles (metadata only) |
| \`styles:protect\` | Protect style write access and assets |
| \`tokens:read\` | List account tokens |
| \`tokens:write\` | Create, update, and delete tokens |
| \`datasets:list\` | List account datasets |
| \`datasets:write\` | Create and update datasets |
| \`tilesets:list\` | List tilesets and tileset sources |
| \`tilesets:read\` | Read tilesets via Mapbox Tiling Service |
| \`tilesets:write\` | Create, publish, and manage tilesets |
| \`downloads:read\` | Download Maps and Navigation SDKs |
| \`atlas:read\` | Access Mapbox Atlas data (Atlas accounts only) |

## Common Scope Combinations

### Minimal map display (public token)
\`\`\`
["styles:tiles", "fonts:read"]
\`\`\`

### Map display with custom dataset (public token)
\`\`\`
["styles:tiles", "fonts:read", "datasets:read"]
\`\`\`

### Style management (secret token)
\`\`\`
["styles:read", "styles:write", "styles:list", "fonts:read"]
\`\`\`

### Full DevKit server (secret token)
\`\`\`
["styles:read", "styles:write", "styles:list", "fonts:read",
 "tokens:read", "tokens:write", "tilesets:read", "tilesets:list"]
\`\`\`

## Best Practices

- **Minimal scopes**: Do not grant more scopes than necessary to each token
- **Public tokens in client code**: Never expose secret tokens in browsers or mobile apps
- **URL restrictions**: Restrict public tokens to specific domains via \`allowedUrls\`
- **Rotate regularly**: Periodically rotate secret tokens used in production
`;
  }
}
