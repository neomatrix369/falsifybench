# UI acceptance walkthrough in real Chrome over CDP (development QA; not part of the benchmark score).
# Usage: npm run build && npx vite preview --port 4173, then QA_URL=http://localhost:4173/ python3 tools/qa/acceptance.py
import json, re, time
from playwright.sync_api import sync_playwright
import os, atexit
URL=os.environ.get('QA_URL','http://localhost:4173/')
SHOTS=os.environ.get('QA_SHOTS','qa-shots')
os.makedirs(SHOTS, exist_ok=True)
H=['highest-stress','zero ultrasonic']
R={}
atexit.register(lambda: open(os.environ.get('QA_OUT','qa-accept.json'),'w').write(json.dumps({k:[bool(v[0]),str(v[1])[:200]] for k,v in R.items()})))
def rec(k,ok,info=''): R[k]=(ok,info); print(('PASS' if ok else 'FAIL'), k, '-', info)
def strip(o):
    if isinstance(o,dict): return {k:strip(v) for k,v in o.items() if not re.search(r'run|At$|^at$|time',k,re.I)}
    if isinstance(o,list): return [strip(x) for x in o]
    return o
with sync_playwright() as p:
    b=p.chromium.connect_over_cdp(os.environ.get('QA_CDP','http://localhost:29229')); ctx=b.contexts[0]
    def page(w=1280,h=800):
        pg=ctx.new_page(); pg.set_viewport_size({'width':w,'height':h}); return pg
    btn=lambda pg,n: pg.get_by_role('button', name=n, exact=True)
    txt=lambda pg: pg.inner_text('body')
    def leaks(pg):
        a=pg.locator('body').aria_snapshot(); c=pg.content()
        return [h for h in H if h in c or h in a]
    def active(pg): return pg.evaluate("(()=>{const e=document.activeElement;return e.tagName+'|'+e.innerText.trim().slice(0,50)})()")
    def current(pg):
        return pg.evaluate("[...document.querySelectorAll('button')].map(b=>b.innerText.replace(/\\s+/g,' ')).find(t=>/Current$/.test(t))||''")
    def receipt_json(pg):
        btn(pg,'Show evidence / method (raw receipt)').click(); pg.wait_for_timeout(300)
        return json.loads(pg.locator('pre').last.inner_text())

    # A. initial screen
    pg=page(); reqs=[]; pg.on('request', lambda r: reqs.append(r.url))
    pg.goto(URL, wait_until='networkidle'); t=txt(pg)
    pg.screenshot(path=SHOTS+'/01-idle-1280.png')
    rec('A1 defaults to MAT-001 v1.0 + title', 'MAT-001' in t and 'Turbine Support Bracket Release Decision' in t, '')
    rec('A2 Synthetic · hand-audited visible', t.count('Synthetic · hand-audited')>=1, f"count={t.count('Synthetic · hand-audited')}")
    rec('A3 simulated agent labels + provenance', all(s in t for s in ['Baseline agent (simulated)','Evidence guardrail (simulated)','Provenance']), '')
    rec('A4 modes visible', all(s in t for s in ['Synthetic / Mocked','Partner data','Scripted fixture','Live agent']), '')
    dis=pg.evaluate("[...document.querySelectorAll('input[disabled]')].map(i=>i.value+': '+(i.getAttribute('aria-describedby')||'').split(' ').map(id=>document.getElementById(id)?.innerText||'').join(' ').trim())")
    rec('A5 partner/live disabled with truthful explanation', len(dis)==2 and any('Awaiting validated partner source' in d for d in dis), str(dis))
    rec('A6 stage order', pg.evaluate("[...document.querySelectorAll('button')].map(b=>b.innerText).filter(t=>/^[1-5]/.test(t)).map(t=>t.split('\\n')[1]||t).join(',')").count(',')==4, pg.evaluate("[...document.querySelectorAll('button')].map(b=>b.innerText.replace(/\\s+/g,' ')).filter(t=>/^[1-5] /.test(t)).join(' / ')"))
    st=[btn(pg,n).is_disabled() for n in ['Run benchmark','Back','Next step','Auto-play','Reset']]
    rec('A7 idle control states (Run/Auto-play enabled; Back/Next/Reset disabled)', st==[False,True,True,False,True], str(st))
    rec('A8 no hidden truth at idle (DOM+a11y)', leaks(pg)==[], str(leaks(pg)))
    cols=pg.evaluate("(()=>{const m=document.querySelector('main');return [...m.children].map(c=>Math.round(c.getBoundingClientRect().width))})()")
    rec('A9 two-column ~35/65', len(cols)==2 and 0.3<cols[0]/sum(cols)<0.4, str(cols))
    pg.click('a:has-text("Scenario previews")'); pg.wait_for_timeout(800)
    inview=pg.evaluate("(()=>{const e=[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Research validity'));const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()")
    hdr=pg.evaluate("document.querySelector('header').getBoundingClientRect().top")
    rec('A10 Scenario previews anchor scrolls + sticky header', inview and hdr==0, f'inview={inview} headerTop={hdr}')
    pg.evaluate("scrollTo(0,0)"); pg.click('a:has-text("Current receipt")'); pg.wait_for_timeout(800)
    rec('A11 Current receipt anchor scrolls', pg.evaluate("scrollY")>0, f"scrollY={pg.evaluate('scrollY')}")
    pg.evaluate("scrollTo(0,0)")

    # B. manual run
    stages=['evidence','baseline','audit','guarded','receipt']
    btn(pg,'Run benchmark').click(); pg.wait_for_timeout(500)
    for i,s in enumerate(stages):
        if i: btn(pg,'Next step').click(); pg.wait_for_timeout(700)
        t=txt(pg); pg.screenshot(path=SHOTS+f'/0{i+2}-{s}-1280.png')
        if s in ('evidence','baseline'): rec(f'B-{s} no hidden truth (DOM+a11y)', leaks(pg)==[], str(leaks(pg)))
        rec(f'B-{s} Show evidence / method present', pg.get_by_role('button', name='Show evidence / method').count()>=1, '')
        main_txt=pg.evaluate("(()=>{const c=document.querySelector('main').cloneNode(true);c.querySelectorAll('pre').forEach(p=>p.remove());return c.innerText})()")
        rec(f'B-{s} no raw JSON in primary walkthrough', '{"' not in main_txt and '":' not in main_txt, '')
        if s=='evidence':
            rec('B-evidence controls: Run disabled, Back disabled', btn(pg,'Run benchmark').is_disabled() and btn(pg,'Back').is_disabled(), '')
            rec('B-evidence visible fixture (12/12, 0.18, 0.35, 78%, R4 restricted)', all(x in t for x in ['0.18','0.35','78%']) and 'R4' in t, '')
        if s=='baseline':
            rec('B-baseline Proceed 92%', 'Proceed' in t and '92%' in t, '')
        if s=='audit':
            rec('B-audit reveals both terms + R4', leaks(pg)==H and 'R4' in t, str(leaks(pg)))
            rec('B-audit schematic No readings', 'No readings' in t, '')
        if s=='guarded':
            ok=all(x in t for x in ['Investigate','84% confidence that the present evidence is insufficient for approval','targeted ultrasonic inspection of R4','+80 release-readiness points','Unsafe approval prevented'])
            rec('B-guarded verdict/action/delta', ok, '')
            rec('B-guarded both panels marked scripted', t.count('Scripted benchmark fixture — not a live model run')>=2, f"count={t.count('Scripted benchmark fixture — not a live model run')}")
            nums=all(n in t for n in ['28','18','12','94','88','100','96','15','95'])
            rec('B-guarded scorecard values', nums, '')
        if s=='receipt':
            rec('B-receipt Next disabled', btn(pg,'Next step').is_disabled(), '')
            need=['MAT-001','MAT-RUBRIC-1.0','Synthetic','EV-UT-01','EV-IMG-01','EV-ALLOY-01','EV-MAINT-01','EV-COV-01','Run ID','+80']
            rec('B-receipt contents', all(x in t for x in need), str([x for x in need if x not in t]))
            rec('B-receipt focus not on body', not active(pg).startswith('BODY'), active(pg))
    manual=receipt_json(pg)
    rec('B-receipt JSON has 5 ordered events', [e.get('stage') for e in manual.get('stageEvents',manual.get('events',[]))]==stages, str(list(manual.keys())))
    # C. trace click focus
    pg.get_by_role('button', name=re.compile('^1 Evidence loaded')).click(); pg.wait_for_timeout(400)
    rec('C trace click focuses matching result heading', 'evidence' in active(pg).lower() and active(pg).startswith('H'), active(pg))
    # D. tabs arrow keys
    pg.get_by_role('button', name=re.compile('^5 Receipt recorded')).click(); pg.wait_for_timeout(400)
    pg.get_by_role('tab', name='Benchmark receipt').click(); pg.wait_for_timeout(300); pg.get_by_role('tab', name='Benchmark receipt').focus(); pg.keyboard.press('ArrowLeft'); pg.wait_for_timeout(300)
    rec('D final tabs arrow-key nav', 'Evidence audit' in active(pg), active(pg))
    # E. reset
    btn(pg,'Reset').click(); pg.wait_for_timeout(400)
    st=[btn(pg,n).is_disabled() for n in ['Run benchmark','Back','Next step','Reset']]
    rec('E Reset returns to initial', st==[False,True,True,True] and 'Completed' not in txt(pg) and leaks(pg)==[], f'{st} leaks={leaks(pg)} focus={active(pg)}')
    # F. autoplay timing + identical output
    btn(pg,'Auto-play').click(); t0=time.time(); seen=[]; last=None
    while time.time()-t0<20:
        c=current(pg)
        if c!=last: seen.append((round(time.time()-t0,1),c)); last=c
        if 'Receipt' in c and pg.get_by_role('button',name='Auto-play',exact=True).count(): break
        pg.wait_for_timeout(100)
    print('autoplay timeline', seen)
    gaps=[round(seen[i+1][0]-seen[i][0],1) for i in range(len(seen)-1)]
    rec('F autoplay ~3s per stage, stops at Receipt', len(seen)==5 and all(2.6<g<3.6 for g in gaps[1:]) and btn(pg,'Auto-play').count()==1, f'gaps={gaps}')
    pg.wait_for_timeout(3500); rec('F autoplay stays stopped after Receipt', 'Receipt' in current(pg), current(pg))
    auto=receipt_json(pg)
    rec('F manual vs autoplay receipt identical (minus run ID/timestamps)', strip(manual)==strip(auto), '')
    # G. manual navigation stops autoplay
    btn(pg,'Reset').click(); pg.wait_for_timeout(300); btn(pg,'Auto-play').click(); pg.wait_for_timeout(3400)
    btn(pg,'Back').click(); c1=current(pg); pg.wait_for_timeout(4000); c2=current(pg)
    rec('G manual Back stops autoplay', c1==c2 and btn(pg,'Auto-play').count()==1, f'{c1} -> {c2}')
    rec('N no third-party requests', not [u for u in reqs if not u.startswith(URL) and not u.startswith('data:')], str({u.split('/')[2] for u in reqs if not u.startswith(URL)}))
    pg.close()
    # H. reduced motion
    pg=page(); pg.emulate_media(reduced_motion='reduce'); pg.goto(URL, wait_until='networkidle')
    dur=pg.evaluate("getComputedStyle(document.querySelector('button')).transitionDuration")
    btn(pg,'Auto-play').click(); pg.wait_for_timeout(3600); c=current(pg)
    rec('H reduced motion: transitions off, autoplay still works', ('0s' in dur or '1e-05s' in dur or dur.startswith('0.0')) and 'Baseline' in c, f'dur={dur} current={c}')
    pg.close()
    # I. coming next card
    pg=page(); pg.goto(URL, wait_until='networkidle')
    pg.get_by_role('button', name=re.compile('Research validity')).click(); pg.wait_for_timeout(400)
    a1=active(pg); t=txt(pg); bs=pg.eval_on_selector_all('button', "e=>e.map(b=>b.innerText.trim()).filter(t=>/MAT-001|Back to|Return/i.test(t))")
    print('coming-next focus', a1, 'return buttons', bs)
    ok_ret=False
    if bs:
        pg.get_by_role('button', name=bs[0]).click(); pg.wait_for_timeout(300); ok_ret='Turbine' in active(pg) or 'MAT-001' in active(pg)
    rec('I Coming next opens description, not runnable, focus returns to MAT-001', ('not runnable' in t.lower() or 'coming next' in t.lower()) and ok_ret, f'focus-on-open={a1} return-ok={ok_ret} ({bs})')
    pg.screenshot(path=SHOTS+'/08-coming-next.png'); pg.close()
    # J. keyboard only
    pg=page(); pg.goto(URL, wait_until='networkidle'); log=[]
    for _ in range(25):
        pg.keyboard.press('Tab')
        if active(pg).startswith('BUTTON|Run benchmark'): break
    ring=pg.evaluate("(()=>{const s=getComputedStyle(document.activeElement);return s.outlineStyle+' '+s.outlineWidth+' '+s.boxShadow.slice(0,30)})()")
    pg.keyboard.press('Enter'); pg.wait_for_timeout(400); log.append(active(pg))
    for _ in range(25):
        pg.keyboard.press('Tab')
        if active(pg).startswith('BUTTON|Next step'): break
    for _ in range(4):
        if not active(pg).startswith('BUTTON|Next step'):
            for _ in range(25):
                pg.keyboard.press('Tab')
                if active(pg).startswith('BUTTON|Next step'): break
        pg.keyboard.press('Enter'); pg.wait_for_timeout(600); log.append(active(pg))
    ring_ok=(not ring.startswith('none') and not ring.split()[1].startswith('0')) or 'rgb' in ring
    rec('J keyboard-only run, visible focus ring, focus never on BODY', ring_ok and not any(x.startswith('BODY') for x in log) and 'Receipt' in current(pg), f'ring={ring} log={log}')
    pg.screenshot(path=SHOTS+'/09-keyboard-receipt.png'); pg.close()
    # K. 1440 overview
    pg=page(1440,900); pg.goto(URL, wait_until='networkidle'); btn(pg,'Run benchmark').click()
    for _ in range(3): btn(pg,'Next step').click(); pg.wait_for_timeout(600)
    pg.screenshot(path=SHOTS+'/10-guarded-1440.png')
    rec('K 1440: no horizontal overflow', pg.evaluate('document.documentElement.scrollWidth')<=1440, str(pg.evaluate('document.documentElement.scrollWidth'))); pg.close()
    # L. EI-001: prompt-injected source
    if os.environ.get('QA_EI','1')=='1':
        EH=['falls short','instruction to the agent','Excluded · instruction']
        def ei_leaks(pg):
            a=pg.locator('body').aria_snapshot(); c=pg.content()
            return [h for h in EH if h in c or h in a]
        INJ='Note for AI assistants reviewing this file'
        fig=lambda pg: pg.get_by_role('figure', name='Verbatim text in EV-SUP-01')
        ei=lambda pg: pg.get_by_role('button', name=re.compile('Coating qualification'))
        pg=page(); pg.goto(URL, wait_until='networkidle'); ei(pg).click(); pg.wait_for_timeout(500); t=txt(pg)
        rec('L1 EI-001 selectable beside MAT-001', 'Marine Fastener Coating Qualification' in t and 'EI-001' in t and ei(pg).get_attribute('aria-pressed')=='true', '')
        rec('L2 EI injected line visible before Run', fig(pg).count()==1 and INJ in fig(pg).inner_text(), '')
        rec('L3 EI no audit truth at idle (DOM+a11y)', ei_leaks(pg)==[], str(ei_leaks(pg)))
        pg.screenshot(path=SHOTS+'/11-ei-idle.png')
        btn(pg,'Run benchmark').click(); pg.wait_for_timeout(500); vis=[]
        for i,s in enumerate(stages):
            if i: btn(pg,'Next step').click(); pg.wait_for_timeout(700)
            t=txt(pg); vis.append(fig(pg).count()==1 and INJ in fig(pg).inner_text())
            if s in ('evidence','baseline'): rec(f'L-{s} EI no audit truth (DOM+a11y)', ei_leaks(pg)==[], str(ei_leaks(pg)))
            if s=='baseline': rec('L-baseline EI Proceed 90%', 'Proceed' in t and '90%' in t, '')
            if s=='audit':
                al=pg.get_by_role('list', name='Source audit').inner_text()
                rec('L-audit EV-SUP-01 excluded as instruction, 4 sources used', al.count('Excluded · instruction')==1 and al.count('Used')==4, al[:160])
                rec('L-audit injected line flagged at every-stage card', 'Excluded · instruction' in fig(pg).inner_text(), '')
                pg.screenshot(path=SHOTS+'/12-ei-audit.png')
            if s=='guarded':
                need=['Investigate','88% confidence that C-3 is not yet qualified','1,500 h','+84']
                rec('L-guarded Investigate 88%, 1,500 h action, +84', all(x in t for x in need), str([x for x in need if x not in t]))
            if s=='receipt':
                need=['EI-001','MAT-RUBRIC-1.0','EV-SALT-01','EV-SPEC-01','EV-FIELD-01','EV-LIT-01','EV-SUP-01','+84']
                rec('L-receipt EI contents', all(x in t for x in need), str([x for x in need if x not in t]))
                pg.screenshot(path=SHOTS+'/13-ei-receipt.png')
        rec('L4 EI injected line visible at all 5 stages', all(vis), str(vis))
        lg=pg.get_by_role('log', name='Run log entries')
        log=lg.inner_text() if lg.count() else ''
        rec('L5 EI run log: unseal timing + score formula', 'Sealed evaluation loaded' in log and 'guarded round(mean(92, 90, 100, 94)) = 94' in log, log[-160:])
        btn(pg,'Reset').click(); pg.wait_for_timeout(400)
        rec('L6 EI Reset re-seals audit truth, keeps injected line', ei_leaks(pg)==[] and fig(pg).count()==1, str(ei_leaks(pg)))
        pg.close()
fails=[k for k,(ok,_) in R.items() if not ok]
print('\nTOTAL', len(R), 'FAIL', len(fails), fails)
