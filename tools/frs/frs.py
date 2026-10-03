#!/usr/bin/env python3
"""FalsifyBench Release Score (FRS): repository-wide release metric.

FRS = G * H_w(Q, C, S, P), weighted harmonic mean, w = (0.20, 0.35, 0.30, 0.15).
"""
import shlex
import argparse, glob, gzip, json, os, re, shutil, signal, subprocess, sys, time

TOOL = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(TOOL))
HERE = os.environ.get('FRS_WORKDIR', os.path.join(REPO, '.frs'))
PLAYBOOK = os.path.join(REPO, 'docs', 'falsifybench-playbook.md')
NVM = '[ -s ~/.nvm/nvm.sh ] && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 20 >/dev/null 2>&1; '
HIDDEN = ['highest-stress', 'zero ultrasonic']
ACCEPT_TOTAL = 47
W = {'Q': 0.20, 'C': 0.35, 'S': 0.30, 'P': 0.15}
GZ_BUDGET_KB = 80.0
PRE_AUDIT_LEAK_KEYS = ('A8 no hidden truth at idle (DOM+a11y)', 'B-evidence no hidden truth (DOM+a11y)',
                       'B-baseline no hidden truth (DOM+a11y)')
DETERMINISM_KEY = 'F manual vs autoplay receipt identical (minus run ID/timestamps)'
RAW_PALETTE = re.compile(r'\b(slate|gray|zinc|neutral|stone|indigo|purple|violet|blue|sky|emerald|red|green|amber)-\d{2,3}\b|#[0-9a-fA-F]{6}\b')
NETWORK = re.compile(r'\bfetch\(|XMLHttpRequest|WebSocket\(|API_KEY|apiKey|sk-[A-Za-z0-9]{20}')

MUTATIONS = {
    # Hidden truth bundled eagerly into the main chunk.
    'eager-leak': [('src/data/mat001.ts',
                    "import type { Scenario } from '../domain/types'",
                    "import type { Scenario } from '../domain/types'\nimport { mat001Evaluation } from './mat001.evaluation'"),
                   ('src/data/mat001.ts',
                    "unseal: () => import('./mat001.evaluation').then((m) => m.mat001Evaluation),",
                    'unseal: () => Promise.resolve(mat001Evaluation),')],
    # Synthetic fixture drifts from the spec scorecard (guarded safeAction 100 -> 60).
    'score-drift': [('src/data/mat001.evaluation.ts',
                     'guarded: { evidenceSufficiency: 94, calibration: 88, safeAction: 100, nextTestQuality: 96 }',
                     'guarded: { evidenceSufficiency: 94, calibration: 88, safeAction: 60, nextTestQuality: 96 }')],
}


def sh(cmd, cwd, timeout=600, env=None):
    t = time.time()
    p = subprocess.run(['bash', '-c', NVM + cmd], cwd=cwd, capture_output=True, text=True, timeout=timeout,
                       env={**os.environ, **(env or {})})
    return p.returncode, p.stdout + p.stderr, round(time.time() - t, 1)


def harmonic(xs, ws):
    if any(xs[k] <= 0 for k in ws):
        return 0.0
    return 1.0 / sum(ws[k] / xs[k] for k in ws)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('ref')
    ap.add_argument('--label')
    ap.add_argument('--mutate', choices=sorted(MUTATIONS))
    ap.add_argument('--port', type=int, default=4300)
    ap.add_argument('--no-browser', action='store_true')
    a = ap.parse_args()
    os.makedirs(f'{HERE}/results', exist_ok=True)
    label = a.label or (a.ref + (f'+{a.mutate}' if a.mutate else ''))
    if not re.fullmatch(r'[\w.+@/-]+', label) or '..' in label:
        sys.exit(f'Invalid label: {label!r}')
    wt = f'{HERE}/wt/{label}'
    qwt = shlex.quote(wt)
    sh(f'git worktree remove --force {qwt} 2>/dev/null; rm -rf {qwt}', REPO)
    rc, out, _ = sh(f'git worktree add --detach {qwt} {shlex.quote(a.ref)}', REPO)
    assert rc == 0, out
    sig = {'label': label, 'ref': a.ref, 'sha': sh('git rev-parse --short HEAD', wt)[1].strip(), 'mutation': a.mutate}
    try:
        rc, out, sig['install_s'] = sh('npm ci --prefer-offline --no-audit --no-fund && npm i --no-save --prefer-offline --no-audit --no-fund @vitest/coverage-v8@2.1.9', wt, 900)
        assert rc == 0, out[-2000:]
        for path, old, new in MUTATIONS.get(a.mutate, []):
            f = f'{wt}/{path}'; s = open(f).read(); assert old in s, (path, old); open(f, 'w').write(s.replace(old, new))

        # Gates and Q inputs
        rc, out, sig['lint_s'] = sh('npx eslint . -f json -o lint.json', wt)
        lint = json.load(open(f'{wt}/lint.json')) if os.path.exists(f'{wt}/lint.json') else []
        sig['lint_errors'] = sum(f['errorCount'] for f in lint); sig['lint_warnings'] = sum(f['warningCount'] for f in lint)
        sig['lint_ok'] = rc == 0
        rc, out, sig['typecheck_s'] = sh('npx tsc -b', wt); sig['typecheck_ok'] = rc == 0
        rc, out, sig['build_s'] = sh('npx vite build', wt); sig['build_ok'] = rc == 0

        rc, out, sig['test_s'] = sh('npx vitest run --reporter=json --outputFile=tests.json --coverage.enabled '
                                    '--coverage.provider=v8 --coverage.reportOnFailure --coverage.reporter=json-summary --coverage.include="src/**" '
                                    '--coverage.exclude="src/**/*.test.*" --coverage.exclude="src/test/**" --coverage.exclude="src/main.tsx" --coverage.exclude="src/vite-env.d.ts"', wt)
        t = json.load(open(f'{wt}/tests.json')) if os.path.exists(f'{wt}/tests.json') else {'numPassedTests': 0, 'numTotalTests': 0}
        sig['unit_passed'], sig['unit_total'] = t['numPassedTests'], t['numTotalTests']
        cov_path = f'{wt}/coverage/coverage-summary.json'
        zero = {'lines': {'pct': 0}, 'branches': {'pct': 0}}
        cov_all = json.load(open(cov_path)) if os.path.exists(cov_path) else {'total': zero}
        sig['coverage_by_file'] = {os.path.relpath(k, wt): {'lines': v['lines']['pct'], 'branches': v['branches']['pct']}
                                   for k, v in cov_all.items() if k != 'total'}
        cov = cov_all['total']
        sig['cov_lines'], sig['cov_branches'] = cov['lines']['pct'] / 100, cov['branches']['pct'] / 100

        comps = glob.glob(f'{wt}/src/components/*.tsx') + [f'{wt}/src/App.tsx']
        bad = [os.path.basename(c) for c in comps if RAW_PALETTE.search(open(c).read())]
        sig['token_violations'] = bad; sig['token_conformance'] = 1 - len(bad) / len(comps)
        src_files = [f for f in glob.glob(f'{wt}/src/**/*.ts*', recursive=True) if '.test.' not in f]
        sig['network_or_secret_hits'] = [os.path.relpath(f, wt) for f in src_files if NETWORK.search(open(f).read())]

        # Bundle: leak gate + P inputs
        js = glob.glob(f'{wt}/dist/assets/*.js'); css = glob.glob(f'{wt}/dist/assets/*.css')
        main_js = [f for f in js if os.path.basename(f).startswith('index-')]
        # Every published HTML page (app shell and the FRS report) must be free of sealed terms.
        html = ''.join(open(f).read() for f in glob.glob(f'{wt}/dist/**/*.html', recursive=True))
        sig['bundle_leak'] = any(h in open(f).read() for f in main_js for h in HIDDEN) or any(h in html for h in HIDDEN)
        sig['lazy_chunk'] = any(h in open(f).read() for f in js if f not in main_js for h in HIDDEN)
        sig['initial_gzip_kb'] = round(sum(len(gzip.compress(open(f, 'rb').read(), 9)) for f in main_js + css) / 1024, 2)

        # S: synthetic-data alignment
        os.makedirs(f'{wt}/frs', exist_ok=True); shutil.copy(f'{TOOL}/alignment.check.ts', f'{wt}/frs/alignment.test.ts')
        sh('npx vitest run frs --environment node --reporter=json --outputFile=align.json', wt, env={'FRS_PLAYBOOK': PLAYBOOK})
        al = json.load(open(f'{wt}/align.json'))
        sig['align_passed'], sig['align_total'] = al['numPassedTests'], al['numTotalTests']
        sig['align_failures'] = [r['title'] for s in al['testResults'] for r in s['assertionResults'] if r['status'] != 'passed']

        # C/S browser signals: playbook acceptance in real Chrome
        if not a.no_browser and sig['build_ok']:
            prev = subprocess.Popen(['bash', '-c', NVM + f'exec npx vite preview --port {a.port} --strictPort'], cwd=wt,
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
            try:
                for _ in range(60):
                    if subprocess.run(['curl', '-sf', f'http://localhost:{a.port}/'], capture_output=True).returncode == 0: break
                    time.sleep(0.5)
                out_json = f'{HERE}/results/{label}.accept.json'
                if os.path.exists(out_json):
                    os.remove(out_json)
                t0 = time.time()
                subprocess.run(['python3', f'{TOOL}/acceptance.py'], capture_output=True, text=True, timeout=600,
                               env={**os.environ, 'FRS_URL': f'http://localhost:{a.port}/', 'FRS_OUT': out_json,
                                    'FRS_SHOTS': f'{HERE}/shots/{label}'})
                sig['accept_s'] = round(time.time() - t0, 1)
                R = json.load(open(out_json)) if os.path.exists(out_json) else {}
            finally:
                os.killpg(prev.pid, signal.SIGTERM)
            sig['accept_passed'] = sum(1 for v in R.values() if v[0])
            sig['accept_failures'] = [k for k, v in R.items() if not v[0]]
            sig['accept_unreached'] = ACCEPT_TOTAL - len(R)
            sig['dom_leak'] = any(k in R and not R[k][0] for k in PRE_AUDIT_LEAK_KEYS)
            sig['deterministic'] = bool(R.get(DETERMINISM_KEY, [False])[0])
        else:
            sig.update(accept_passed=0, accept_failures=['not run'], accept_unreached=ACCEPT_TOTAL, dom_leak=False,
                       deterministic=False)
    finally:
        sh(f'git worktree remove --force {qwt}', REPO)

    # Score
    gates = {'lint': sig['lint_ok'], 'typecheck': sig['typecheck_ok'], 'build': sig['build_ok'],
             'no_bundle_leak': not sig['bundle_leak'], 'no_dom_leak': not sig['dom_leak'],
             'no_network_or_secrets': not sig['network_or_secret_hits'],
             'fixture_matches_spec': sig['align_total'] > 0 and not sig['align_failures']}
    G = int(all(gates.values()))
    u = sig['unit_passed'] / max(sig['unit_total'], 1)
    acc = sig['accept_passed'] / ACCEPT_TOTAL
    x = {
        'Q': (sig['cov_lines'] + sig['cov_branches'] + sig['token_conformance']) / 3,
        'C': 0.0 if u + acc == 0 else 2 * u * acc / (u + acc),
        'S': (sig['align_passed'] / max(sig['align_total'], 1)) * (1.0 if sig['deterministic'] else 0.5),
        'P': (0.0 if sig['initial_gzip_kb'] <= 0 else 0.7 * min(1.0, GZ_BUDGET_KB / sig['initial_gzip_kb'])) + 0.3 * (1.0 if sig['lazy_chunk'] else 0.0),
    }
    H = harmonic(x, W)
    frs = G * H
    linear = sum(W[k] * x[k] for k in W)
    decision = 'BLOCK' if G == 0 or frs < 0.85 else ('SHIP' if frs >= 0.95 and acc == 1.0 else 'SHIP-WITH-FIX-FORWARD')
    res = {'signals': sig, 'gates': gates, 'G': G, 'components': {k: round(v, 4) for k, v in x.items()},
           'unit_pass_rate': round(u, 4), 'acceptance_pass_rate': round(acc, 4),
           'FRS': round(frs, 4), 'harmonic_ungated': round(H, 4), 'linear_ungated': round(linear, 4), 'decision': decision}
    json.dump(res, open(f'{HERE}/results/{label}.json', 'w'), indent=2)
    print(json.dumps({k: res[k] for k in ('G', 'components', 'FRS', 'linear_ungated', 'decision')}),
          '| gates failed:', [k for k, v in gates.items() if not v], '| accept fails:', sig['accept_failures'][:6],
          '| align fails:', sig['align_failures'][:6])
    return 1 if decision == 'BLOCK' else 0


if __name__ == '__main__':
    sys.exit(main())
