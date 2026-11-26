const state = { squad: null, players: [], selected: 'ST', messages: [], busy: false, recognizing: false, mode: 'local', config: null };
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const coordinates = { LW: [17, 19], ST: [50, 12], RW: [83, 19], LCM: [31, 38], RCM: [69, 38], CDM: [50, 55], LB: [13, 72], LCB: [38, 75], RCB: [62, 75], RB: [87, 72], GK: [50, 91] };
let toastTimer;

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '请求失败，请重试。');
  return data;
}
function post(path, body) { return api(path, { method: 'POST', body: JSON.stringify(body) }); }
function notify(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 4500);
}
function slot() { return state.squad.slots.find((item) => item.key === state.selected); }
function playerById(id) { return state.players.find((player) => player.id === id); }
function shortName(name) {
  if (!name) return '添加球员';
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}
function renderPitch() {
  const pitch = $('#pitch');
  pitch.querySelectorAll('.pitch-player').forEach((element) => element.remove());
  for (const item of state.squad.slots) {
    const player = document.createElement('button');
    const position = coordinates[item.key];
    player.type = 'button';
    player.className = `pitch-player ${item.key === state.selected ? 'selected' : ''} ${item.name ? 'has-player' : ''}`;
    player.style.left = `${position[0]}%`;
    player.style.top = `${position[1]}%`;
    player.setAttribute('aria-label', `${item.position} ${item.name || '添加球员'}`);
    player.innerHTML = `<span class="player-position">${escapeHtml(item.position)}</span><span class="player-shirt">${item.name ? escapeHtml(item.name.trim().charAt(0).toUpperCase()) : '+'}</span><span class="player-name">${escapeHtml(shortName(item.name))}</span>`;
    player.addEventListener('click', () => selectSlot(item.key));
    pitch.append(player);
  }
  $('#filled-count').textContent = state.squad.slots.filter((item) => item.name).length;
  $('#formation-label').textContent = state.squad.formation || '4-1-2-3';
}
function renderEditor() {
  const selected = slot();
  $('#selected-slot').textContent = selected.key;
  $('#slot-position').value = selected.position;
  $('#slot-name').value = selected.name || '';
  $('#slot-season').value = selected.season || '';
  $('#slot-level').value = selected.level || '';
  renderLinkedPlayer();
}
function renderLinkedPlayer() {
  const linked = playerById(slot().player_id);
  $('#linked-player').textContent = linked ? `已关联：${linked.name} · ${linked.season} · OVR ${linked.ovr}` : '尚未关联球员数据';
}
function selectSlot(key) {
  if (key !== state.selected && editorIsDirty() && !window.confirm('当前位置有未保存的修改，切换后将丢失。继续吗？')) return;
  state.selected = key;
  renderPitch();
  renderEditor();
  renderPlayers();
}
function editorIsDirty() {
  const selected = slot();
  return $('#slot-position').value !== selected.position || $('#slot-name').value !== (selected.name || '') || $('#slot-season').value !== (selected.season || '') || $('#slot-level').value !== (selected.level || '');
}
async function saveSquad() {
  state.squad = await post('/api/squad', state.squad);
  renderPitch();
  renderEditor();
}
async function saveEditor() {
  const selected = slot();
  const newName = $('#slot-name').value.trim();
  const newSeason = $('#slot-season').value.trim();
  const linked = playerById(selected.player_id);
  if (linked && (newName !== selected.name || newSeason !== selected.season)) delete selected.player_id;
  Object.assign(selected, { position: $('#slot-position').value, name: newName, season: newSeason, level: $('#slot-level').value.trim() });
  await saveSquad();
  notify('球员信息已保存。');
}
function renderPlayers() {
  const query = $('#search').value.trim().toLocaleLowerCase();
  const filtered = state.players.filter((player) => [player.name, player.season, player.position, player.id].some((value) => String(value || '').toLocaleLowerCase().includes(query)));
  const list = $('#player-list');
  list.replaceChildren();
  $('#players-empty').hidden = filtered.length > 0;
  $('#players-empty').textContent = state.players.length ? '没有找到匹配的本地球员。' : '还没有导入球员。前往球员网站复制详情链接，粘贴到上方。';
  for (const player of filtered) {
    const row = document.createElement('article');
    row.className = 'player-row';
    const time = new Date(player.fetched_at).toLocaleString('zh-CN');
    const stats = Object.entries(player.attributes || {}).map(([name, value]) => `${name} ${value}`).join(' · ');
    row.innerHTML = `<div class="player-monogram">${escapeHtml(player.name.charAt(0))}</div><div class="player-information"><strong>${escapeHtml(player.name)} <span>${escapeHtml(player.ovr)}</span></strong><small>${escapeHtml(player.season)} · ${escapeHtml(player.position)} ${player.club ? '· ' + escapeHtml(player.club) : ''}</small><small>${escapeHtml(stats || '暂无主要能力摘要')}</small><small>获取于 ${escapeHtml(time)} · <a href="${escapeHtml(player.source_url)}" target="_blank" rel="noopener noreferrer">查看来源 ↗</a></small></div><div class="player-actions"><button type="button" class="link-player">关联到 ${escapeHtml(state.selected)}</button><button type="button" class="refresh-player">刷新</button></div>`;
    row.querySelector('.link-player').addEventListener('click', async () => {
      if (editorIsDirty() && !window.confirm('位置编辑有未保存的修改，关联后将丢失。继续吗？')) return;
      const selected = slot();
      Object.assign(selected, { player_id: player.id, name: player.name, season: player.season });
      try { await saveSquad(); renderPlayers(); notify(`已关联到 ${selected.key}，请核对强化等级。`); } catch (error) { notify(error.message); }
    });
    row.querySelector('.refresh-player').addEventListener('click', () => importPlayer(player.source_url));
    list.append(row);
  }
}
async function reloadPlayers() {
  const result = await api('/api/players');
  state.players = result.players;
  renderPlayers();
  renderLinkedPlayer();
}
async function importPlayer(url) {
  const button = $('#player-form button');
  button.disabled = true;
  button.textContent = '正在获取…';
  try {
    const result = await post('/api/player', { url });
    await reloadPlayers();
    notify(result.warning || `已导入 ${result.player.name} · ${result.player.season}`);
    $('#player-url').value = '';
  } catch (error) { notify(error.message); }
  finally { button.disabled = false; button.textContent = '导入 / 刷新 ↗'; }
}
function renderRecognition(players) {
  const root = $('#recognition-results');
  root.replaceChildren();
  if (!players.length) { root.textContent = '未识别到球员，请尝试更清晰的截图或手动录入。'; return; }
  const title = document.createElement('h3');
  title.textContent = '识别候选 · 请逐项核对';
  root.append(title);
  for (const player of players) {
    const row = document.createElement('div');
    row.className = 'recognition-row';
    row.innerHTML = `<div class="recognition-meta">识别位置：${escapeHtml(player.position || '未知')} <span>置信度：${escapeHtml(player.confidence || '未知')}</span></div><div class="recognition-fields"><input class="recognized-name" aria-label="球员名称" placeholder="球员名称" value="${escapeHtml(player.name)}"><input class="recognized-season" aria-label="赛季" placeholder="赛季" value="${escapeHtml(player.season)}"><input class="recognized-level" aria-label="强化" placeholder="强化" value="${escapeHtml(player.level)}"></div><div class="recognition-actions"><select aria-label="选择阵容位置"><option value="">选择要写入的位置</option>${state.squad.slots.map((item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.key)} · ${escapeHtml(item.name || '空位')}</option>`).join('')}</select><button class="button dark" type="button">确认写入</button></div>`;
    row.querySelector('button').addEventListener('click', async () => {
      const key = row.querySelector('select').value;
      const name = row.querySelector('.recognized-name').value.trim();
      if (!key || !name) return notify('请选择位置并确认球员名称。');
      const target = state.squad.slots.find((item) => item.key === key);
      if (editorIsDirty() && !window.confirm('位置编辑有未保存的修改，写入后将丢失。继续吗？')) return;
      if (target.name && !window.confirm(`将覆盖 ${key} 的 ${target.name}，继续吗？`)) return;
      Object.assign(target, { name, season: row.querySelector('.recognized-season').value.trim(), level: row.querySelector('.recognized-level').value.trim() });
      delete target.player_id;
      try { await saveSquad(); selectSlot(key); row.querySelector('button').textContent = '已写入'; row.querySelector('button').disabled = true; notify('候选已写入，请关联对应的球员卡。'); } catch (error) { notify(error.message); }
    });
    root.append(row);
  }
}
function appendMessage(role, content) {
  const intro = $('.coach-intro');
  if (intro) intro.remove();
  const node = document.createElement('div');
  node.className = `chat-message ${role}`;
  const label = document.createElement('small');
  label.textContent = role === 'user' ? 'YOU' : '战术助手';
  const text = document.createElement('p');
  text.textContent = content;
  node.append(label, text);
  $('#chat-area').append(node);
  $('#chat-area').scrollTop = $('#chat-area').scrollHeight;
}
async function sendChat(message) {
  if (state.busy || !message.trim()) return;
  state.busy = true;
  renderModel();
  $('#chat-form button').disabled = true;
  const clean = message.trim();
  state.messages.push({ role: 'user', content: clean });
  appendMessage('user', clean);
  $('#chat-input').value = '';
  try {
    const result = await post('/api/chat', { messages: state.messages, mode: state.mode });
    state.messages.push({ role: 'assistant', content: result.reply });
    appendMessage('assistant', result.reply);
  } catch (error) {
    state.messages.pop();
    appendMessage('error', error.message);
  } finally { state.busy = false; $('#chat-form button').disabled = false; renderModel(); }
}
function renderModel() {
  const local = state.mode === 'local';
  const provider = { openai: 'OpenAI', deepseek: 'DeepSeek', online: '所配置的在线服务' }[state.mode];
  const config = state.config?.[state.mode];
  $('#model-mode').value = state.mode;
  $('#model-mode').disabled = state.busy || state.recognizing;
  $('#model-status').textContent = !config ? '检查配置中' : config.chat ? (local ? '本地已配置 · 未验证' : '在线已配置 · 未验证') : '模型未配置';
  $('#model-status').classList.toggle('configured', Boolean(config?.chat));
  $('#model-hint').textContent = local ? '连接本机 Ollama；如使用 Ollama 云模型，数据仍可能发送到远程。' : `使用 ${provider}：问题、阵容摘要和主动发送的截图会传给该服务，可能产生费用。` + (config && !config.vision ? ' 视觉模型未配置。' : ' 模型能力和余额需自行确认。');
  $('#chat-privacy').textContent = local ? '问题、对话和阵容摘要将发送至本机 Ollama；使用云模型时可能传至远程。' : `问题、对话和阵容摘要将发送给 ${provider}。`;
  $('#vision-privacy').textContent = local ? '当前使用本机 Ollama。点击发送后才会传送截图；使用云模型时可能传至远程。识别结果需要逐项确认。' : `当前使用 ${provider}。点击发送后截图将传给该服务；识别结果需要逐项确认。`;
}
$('#model-mode').addEventListener('change', (event) => {
  state.mode = event.target.value;
  state.messages = [];
  renderModel();
  notify('已切换模型，之前的对话不会作为上下文发送。');
});
async function initialize() {
  try {
    state.squad = await api('/api/squad');
    await reloadPlayers();
    renderPitch();
    renderEditor();
    state.config = await api('/api/config');
    renderModel();
  } catch (error) { notify(error.message); }
}
$('#save-slot').addEventListener('click', () => saveEditor().catch((error) => notify(error.message)));
$('#clear-slot').addEventListener('click', async () => {
  const selected = slot();
  Object.assign(selected, { name: '', season: '', level: '' });
  delete selected.player_id;
  try { await saveSquad(); notify('位置已清空。'); } catch (error) { notify(error.message); }
});
$('#player-form').addEventListener('submit', (event) => { event.preventDefault(); importPlayer($('#player-url').value); });
$('#search').addEventListener('input', renderPlayers);
const capture = { image: null, crop: null, start: null, generation: 0, stream: null };

function resetCapture() {
  capture.generation += 1;
  if (capture.stream) capture.stream.getTracks().forEach((track) => track.stop());
  capture.stream = null;
  capture.image = null;
  capture.crop = null;
  capture.start = null;
  $('#capture-preview').hidden = true;
  $('#capture-canvas').width = 0;
  $('#capture-canvas').height = 0;
}
function drawCapture() {
  const canvas = $('#capture-canvas');
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(capture.image, 0, 0, canvas.width, canvas.height);
  if (capture.crop) {
    const { x, y, width, height } = capture.crop;
    context.fillStyle = 'rgba(0, 0, 0, 0.4)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(capture.image, x * capture.image.width, y * capture.image.height, width * capture.image.width, height * capture.image.height, x * canvas.width, y * canvas.height, width * canvas.width, height * canvas.height);
    context.strokeStyle = '#d5e99d';
    context.lineWidth = 3;
    context.strokeRect(x * canvas.width, y * canvas.height, width * canvas.width, height * canvas.height);
  }
  $('#crop-status').textContent = capture.crop ? '已选择区域，仅发送选中的内容' : '当前使用完整截图';
}
function capturePoint(event) {
  const bounds = $('#capture-canvas').getBoundingClientRect();
  return { x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) };
}
function selectedImage() {
  const region = capture.crop || { x: 0, y: 0, width: 1, height: 1 };
  const source = capture.image;
  const x = Math.round(region.x * source.width);
  const y = Math.round(region.y * source.height);
  const width = Math.min(source.width - x, Math.max(1, Math.round(region.width * source.width)));
  const height = Math.min(source.height - y, Math.max(1, Math.round(region.height * source.height)));
  const canvas = document.createElement('canvas');
  let scale = 1;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext('2d').drawImage(source, x, y, width, height, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.92, 0.8, 0.65, 0.5]) {
      const data = canvas.toDataURL('image/jpeg', quality);
      if (data.length < 5592000) return data;
    }
    scale *= 0.75;
  }
  throw new Error('截图过大，请重新选择较小的区域。');
}
async function captureScreen() {
  if (!navigator.mediaDevices?.getDisplayMedia) return notify('当前浏览器不支持桌面截图，请使用 Chrome 或 Edge 打开本地页面。');
  const generation = ++capture.generation;
  const button = $('#capture-screen');
  let stream;
  button.disabled = true;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    if (!$('#upload-dialog').open || generation !== capture.generation) return;
    capture.stream = stream;
    const video = document.createElement('video');
    video.muted = true;
    video.srcObject = stream;
    await video.play();
    if (!$('#upload-dialog').open || generation !== capture.generation) return;
    if (!video.videoWidth || !video.videoHeight) throw new Error('没有获取到画面，请重试或选择其他窗口。');
    const image = document.createElement('canvas');
    image.width = video.videoWidth;
    image.height = video.videoHeight;
    image.getContext('2d').drawImage(video, 0, 0);
    capture.image = image;
    capture.crop = null;
    capture.start = null;
    $('#image-input').value = '';
    $('#image-name').textContent = '已截取桌面画面';
    $('#recognition-results').replaceChildren();
    const canvas = $('#capture-canvas');
    const scale = Math.min(1, 1200 / image.width);
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    $('#capture-preview').hidden = false;
    drawCapture();
  } catch (error) {
    if (generation === capture.generation) notify(error.name === 'NotAllowedError' ? '已取消截图或未授予屏幕共享权限。' : (error.message || '截图失败，请尝试选择其他窗口。'));
  } finally {
    if (stream) stream.getTracks().forEach((track) => track.stop());
    if (capture.stream === stream) capture.stream = null;
    button.disabled = false;
  }
}
$('#upload-open').addEventListener('click', () => $('#upload-dialog').showModal());
$('#upload-close').addEventListener('click', () => $('#upload-dialog').close());
$('#upload-dialog').addEventListener('close', () => {
  resetCapture();
  $('#image-input').value = '';
  $('#image-name').textContent = '';
  $('#recognition-results').replaceChildren();
});
$('#capture-screen').addEventListener('click', captureScreen);
$('#reset-crop').addEventListener('click', () => { capture.crop = null; drawCapture(); });
$('#capture-canvas').addEventListener('pointerdown', (event) => {
  if (!capture.image) return;
  event.preventDefault();
  event.currentTarget.setPointerCapture(event.pointerId);
  capture.start = capturePoint(event);
  capture.crop = null;
  drawCapture();
});
$('#capture-canvas').addEventListener('pointermove', (event) => {
  if (!capture.start) return;
  const point = capturePoint(event);
  const x = Math.min(capture.start.x, point.x);
  const y = Math.min(capture.start.y, point.y);
  const width = Math.abs(point.x - capture.start.x);
  const height = Math.abs(point.y - capture.start.y);
  capture.crop = width > 0.005 && height > 0.005 ? { x, y, width, height } : null;
  drawCapture();
});
$('#capture-canvas').addEventListener('pointerup', () => { capture.start = null; });
$('#capture-canvas').addEventListener('pointercancel', () => { capture.start = null; capture.crop = null; drawCapture(); });
$('#image-input').addEventListener('change', () => {
  const file = $('#image-input').files[0];
  if (!file) return;
  if (file.size > 4 * 1024 * 1024) { $('#image-input').value = ''; return notify('截图不能超过 4 MB。'); }
  resetCapture();
  $('#image-name').textContent = file.name;
  $('#recognition-results').replaceChildren();
});
$('#recognize').addEventListener('click', async () => {
  const file = $('#image-input').files[0];
  if (!file && !capture.image) return notify('请先截取桌面或选择截图。');
  const button = $('#recognize');
  const generation = capture.generation;
  state.recognizing = true;
  renderModel();
  button.disabled = true;
  $('#capture-screen').disabled = true;
  $('#image-input').disabled = true;
  button.textContent = '识别中，请稍候…';
  try {
    const image = capture.image ? selectedImage() : await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
    const result = await post('/api/vision', { image, mode: state.mode });
    if ($('#upload-dialog').open && generation === capture.generation) renderRecognition(result.players);
  } catch (error) { notify(error.message || '读取图片失败。'); }
  finally { state.recognizing = false; button.disabled = false; $('#capture-screen').disabled = false; $('#image-input').disabled = false; button.textContent = '发送截图并识别 ↗'; renderModel(); }
});
$('#chat-form').addEventListener('submit', (event) => { event.preventDefault(); sendChat($('#chat-input').value); });
$('.prompt-chips').addEventListener('click', (event) => { const button = event.target.closest('button'); if (button) sendChat(button.dataset.prompt); });

async function refreshSettings() {
  const [keys, config] = await Promise.all([api('/api/secrets'), api('/api/config')]);
  for (const provider of ['openai', 'deepseek']) {
    const info = keys[provider];
    const label = info.local ? (info.environment ? '本机已设置 · 环境变量备用' : '本机已设置') : (info.environment ? '使用环境变量' : '未设置');
    $(`#${provider}-key-status`).textContent = label;
    $(`.key-form[data-provider="${provider}"] .key-delete`).disabled = !info.local;
  }
  state.config = config;
  renderModel();
  try {
    renderSyncStatus(await api('/api/sync'));
    $('#sync-export').disabled = false;
  } catch (error) {
    $('#sync-status').textContent = error.message;
    $('#sync-import').disabled = true;
    $('#sync-export').disabled = true;
  }
}
function renderSyncStatus(info) {
  const file = !info.exists ? '尚无同步文件' : info.file_changed ? '同步文件有尚未导入的变化' : '同步文件与上次同步一致';
  const data = !info.has_baseline ? '本机尚未建立同步基线' : info.data_changed ? '本机数据有未导出的变化' : '本机数据与上次同步一致';
  $('#sync-status').textContent = `${file}；${data}。`;
  $('#sync-import').disabled = !info.exists;
}
$('#settings-open').addEventListener('click', () => {
  $('#settings-dialog').showModal();
  refreshSettings().catch((error) => notify(error.message));
});
$('#settings-close').addEventListener('click', () => $('#settings-dialog').close());
$('#settings-dialog').addEventListener('close', () => document.querySelectorAll('.key-form').forEach((form) => form.reset()));
for (const form of document.querySelectorAll('.key-form')) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await post('/api/secrets', { provider: form.dataset.provider, action: 'save', key: form.elements.key.value });
      form.reset();
      await refreshSettings();
      notify('本机密钥已加密保存，下一次请求立即生效。');
    } catch (error) { form.reset(); notify(error.message); }
    finally { button.disabled = false; }
  });
  form.querySelector('.key-delete').addEventListener('click', async (event) => {
    if (!window.confirm('删除此设备的本机密钥？若启动时配置了环境变量，将继续使用环境变量中的密钥。')) return;
    event.currentTarget.disabled = true;
    try {
      const result = await post('/api/secrets', { provider: form.dataset.provider, action: 'delete' });
      form.reset();
      await refreshSettings();
      notify(result.environment ? '本机密钥已删除；环境变量中的密钥仍然生效。' : '本机密钥已删除。');
    } catch (error) { notify(error.message); await refreshSettings().catch(() => {}); }
  });
}
async function runSync(action) {
  if (!state.squad) return notify('阵容尚未加载，请刷新页面后重试。');
  if (state.busy || state.recognizing) return notify('请等待对话或截图识别完成后再同步。');
  if (editorIsDirty()) return notify('请先保存或撤销位置编辑中的修改，再进行同步。');
  const importButton = $('#sync-import');
  const exportButton = $('#sync-export');
  importButton.disabled = true;
  exportButton.disabled = true;
  try {
    const info = await api('/api/sync');
    if (action === 'import') {
      if (!info.exists) throw new Error('没有同步文件，请先从 Git 拉取。');
      const warning = info.data_changed ? '本机阵容或球员可能有未导出的修改。' : '';
      if (!window.confirm(`${warning}导入将替换本机已保存的阵容和球员缓存，密钥不会改变。继续吗？`)) return;
    }
    let force = false;
    if (action === 'export' && info.file_changed) {
      force = window.confirm('同步文件有尚未导入的变更。导出将覆盖该文件，建议先导入或备份。仍要覆盖吗？');
      if (!force) return;
    }
    await post(`/api/sync/${action}`, { file_hash: info.file_hash, data_hash: info.data_hash, force });
    if (action === 'import') {
      state.squad = await api('/api/squad');
      await reloadPlayers();
      renderPitch();
      renderEditor();
      state.messages = [];
      notify('同步数据已导入；对话上下文已清空。');
    } else notify('同步数据已导出，请检查文件后自行提交并推送。');
  } catch (error) { notify(error.message); }
  finally { exportButton.disabled = false; await refreshSettings().catch((error) => notify(error.message)); }
}
$('#sync-import').addEventListener('click', () => runSync('import'));
$('#sync-export').addEventListener('click', () => runSync('export'));
initialize();
