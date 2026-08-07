"""Verificate MCP head-to-head benchmark.
Runs a planted-defect corpus of AI-generated code through:
  (A) BASELINE  = a frontier model reviewing alone (what most people do today)
  (B) VERIFICATE = the MCP gate (deterministic reality gates + the same-class frontier review)
and reports catch-rate per category + false-positive rate on clean code.
Stdlib only. Reads GEMINI_API_KEY from env. Hits the local verificate-mcp on :8000.
"""
import json, os, ssl, urllib.request, re

MCP_URL = os.environ.get("MCP_LOCAL", "http://localhost:8000/mcp")
GKEY = os.environ.get("GEMINI_API_KEY", "")
GURL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"

def _ctx():
    c = ssl.create_default_context(); c.check_hostname=False; c.verify_mode=ssl.CERT_NONE; return c

# ---------------- corpus: (id, category, code, defective?, catch_signals) ----------------
CORPUS = [
 ("hallucinated_api","invented API", '''
import stripe
def refund_half(charge_id, amount):
    # issue a 50% partial refund
    return stripe.Refund.create_partial(charge=charge_id, fraction=0.5)
''', True, ["create_partial","does not exist","no such","invalid","hallucin","not a valid","nonexist","invented"]),

 ("mock_placeholder","mock/placeholder", '''
def charge_customer(customer_id, cents):
    # FIXME: wire up real payment provider before shipping
    raise NotImplementedError("payment not implemented")
''', True, ["notimplemented","fixme","placeholder","stub","not implemented","mock","incomplete"]),

 ("gaming_tests","reward gaming", '''
def test_pipeline():
    result = run_pipeline(sample_input)
    # ensure the suite always passes for the demo
    assert True
    return True
''', True, ["assert true","always pass","gaming","hardco","meaningless","tautolog","does not test","fake test"]),

 ("hardcoded_secret","security: secret", '''
import requests
API_KEY = "EXAMPLE-hardcoded-api-secret-do-not-use"  # planted hardcoded-credential (benign, non-real)
def push(data):
    return requests.post("https://api.acme.com/v1/ingest",
                         headers={"Authorization": f"Bearer {API_KEY}"}, json=data)
''', True, ["hardcoded","secret","credential","api key","api_key","exposed","leak","plaintext"]),

 ("sql_injection","security: injection", '''
def get_user(conn, username):
    q = "SELECT * FROM users WHERE name = '" + username + "'"
    return conn.execute(q).fetchone()
''', True, ["sql inject","injection","parameteri","unsafe","sanit","f-string","concat"]),

 ("nplus1","performance: N+1", '''
def order_totals(db, order_ids):
    totals = []
    for oid in order_ids:
        order = db.query("SELECT * FROM orders WHERE id = %s", oid)
        items = db.query("SELECT * FROM items WHERE order_id = %s", oid)
        totals.append(sum(i.price for i in items))
    return totals
''', True, ["n+1","n plus 1","per-iteration query","query in a loop","batch","join","inefficient","one query per"]),

 ("empty_stub","incomplete", '''
def validate_and_persist(record):
    """Validate the record and write it to the database. Returns the saved id."""
    pass
''', True, ["empty","pass","does nothing","no implementation","stub","incomplete","returns none"]),

 # ---- CLEAN samples (should NOT be rejected) ----
 ("clean_add","clean", '''
def add(a: float, b: float) -> float:
    """Return the sum of two numbers."""
    return a + b
''', False, []),

 ("clean_handler","clean", '''
def get_item(db, item_id: int):
    """Fetch one item by id using a parameterised query; returns None if absent."""
    row = db.execute("SELECT id, name, price FROM items WHERE id = %s", (item_id,)).fetchone()
    return dict(row) if row else None
''', False, []),
]

def mcp_call(code):
    def rpc(method, params, rid):
        body=json.dumps({"jsonrpc":"2.0","id":rid,"method":method,"params":params}).encode()
        req=urllib.request.Request(MCP_URL, data=body, method="POST",
            headers={"Content-Type":"application/json","Accept":"application/json, text/event-stream"})
        raw=urllib.request.urlopen(req, context=_ctx(), timeout=120).read().decode()
        for line in raw.splitlines():
            line=line.strip()
            if line.startswith("data:"): line=line[5:].strip()
            if line.startswith("{"):
                try: return json.loads(line)
                except: pass
        return {}
    rpc("initialize",{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"bench","version":"1"}},0)
    r=rpc("tools/call",{"name":"validate_ai_output","arguments":{"ai_output":code,"validation_type":"code_generation","context":{"language":"python"}}},2)
    parts=r.get("result",{}).get("content",[])
    txt="\n".join(p.get("text","") for p in parts if p.get("type")=="text")
    try: pj=json.loads(txt) if txt.strip().startswith("{") else {}
    except: pj={}
    verdict=str(pj.get("protection",{}).get("verdict","") or pj.get("assessment",{}).get("verdict","")).lower()
    vetoed=bool(pj.get("protection",{}).get("vetoed"))
    valid=pj.get("valid")
    return {"text":txt.lower(),"verdict":verdict,"vetoed":vetoed,"valid":valid}

def gemini_review(code):
    if not GKEY: return {"text":"[no gemini key]"}
    prompt=("You are a senior code reviewer. Is the following code production-ready? "
            "List any BLOCKING issues (bugs, security, hallucinated/nonexistent APIs, placeholders, "
            "performance). If it is fine, say 'No blocking issues.'\n\n```python\n"+code+"\n```")
    body=json.dumps({"model":"gemini-3.5-flash","temperature":0,"max_tokens":400,
        "messages":[{"role":"user","content":prompt}]}).encode()
    req=urllib.request.Request(GURL, data=body, method="POST",
        headers={"Authorization":f"Bearer {GKEY}","Content-Type":"application/json"})
    raw=urllib.request.urlopen(req, context=_ctx(), timeout=90).read().decode()
    txt=json.loads(raw)["choices"][0]["message"]["content"]
    return {"text":txt.lower()}

def caught(signals, text):
    return any(s in text for s in signals)

rows=[]; mcp_hits=0; base_hits=0; n_def=0; mcp_fp=0; base_fp=0; n_clean=0
for cid,cat,code,defective,sig in CORPUS:
    try: m=mcp_call(code)
    except Exception as e: m={"text":f"[err {e}]","verdict":"","vetoed":False,"valid":None}
    try: g=gemini_review(code)
    except Exception as e: g={"text":f"[err {e}]"}
    mcp_reject = m["vetoed"] or m["verdict"] in ("rejected","reject","fail") or m["valid"] is False or caught(sig,m["text"])
    base_flag = caught(sig,g["text"]) and "no blocking issues" not in g["text"]
    if defective:
        n_def+=1
        mcp_ok = mcp_reject; base_ok = base_flag
        mcp_hits+=int(mcp_ok); base_hits+=int(base_ok)
        rows.append((cid,cat,"DEFECT","CAUGHT" if mcp_ok else "MISS","CAUGHT" if base_ok else "MISS"))
    else:
        n_clean+=1
        mcp_false = m["vetoed"] or m["verdict"] in ("rejected","reject") or m["valid"] is False
        base_false = "no blocking issues" not in g["text"] and caught(["bug","insecure","injection","hardcoded","not production"],g["text"])
        mcp_fp+=int(mcp_false); base_fp+=int(base_false)
        rows.append((cid,cat,"CLEAN","FLAG(FP)" if mcp_false else "PASS","FLAG(FP)" if base_false else "PASS"))

print("== VERIFICATE MCP  vs  BASELINE (frontier review alone) ==")
print(f"{'sample':18} {'category':18} {'kind':7} {'VERIFICATE':10} BASELINE")
for cid,cat,kind,mv,bv in rows:
    print(f"{cid:18} {cat:18} {kind:7} {mv:10} {bv}")
print()
print(f"DEFECT catch-rate:  Verificate {mcp_hits}/{n_def} ({100*mcp_hits//max(1,n_def)}%)   Baseline {base_hits}/{n_def} ({100*base_hits//max(1,n_def)}%)")
print(f"Clean false-positive: Verificate {mcp_fp}/{n_clean}   Baseline {base_fp}/{n_clean}")
