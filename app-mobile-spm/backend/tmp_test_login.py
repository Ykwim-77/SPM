import json, urllib.request, urllib.error
base='http://127.0.0.1:3000'
req = urllib.request.Request(base + '/api/auth/login', data=json.dumps({'email':'patient+1785417433864@example.com','password':'TempSenha123!'}).encode(), headers={'Content-Type':'application/json'})
try:
    with urllib.request.urlopen(req, timeout=10) as f:
        print('status', f.status)
        print(f.read().decode())
except urllib.error.HTTPError as e:
    print('status', e.code)
    print(e.read().decode())
