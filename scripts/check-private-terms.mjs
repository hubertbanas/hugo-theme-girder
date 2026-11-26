// Fails if any file, file path or text from stdin contains a term from the
// private denylist: names, addresses and other details that must never be
// published in this repo.
//
// The denylist lives outside the repo:
//   - the PRIVATE_TERMS environment variable (its whole text; CI sets it from
//     the repository secret of the same name), or
//   - the file named by GIRDER_PRIVATE_TERMS, by default
//     ~/.config/hugo-theme-girder/private-terms.txt.
// One term per line, case-insensitive, matched as a whole word. Lines starting
// with "re:" are regular expressions. Blank lines and "#" comments are ignored.
//
// Usage:
//   node scripts/check-private-terms.mjs              every file git would commit
//   node scripts/check-private-terms.mjs FILE...      just these files
//   git log -p | node scripts/check-private-terms.mjs -     text from stdin
// Matches are reported by file and line, never by the term or the line's text:
// the match itself is what must not leak (into CI logs, for one).
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function loadDenylist() {
  let text = process.env.PRIVATE_TERMS;
  let source = 'the PRIVATE_TERMS variable';
  if (!text) {
    const file =
      process.env.GIRDER_PRIVATE_TERMS ||
      join(homedir(), '.config', 'hugo-theme-girder', 'private-terms.txt');
    if (!existsSync(file)) {
      console.error(
        `Private-term denylist not found: ${file}\n` +
          'Create it (one term per line), point GIRDER_PRIVATE_TERMS at it, or set PRIVATE_TERMS.',
      );
      process.exit(2);
    }
    text = readFileSync(file, 'utf8');
    source = file;
  }
  const patterns = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((term) =>
      term.startsWith('re:')
        ? new RegExp(term.slice(3), 'i')
        : // Lookarounds instead of \b, so terms may start or end with punctuation.
          new RegExp(`(?<![\\p{L}\\p{N}_])${escape(term)}(?![\\p{L}\\p{N}_])`, 'iu'),
    );
  if (!patterns.length) {
    console.error(`The private-term denylist (${source}) is empty.`);
    process.exit(2);
  }
  return patterns;
}

const patterns = loadDenylist();
let args = process.argv.slice(2);
if (!args.length) {
  args = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    encoding: 'utf8',
  })
    .split('\0')
    .filter((f) => f && existsSync(f));
}

let found = 0;
for (const name of args) {
  const data = name === '-' ? readFileSync(0) : readFileSync(name);
  // In a binary file (an image, a font) random bytes can spell a short term,
  // so only its readable runs of 8+ characters are checked, one per line:
  // that's where metadata such as an author or a place would be.
  const text = data.includes(0)
    ? (data.toString('latin1').match(/[\x20-\x7e]{8,}/g) ?? []).join('\n')
    : data.toString('utf8');
  if (name !== '-' && patterns.some((p) => p.test(name))) {
    console.log(`${name}: path matches a private term`);
    found++;
  }
  // Commits in `git log -p` output, so a match in history can be traced.
  let commit = '';
  text.split('\n').forEach((line, i) => {
    if (name === '-' && line.startsWith('commit ')) commit = line.slice(7, 19);
    if (patterns.some((p) => p.test(line))) {
      console.log(`${name}:${i + 1}${commit ? ` (commit ${commit})` : ''}: matches a private term`);
      found++;
    }
  });
}

if (found) {
  console.error(`${found} match(es). Remove the private terms above before committing.`);
  process.exit(1);
}
console.log(
  `No private terms in ${args.length === 1 && args[0] === '-' ? 'stdin' : `${args.length} files`}.`,
);
