// Signed server-to-server connection. Merchant credentials stay on Tharigopula.
const encoder=new TextEncoder();
const fail=(message,status=503)=>{throw Object.assign(Error(message),{status});};
const json=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const reference=id=>'sims-'+id.replaceAll('-','');
async function bytes(request,max){const reader=request.body?.getReader();if(!reader)return new Uint8Array();const parts=[];let length=0;try{for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>max)fail('request_too_large',413);parts.push(value);}}catch(error){await reader.cancel().catch(()=>{});throw error;}const result=new Uint8Array(length);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}return result;}
export async function signRecharge(secret,timestamp,body){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(timestamp+'.'+body))),v=>v.toString(16).padStart(2,'0')).join('');}
async function authenticated(request,secret,raw){const time=request.headers.get('x-tharigopula-time')||'',signature=request.headers.get('x-tharigopula-signature')||'';if(!/^\d{13}$/.test(time)||Math.abs(Date.now()-Number(time))>60000||!/^([a-f0-9]{2}){32}$/.test(signature))return false;const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);return crypto.subtle.verify('HMAC',key,Uint8Array.from(signature.match(/../g),v=>parseInt(v,16)),encoder.encode(time+'.'+raw));}
function checkout(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='rzp.io'&&!u.username&&!u.password?u.href:'';}catch{return '';}}
function matches(link,input){return link&&link.reference_id===reference(input.requestId)&&link.notes?.tenant==='sims'&&link.notes?.purpose==='service_wallet'&&link.amount===input.amountPaise&&link.currency==='INR'&&link.accept_partial===false&&/^plink_[a-zA-Z0-9]+$/.test(link.id||'');}
function project(link){return {id:link.id,reference_id:link.reference_id,notes:{tenant:link.notes.tenant,purpose:link.notes.purpose},amount:link.amount,currency:link.currency,accept_partial:link.accept_partial,short_url:checkout(link.short_url),amount_paid:link.amount_paid,status:link.status,payments:Array.isArray(link.payments)?link.payments.map(p=>({payment_id:p.payment_id})):[]};}
async function provider(env,path,body,fetcher){const response=await fetcher('https://api.razorpay.com/v1/'+path,{method:body?'POST':'GET',headers:{authorization:'Basic '+btoa(env.RAZORPAY_KEY_ID+':'+env.RAZORPAY_KEY_SECRET),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'manual',signal:AbortSignal.timeout(12000)});if(!response.ok){await response.body?.cancel();fail('payment_provider_unavailable');}let value;try{value=JSON.parse(new TextDecoder().decode(await bytes(response,500000)));}catch{fail('payment_provider_unavailable');}return value;}
export async function handleAiRecharge(request,env,fetcher=fetch){
 if(request.method!=='POST')return json({error:'method_not_allowed'},405);
 if(!env.SIMS_RECHARGE_SHARED_SECRET||env.SIMS_RECHARGE_SHARED_SECRET.length<32)return json({error:'recharge_not_configured'},503);
 try{
  const raw=new TextDecoder().decode(await bytes(request,8192));
  if(!await authenticated(request,env.SIMS_RECHARGE_SHARED_SECRET,raw))return json({error:'signature_rejected'},403);
  // Trim copied whitespace/paired quotes; never reinterpret a different credential.
  const clean=value=>typeof value==='string'?value.trim().replace(/^(['"])(.*)\1$/s,'$2'):'';
  env={...env,RAZORPAY_KEY_ID:clean(env.RAZORPAY_KEY_ID),RAZORPAY_KEY_SECRET:clean(env.RAZORPAY_KEY_SECRET)};
  if(!/^rzp_live_[a-zA-Z0-9]+$/.test(env.RAZORPAY_KEY_ID||'')||!env.RAZORPAY_KEY_SECRET)return json({error:'live_merchant_required',keyMode:/^rzp_test_/.test(env.RAZORPAY_KEY_ID||'')?'test':env.RAZORPAY_KEY_ID?'unrecognised':'missing',merchantSecretPresent:Boolean(env.RAZORPAY_KEY_SECRET),keyIdLength:(env.RAZORPAY_KEY_ID||'').length,containsReviewedKey:(env.RAZORPAY_KEY_ID||'').includes('rzp_live_TanPvUMLv1Hryj')},503);
  let input;try{input=JSON.parse(raw);}catch{fail('invalid_request',400);}
  if(input.tenant!=='sims'||!['status','create','verify'].includes(input.operation))fail('invalid_request',400);
  if(input.operation==='status'){await provider(env,'payment_links?count=1',null,fetcher);return json({ready:true,live:true,keyId:env.RAZORPAY_KEY_ID});}
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(input.requestId||'')||!Number.isSafeInteger(input.amountPaise)||input.amountPaise<100||input.amountPaise>1000000)fail('invalid_request',400);
  if(input.providerId&&!/^plink_[a-zA-Z0-9]+$/.test(input.providerId))fail('invalid_request',400);
  let link;
  if(input.providerId)link=await provider(env,'payment_links/'+input.providerId,null,fetcher);
  else {const list=await provider(env,'payment_links?reference_id='+reference(input.requestId),null,fetcher);if(!Array.isArray(list.payment_links))fail('payment_provider_unavailable');link=list.payment_links.find(l=>l.reference_id===reference(input.requestId));}
  if(!link&&input.operation==='create')link=await provider(env,'payment_links',{amount:input.amountPaise,currency:'INR',accept_partial:false,reference_id:reference(input.requestId),description:'Tharigopula',notify:{sms:false,email:false},reminder_enable:false,notes:{tenant:'sims',purpose:'service_wallet'}},fetcher);
  if(!link)fail('payment_not_found',409);
  if(!matches(link,input)||!checkout(link.short_url))fail('payment_reference_mismatch',409);
  let payment=null;
  if(input.operation==='verify'&&link.status==='paid'){
   if(link.amount_paid!==input.amountPaise||!Array.isArray(link.payments)||link.payments.length!==1||!/^pay_[a-zA-Z0-9]+$/.test(link.payments[0].payment_id||''))fail('payment_requires_reconciliation',409);
   const p=await provider(env,'payments/'+link.payments[0].payment_id,null,fetcher);
   if(p.id!==link.payments[0].payment_id||!['captured','refunded'].includes(p.status)||p.amount!==input.amountPaise||p.currency!=='INR'||!Number.isSafeInteger(p.amount_refunded)||p.amount_refunded<0||p.amount_refunded>p.amount)fail('payment_requires_reconciliation',409);
   payment={id:p.id,status:p.status,amount:p.amount,currency:p.currency,amount_refunded:p.amount_refunded};
  }
  return json({link:project(link),payment});
 }catch(error){return json({error:error.status?error.message:'payment_verification_unavailable'},error.status||503);}
}
