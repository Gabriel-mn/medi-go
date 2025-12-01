let db = null;

try {
  const firebaseConfig = {
    apiKey: "AIzaSyDdeLTGazq7qSahG4fYUtAWorndqaFCCJI",
    authDomain: "projeto-a3-medi-go.firebaseapp.com",
    projectId: "projeto-a3-medi-go",
    storageBucket: "projeto-a3-medi-go.firebasestorage.app",
    messagingSenderId: "450701155898",
    appId: "1:450701155898:web:cd19ba0871aed011c55f03",
    measurementId: "G-B2F1DD5QDF"
  };

  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log("Firebase conectado!");
  } else {
    console.error("Firebase não encontrado no HTML.");
  }
} catch (error) {
  console.error("Erro Firebase:", error);
}

function uid(prefix='id'){ return prefix + '_' + Math.random().toString(36).slice(2,9); }
function nowISO(){ return new Date().toISOString(); }
function read(k){ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ return null; } }

function write(k, v, saveToCloud = true){ 
  localStorage.setItem(k, JSON.stringify(v)); 
  if (db && saveToCloud) {
    db.collection('projeto_escola').doc(k).set({
      dados: v,
      ultimoUpdate: new Date().toISOString()
    }).catch(e => console.log("Erro nuvem:", e));
  }
}

function init(){
  if(!read('users')) localStorage.setItem('users', '[]');
  if(!read('elders')) localStorage.setItem('elders', '[]');
  if(!read('communities')) localStorage.setItem('communities', '{}');
  if(!read('alarms')) localStorage.setItem('alarms', '[]');
  if(!read('appts')) localStorage.setItem('appts', '[]');
  if(!read('activity')) localStorage.setItem('activity', '[]');
  if(!read('pending')) localStorage.setItem('pending', '{"pending":[]}');
  if(!read('currentUser')) localStorage.setItem('currentUser', 'null');
}
init();

function toast(msg, ttl=3000){
  const d=document.createElement('div');
  d.className='toast';
  d.textContent=msg;
  const area = document.getElementById('toast-area');
  if(area) area.appendChild(d);
  setTimeout(()=>d.remove(), ttl);
}

function showScreenId(id){
  const user = getCurrentUser();
  const nav = document.querySelector('nav.bottom');

  if (!user && id !== 'login' && id !== 'register') {
    showScreenId('login'); 
    return;
  }

  if (nav) {
    nav.style.display = user ? 'flex' : 'none';
  }

  document.querySelectorAll('.screen').forEach(s=>s.style.display='none');
  const el = document.getElementById('screen-' + id);
  if(el) el.style.display = 'block';

  document.querySelectorAll('nav.bottom button').forEach(b=>b.classList.remove('active'));
  const map = { home:'nav-home', agenda:'nav-agenda', community:'nav-community', alarmes:'nav-alarmes', config:'nav-config' };
  const btn = document.getElementById(map[id]);
  if(btn) btn.classList.add('active');
}

function safeListen(id, event, callback) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, callback);
}

safeListen('nav-home', 'click', ()=> showScreenId('home'));
safeListen('nav-agenda', 'click', ()=> showScreenId('agenda'));
safeListen('nav-community', 'click', ()=> showScreenId('community'));
safeListen('nav-alarmes', 'click', ()=> showScreenId('alarmes'));
safeListen('nav-config', 'click', ()=> showScreenId('config'));

safeListen('btn-open-register', 'click', ()=> showScreenId('register'));
safeListen('btn-cancel-register', 'click', ()=> showScreenId('login'));

safeListen('reg-role', 'change', (e)=> {
  const sec = document.getElementById('elder-section');
  if(sec) sec.style.display = e.target.value === 'cuidador' ? 'block' : 'none';
});

safeListen('btn-register', 'click', async ()=>{
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const role = document.getElementById('reg-role').value;
  
  const elderData = {};
  const elderSec = document.getElementById('elder-section');
  
  if(elderSec && elderSec.style.display !== 'none'){
    elderData.name = document.getElementById('elder-name').value.trim() || name;
    elderData.birth = document.getElementById('elder-birth').value || null;
  }
  
  if(!name || !email || !pass){ toast('Preencha todos os campos'); return; }
  
  await syncCollection('users');

  const u = registerUser(name,email,pass,role, elderData);
  if(u){
    write('currentUser', u, false);
    renderCurrentUser(); 
  }
});

safeListen('btn-login', 'click', async ()=>{
  const e = document.getElementById('login-email').value.trim();
  const p = document.getElementById('login-pass').value;
  if(!e || !p){ toast('Preencha email e senha'); return; }
  
  await syncCollection('users');

  login(e,p);
});

safeListen('btn-logout', 'click', ()=> { if(confirm('Deseja sair?')) logout(); });

function registerUser(name,email,pass,role, elderData){
  const users = read('users') || [];
  if(users.find(u=>u.email===email)){ toast('Email já cadastrado'); return null; }
  
  const userFull = {id: uid('u'), name, email, pass, role};
  users.push(userFull);
  write('users', users, true);
  
  if(role === 'idoso' || (role === 'cuidador' && elderData && elderData.name)){
    const elders = read('elders') || [];
    const elder = {
      id: uid('e'),
      name: role === 'idoso' ? name : elderData.name, 
      birth: role === 'idoso' ? (elderData.birth || null) : elderData.birth,
      ownerUserId: userFull.id
    };
    elders.push(elder);
    write('elders', elders, true);
    const comm = read('communities') || {};
    comm[elder.id] = [userFull.id];
    write('communities', comm, true);
  }
  
  const userApp = {...userFull};
  delete userApp.pass; 
  return userApp;
}

function login(email,pass){
  const users = read('users') || [];
  const u = users.find(x=>x.email===email && x.pass===pass);
  if(!u){ 
    toast('Credenciais inválidas'); 
    return null; 
  }
  
  const userApp = {...u};
  delete userApp.pass; 
  
  write('currentUser', userApp, false);
  
  toast('Bem-vindo, ' + u.name);
  renderCurrentUser(); 
}

function logout(){
  write('currentUser', null, false);
  renderCurrentUser(); 
  toast('Desconectado');
}

function getCurrentUser(){ return read('currentUser'); }

function renderCurrentUser(){
  const u = getCurrentUser();
  const n = document.getElementById('me-name');
  const r = document.getElementById('me-role');
  if(n) n.textContent = u ? u.name : '—';
  if(r) r.textContent = u ? (u.role==='cuidador' ? 'Cuidador' : 'Idoso') : '—';

  if(u) showScreenId('home');
  else showScreenId('login');

  populateEldersSelects();
  renderAllData(); 
}

function populateEldersSelects(){
  const elders = read('elders') || [];
  ['appt-elder','comm-elder','alarm-elder'].forEach(id => {
    const s = document.getElementById(id);
    if(!s) return;
    s.innerHTML = '';
    elders.forEach(e=>{
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = e.name || 'Idoso';
      s.appendChild(opt);
    });
  });
}

safeListen('btn-add-appt', 'click', ()=>{
  const title = document.getElementById('appt-title').value.trim();
  const when = document.getElementById('appt-when').value;
  const elderId = document.getElementById('appt-elder').value;
  if(!title || !when || !elderId){ toast('Preencha tudo'); return; }
  const appts = read('appts') || [];
  const user = getCurrentUser();
  appts.push({ id: uid('a'), elderId, title, whenISO: new Date(when).toISOString(), creator: user ? user.id : null });
  write('appts', appts, true);
  renderAppts();
  toast('Salvo!');
  document.getElementById('appt-title').value='';
});

function renderAppts(){
  const cont = document.getElementById('appts-list');
  if(!cont) return;
  cont.innerHTML='';
  const appts = (read('appts')||[]).slice().sort((a,b)=> new Date(a.whenISO) - new Date(b.whenISO));
  if(appts.length===0){ cont.innerHTML = '<div class="small">Vazio</div>'; return; }
  appts.forEach(a=>{
    const div = document.createElement('div');
    div.className='list-item';
    div.innerHTML = `<div><b>${a.title}</b><br><span class="small">${new Date(a.whenISO).toLocaleString()}</span></div>
    <button class="btn ghost" onclick="removeAppt('${a.id}')">Excluir</button>`;
    cont.appendChild(div);
  });
}

window.removeAppt = function(id){
  if(!confirm('Excluir?')) return;
  write('appts', (read('appts')||[]).filter(x=>x.id!==id), true);
  renderAppts();
}

safeListen('btn-invite', 'click', ()=>{
  const elderId = document.getElementById('comm-elder').value;
  const email = document.getElementById('comm-email').value.trim();
  if(!elderId || !email){ toast('Preencha tudo'); return; }
  const users = read('users') || [];
  const u = users.find(x=>x.email===email);
  if(!u){ toast('Email não encontrado'); return; }
  const comm = read('communities') || {};
  comm[elderId] = comm[elderId] || [];
  if(!comm[elderId].includes(u.id)) comm[elderId].push(u.id);
  write('communities', comm, true);
  renderCommunityMembers();
  toast('Adicionado!');
});

safeListen('btn-refresh-comm', 'click', renderCommunityMembers);

function renderCommunityMembers(){
  const container = document.getElementById('comm-members');
  if(!container) return;
  container.innerHTML='';
  const elderId = document.getElementById('comm-elder').value;
  const comm = read('communities') || {};
  const users = read('users') || [];
  if(!elderId || !comm[elderId]){ container.innerHTML = '<div class="small">Vazio</div>'; return; }
  comm[elderId].forEach(uid=>{
    const u = users.find(x=>x.id===uid);
    container.innerHTML += `<div class="list-item"><span>${u ? u.name : uid}</span>
    <button class="btn ghost" onclick="removeMember('${elderId}','${uid}')">Remover</button></div>`;
  });
}

window.removeMember = function(eid, uid){
  if(!confirm('Remover?')) return;
  const c = read('communities');
  c[eid] = c[eid].filter(x=>x!==uid);
  write('communities', c, true);
  renderCommunityMembers();
}

safeListen('btn-save-alarm', 'click', ()=>{
  const elderId = document.getElementById('alarm-elder').value;
  const name = document.getElementById('alarm-name').value.trim();
  const times = document.getElementById('alarm-times').value.split(',').filter(Boolean);
  if(!elderId || !name || times.length===0){ toast('Preencha tudo'); return; }
  const alarms = read('alarms')||[];
  alarms.push({ id: uid('al'), elderId, name, times, start: new Date().toISOString(), durationDays: 30, confirmWindowMinutes: 1, active:true });
  write('alarms', alarms, true);
  renderAlarms();
  toast('Alarme salvo');
  document.getElementById('alarm-name').value='';
});

function renderAlarms(){
  const cont = document.getElementById('alarms-list');
  if(!cont) return;
  cont.innerHTML='';
  const alarms = read('alarms')||[];
  alarms.forEach(al=>{
    cont.innerHTML += `<div class="list-item"><div><b>${al.name}</b><br><span class="small">${al.times.join(', ')}</span></div>
    <button class="btn ghost" onclick="removeAlarm('${al.id}')">Excluir</button>`;
  });
}

window.removeAlarm = function(id){
  if(!confirm('Excluir?')) return;
  write('alarms', (read('alarms')||[]).filter(x=>x.id!==id), true);
  renderAlarms();
}

function renderAllData(){
  renderAppts();
  renderAlarms();
  renderCommunityMembers();
}

async function syncCollection(key) {
    if (!db) return false;
    try {
        const docRef = db.collection('projeto_escola').doc(key);
        const doc = await docRef.get();
        if (doc.exists) {
            const cloudData = doc.data().dados;
            if (cloudData !== undefined) {
                localStorage.setItem(key, JSON.stringify(cloudData));
                return true;
            }
        }
    } catch (e) {
        console.error(`Erro sync ${key}`, e);
    }
    return false;
}

function createDemoDataLocalOnly() {
    const u = {id:uid('u'), name:'Ana Cuidadora (Local)', email:'cuidadora@demo', pass:'1234', role:'cuidador'};
    write('users', [u], false); 
    console.log("Modo Offline/Demo Ativado (Dados locais apenas)");
}

async function initSyncAndRender() {
    const collectionsToSync = ['users', 'elders', 'communities', 'alarms', 'appts', 'activity', 'pending'];
    
    if ((read('users') || []).length === 0) {
        console.log("Sincronizando...");
        let usersFound = false;
        
        for (const key of collectionsToSync) {
            const success = await syncCollection(key);
            if (key === 'users' && success) usersFound = true;
        }
        
        if (!usersFound) {
            createDemoDataLocalOnly();
        }
    }
    renderCurrentUser();
}

initSyncAndRender();

safeListen('btn-notif-perm', 'click', ()=> Notification.requestPermission());
