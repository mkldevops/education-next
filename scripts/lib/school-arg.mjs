/**
 * Reads `--school-id`, kept out of `scripts/migrate-legacy.mjs` so it can be tested:
 * this module reads no environment variable and opens no connection, whereas the
 * script fails on load without its credentials.
 *
 * The option is required. The cleanup that follows deletes rows, so a missing or empty
 * value must stop the script while it has touched nothing yet.
 */
export function parseSchoolId(argv) {
  const index = argv.findIndex((arg) => arg === '--school-id' || arg.startsWith('--school-id='))
  if (index === -1) {
    throw new Error('Missing required option: --school-id <uuid>')
  }

  const flag = argv[index]
  const value = flag.includes('=') ? flag.slice(flag.indexOf('=') + 1) : argv[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error('Option --school-id requires a value: --school-id <uuid>')
  }

  return value
}
