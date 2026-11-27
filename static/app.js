const modelModes = ['openai', 'deepseek', 'online', 'local'];
const modelStorageKey = 'fc-online-model-mode';
let modelStorageAvailable = true;
function savedModelMode() {
  try {
    const mode = localStorage.getItem(modelStorageKey);
    return modelModes.includes(mode) ? mode : 'openai';
  } catch (error) {
    modelStorageAvailable = false;
    return 'openai';
  }
}
const state = { squad: null, players: [], selected: 'ST', messages: [], busy: false, recognizing: false, mode: savedModelMode(), config: null };
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const coordinates = { LW: [18, 20], ST: [50, 14], RW: [82, 20], LCM: [33, 39], RCM: [67, 39], CDM: [50, 55], LB: [13, 72], LCB: [35, 72], RCB: [65, 72], RB: [87, 72], GK: [50, 90] };
const personalTacticNames = { AR: '进攻跑动', CC: '创造机会', AS: '进攻倾向', DS: '防守倾向', DP: '压迫防守', DB: '防守', IN: '拦截', PF: '自由跑动', SC: '传中', SR: '积极跑动' };
const personalTacticOptions = {
  forward: { AR: ['均衡的进攻', '前插', '禁区射手', '隐形进攻球员'], DP: ['基础防守支援', '积极参与防守', '留在前场'], IN: ['普通拦截', '积极的拦截', '稳健的拦截'], SR: ['均衡的跑动', '广阔的区域', '留在中央'] },
  wing: { CC: ['适当的创造机会', '突破防守球员', '位于边路'], DS: ['基础防守支援', '积极参与防守', '留在前场'], IN: ['普通拦截', '积极的拦截', '稳健的拦截'], SC: ['均衡的传中', '插入到对方禁区内', '伺机插入'], SR: ['均衡的渗透支援', '向前插入', '靠近队友', '禁区射手'] },
  attackingMidfield: { DS: ['基础防守支援', '积极参与防守', '留在前场'], IN: ['普通拦截', '积极的拦截', '稳健的拦截'], PF: ['维持位置', '自由人', '利用球场宽度'], SC: ['均衡的传中', '插入到对方禁区内', '伺机插入'] },
  midfield: { AS: ['均衡的进攻', '进攻时留在后场', '参与进攻', '防线肋部'], DP: ['照应边路', '照应中路'], IN: ['普通拦截', '积极的拦截', '稳健的拦截'], PF: ['维持位置', '自由人', '利用球场宽度'], SC: ['均衡的传中', '插入到对方禁区内', '伺机插入'] },
  defensiveMidfield: { AS: ['均衡的进攻', '进攻时留在后场', '参与进攻', '防线肋部'], DP: ['照应边路', '照应中路'], DB: ['均衡的防守', '拦截传球', '人盯人防守'], IN: ['普通拦截', '积极的拦截', '稳健的拦截'], PF: ['维持位置', '自由人', '利用球场宽度'], SC: ['均衡的传中', '插入到对方禁区内', '伺机插入'] },
  centerBack: { AS: ['进攻时留在后场', '参与进攻', '充当进攻球员角色'], IN: ['普通拦截', '积极的拦截', '稳健的拦截'] },
  fullBack: { AR: ['均衡的进攻', '积极叠瓦式助攻', '不参与进攻'], IN: ['普通拦截', '积极的拦截', '稳健的拦截'], SR: ['均衡的跑动', '支援中路', '叠瓦式'] },
};
personalTacticOptions.wideMidfield = { CC: personalTacticOptions.wing.CC, DS: personalTacticOptions.wing.DS, IN: personalTacticOptions.wing.IN, PF: personalTacticOptions.attackingMidfield.PF, SC: personalTacticOptions.wing.SC, SR: personalTacticOptions.wing.SR };
function optionsForPosition(position) {
  const groups = { ST: 'forward', CF: 'forward', LW: 'wing', RW: 'wing', CAM: 'attackingMidfield', LM: 'wideMidfield', RM: 'wideMidfield', CM: 'midfield', CDM: 'defensiveMidfield', CB: 'centerBack', LB: 'fullBack', RB: 'fullBack', LWB: 'fullBack', RWB: 'fullBack' };
  return personalTacticOptions[groups[position]] || {};
}
let toastTimer;
const seasonBadgeData = `
ICONTM|ICON THE MOMENT|0
ICONTMB|ICON THE MOMENT B|8
ICON|ICON|1
DR|Derby Rivals|204
26UP|26 Undroppable Player|201
UC|Untouchable Champions|200
SPT|Spartan|190
PTG|Path to Glory|186
WG|Warriors of Glory|184
FAC|Football Association Champions|175
25DP|25 Devoted Player|174
26FSL|26 FCO Super Champions League|191
FSL|25 FCO Super Champions League|173
WS|Winning Streak|171
DCB|Dramatic Comebacks|169
CH|Continental Heroes|168
LE|Legend of Europa|163
NO7|NO.7 LEGENDS (Server: th,vn,cn)|166
NO7KR|NO.7 LEGENDS (Server: kr)|162
WB|Wonderboys|159
GRU|Greatest Runner-Ups|152
BLD|Best Legend|151
BDO|Ballon d'Or|150
EEP|EVO-Energetic Player|207
24EP|Energetic Player 2024|149
ECU|EVO-Champions of Europe|208
CU|Champions of Europe|148
MDL|Medalist|146
EU24|UEFA EURO 2024|140
LD|Last Dance|143
UT|Unexpected Transfer|139
JNM|Journeyman|138
DC|Decades|129
FC|FC Ambassador|88
23HW|23 Hard Worker|89
CC|Century Club|87
HG|Home Grown|82
RTN|Returnees|83
BWC|Best of World Cup|72
WC22|World Cup 2022|73
26TY|Team Of The Year 2026|177
26TYN|Team Of The Year 2026 Nominate|178
25TY|Team Of The Year 2025|154
25TYN|Team Of The Year 2025 Nominate|155
24TY|Team Of The Year 2024|133
24TYN|Team Of The Year 2024 Nominate|134
23TY|Team Of The Year 2023|78
23TYN|Team Of The Year 2023 Nominate|79
22TY|Team Of The Year 2022|60
22TYN|Team Of The Year 2022 Nominate|61
21TY|Team Of The Year 2021|43
21TYN|Team Of The Year 2021 Nominate|44
20TY|Team Of The Year 2020|28
20TYN|Team Of The Year 2020 Nominate|30
19TY|Team Of The Year 2019|20
18TY|Team Of The Year 2018|15
26TS|Team Of The Season 2026|189
25TS|Team Of The Season 2025|167
24TS|Team Of The Season 2024|145
23TS|Team Of The Season 2023|86
22TS|Team Of The Season 2022|68
21TS|Team Of The Season 2021|52
20TS|Team Of The Season 2020|35
19TS|Team Of The Season 2019|23
NHD|National Hero Debut|13
TB|Tournament Best|16
TT|Top Transfer|17
GR|Golden Rookies|19
TC|Tournament Champions|22
HOT|Heroes of the Team|24
SPL|Spotlight|70
LN|Legendary Numbers|69
LOL|Legend of the Loan|66
FA|Free Agent|65
OTW|Ones Time Watch|26
BOE21|Best of Europe 21|55
BOE|Best of Europe 20|34
BTB|Back to Back|58
CAP|Captain|54
EBS|European Best Stars|53
UP|Unsung Player|48
MC|Multi-League Champions|40
VTR|Veteran|36
MOG|Moments of Glory|37
LH|Loyal Heroes|31
COC|Competitors of Continents|25
26HR|26 Heroes|181
25HR|25 Heroes|158
24HR|24 Heroes|137
23HR|23 Heroes|81
22HR|22 Heroes|63
23NG|2023 New Generation|130
22NG|2022 New Generation|76
21NG|2021 New Generation|64
20NG|2020 New Generation|41
19NG|2019 New Generation|27
25UCL|25-26 UEFA Champions League|179
24UCL|24-25 UEFA Champions League|157
23UCL|23-24 UEFA Champions League|136
22UCL|22-23 UEFA Champions League|80
21UCL|21-22 UEFA Champions League|62
20UCL|20-21 UEFA Champions League|45
19UCL|19–20 UEFA Champions League|29
26PL|26 Premium Live|123
25PL|25-26 Premium Live|121
24PL|24-25 Premium Live|119
23PL|23-24 Premium Live|117
22PL|22-23 Premium Live|115
21PL|21-22 Premium Live|113
20A|20-21 PLC Autumn|111
19S|19-20 PLC Spring|109
19A|19-20 PLC Autumn|108
18S|18-19 PLC Spring|107
18A|18-19 PLC Autumn|106
LIVE|2025 LIVE|96
25|25 Live|105
24|2024|104
23|2023|103
22|2022|102
21|2021|101
20|2020|100
19|2019|99
18|2018|98
17|2017|97
25IM|25 ICONS MATCH - Show & Prove|11
25IMF|25 ICONS MATCH - Fan Boost|12
ICONM|ICONS MATCH|9
NTG|Nostalgia|46
JA|Juventus Ambassador|128
RMFC|Real Madrid CF Ambassadors|74
CFA|Chelsea FC Ambassador|56
LA|Liverpool Ambassador|39
PSG|Paris Saint Germain|93
MCI|Man City ICON|21
MCC|17-18 Man City Champions|94
VLA|Volta Live Ambassador|38
26TH|26 Thai Best|199
25TH|25 Thai Best|170
THB|Thai Best|147
THL|Thai Legends|33
26LM|26 Legends Match VN|195
26VB|26 VN Best|193
25VB|25 Vietnam Best|160
24VB|24 Vietnam Best|142
23VB|23 Vietnam Best|85
22VB|22 Vietnam Best|57
VFG|Vietnam Future Generation|75
VNL|Vietnam Legends|50
VN|Viet Nam|18
PRM|Prime|161
IPRM|Infinite Prime|188
HC|Heroes Cartoon|172
TK|TEAM KOREA|187
KHD|Korea Heroes Debut|185
TKI|Team Korea Icons|14
TKL|Team K League|32
12KH|2012 KH|49
26KL|26 K League|122
25KL|25 KLeague|120
24KL|24 KLeague|118
23KL|23 KLeague|116
22KL|22 KLeague|114
21KL|21 KLeague|112
20KL|20 KLeague|110
26KB|26 K League Best|205
25KLB|25 K-League Best|176
24KLB|24 K-League Best|153
23KLB|23 K-League Best|131
22KLB|22 K-League Best|77
21KLB|21 K-League Best|59
20KLB|20 K-League Best|42
K23|Korea Football Association 2023|132
K22|Korea Football Association 2022|90
K21|Korea Football Association 2021|91
K19|Korea Football Association 2019|92
K18|Korea Football Association 2018|95
22TG|22 Totem Legendary|71
21TG|21 Totem Legendary|47
24WL|2024 World Legends|7
23WL|2023 World Legends|6
22WL|2022 World Legends|5
21WL|2021 World Legends|4
20WL|2020 World Legends|3
19WL|2019 World Legends|2
SYL|Snake Year Limitation|156
DYL|Dragon Year Limitation|141
RYL|Rabbit Year Limitation|84
TYL|Tiger Year Limitation|67
MLS|Mythical Legend|144
TKC|Three Kingdoms Legend|135
26CSL|2026 Chinese Super League|203
25CSL|2025 Chinese Super League|165
FLG|Legendary Glory|164
26FCL|26 FC Online League|192
EL|Eternal Legends|10
HYL1|Horse Year Legend: Success Arrives Swiftly|180
HYL2|Horse Year Legend: Leading the Charge|182
HYL3|Horse Year Legend: Spurring Forward at Full Speed|183
CTR|Captain Tsubasa: Rising Young Champions|194
CTT|Captain Tsubasa: Tiger Wing Showdown|197
CTK|Captain Tsubasa: Kickoff on the Green|198`.trim().split('\n').map((line) => line.split('|'));
const seasonBadges = new Map(seasonBadgeData.flatMap(([short, name, index]) => [[short.toLowerCase(), Number(index)], [name.toLowerCase(), Number(index)]]));

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
function allSlots(squad = state.squad) { return [...squad.slots, ...squad.substitutes]; }
function slot() { return allSlots().find((item) => item.key === state.selected); }
function isSubstitute(item) { return item.key.startsWith('SUB'); }
function playerById(id) { return state.players.find((player) => player.id === id); }
function shortName(name) {
  if (!name) return '添加球员';
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}
function playerPortrait(player, eager = false) {
  const portrait = document.createElement('div');
  portrait.className = 'player-portrait';
  const fallback = document.createElement('span');
  fallback.textContent = (player.name || '?').charAt(0).toUpperCase();
  portrait.append(fallback);
  if (typeof player.id === 'string' && /^[a-z0-9]{5,20}$/.test(player.id)) {
    const image = document.createElement('img');
    image.alt = '';
    image.loading = eager ? 'eager' : 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('load', () => fallback.hidden = true);
    image.addEventListener('error', () => image.remove());
    image.src = `https://s1.fifaaddict.com/fo4/players/${player.id}.png`;
    portrait.append(image);
  }
  return portrait;
}
function seasonBadge(season) {
  const index = seasonBadges.get(String(season || '').trim().toLowerCase());
  const badge = document.createElement('span');
  badge.className = 'season-icon';
  if (index === undefined) return badge;
  const image = document.createElement('img');
  image.alt = '';
  image.referrerPolicy = 'no-referrer';
  image.style.left = `${-(index % 18) * 20}px`;
  image.style.top = `${-Math.floor(index / 18) * 16}px`;
  image.addEventListener('load', () => badge.classList.add('loaded'));
  image.addEventListener('error', () => badge.remove());
  image.src = 'https://fifaaddict.com/ffaddv2/img/b447c38.png';
  badge.append(image);
  return badge;
}
function playerPosition(position) {
  const value = String(position || '').trim();
  const normalized = value.toUpperCase();
  const groups = {
    forward: ['ST', 'LS', 'RS', 'CF', 'LF', 'RF', 'LW', 'RW', '前锋', '中锋', '影锋', '左边锋', '右边锋'],
    midfield: ['CAM', 'LAM', 'RAM', 'CM', 'LCM', 'RCM', 'CDM', 'LDM', 'RDM', 'LM', 'RM', '前腰', '中场', '中前卫', '后腰', '左前卫', '右前卫'],
    defense: ['CB', 'LCB', 'RCB', 'LB', 'RB', 'LWB', 'RWB', 'SW', '后卫', '中后卫', '左后卫', '右后卫', '左边后卫', '右边后卫', '清道夫'],
    goalkeeper: ['GK', '门将', '守门员'],
  };
  const group = Object.keys(groups).find((key) => groups[key].includes(normalized)) || 'unknown';
  return `<div class="player-list-position position-${group}" title="位置：${escapeHtml(value || '未知')}">${escapeHtml(value || '—')}</div>`;
}
function footLabel(player) { return { left: '左脚', right: '右脚' }[player.preferred_foot] || '未知'; }
let footSpriteProbe;
function playerMetrics(player) {
  if (!footSpriteProbe) {
    footSpriteProbe = new Image();
    footSpriteProbe.referrerPolicy = 'no-referrer';
    footSpriteProbe.addEventListener('load', () => document.documentElement.classList.add('foot-sprite-loaded'));
    footSpriteProbe.src = 'https://fifaaddict.com/ffaddv2/img/4364840.png';
  }
  const left = player.left_foot ?? '—';
  const right = player.right_foot ?? '—';
  const salary = player.salary ?? '—';
  const ovr = player.ovr ?? '—';
  const footDescription = `左脚 ${left}，右脚 ${right}，惯用脚 ${footLabel(player)}`;
  return `<div class="player-metrics"><div class="foot-pair" role="img" aria-label="${escapeHtml(footDescription)}" title="${escapeHtml(footDescription)}"><span class="foot-value ${player.preferred_foot === 'left' ? 'preferred' : ''}" aria-hidden="true">${escapeHtml(left)}</span><span class="foot-value ${player.preferred_foot === 'right' ? 'preferred' : ''}" aria-hidden="true">${escapeHtml(right)}</span></div><span class="salary-badge" aria-label="工资 ${escapeHtml(salary)}" title="工资 ${escapeHtml(salary)}">${escapeHtml(salary)}</span><span class="player-rating" aria-label="总评 ${escapeHtml(ovr)}" title="总评 ${escapeHtml(ovr)}">${escapeHtml(ovr)}</span></div>`;
}
let detailRequest = 0;
function renderPlayerDetail(player, status) {
  const content = $('#player-detail-content');
  const attributes = Object.entries(player.attributes || {});
  const traits = Array.isArray(player.trait_details) ? player.trait_details : (player.traits || []).map((name) => ({ name }));
  const profile = player.profile || {};
  const career = Array.isArray(player.club_career) ? player.club_career : [];
  const fetched = player.fetched_at ? new Date(player.fetched_at).toLocaleString('zh-CN') : '尚未获取';
  const workrate = (value) => ({ low: '低', mid: '中', high: '高' }[value] || value || '未知');
  const fields = [['赛季', player.season || '未知'], ['位置', player.position || '未知'], ['总评 OVR', player.ovr ?? '未知'], ['工资', player.salary ?? '未知'], ['惯用脚', footLabel(player)], ['逆足', player.weak_foot ?? '未知'], ['身高', player.height_cm == null ? '未知' : `${player.height_cm} cm`], ['体重', player.weight_kg == null ? '未知' : `${player.weight_kg} kg`], ['体型', profile.bodytype_name || '未知'], ['俱乐部', player.club || '未知'], ['国籍', profile.nation_name || '未知'], ['联赛', profile.league_name || '未知'], ['出生日期', profile.birthdate || '未知'], ['年龄', profile.age || '未知'], ['球衣号码', profile.number ?? '未知'], ['花式动作', profile.skill_level ? `${profile.skill_level} 星` : '未知'], ['进攻 / 防守倾向', `${workrate(profile.workrate_att)} / ${workrate(profile.workrate_def)}`], ['名声', profile.reputation || '未知']];
  const traitHtml = traits.length ? traits.map((trait) => `<div class="detail-trait">${/^\d{1,6}$/.test(trait.id || '') ? `<img loading="lazy" src="https://s1.fifaaddict.com/fo4/traits/trait_icon_${trait.id}.png" alt="">` : ''}<div><strong>${escapeHtml(trait.name)}</strong><p>${escapeHtml(trait.effect || '效果暂未获取')}</p></div></div>`).join('') : '<p>暂无特殊能力数据</p>';
  const careerHtml = career.length ? career.map((item) => `<div class="detail-career-row"><span>${escapeHtml(item.year)}</span><strong>${escapeHtml(item.team)}${item.loan ? '（租借）' : ''}</strong></div>`).join('') : `<p>${player.club_career ? '数据源暂无俱乐部经历' : '尚未获取，请刷新球员资料'}</p>`;
  content.innerHTML = `<div class="detail-heading"><div class="detail-portrait"></div><div><h3>${escapeHtml(player.name)}</h3><p>${escapeHtml(player.season || '未知赛季')} · ${escapeHtml(player.position || '位置未知')}</p></div></div><p class="detail-status">${escapeHtml(status)}</p><div class="detail-grid">${fields.map(([label, value]) => `<div><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`).join('')}</div><section class="detail-section"><h3>${player.profile ? '全部基础能力值' : '已获取的能力值'}</h3><div class="detail-attributes">${attributes.length ? attributes.map(([name, value]) => `<div><span>${escapeHtml(name)}</span><strong>${escapeHtml(value)}</strong></div>`).join('') : '<p>暂无数据</p>'}</div><small>${escapeHtml(player.attributes_note || '详情仅显示数据源已提供的部分属性。')}</small></section><section class="detail-section"><h3>特殊能力</h3><div class="detail-traits">${traitHtml}</div></section><section class="detail-section"><h3>INFO</h3><p>${escapeHtml(player.description || '暂无资料')}</p></section><section class="detail-section"><h3>俱乐部经历</h3>${careerHtml}</section><p class="detail-source">${escapeHtml(player.data_note || '第三方数据，不代表国服官方实时数据。')}<br>获取时间：${escapeHtml(fetched)} · <a href="https://cn.fifaaddict.com/fo4db/pid${escapeHtml(player.id)}" target="_blank" rel="noopener noreferrer">查看来源 ↗</a></p>`;
  content.querySelector('.detail-portrait').append(playerPortrait(player, true));
}
async function openPlayerDetail(player, local) {
  const request = ++detailRequest;
  const dialog = $('#player-detail-dialog');
  const needsFetch = !local || player.salary == null || !player.preferred_foot || !player.profile || !Array.isArray(player.trait_details) || !Array.isArray(player.club_career);
  renderPlayerDetail(player, needsFetch ? '正在获取 FIFA Addict 详情…' : '显示本地缓存；可通过球员列表中的“刷新”更新。');
  if (!dialog.open) dialog.showModal();
  if (!needsFetch) return;
  try {
    const result = await api(`/api/player-detail?id=${encodeURIComponent(player.id)}`);
    if (request === detailRequest && dialog.open) renderPlayerDetail(result.player, '已联网获取详情；仅供查看，不会自动导入或修改缓存。');
  } catch (error) {
    if (request === detailRequest && dialog.open) renderPlayerDetail(player, `详情获取失败：${error.message}${local ? ' 当前显示本地缓存。' : ''}`);
  }
}
$('#player-detail-close').addEventListener('click', () => $('#player-detail-dialog').close());
$('#player-detail-dialog').addEventListener('close', () => { detailRequest += 1; });
function tacticColor(code) {
  if (['CC', 'AR', 'AS'].includes(code)) return 'red';
  if (['SC', 'SR'].includes(code)) return 'green';
  if (['DS', 'DP', 'DB'].includes(code)) return 'blue';
  if (['IN', 'PF'].includes(code)) return 'teal';
  return 'neutral';
}
function tacticDescription(tactics = {}) {
  const parts = (tactics.instructions || []).map((item) => `${item.code} ${item.value}`);
  if (tactics.attack_work_rate != null) parts.push(`进攻倾向 ${tactics.attack_work_rate}`);
  if (tactics.defense_work_rate != null) parts.push(`防守倾向 ${tactics.defense_work_rate}`);
  return parts.length ? parts.join('，') : '个人战术未设置';
}
function enhancementLevel(value) {
  const match = String(value || '').trim().match(/^\+?\s*(\d{1,2})\s*强?$/);
  const level = match ? Number(match[1]) : null;
  return level >= 1 && level <= 13 ? level : null;
}
function enhancementStyle(value) {
  const level = enhancementLevel(value);
  if (level == null) return { style: 'unknown', label: '卡色未识别' };
  if (level >= 1 && level <= 4) return { style: 'bronze', label: '铜卡' };
  if (level <= 7 && level >= 5) return { style: 'silver', label: '银卡' };
  if (level <= 10 && level >= 8) return { style: 'gold', label: '金卡' };
  if (level <= 13 && level >= 11) return { style: 'diamond', label: '钻石卡' };
  return { style: 'unknown', label: '卡色未识别' };
}
const fullPlayerLevelBonus = 4;
const enhancementOvrBonus = [null, 0, 1, 2, 4, 6, 8, 11, 15, 17, 19, 21, 24, 27];
const enhancementTeams = [
  { name: '银卡军团', minimum: 5, bonuses: [1, 2] },
  { name: '金卡军团', minimum: 8, bonuses: [2, 3] },
  { name: '钻石军团', minimum: 11, bonuses: [3, 4] },
];
function estimatePitchRating(item, linked, starters) {
  const base = linked?.ovr;
  if (!Number.isInteger(base) || base < 0) return { value: null, explanation: '缺少关联球员的来源总评' };
  const level = enhancementLevel(item.level);
  if (level == null) return { value: null, explanation: `数据源总评 ${base}；请填写 1–13 的强化等级` };
  const filled = starters.filter((starter) => starter.name?.trim());
  const unknown = filled.filter((starter) => enhancementLevel(starter.level) == null).length;
  const club = filled.length >= 11 ? 4 : filled.length >= 8 ? 3 : filled.length >= 3 ? 1 : 0;
  const teams = enhancementTeams.filter((team) => level >= team.minimum).map((team) => {
    const count = filled.filter((starter) => enhancementLevel(starter.level) >= team.minimum).length;
    const bonus = (total) => total >= 8 ? team.bonuses[1] : total >= 5 ? team.bonuses[0] : 0;
    return { name: team.name, minimum: bonus(count), maximum: bonus(count + unknown) };
  });
  const minimum = Math.max(0, ...teams.map((team) => team.minimum));
  const maximum = Math.max(0, ...teams.map((team) => team.maximum));
  if (minimum !== maximum) return { value: null, explanation: `数据源总评 ${base}；其他首发强化等级未填写，军团加成不确定` };
  const applied = [...teams].reverse().find((team) => team.minimum === minimum && minimum > 0);
  const teamName = unknown && minimum ? '强化军团' : applied?.name || '强化军团';
  const enhancement = enhancementOvrBonus[level];
  return { value: base + fullPlayerLevelBonus + enhancement + club + minimum, explanation: `估算总评：数据源 ${base}（按 1 强、1 级基准假设） + 球员满级 ${fullPlayerLevelBonus} + 强化 ${enhancement} + 曼联套 ${club} + ${teamName} ${minimum}；仅按首发统计，未计算细项加成` };
}
function estimateSubstituteRating(item, linked) {
  const base = linked?.ovr;
  if (!Number.isInteger(base) || base < 0) return { value: null, label: '总评', explanation: '缺少关联球员的来源总评' };
  const level = enhancementLevel(item.level);
  if (level == null) return { value: base, label: '来源总评', explanation: `数据源总评 ${base}；填写 1–13 的强化等级后可计算个人总评` };
  const enhancement = enhancementOvrBonus[level];
  return { value: base + fullPlayerLevelBonus + enhancement, label: '总评', explanation: `个人总评：数据源 ${base}（按 1 强、1 级基准假设） + 球员满级 ${fullPlayerLevelBonus} + 强化 ${enhancement}；未计算队套、军团及细项加成，可能与游戏不同` };
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
    const tactics = item.personal_tactics || {};
    const instructions = tactics.instructions || [];
    const description = tacticDescription(tactics);
    const linked = playerById(item.player_id);
    const rating = estimatePitchRating(item, linked, state.squad.slots);
    const ovr = rating.value;
    const salary = linked?.salary ?? null;
    const ratingStyle = enhancementStyle(item.level);
    const details = item.name ? `，估算总评 ${ovr ?? '未知'}，工资 ${salary ?? '未知'}，强化 ${item.level || '未设置'}${item.level ? `（${ratingStyle.label}）` : ''}，赛季 ${item.season || '未知'}` : '';
    const source = linked ? `；FIFA Addict 数据获取于 ${linked.fetched_at ? new Date(linked.fetched_at).toLocaleString('zh-CN') : '未知时间'}；${rating.explanation}` : item.name ? '；未关联球员卡，头像、总评和工资未知' : '';
    player.setAttribute('aria-label', `${item.position} ${item.name || '添加球员'}${details}，${description}${source}`);
    player.title = `${item.position} ${item.name || '添加球员'}${details}；${description}${source}；点击查看或编辑`;
    const badges = instructions.slice(0, 3).map((entry) => `<span class="pitch-instruction ${tacticColor(entry.code)}"><span>${escapeHtml(entry.code)}</span><span>${entry.value === 0 ? '' : escapeHtml(entry.value)}</span></span>`).join('');
    const extra = instructions.length > 3 ? `<span class="pitch-extra">+${instructions.length - 3}</span>` : '';
    const attack = tactics.attack_work_rate == null ? '' : `<span class="work-rate red">${escapeHtml(tactics.attack_work_rate)}</span>`;
    const defense = tactics.defense_work_rate == null ? '' : `<span class="work-rate">${escapeHtml(tactics.defense_work_rate)}</span>`;
    const face = item.name ? `<span class="pitch-player-visual"><span class="pitch-salary">${escapeHtml(salary ?? '—')}</span><span class="pitch-portrait-slot"></span><span class="pitch-ovr">${ovr == null ? '—' : escapeHtml(ovr)}</span></span>` : '<span class="player-shirt">+</span>';
    const label = item.name ? `<span class="player-name"><span class="pitch-season"><span class="pitch-season-icon"></span><span class="pitch-season-text">${escapeHtml(item.season || '?')}</span></span><span class="pitch-name-text">${escapeHtml(shortName(item.name))}</span>${item.level ? `<span class="pitch-level ${ratingStyle.style}">${escapeHtml(item.level)}</span>` : ''}</span>` : '<span class="player-name">添加球员</span>';
    player.innerHTML = `<span class="pitch-instructions" aria-hidden="true">${badges}${extra}</span><span class="player-position">${escapeHtml(item.position)}</span><span class="pitch-work-rates" aria-hidden="true">${attack}${defense}</span>${face}${label}`;
    if (item.name) {
      player.querySelector('.pitch-portrait-slot').append(playerPortrait(linked || { name: item.name }, true));
      player.querySelector('.pitch-season-icon').replaceWith(seasonBadge(item.season));
    }
    player.addEventListener('click', () => selectSlot(item.key));
    pitch.append(player);
  }
  $('#filled-count').textContent = state.squad.slots.filter((item) => item.name).length;
  $('#formation-label').textContent = state.squad.formation || '4-1-2-3';
  renderBench();
}
function renderBench() {
  const list = $('#bench-list');
  list.replaceChildren();
  for (const item of state.squad.substitutes) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `bench-player${item.key === state.selected ? ' selected' : ''}`;
    button.setAttribute('aria-pressed', String(item.key === state.selected));
    const linked = playerById(item.player_id);
    const rating = estimateSubstituteRating(item, linked);
    const position = linked?.position || '未知';
    const salary = linked?.salary ?? '—';
    const levelStyle = enhancementStyle(item.level);
    const ratingText = rating.value == null ? '—' : String(rating.value);
    const source = linked ? `FIFA Addict 获取时间：${linked.fetched_at ? new Date(linked.fetched_at).toLocaleString('zh-CN') : '未知'}` : '未关联球员卡';
    const description = `替补 ${item.key.slice(3)}，${item.name || '添加球员'}，资料位置 ${position}，${item.position ? `已选位置 ${item.position}，` : ''}赛季 ${item.season || '未知'}，强化 ${item.level || '未设置'}，工资 ${salary}，${rating.label} ${ratingText}；${rating.explanation}；${source}`;
    button.setAttribute('aria-label', description);
    button.title = description;
    button.innerHTML = item.name ? `<span class="bench-slot">${escapeHtml(item.key)} · ${escapeHtml(position)}</span><span class="bench-main"><span class="bench-portrait-slot"></span><span class="bench-metrics"><span class="bench-rating-label">${escapeHtml(rating.label)}</span><span class="bench-rating">${escapeHtml(ratingText)}</span><span class="bench-salary">工资 ${escapeHtml(salary)}</span></span></span><strong class="bench-name">${escapeHtml(item.name)}</strong><span class="bench-meta"><span class="pitch-season bench-season"><span class="bench-season-icon"></span><span class="pitch-season-text">${escapeHtml(item.season || '未知赛季')}</span></span><span class="pitch-level ${levelStyle.style}">${escapeHtml(item.level || '未设置')}</span></span>${item.position ? `<small>已选位置 ${escapeHtml(item.position)}</small>` : ''}` : `<span class="bench-slot">${escapeHtml(item.key)}</span><strong class="bench-empty">＋ 添加球员</strong><small>选择席位填写或关联</small>`;
    if (item.name) {
      button.querySelector('.bench-portrait-slot').append(playerPortrait(linked || { name: item.name }, true));
      button.querySelector('.bench-season-icon').replaceWith(seasonBadge(item.season));
    }
    button.addEventListener('click', () => selectSlot(item.key));
    list.append(button);
  }
  $('#bench-count').textContent = state.squad.substitutes.filter((item) => item.name).length;
}
function renderPersonalInstructions(position, instructions = []) {
  const options = optionsForPosition(position);
  const values = new Map(instructions.map((item) => [item.code, item.value]));
  const codes = [...Object.keys(options), ...instructions.map((item) => item.code).filter((code) => !(code in options))];
  $('#personal-instructions').innerHTML = codes.map((code) => {
    const available = options[code] || [];
    const value = values.get(code);
    const legacy = value != null && !available[value];
    const label = personalTacticNames[code] || '旧战术';
    const choices = available.map((name, index) => `<option value="${index}"${value === index ? ' selected' : ''}>${escapeHtml(code)}${index || ''} · ${escapeHtml(name)}</option>`).join('');
    const previous = legacy ? `<option value="${value}" selected disabled>保留旧值：${escapeHtml(code)} ${value}（请核对）</option>` : '';
    return `<label class="instruction-row"><span class="instruction-label ${tacticColor(code)}"><strong>${escapeHtml(code)}</strong><small>${escapeHtml(label)}</small></span><select class="instruction-value" data-code="${escapeHtml(code)}" aria-label="${escapeHtml(label)} ${escapeHtml(code)}"><option value="">未设置</option>${choices}${previous}</select></label>`;
  }).join('') || '<p class="instructions-empty">该位置暂无已核实的战术选项。</p>';
}
function renderWorkRate(selector, value) {
  const select = $(selector);
  select.innerHTML = '<option value="">未设置</option>' + [1, 2, 3].map((number) => `<option value="${number}">${number}</option>`).join('');
  if (value != null && ![1, 2, 3].includes(value)) select.insertAdjacentHTML('beforeend', `<option value="${value}" disabled>保留旧值：${value}（请核对）</option>`);
  select.value = value ?? '';
}
function renderEditor() {
  const selected = slot();
  $('#selected-slot').textContent = isSubstitute(selected) ? `替补 ${selected.key.slice(3)}` : selected.key;
  $('.personal-tactics-editor').hidden = isSubstitute(selected);
  $('#slot-position').value = selected.position;
  $('#slot-position').dataset.previousPosition = selected.position;
  $('#slot-name').value = selected.name || '';
  $('#slot-season').value = selected.season || '';
  $('#slot-level').value = selected.level || '';
  const tactics = selected.personal_tactics || {};
  renderPersonalInstructions(isSubstitute(selected) ? '' : selected.position, tactics.instructions || []);
  renderWorkRate('#attack-work-rate', tactics.attack_work_rate);
  renderWorkRate('#defense-work-rate', tactics.defense_work_rate);
  renderLinkedPlayer();
}
function renderLinkedPlayer() {
  const selected = slot();
  const linked = playerById(selected.player_id);
  $('#linked-player').textContent = linked ? `已关联：${linked.name} · ${linked.season} · 数据源总评 ${linked.ovr ?? '未知'}` : '尚未关联球员数据';
  const explanation = $('#slot-rating-explanation');
  const rating = selected.name ? (isSubstitute(selected) ? estimateSubstituteRating(selected, linked) : estimatePitchRating(selected, linked, state.squad.slots)).explanation : '';
  explanation.textContent = rating && linked ? `${rating}；FIFA Addict 获取时间：${linked.fetched_at ? new Date(linked.fetched_at).toLocaleString('zh-CN') : '未知'}` : rating;
  explanation.hidden = !explanation.textContent;
}
function selectSlot(key) {
  if (state.saving) return notify('正在保存阵容，请稍候。');
  if (key === state.selected) return;
  if (editorIsDirty() && !window.confirm('当前位置有未保存的修改，切换后将丢失。继续吗？')) return;
  state.selected = key;
  renderPitch();
  renderEditor();
  renderPlayers();
}
function editorIsDirty() {
  const selected = slot();
  const tactics = selected.personal_tactics || {};
  const savedInstructions = new Map((tactics.instructions || []).map((item) => [item.code, String(item.value)]));
  const chosen = Array.from(document.querySelectorAll('.instruction-value')).filter((input) => input.value !== '');
  const changedInstructions = chosen.length !== savedInstructions.size || chosen.some((input) => savedInstructions.get(input.dataset.code) !== input.value);
  return $('#slot-position').value !== selected.position || $('#slot-name').value !== (selected.name || '') || $('#slot-season').value !== (selected.season || '') || $('#slot-level').value !== (selected.level || '') || changedInstructions || $('#attack-work-rate').value !== String(tactics.attack_work_rate ?? '') || $('#defense-work-rate').value !== String(tactics.defense_work_rate ?? '');
}
function readNumber(input, max, label) {
  if (input.validity.badInput) throw new Error(`${label}必须是整数。`);
  const value = input.value.trim();
  if (!value) return null;
  if (!/^\d+$/.test(value) || Number(value) > max) throw new Error(`${label}必须是 0 至 ${max} 的整数。`);
  return Number(value);
}
function readPersonalTactics() {
  const chosen = new Map();
  for (const input of document.querySelectorAll('.instruction-value')) {
    if (input.value !== '') chosen.set(input.dataset.code, Number(input.value));
  }
  if (chosen.size > 6) throw new Error('每个位置最多保存 6 项个人战术，请先清除不需要的旧值。');
  const instructions = [];
  for (const item of slot().personal_tactics?.instructions || []) {
    if (chosen.has(item.code)) {
      instructions.push({ code: item.code, value: chosen.get(item.code) });
      chosen.delete(item.code);
    }
  }
  for (const [code, value] of chosen) instructions.push({ code, value });
  const tactics = {};
  if (instructions.length) tactics.instructions = instructions;
  for (const [field, selector] of [['attack_work_rate', '#attack-work-rate'], ['defense_work_rate', '#defense-work-rate']]) {
    if ($(selector).value !== '') tactics[field] = Number($(selector).value);
  }
  return tactics;
}
function renderTeamTactics() {
  const tactics = state.squad.team_tactics || {};
  document.querySelectorAll('[data-team-tactic]').forEach((input) => { input.value = tactics[input.dataset.teamTactic] ?? ''; });
}
function teamTacticsIsDirty() {
  const tactics = state.squad.team_tactics || {};
  return Array.from(document.querySelectorAll('[data-team-tactic]')).some((input) => input.value !== String(tactics[input.dataset.teamTactic] ?? '') || input.validity.badInput);
}
function readTeamTactics() {
  const tactics = {};
  for (const input of document.querySelectorAll('[data-team-tactic]')) {
    const value = input.type === 'number' ? readNumber(input, 100, '球队战术数值') : input.value.trim();
    if (value !== null && value !== '') tactics[input.dataset.teamTactic] = value;
  }
  return tactics;
}
async function saveSquad(candidate, resetEditor = true) {
  if (state.saving) throw new Error('正在保存阵容，请稍候。');
  state.saving = true;
  document.querySelectorAll('#editor input, #editor select, #editor button, #team-tactics input, #team-tactics button').forEach((element) => { element.disabled = true; });
  try {
    state.squad = await post('/api/squad', candidate);
    renderPitch();
    if (resetEditor) renderEditor();
  } finally {
    state.saving = false;
    document.querySelectorAll('#editor input, #editor select, #editor button, #team-tactics input, #team-tactics button').forEach((element) => { element.disabled = false; });
  }
}
function copySquad() { return JSON.parse(JSON.stringify(state.squad)); }
async function saveEditor() {
  const tactics = isSubstitute(slot()) ? {} : readPersonalTactics();
  const candidate = copySquad();
  const selected = allSlots(candidate).find((item) => item.key === state.selected);
  const newName = $('#slot-name').value.trim();
  const newSeason = $('#slot-season').value.trim();
  const linked = playerById(selected.player_id);
  if (linked && (newName !== selected.name || newSeason !== selected.season)) delete selected.player_id;
  Object.assign(selected, { position: $('#slot-position').value, name: newName, season: newSeason, level: $('#slot-level').value.trim() });
  if (Object.keys(tactics).length) selected.personal_tactics = tactics;
  else delete selected.personal_tactics;
  await saveSquad(candidate);
  notify(isSubstitute(selected) ? '替补球员已保存。' : '球员和个人战术已保存。');
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
    const stats = Object.entries(player.attributes || {}).slice(0, 6).map(([name, value]) => `${name} ${value}`).join(' · ');
    row.innerHTML = `${playerPosition(player.position)}<div class="player-portrait-slot"></div><div class="player-information"><strong><span class="season-icon-slot"></span><button class="player-detail-link" type="button">${escapeHtml(player.name)}</button></strong><small>${escapeHtml(player.season || '未知赛季')}${player.club ? ' · ' + escapeHtml(player.club) : ''}</small><small>${escapeHtml(stats || '暂无主要能力摘要')}</small><small>获取于 ${escapeHtml(time)} · <a href="${escapeHtml(player.source_url)}" target="_blank" rel="noopener noreferrer">查看来源 ↗</a></small></div>${playerMetrics(player)}<div class="player-actions"><button type="button" class="link-player">关联到 ${escapeHtml(state.selected)}</button><button type="button" class="refresh-player">刷新</button></div>`;
    row.querySelector('.player-detail-link').addEventListener('click', () => openPlayerDetail(player, true));
    row.querySelector('.player-portrait-slot').append(playerPortrait(player, list.childElementCount < 8));
    row.querySelector('.season-icon-slot').replaceWith(seasonBadge(player.season));
    row.querySelector('.link-player').addEventListener('click', async () => {
      if (editorIsDirty() && !window.confirm('位置编辑有未保存的修改，关联后将丢失。继续吗？')) return;
      const candidate = copySquad();
      const selected = allSlots(candidate).find((item) => item.key === state.selected);
      Object.assign(selected, { player_id: player.id, name: player.name, season: player.season });
      try { await saveSquad(candidate); renderPlayers(); notify(`已关联到 ${selected.key}，请核对强化等级。`); } catch (error) { notify(error.message); }
    });
    row.querySelector('.refresh-player').addEventListener('click', () => importPlayer(player.source_url));
    list.append(row);
  }
}
async function reloadPlayers() {
  const result = await api('/api/players');
  state.players = result.players;
  if (state.squad) renderPitch();
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
async function searchOnlinePlayers(query) {
  const button = $('#online-search-form button');
  const status = $('#online-search-status');
  const results = $('#online-search-results');
  button.disabled = true;
  status.textContent = '正在搜索 FIFA Addict…';
  results.replaceChildren();
  try {
    const result = await api(`/api/player-search?q=${encodeURIComponent(query)}`);
    status.textContent = (result.players.length ? `找到 ${result.players.length} 条结果${result.truncated ? '，仅显示前 100 条，请使用更精确的名称' : ''}。请选择对应赛季导入。` : '未找到匹配的球员，请尝试其他名称。') + (result.warning ? ` ${result.warning}` : '');
    for (const player of result.players) {
      const row = document.createElement('article');
      row.className = 'player-row';
      row.innerHTML = `${playerPosition(player.position)}<div class="player-portrait-slot"></div><div class="player-information"><strong><span class="season-icon-slot"></span><button class="player-detail-link" type="button">${escapeHtml(player.name)}</button></strong><small>赛季 ${escapeHtml(player.season || '未知')}</small></div>${playerMetrics(player)}<div class="player-actions"><button class="import-player" type="button">导入详情</button></div>`;
      row.querySelector('.player-detail-link').addEventListener('click', () => openPlayerDetail(player, false));
      row.querySelector('.player-portrait-slot').append(playerPortrait(player, results.childElementCount < 8));
      row.querySelector('.season-icon-slot').replaceWith(seasonBadge(player.season));
      row.querySelector('.import-player').addEventListener('click', async (event) => {
        const importButton = event.currentTarget;
        importButton.disabled = true;
        try { await importPlayer(player.id); } finally { importButton.disabled = false; }
      });
      results.append(row);
    }
  } catch (error) { status.textContent = error.message; }
  finally { results.scrollTop = 0; button.disabled = false; }
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
    row.innerHTML = `<div class="recognition-meta">识别位置：${escapeHtml(player.position || '未知')} <span>置信度：${escapeHtml(player.confidence || '未知')}</span></div><div class="recognition-fields"><input class="recognized-name" aria-label="球员名称" placeholder="球员名称" value="${escapeHtml(player.name)}"><input class="recognized-season" aria-label="赛季" placeholder="赛季" value="${escapeHtml(player.season)}"><input class="recognized-level" aria-label="强化" placeholder="强化" value="${escapeHtml(player.level)}"></div><div class="recognition-actions"><select aria-label="选择阵容位置"><option value="">选择要写入的位置</option>${allSlots().map((item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.key)} · ${escapeHtml(item.name || '空位')}</option>`).join('')}</select><button class="button dark" type="button">确认写入</button></div>`;
    row.querySelector('button').addEventListener('click', async () => {
      const key = row.querySelector('select').value;
      const name = row.querySelector('.recognized-name').value.trim();
      if (!key || !name) return notify('请选择位置并确认球员名称。');
      const target = allSlots().find((item) => item.key === key);
      if (editorIsDirty() && !window.confirm('位置编辑有未保存的修改，写入后将丢失。继续吗？')) return;
      if (target.name && !window.confirm(`将覆盖 ${key} 的 ${target.name}，继续吗？`)) return;
      const candidate = copySquad();
      const updated = allSlots(candidate).find((item) => item.key === key);
      Object.assign(updated, { name, season: row.querySelector('.recognized-season').value.trim(), level: row.querySelector('.recognized-level').value.trim() });
      delete updated.player_id;
      try { await saveSquad(candidate); selectSlot(key); row.querySelector('button').textContent = '已写入'; row.querySelector('button').disabled = true; notify('候选已写入，请关联对应的球员卡。'); } catch (error) { notify(error.message); }
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
  $('#model-hint').textContent = local ? '连接本机 Ollama；如使用 Ollama 云模型，阵容和战术等数据仍可能发送到远程。' : `使用 ${provider}：问题、阵容和战术摘要及主动发送的截图会传给该服务，可能产生费用。` + (config && !config.vision ? ' 视觉模型未配置。' : ' 模型能力和余额需自行确认。');
  $('#chat-privacy').textContent = local ? '问题、对话及已保存的阵容和战术将发送至本机 Ollama；使用云模型时可能传至远程。' : `问题、对话及已保存的阵容和战术将发送给 ${provider}。`;
  $('#vision-privacy').textContent = local ? '当前使用本机 Ollama。点击发送后才会传送截图；使用云模型时可能传至远程。识别结果需要逐项确认。' : `当前使用 ${provider}。点击发送后截图将传给该服务；识别结果需要逐项确认。`;
}
$('#model-mode').addEventListener('change', (event) => {
  state.mode = event.target.value;
  state.messages = [];
  try {
    localStorage.setItem(modelStorageKey, state.mode);
    modelStorageAvailable = true;
  } catch (error) {
    modelStorageAvailable = false;
  }
  renderModel();
  notify(modelStorageAvailable ? '已切换模型，之前的对话不会作为上下文发送。' : '已切换模型，但浏览器存储不可用，刷新后可能恢复之前的选择。');
});
async function initialize() {
  try {
    state.squad = await api('/api/squad');
    await reloadPlayers();
    renderEditor();
    renderTeamTactics();
    state.config = await api('/api/config');
    renderModel();
  } catch (error) { notify(error.message); }
}
$('#slot-position').addEventListener('change', (event) => {
  const select = event.currentTarget;
  if (isSubstitute(slot())) {
    select.dataset.previousPosition = select.value;
    return;
  }
  if (Array.from(document.querySelectorAll('.instruction-value')).some((input) => input.value !== '') && !window.confirm('不同位置的个人战术选项可能不同。更改位置将清除当前已选择的个人战术，保存后才会生效；进攻和防守倾向保留。继续吗？')) {
    select.value = select.dataset.previousPosition;
    return;
  }
  select.dataset.previousPosition = select.value;
  renderPersonalInstructions(select.value);
});
$('#save-slot').addEventListener('click', () => saveEditor().catch((error) => notify(error.message)));
$('#clear-slot').addEventListener('click', async () => {
  if (editorIsDirty() && !window.confirm(isSubstitute(slot()) ? '替补席位有未保存的修改，清空球员将丢弃这些修改。继续吗？' : '位置编辑有未保存的修改，清空球员将丢弃这些修改，已保存的个人战术会保留。继续吗？')) return;
  const candidate = copySquad();
  const selected = allSlots(candidate).find((item) => item.key === state.selected);
  Object.assign(selected, { name: '', season: '', level: '' });
  if (isSubstitute(selected)) selected.position = '';
  delete selected.player_id;
  try { await saveSquad(candidate); notify(isSubstitute(selected) ? '替补球员已清空。' : '球员已清空，位置战术保留。'); } catch (error) { notify(error.message); }
});
$('#team-tactics-open').addEventListener('click', () => {
  if (!state.squad) return notify('阵容尚未加载，请刷新页面后重试。');
  if (state.saving) return notify('正在保存阵容，请稍候。');
  $('#team-tactics-status').textContent = '';
  $('#team-tactics').showModal();
});
function closeTeamTactics() {
  if (state.saving) return;
  if (teamTacticsIsDirty() && !window.confirm('球队战术有未保存的修改，关闭后将丢失。继续吗？')) return;
  renderTeamTactics();
  $('#team-tactics').close();
}
$('#team-tactics-close').addEventListener('click', closeTeamTactics);
$('#team-tactics').addEventListener('cancel', (event) => {
  event.preventDefault();
  closeTeamTactics();
});
$('#save-team-tactics').addEventListener('click', async () => {
  try {
    const tactics = readTeamTactics();
    const candidate = copySquad();
    if (Object.keys(tactics).length) candidate.team_tactics = tactics;
    else delete candidate.team_tactics;
    await saveSquad(candidate, false);
    renderTeamTactics();
    $('#team-tactics-status').textContent = '球队战术已保存。';
  } catch (error) { $('#team-tactics-status').textContent = error.message; }
});
$('#reset-team-tactics').addEventListener('click', () => {
  if (teamTacticsIsDirty() && !window.confirm('撤销球队战术中未保存的修改？')) return;
  renderTeamTactics();
});
window.addEventListener('beforeunload', (event) => {
  if (state.squad && (state.saving || editorIsDirty() || teamTacticsIsDirty())) {
    event.preventDefault();
    event.returnValue = '';
  }
});
$('#online-search-form').addEventListener('submit', (event) => { event.preventDefault(); searchOnlinePlayers($('#online-search').value.trim()); });
$('#player-form').addEventListener('submit', (event) => { event.preventDefault(); importPlayer($('#player-url').value); });
$('#search').addEventListener('input', renderPlayers);
const capture = { image: null, crop: null, start: null, generation: 0, stream: null, loading: false };

function resetCapture() {
  capture.generation += 1;
  if (capture.stream) capture.stream.getTracks().forEach((track) => track.stop());
  capture.stream = null;
  capture.loading = false;
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
function showCapture(image, name) {
  capture.image = image;
  capture.crop = null;
  capture.start = null;
  $('#image-input').value = '';
  $('#image-name').textContent = name;
  $('#recognition-results').replaceChildren();
  const canvas = $('#capture-canvas');
  const scale = Math.min(1, 1200 / image.width);
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  $('#capture-preview').hidden = false;
  drawCapture();
}
async function captureScreen() {
  if (!navigator.mediaDevices?.getDisplayMedia) return notify('当前浏览器不支持桌面截图，请使用 Chrome 或 Edge 打开本地页面。');
  const generation = ++capture.generation;
  if (capture.loading) $('#image-name').textContent = '';
  capture.loading = false;
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
    showCapture(image, '已截取桌面画面');
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
document.addEventListener('paste', (event) => {
  const items = Array.from(event.clipboardData?.items || []);
  const target = event.target;
  const editable = target instanceof Element && (target.matches('input, textarea') || target.isContentEditable);
  if (editable && items.some((item) => item.kind === 'string' && item.type === 'text/plain')) return;
  const imageItem = items.find((item) => item.kind === 'file' && item.type.startsWith('image/'));
  if (!imageItem || (document.querySelector('dialog[open]') && !$('#upload-dialog').open)) return;
  event.preventDefault();
  if (state.recognizing) return notify('截图识别进行中，请稍后粘贴。');
  const file = imageItem.getAsFile();
  if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return notify('仅支持粘贴 PNG、JPEG 或 WebP 截图。');
  if (!file.size || file.size > 20 * 1024 * 1024) return notify('粘贴的截图为空或超过 20 MB。');
  if (!$('#upload-dialog').open) $('#upload-dialog').showModal();
  resetCapture();
  const generation = capture.generation;
  capture.loading = true;
  $('#image-input').value = '';
  $('#image-name').textContent = '正在读取粘贴的截图…';
  $('#recognition-results').replaceChildren();
  const reader = new FileReader();
  reader.onload = () => {
    if (generation !== capture.generation || !$('#upload-dialog').open) return;
    const image = new Image();
    image.onload = () => {
      if (generation !== capture.generation || !$('#upload-dialog').open) return;
      capture.loading = false;
      if (!image.width || !image.height || image.width * image.height > 40000000) {
        $('#image-name').textContent = '';
        return notify('截图尺寸无效或超过 4000 万像素，请缩小后重试。');
      }
      showCapture(image, '已粘贴截图，请预览后手动发送');
    };
    image.onerror = () => {
      if (generation !== capture.generation) return;
      capture.loading = false;
      $('#image-name').textContent = '';
      notify('粘贴的截图无法解码，请重试。');
    };
    image.src = reader.result;
  };
  reader.onerror = () => {
    if (generation !== capture.generation) return;
    capture.loading = false;
    $('#image-name').textContent = '';
    notify('无法读取粘贴的截图，请重试。');
  };
  reader.readAsDataURL(file);
});
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
  if (capture.loading) return notify('截图正在读取，请稍候。');
  const file = $('#image-input').files[0];
  if (!file && !capture.image) return notify('请先截取、粘贴或选择截图。');
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
  if (state.busy || state.recognizing || state.saving) return notify('请等待对话、截图识别或保存完成后再同步。');
  if (editorIsDirty() || teamTacticsIsDirty()) return notify('请先保存或撤销位置及球队战术中的修改，再进行同步。');
  const importButton = $('#sync-import');
  const exportButton = $('#sync-export');
  importButton.disabled = true;
  exportButton.disabled = true;
  try {
    const info = await api('/api/sync');
    let allowLegacyTactics = false;
    let allowLegacySubstitutes = false;
    if (action === 'import') {
      if (!info.exists) throw new Error('没有同步文件，请先从 Git 拉取。');
      const warning = info.data_changed ? '本机阵容或球员可能有未导出的修改。' : '';
      if (!window.confirm(`${warning}导入将替换本机已保存的阵容和球员缓存，密钥不会改变。继续吗？`)) return;
      if (info.legacy_tactics_conflict) {
        allowLegacyTactics = window.confirm('旧版同步文件没有个人或球队战术。导入将清除本机已保存的战术，变为未设置。确认继续吗？');
        if (!allowLegacyTactics) return;
      }
      if (info.legacy_substitutes_conflict) {
        allowLegacySubstitutes = window.confirm('旧版同步文件没有替补席位。导入将清空本机已保存的替补球员，确认继续吗？');
        if (!allowLegacySubstitutes) return;
      }
    }
    let force = false;
    if (action === 'export' && info.file_changed) {
      force = window.confirm('同步文件有尚未导入的变更。导出将覆盖该文件，建议先导入或备份。仍要覆盖吗？');
      if (!force) return;
    }
    await post(`/api/sync/${action}`, { file_hash: info.file_hash, data_hash: info.data_hash, force, allow_legacy_tactics: allowLegacyTactics, allow_legacy_substitutes: allowLegacySubstitutes });
    if (action === 'import') {
      state.squad = await api('/api/squad');
      await reloadPlayers();
      renderPitch();
      renderEditor();
      renderTeamTactics();
      state.messages = [];
      notify('同步数据已导入；对话上下文已清空。');
    } else notify('同步数据已导出，请检查文件后自行提交并推送。');
  } catch (error) { notify(error.message); }
  finally { exportButton.disabled = false; await refreshSettings().catch((error) => notify(error.message)); }
}
$('#sync-import').addEventListener('click', () => runSync('import'));
$('#sync-export').addEventListener('click', () => runSync('export'));
renderModel();
if (!modelStorageAvailable) notify('浏览器存储不可用，无法恢复上次的模型选择；当前默认使用 OpenAI。');
initialize();
