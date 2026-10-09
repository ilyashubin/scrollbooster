/**
 * Publish the built demo (`dist-demo/`, run `pnpm build:demo` first) to the `gh-pages` branch that GitHub Pages
 * serves. The branch gets exactly the built files, one commit per deploy that names the source commit.
 * `--dry-run` prepares the commit and prints its files without pushing.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const BRANCH = 'gh-pages';
const isDryRun = process.argv.includes('--dry-run');
const source = resolve('dist-demo');

const git = (args: string[], cwd = process.cwd()): string =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();

if (!existsSync(join(source, 'index.html'))) {
    throw new Error('dist-demo/index.html is missing, run `pnpm build:demo` first');
}
if (git(['status', '--porcelain'])) {
    throw new Error('Commit or stash local changes first: the deploy names the commit it was built from');
}

const commit = git(['rev-parse', '--short', 'HEAD']);
const worktree = mkdtempSync(join(tmpdir(), 'scrollbooster-pages-'));
git(['fetch', 'origin', BRANCH]);
git(['worktree', 'add', '-B', BRANCH, worktree, `origin/${BRANCH}`]);
try {
    git(['rm', '-rq', '--ignore-unmatch', '.'], worktree);
    cpSync(source, worktree, { recursive: true });
    // Jekyll of GitHub Pages would drop files whose names start with an underscore
    writeFileSync(join(worktree, '.nojekyll'), '');
    git(['add', '-A'], worktree);
    if (git(['status', '--porcelain'], worktree)) {
        git(['commit', '-qm', `Deploy ${commit}`], worktree);
        if (isDryRun) {
            console.log(git(['show', '--stat', '--format=%s', 'HEAD'], worktree));
        } else {
            git(['push', 'origin', BRANCH], worktree);
            console.log(`Deployed ${commit} to ${BRANCH}`);
        }
    } else {
        console.log(`${BRANCH} already has this build`);
    }
} finally {
    git(['worktree', 'remove', '--force', worktree]);
    rmSync(worktree, { recursive: true, force: true });
}
