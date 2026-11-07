"""Offline browser smoke check. Uses set_content because navigation is restricted in the test container."""
import base64,re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
html=(ROOT/'index.html').read_text()
html=re.sub(r'<script src="\./app\.js" defer></script>','',html)
html=re.sub(r'<link rel="stylesheet" href="\./styles\.css">','',html)
css=(ROOT/'styles.css').read_text()
js=(ROOT/'app.js').read_text()
b64=base64.b64encode((ROOT/'data/incidents.json.gz').read_bytes()).decode()
analytics_b64=base64.b64encode((ROOT/'data/analytics.json').read_bytes()).decode()

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,**({'executable_path':'/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}),args=['--no-sandbox'])
    for name,width,height in [('desktop',1440,900),('tablet',950,900),('mobile',390,844)]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(html,wait_until='domcontentloaded')
        page.add_style_tag(content=css)
        page.evaluate('''encoded=>{
            window.__incidentB64=encoded;
        }''',b64)
        page.evaluate('''encoded=>{
            window.__analyticsB64=encoded;
            window.fetch=async(url)=>{
                const data=String(url).includes('analytics.json')?window.__analyticsB64:window.__incidentB64;
                return new Response(Uint8Array.from(atob(data),c=>c.charCodeAt(0)),{status:200});
            };
        }''',analytics_b64)
        page.add_script_tag(content=js)
        page.locator('.kpi').first.wait_for(timeout=30000)
        assert page.locator('.history-chart').count()==1, 'SQL backlog chart should be visible'
        print(name,'title',page.title(),'KPIs',page.locator('.kpi').count(),'nav',page.locator('.nav-link').count(),'overflow',page.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth'))
        if name=='desktop':
            page.screenshot(path=str(ROOT/'docs/desktop-overview.png'),full_page=True)
            assert page.locator('.analytical-table tbody tr').count()>=5
            page.locator('.analytical-table .incident-link').first.click()
            assert page.locator('.investigation-chip').count()==1
            assert 'Resolver team' in page.locator('.investigation-chip').inner_text() or len(page.locator('.investigation-chip').inner_text())>10
            page.locator('[data-action="reset"]').last.click()
            page.locator('[data-page="incidents"]').click()
            assert page.locator('.table tbody tr').count()>0
            page.locator('#search-incidents').fill('VPN')
            print('  searched VPN',page.locator('.pagination').inner_text())
            page.locator('.incident-link').first.click()
            assert page.locator('.timeline-item').count()>=3
            page.screenshot(path=str(ROOT/'docs/desktop-detail.png'),full_page=True)
            page.locator('[data-page="sla"]').first.click()
            assert page.locator('.rule-card').count()==4
            assert page.locator('#policy-hours').count()==1
            page.locator('#policy-hours').fill('12')
            page.locator('#policy-hours').dispatch_event('change')
            assert '12h' in page.locator('.policy-result').inner_text()
            page.locator('[data-page="insights"]').click()
            assert page.locator('.issue-item').count()>0
            assert page.locator('.analytical-table').count()==1
            page.locator('.issue-link').first.click()
            assert page.locator('.investigation-chip').count()==1
            page.locator('[data-page="quality"]').click()
            assert page.locator('.check-row').count()==7
            assert page.locator('.analytical-table tbody tr').count()==7
            assert page.locator('.analytical-table .pill.good').count()==7
            print('  quality',page.locator('.kpi-value').all_inner_texts())
            page.screenshot(path=str(ROOT/'docs/desktop-quality.png'),full_page=True)
        if name=='mobile':
            page.screenshot(path=str(ROOT/'docs/mobile-overview.png'),full_page=True)
            page.locator('.menu-button').click()
            assert page.locator('.sidebar').evaluate('(el)=>el.classList.contains("open")')
            page.locator('[data-page="incidents"]').click()
            assert page.locator('.incident-link').count()>0
            page.screenshot(path=str(ROOT/'docs/mobile-incidents.png'),full_page=True)
        print('  errors:',errors)
        assert not errors,errors
        assert page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth+4')
        page.close()
    browser.close()
print('All offline browser checks passed.')
