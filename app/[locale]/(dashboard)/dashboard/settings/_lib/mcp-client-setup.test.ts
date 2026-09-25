import { describe, expect, it } from 'vitest'
import { claudeCodeCommand, codexConfig, codexTokenExport, mcpSite } from './mcp-client-setup'

describe('mcpSite', () => {
  it('names the server and token variable after the site host', () => {
    expect(mcpSite('https://Ecole.Example.fr')).toEqual({
      host: 'ecole.example.fr',
      url: 'https://ecole.example.fr/api/mcp',
      serverName: 'education-ecole-example-fr',
      tokenEnvVar: 'EDUCATION_MCP_TOKEN_ECOLE_EXAMPLE_FR',
    })
  })

  it('keeps the port so two local instances stay distinct', () => {
    const site = mcpSite('http://localhost:8550')

    expect(site.url).toBe('http://localhost:8550/api/mcp')
    expect(site.serverName).toBe('education-localhost-8550')
    expect(site.tokenEnvVar).toBe('EDUCATION_MCP_TOKEN_LOCALHOST_8550')
  })
})

describe('client snippets', () => {
  const site = mcpSite('https://a.example.fr')

  it('builds the Claude Code command for the current site', () => {
    expect(claudeCodeCommand(site, 'edu_mcp_secret')).toBe(
      'claude mcp add --transport http education-a-example-fr https://a.example.fr/api/mcp --header "Authorization: Bearer edu_mcp_secret"'
    )
  })

  it('keeps the key out of the Codex configuration file', () => {
    const config = codexConfig(site)

    expect(config).toBe(
      [
        '[mcp_servers.education-a-example-fr]',
        'url = "https://a.example.fr/api/mcp"',
        'bearer_token_env_var = "EDUCATION_MCP_TOKEN_A_EXAMPLE_FR"',
      ].join('\n')
    )
    expect(codexTokenExport(site, 'edu_mcp_secret')).toBe(
      'export EDUCATION_MCP_TOKEN_A_EXAMPLE_FR="edu_mcp_secret"'
    )
  })
})
