const API_BASE = "https://YOUR-BACKEND.onrender.com"; // آدرس واقعی Render را جایگزین کن
const form=document.getElementById("chatForm"), input=document.getElementById("prompt"), messages=document.getElementById("messages"), mic=document.getElementById("mic"), listening=document.getElementById("listening");
let busy=false, wakeEnabled=false, recognition=null, restartWake=false;
function addMessage(text,who){const el=document.createElement("article");el.className="msg "+who;const tag=document.createElement("small");tag.textContent=who==="bot"?"JARVIS":"شما";const p=document.createElement("p");p.textContent=text;el.append(tag,p);messages.append(el);messages.scrollTop=messages.scrollHeight;return p}
function speak(text){if(!("speechSynthesis" in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="fa-IR";u.rate=.94;u.pitch=.82;const vs=speechSynthesis.getVoices();u.voice=vs.find(v=>/fa[-_]ir/i.test(v.lang)&&/farid|male|مرد/i.test(v.name))||vs.find(v=>/fa[-_]ir/i.test(v.lang))||null;speechSynthesis.speak(u)}
function localAnswer(q){if(/کی.*(ساخت|سازنده)|سازنده.*(تو|کی)/i.test(q))return "قربان، شهروز منو ساخته. من دستیار هوشمند اختصاصی شما هستم!";return null}
function openAndroidApp(q){
 const s=q.toLowerCase();
 const intents=[
  {re:/یوتیوب|youtube/,url:"https://www.youtube.com/"},
  {re:/واتساپ|whatsapp/,url:"https://wa.me/"},
  {re:/تلگرام|telegram/,url:"https://t.me/"},
  {re:/اینستاگرام|instagram/,url:"https://www.instagram.com/"},
  {re:/کروم|مرورگر|chrome/,url:"intent://#Intent;scheme=googlechrome;package=com.android.chrome;end"},
  {re:/تنظیمات گوشی|تنظیمات اندروید/,url:"intent://#Intent;action=android.settings.SETTINGS;end"}
 ];
 const hit=intents.find(x=>x.re.test(s));if(!hit)return false;
 addMessage("چشم قربان، تلاش می‌کنم برنامه را باز کنم.","bot");window.location.href=hit.url;return true;
}
async function weather(){
 const p=addMessage("برای بررسی آب‌وهوا، موقعیت گوشی را می‌گیرم...","bot");
 if(!navigator.geolocation){p.textContent="مرورگر امکان دسترسی به موقعیت را ندارد.";return}
 navigator.geolocation.getCurrentPosition(async pos=>{try{
  const {latitude,longitude}=pos.coords;
  const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`);
  const d=await r.json(),c=d.current;
  p.textContent=`قربان، دمای فعلی ${c.temperature_2m} درجه و دمای محسوس ${c.apparent_temperature} درجه سانتی‌گراد است. رطوبت ${c.relative_humidity_2m}٪ و سرعت باد ${c.wind_speed_10m} کیلومتر بر ساعت است.`;
  speak(p.textContent);
 }catch(e){p.textContent="قربان، دریافت آب‌وهوا ناموفق بود."}},()=>{p.textContent="برای آب‌وهوا باید اجازه موقعیت مکانی را به مرورگر بدهید."},{enableHighAccuracy:false,timeout:10000});
}
async function news(){
 const p=addMessage("در حال دریافت تیترهای تازه، قربان...","bot");
 try{const r=await fetch(API_BASE+"/news");if(!r.ok)throw new Error();const d=await r.json();p.textContent=(d.items||[]).slice(0,5).map((x,i)=>`${i+1}. ${x.title}`).join("\n")||"خبر تازه‌ای پیدا نکردم.";speak("قربان، چند خبر تازه برای شما آماده کردم.");}
 catch(e){p.textContent="قربان، خبرخوان در دسترس نیست. می‌توانید جستجوی خبر را در گوگل باز کنید.";window.open("https://news.google.com/?hl=fa&gl=IR&ceid=IR:fa","_blank");}
}
async function ask(q){if(!q.trim()||busy)return;addMessage(q,"user");input.value="";
 if(/آب.?وهوا|هوا چطوره|دمای هوا/.test(q)){weather();return}
 if(/اخبار|خبرهای امروز|خبر جدید/.test(q)){news();return}
 if(/جستجو کن|تو اینترنت بگرد|در اینترنت پیدا کن/.test(q)){const term=q.replace(/جستجو کن|تو اینترنت بگرد|در اینترنت پیدا کن/g,"").trim();window.open("https://www.google.com/search?q="+encodeURIComponent(term||"اخبار امروز"),"_blank");addMessage("نتایج جستجو را در مرورگر باز کردم، قربان.","bot");return}
 if(/باز کن|اجرا کن|رو باز کن/.test(q)&&openAndroidApp(q))return;
 const rememberMatch=q.match(/^(?:یادت باشه که|یادم باشه که|به خاطر بسپار)\s*(.+)$/);
 if(rememberMatch){busy=true;const p=addMessage("دارم این نکته رو در حافظه ذخیره می‌کنم...","bot");try{const r=await fetch(API_BASE+"/remember",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({note:rememberMatch[1]})});if(!r.ok)throw new Error();const d=await r.json();p.textContent=d.message||"چشم قربان، به خاطر سپردم.";speak(p.textContent)}catch(e){p.textContent="قربان، ذخیره یادداشت انجام نشد؛ اتصال سرور و تنظیمات حافظه را بررسی کنید."}finally{busy=false}return}
 const special=localAnswer(q);if(special){addMessage(special,"bot");speak(special);return}
 busy=true;const placeholder=addMessage("در حال فکر کردن هستم، قربان...","bot");try{const r=await fetch(API_BASE+"/ask",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:q})});if(!r.ok)throw new Error();const data=await r.json();placeholder.textContent=data.answer||"پاسخی دریافت نشد.";speak(placeholder.textContent)}catch(e){placeholder.textContent="قربان، به مغز آنلاین وصل نشدم. آدرس بک‌اند و اتصال اینترنت را بررسی کنید."}finally{busy=false}}
form.addEventListener("submit",e=>{e.preventDefault();ask(input.value)});
document.querySelectorAll("[data-msg]").forEach(b=>b.addEventListener("click",()=>{input.value=b.dataset.msg;input.focus()}));
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
function setWakeButton(){const b=document.getElementById("wake");if(b){b.textContent=wakeEnabled?"Hey Jarvis: روشن":"Hey Jarvis: خاموش";b.classList.toggle("active",wakeEnabled)}}
if(SR){
 recognition=new SR();recognition.lang="fa-IR";recognition.interimResults=false;recognition.continuous=true;
 recognition.onstart=()=>{if(!wakeEnabled)listening.hidden=false};
 recognition.onend=()=>{listening.hidden=true;if(wakeEnabled&&restartWake&&document.visibilityState==="visible"){setTimeout(()=>{try{recognition.start()}catch(_){ }},900)}};
 recognition.onerror=()=>{listening.hidden=true};
 recognition.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){if(!e.results[i].isFinal)continue;const said=e.results[i][0].transcript.trim();if(wakeEnabled){if(/hey\s*jarvis|هی\s*جارویس|هی جارویس/i.test(said)){const rest=said.replace(/hey\s*jarvis|هی\s*جارویس/ig,"").trim();speak("بله قربان، گوش می‌کنم.");if(rest)ask(rest)}else if(/لغو بیدارباش|خاموش شو جارویس/i.test(said)){wakeEnabled=false;restartWake=false;recognition.stop();setWakeButton()}}else{input.value=said;ask(said)}}};
 mic.addEventListener("click",()=>{wakeEnabled=false;restartWake=false;setWakeButton();try{recognition.start()}catch(_){}})
 const wake=document.createElement("button");wake.id="wake";wake.type="button";wake.className="wake-btn";wake.textContent="Hey Jarvis: خاموش";wake.addEventListener("click",()=>{wakeEnabled=!wakeEnabled;restartWake=wakeEnabled;setWakeButton();try{if(wakeEnabled)recognition.start();else recognition.stop()}catch(_){}});document.querySelector(".quick").prepend(wake);
}else{mic.disabled=true;mic.title="مرورگر از تشخیص گفتار پشتیبانی نمی‌کند."}
