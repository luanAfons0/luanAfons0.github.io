# Joins dungeon-screens.html and dungeon-frame.js into the single-file Artifact mock.
import re
s=open('parts/dungeon-screens.html').read(); js=open('parts/dungeon-frame.js').read()
s=s.replace('/*GAME_FRAME_JS*/', js.replace('</script','<\\/script'))
s=re.sub(r'<!doctype html>\s*<html[^>]*>\s*<head>\s*','',s,flags=re.I)
s=s.replace('<meta charset="UTF-8" />\n','').replace('<meta name="viewport" content="width=device-width, initial-scale=1" />\n','')
s=s.replace('<title>Dungeon Theme</title>','<title>Dungeon Theme</title>\n<meta name="claude:viewport-fit-sides" content="cover" />')
s=re.sub(r'</head>\s*<body>','<div class="mock-root">',s)
s=re.sub(r'</body>\s*</html>\s*$','</div>\n',s)
s=s.replace('html, body { margin: 0; }','html, body { margin: 0; background: #141611; }')
s=s.replace('\tposition: sticky; top: 0; z-index: 10;','\tposition: sticky; top: env(safe-area-inset-top, 0px); z-index: 10;')
s=s.replace('\tpadding: 10px 16px;\n\tbackground: var(--mock-bar);','\tpadding-block: 10px;\n\tpadding-left: max(16px, env(safe-area-inset-left, 0px));\n\tpadding-right: max(16px, env(safe-area-inset-right, 0px));\n\tbackground: var(--mock-bar);')
s=s.replace('.stage-wrap { display: grid; place-items: center; padding: 24px 16px 48px; }','.stage-wrap { display: grid; place-items: center; padding-block: 24px 48px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }\nbody::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--mock-bar); }')
open('dungeon.html','w').write(s)
