"""Bundle a saved hydrostatics solve and Three.js into a single offline HTML file."""
import argparse
import json
import re
from pathlib import Path

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--three-js',type=Path,help='Local Three.js 0.160.0 build/three.min.js; otherwise reuse the existing HTML bundle')
args=parser.parse_args()
folder=Path(__file__).resolve().parent
data=json.loads((folder/'static-view-data.json').read_text())
template=(folder/'static-viewer.template.html').read_text()
payload=json.dumps(data,separators=(',',':')).replace('<','\\u003c')
if args.three_js:
    library=args.three_js.read_text().replace('</script','<\\/script')
else:
    previous=(folder/'static-model.html').read_text()
    match=re.search(r'<script id="three-library">(.*?)</script>',previous,re.S)
    if not match:
        raise ValueError('Pass --three-js with a local Three.js 0.160.0 library for the first build')
    library=match.group(1)
html=template.replace('__THREE_LIBRARY__',library).replace('__MODEL_DATA__',payload)
(folder/'static-model.html').write_text(html)
print(folder/'static-model.html')
