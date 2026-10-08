(()=>{
  'use strict';
  const ENDPOINT='https://lucas-portfolio-assistant.e1384451.workers.dev/chat';
  const welcome="Hi! I'm Lucas's AI portfolio assistant. Ask me about his projects, technical skills, engineering experience, or qualifications.";
  const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const refs=new Map(projects.map(p=>[`project-${slug(p.name)}`,{title:p.name,href:`#portfolio/projects/${slug(p.name)}`} ]));
  sections.filter(s=>s.id!=='projects').forEach(s=>refs.set(`section-${s.id}`,{title:s.title,href:`#portfolio/${s.id}`}));
  for(const [id,title] of [['about','About Lucas'],['posts','LinkedIn Posts'],['contact','Contact Lucas']])refs.set(id,{title,href:`#${id}`});
  const root=document.createElement('aside');root.className='portfolio-chat';root.setAttribute('aria-label','Lucas’s AI portfolio assistant');
  root.innerHTML=`<section class="chat-panel" role="dialog" aria-modal="false" aria-labelledby="chat-title" hidden data-lenis-prevent><header class="chat-header"><div class="chat-heading"><h2 id="chat-title">Ask Lucas AI</h2><p>Your guide to the portfolio</p></div><button type="button" class="chat-icon-button" data-chat-clear aria-label="Restart conversation" title="Restart conversation">↻</button><button type="button" class="chat-icon-button" data-chat-minimise aria-label="Minimise assistant" title="Minimise">−</button><button type="button" class="chat-icon-button" data-chat-close aria-label="Close assistant" title="Close">×</button></header><div class="chat-messages" role="log" aria-live="polite" aria-relevant="additions text" aria-label="Conversation" data-lenis-prevent></div><form class="chat-form"><label class="chat-sr" for="chat-question">Ask about Lucas’s portfolio</label><div class="chat-input-row"><textarea class="chat-input" id="chat-question" rows="2" maxlength="1000" placeholder="Ask about Lucas’s experience…" aria-describedby="chat-privacy"></textarea><button class="chat-send" type="submit">Send</button></div></form><p class="chat-privacy" id="chat-privacy">Questions are processed by Cloudflare AI. This site does not save your conversation. Avoid sharing sensitive information. AI answers may be imperfect; check the linked evidence.</p></section><button type="button" class="chat-launcher" aria-expanded="false" aria-controls="chat-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 3V6a2 2 0 0 1 1-2Z"/><path d="M8 9h8M8 13h5"/></svg><span>Ask Lucas AI</span></button>`;
  document.body.append(root);
  const panel=root.querySelector('.chat-panel'),messages=root.querySelector('.chat-messages'),input=root.querySelector('.chat-input'),send=root.querySelector('.chat-send'),launcher=root.querySelector('.chat-launcher');
  panel.id='chat-panel';launcher.setAttribute('aria-controls','chat-panel');
  let history=[],busy=false,controller=null,generation=0,closeTimer;
  function bottom(){messages.scrollTop=messages.scrollHeight;}
  function bubble(role,text){const el=document.createElement('div');el.className=`chat-message ${role}`;el.setAttribute('aria-label',role==='user'?'You':'Lucas’s AI assistant');const p=document.createElement('p');p.textContent=text;el.append(p);messages.append(el);bottom();return el;}
  function reset(){generation++;controller?.abort();controller=null;busy=false;send.disabled=false;history=[];messages.replaceChildren();bubble('assistant',welcome);const suggestions=document.createElement('div');suggestions.className='chat-suggestions';suggestions.setAttribute('aria-label','Suggested questions');for(const q of ['Does Lucas have AI experience?','Tell me about his robotics projects.','What are his technical skills?']){const b=document.createElement('button');b.type='button';b.textContent=q;b.onclick=()=>ask(q);suggestions.append(b);}messages.append(suggestions);input.value='';}
  function open(){clearTimeout(closeTimer);panel.hidden=false;requestAnimationFrame(()=>root.classList.add('is-open'));launcher.setAttribute('aria-expanded','true');setTimeout(()=>input.focus({preventScroll:true}),50);}
  function close(){root.classList.remove('is-open');launcher.setAttribute('aria-expanded','false');closeTimer=setTimeout(()=>{panel.hidden=true;},240);launcher.focus({preventScroll:true});}
  launcher.onclick=()=>root.classList.contains('is-open')?close():open();
  root.querySelector('[data-chat-minimise]').onclick=close;root.querySelector('[data-chat-close]').onclick=close;
  root.querySelector('[data-chat-clear]').onclick=()=>{reset();input.focus();};
  root.addEventListener('keydown',e=>{if(e.key==='Escape'&&root.classList.contains('is-open')){e.preventDefault();e.stopPropagation();close();}if(e.key==='Tab'&&root.classList.contains('is-open')&&matchMedia('(max-width:700px)').matches){const controls=[...panel.querySelectorAll('button:not(:disabled),a[href],textarea')];const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  root.querySelector('form').onsubmit=e=>{e.preventDefault();ask(input.value);};
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();ask(input.value);}});
  function context(){let result=history.slice(-6);while(result.reduce((n,m)=>n+m.content.length,0)>4500)result=result.slice(2);return result;}
  async function ask(raw,retryCard=null){
    const question=raw.trim();if(!question||busy)return;if(question.length>1000){input.reportValidity();return;}
    messages.querySelector('.chat-suggestions')?.remove();retryCard?.remove();if(!retryCard)bubble('user',question);input.value='';busy=true;send.disabled=true;
    const loading=document.createElement('div');loading.className='chat-loading';loading.setAttribute('role','status');loading.textContent='Reading Lucas’s portfolio';messages.append(loading);bottom();
    controller=new AbortController();const ticket=generation,timer=setTimeout(()=>controller?.abort(),32000);
    try{
      const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,history:context()}),signal:controller.signal,credentials:'omit'});
      let data;try{data=await response.json();}catch{throw new Error('The assistant could not respond. Please try again shortly.');}
      if(ticket!==generation)return;
      if(!response.ok)throw new Error(data.error?.message||'The assistant is temporarily unavailable. Please try again shortly.');
      if(typeof data.answer!=='string'||!Array.isArray(data.references))throw new Error('The assistant could not respond. Please try again shortly.');
      loading.remove();const answer=bubble('assistant',data.answer);const links=document.createElement('div');links.className='chat-references';links.setAttribute('aria-label','Portfolio evidence');
      const seen=new Set();for(const reference of data.references){const safe=refs.get(reference.id);if(!safe||seen.has(reference.id))continue;seen.add(reference.id);const a=document.createElement('a');a.href=safe.href;a.textContent=safe.title;a.onclick=e=>{e.preventDefault();close();navigate(safe.href);};links.append(a);}if(links.childElementCount)answer.append(links);
      history.push({role:'user',content:question},{role:'assistant',content:data.answer.slice(0,2000)});history=context();bottom();
    }catch(error){if(ticket!==generation)return;loading.remove();const text=error.name==='AbortError'?'The assistant took too long to respond. Please try again shortly.':error instanceof TypeError?'Could not connect to the assistant. Check your connection and try again.':error.message;const card=bubble('assistant error',text);const retry=document.createElement('button');retry.className='chat-retry';retry.type='button';retry.textContent='Try again';retry.onclick=()=>ask(question,card);card.append(retry);bottom();}
    finally{clearTimeout(timer);loading.remove();if(ticket===generation){busy=false;send.disabled=false;controller=null;}}
  }
  // Keep the launcher usable inside the site's existing native modal top layer.
  // No change to existing dialog animations, contents, or CAD mounting is needed.
  function host(){const dialogs=[...document.querySelectorAll('dialog[open]')];const target=dialogs.at(-1)||document.body;if(root.parentElement!==target)target.append(root);root.hidden=target.id==='welcome';root.classList.toggle('showcase-visible',target===document.body&&document.querySelector('.showcase').getBoundingClientRect().bottom>innerHeight*.7&&scrollY<document.querySelector('.identity').offsetTop);}
  const observer=new MutationObserver(host);document.querySelectorAll('dialog').forEach(d=>observer.observe(d,{attributes:true,attributeFilter:['open']}));window.addEventListener('scroll',host,{passive:true});host();reset();
  let pendingHash=null,openedRoute=false;
  function navigate(hash){if(location.hash!==hash)historySet(hash);route(hash);}
  function historySet(hash){window.history.pushState(null,'',hash);}
  function route(hash=location.hash){
    const match=hash.match(/^#portfolio\/([a-z]+)(?:\/([a-z0-9-]+))?$/);
    if(!match){if(['#about','#posts','#contact'].includes(hash)){if(currentDialog)closeDialog();setTimeout(()=>{const target=document.querySelector(hash);if(target)lenis?lenis.scrollTo(target):target.scrollIntoView();},reduce?0:470);}else if(openedRoute&&currentDialog?.id==='information'){closeDialog();}openedRoute=false;return;}
    const section=sections.find(s=>s.id===match[1]);if(!section)return;const index=match[2]?projects.findIndex(p=>slug(p.name)===match[2]):null;if(match[2]&&(section.id!=='projects'||index<0))return;
    if(currentDialog?.id==='welcome'||closing){pendingHash=hash;return;}
    pendingHash=null;openedRoute=true;showPanel(section.id,index);setTimeout(()=>{const heading=index===null?document.getElementById('panel-title'):document.querySelector(`#entry-${index} h3`);if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}},reduce?0:730);
  }
  const routeObserver=new MutationObserver(()=>{if(pendingHash&&!document.getElementById('welcome').open){const next=pendingHash;pendingHash=null;setTimeout(()=>route(next),30);}if(openedRoute&&!document.getElementById('information').open&&!closing){openedRoute=false;if(location.hash.startsWith('#portfolio/'))window.history.replaceState(null,'','#background');}});
  routeObserver.observe(document.getElementById('welcome'),{attributes:true,attributeFilter:['open']});routeObserver.observe(document.getElementById('information'),{attributes:true,attributeFilter:['open']});window.addEventListener('hashchange',()=>route());window.addEventListener('popstate',()=>route());
  if(location.hash.startsWith('#portfolio/'))route();
})();
