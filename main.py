import os, json, uuid, urllib.request, urllib.parse, xml.etree.ElementTree as ET
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

app = FastAPI(title="Jarvis Shahrooz API")
allowed = os.getenv("ALLOWED_ORIGIN", "*")
app.add_middleware(CORSMiddleware, allow_origins=[x.strip() for x in allowed.split(",")], allow_credentials=False, allow_methods=["GET","POST"], allow_headers=["*"])
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
MEMORY = Path(os.getenv("MEMORY_DIR", "memory"))
MEMORY.mkdir(exist_ok=True)
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

SYSTEM = """تو جارویس، دستیار هوشمند فارسی و اختصاصی شهروز هستی. با صدای نوشتاری مردانه، فارسی روان، محترمانه، کوتاه و دقیق جواب بده و گاهی کاربر را «قربان» خطاب کن. اگر پرسید چه کسی تو را ساخته، دقیقاً بگو: «شهروز منو ساخته.» هرگز ادعا نکن انسان هستی یا به امکاناتی دسترسی داری که واقعاً نداری. از یادداشت‌های حافظه فقط وقتی مرتبط است استفاده کن."""
class AskBody(BaseModel):
    question: str
class RememberBody(BaseModel):
    note: str

def load_memories():
    if SUPABASE_URL and SUPABASE_KEY:
        req=urllib.request.Request(SUPABASE_URL+"/rest/v1/jarvis_memory?select=note&order=created_at.desc&limit=30",
          headers={"apikey":SUPABASE_KEY,"Authorization":"Bearer "+SUPABASE_KEY})
        with urllib.request.urlopen(req,timeout=12) as res: return [x["note"] for x in json.loads(res.read().decode())]
    return [f.read_text(encoding="utf-8") for f in sorted(MEMORY.glob("*.txt"))[-20:]]

def save_memory(note):
    if SUPABASE_URL and SUPABASE_KEY:
        payload=json.dumps({"note":note}).encode()
        req=urllib.request.Request(SUPABASE_URL+"/rest/v1/jarvis_memory",data=payload,method="POST",
          headers={"apikey":SUPABASE_KEY,"Authorization":"Bearer "+SUPABASE_KEY,"Content-Type":"application/json","Prefer":"return=minimal"})
        with urllib.request.urlopen(req,timeout=12): pass
    else:
        (MEMORY/(uuid.uuid4().hex+".txt")).write_text(note,encoding="utf-8")

@app.get("/")
def health():
    return {"status":"online","assistant":"JARVIS Shahrooz","persistent_memory":bool(SUPABASE_URL and SUPABASE_KEY)}
@app.post("/ask")
def ask(body: AskBody):
    q=body.question.strip()
    if not q: raise HTTPException(400,"سؤال خالی است")
    try:
        context="\n".join(load_memories())
        response=client.chat.completions.create(model=MODEL,messages=[
          {"role":"system","content":SYSTEM+"\n\nیادداشت‌های ذخیره‌شده:\n"+context},
          {"role":"user","content":q}],temperature=0.6)
        return {"answer":response.choices[0].message.content or ""}
    except Exception:
        raise HTTPException(502,"خطا در ارتباط با سرویس هوش مصنوعی یا حافظه")
@app.post("/remember")
def remember(body: RememberBody):
    note=body.note.strip()
    if not note: raise HTTPException(400,"یادداشت خالی است")
    try: save_memory(note)
    except Exception: raise HTTPException(503,"حافظه در دسترس نیست؛ تنظیمات Supabase را بررسی کنید")
    return {"saved":True,"persistent":bool(SUPABASE_URL and SUPABASE_KEY),"message":"چشم قربان، این نکته را به حافظه‌ام سپردم."}
@app.get("/news")
def news():
    url="https://news.google.com/rss?hl=fa&gl=IR&ceid=IR:fa"
    try:
        req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0"})
        with urllib.request.urlopen(req,timeout=12) as res: data=res.read()
        root=ET.fromstring(data); items=[]
        for item in root.findall(".//item")[:8]:
            items.append({"title":item.findtext("title",""),"link":item.findtext("link",""),"published":item.findtext("pubDate","")})
        return {"items":items}
    except Exception: raise HTTPException(502,"دریافت خبر ناموفق بود")
