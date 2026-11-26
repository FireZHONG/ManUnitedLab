import html
import http.cookiejar
import json
import re
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urlencode, urlparse

BASE_URL = 'https://cn.fifaaddict.com'
USER_AGENT = 'FCOnlineLocalAssistant/1.0 (personal use)'


class MetaParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.description = ''
        self.title = ''
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == 'meta' and attributes.get('name') == 'description':
            self.description = attributes.get('content', '')
        if tag == 'title':
            self.in_title = True

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def player_id(value):
    value = value.strip()
    if re.fullmatch(r'[a-z0-9]{5,20}', value):
        return value
    parsed = urlparse(value)
    if parsed.scheme != 'https' or parsed.netloc.lower() != 'cn.fifaaddict.com':
        raise ValueError('请输入 cn.fifaaddict.com 的球员详情链接。')
    match = re.fullmatch(r'/fo4db/pid([a-z0-9]{5,20})/?', parsed.path)
    if not match:
        raise ValueError('链接格式不正确，请粘贴球员详情页链接。')
    return match.group(1)


SEARCH_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'


def search_players(query):
    query = query.strip()
    if not query:
        raise ValueError('请输入球员名称。')
    search_query = urlencode({'playername': query})
    parameters = urlencode({'q': 'fo4db', 'playername': query, 'locale': 'cn'})
    request = urllib.request.Request(f'{BASE_URL}/api2?{parameters}', headers={
        'User-Agent': SEARCH_USER_AGENT,
        'Accept': 'application/json',
        'Referer': f'{BASE_URL}/fo4db?{search_query}',
        'X-Requested-With': 'XMLHttpRequest',
    })
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=15) as response:
            raw = response.read(2_000_001)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise ValueError('无法访问 FIFA Addict 搜索，请检查网络或稍后重试。') from exc
    if len(raw) > 2_000_000:
        raise ValueError('搜索结果过大，请输入更精确的名称。')
    try:
        payload = json.loads(raw.decode('utf-8'))
        items = payload['db']
        if not isinstance(items, list):
            raise ValueError('invalid results')
    except (UnicodeDecodeError, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        raise ValueError('FIFA Addict 返回的数据格式无法识别，请稍后重试。') from exc
    players = []
    for item in items:
        if not isinstance(item, dict):
            continue
        identifier = item.get('uid')
        name = item.get('name')
        if not isinstance(identifier, str) or not re.fullmatch(r'[a-z0-9]{5,20}', identifier) or not isinstance(name, str) or not name.strip():
            continue
        season = item.get('year_short')
        position = item.get('pos')
        ovr = item.get('attrB')
        salary = item.get('attrA')
        preferred_foot = item.get('foot_pref')
        foot_values = [str(item.get(field, '')) for field in ('foot_left', 'foot_right')]
        left_foot, right_foot = [int(value) if value in ('1', '2', '3', '4', '5') else None for value in foot_values]
        players.append({'id': identifier, 'name': name[:100], 'season': season[:100] if isinstance(season, str) else '',
                        'position': position[:12] if isinstance(position, str) else '',
                        'ovr': ovr if type(ovr) is int and 0 <= ovr <= 1000 else None,
                        'salary': salary if type(salary) is int and 0 <= salary <= 1000 else None,
                        'preferred_foot': preferred_foot if preferred_foot in ('left', 'right') else None,
                        'left_foot': left_foot, 'right_foot': right_foot})
    if items and not players:
        raise ValueError('FIFA Addict 搜索结果格式发生变化，请稍后重试。')
    warning = ''
    if len(query.encode('utf-8')) < 3:
        players = [player for player in players if query.casefold() in player['name'].casefold()]
        warning = '数据源可能忽略过短的英文搜索词；这里只筛选了默认结果，可能不完整。'
    return {'players': players[:100], 'truncated': len(players) > 100, 'warning': warning}


def first(pattern, text, default=None):
    match = re.search(pattern, text)
    return match.group(1) if match else default


def fetch_full_detail(identifier):
    opener = urllib.request.build_opener(NoRedirect, urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    headers = {'User-Agent': SEARCH_USER_AGENT, 'Accept': 'application/json',
               'Referer': f'{BASE_URL}/fo4db/pid{identifier}', 'X-Requested-With': 'XMLHttpRequest',
               'Cache-Control': 'no-store'}
    try:
        handshake = urllib.request.Request(f'{BASE_URL}/api2?{urlencode({"rq": "araiwa", "t": uuid.uuid4().hex})}', headers=headers)
        with opener.open(handshake, timeout=15) as response:
            token = response.read(1025).decode('ascii').strip()
        if not re.fullmatch(r'[a-f0-9]{64}', token):
            raise ValueError('FIFA Addict 详情会话无效，请稍后重试。')
        headers['X-ARAIWA'] = token
        parameters = urlencode({'fo4pid': f'pid{identifier}', 'locale': 'cn'})
        with opener.open(urllib.request.Request(f'{BASE_URL}/api2?{parameters}', headers=headers), timeout=15) as response:
            raw = response.read(2_000_001)
        if len(raw) > 2_000_000:
            raise ValueError('球员完整详情过大，无法安全解析。')
        payload = json.loads(raw.decode('utf-8'))
    except (urllib.error.URLError, TimeoutError, OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError('无法获取球员完整详情，数据源可能暂时不可用，请稍后重试。') from exc
    if not isinstance(payload, dict) or not isinstance(payload.get('db'), dict) or payload['db'].get('uid') != identifier or not isinstance(payload.get('attr'), dict) or not payload['attr'] or 'traits' not in payload or 'clubcareer' not in payload['db']:
        raise ValueError('球员完整详情格式发生变化，请稍后重试。')
    return payload


def parse_full_detail(payload):
    if len(payload['attr']) > 200:
        raise ValueError('球员能力值过多，无法安全解析。')
    attributes = {}
    for key, item in payload['attr'].items():
        if not isinstance(item, dict) or not isinstance(item.get('name'), str) or not item['name'].strip() or type(item.get('value')) is not int or not 0 <= item['value'] <= 1000:
            raise ValueError('球员能力值格式发生变化，请稍后重试。')
        name = 'GK扑救' if key == 'gkdiving' and item['name'] == 'GK手控球' else item['name'].strip()
        if name in attributes:
            name = f'{name} ({key})'
        if len(name) > 100:
            raise ValueError('球员能力值名称过长。')
        attributes[name] = item['value']
    source_traits = payload.get('traits') or {}
    if not isinstance(source_traits, dict) or len(source_traits) > 200:
        raise ValueError('球员特殊能力格式发生变化，请稍后重试。')
    trait_details = []
    for item in source_traits.values():
        if not isinstance(item, dict):
            raise ValueError('球员特殊能力格式发生变化，请稍后重试。')
        icon_id = str(item.get('id', ''))
        name, effect = item.get('name'), item.get('desc')
        if not re.fullmatch(r'\d{1,6}', icon_id) or not isinstance(name, str) or not name.strip() or len(name) > 200 or not isinstance(effect, str) or len(effect) > 2000:
            raise ValueError('球员特殊能力格式发生变化，请稍后重试。')
        trait_details.append({'id': icon_id, 'name': name.strip(), 'effect': effect.strip()})
    db = payload['db']
    profile = {}
    for field in ('birthdate', 'age', 'number', 'nation_name', 'league_name', 'bodytype_name', 'skill_level', 'workrate_att', 'workrate_def', 'reputation'):
        value = db.get(field)
        if value is not None and not isinstance(value, (str, int)):
            raise ValueError('球员基本资料格式发生变化，请稍后重试。')
        if value is not None and str(value).strip():
            profile[field] = str(value).strip()[:200]
    source_career = db.get('clubcareer') or {}
    if not isinstance(source_career, (dict, list)) or len(source_career) > 200:
        raise ValueError('球员俱乐部经历格式发生变化，请稍后重试。')
    career = []
    for item in (source_career.values() if isinstance(source_career, dict) else source_career):
        if not isinstance(item, dict) or not isinstance(item.get('year'), str) or not isinstance(item.get('teamname'), str) or type(item.get('loan', False)) is not bool:
            raise ValueError('球员俱乐部经历格式发生变化，请稍后重试。')
        career.append({'year': item['year'][:100], 'team': item['teamname'][:200], 'loan': item.get('loan', False)})
    return attributes, trait_details, profile, career


def fetch_player(value):
    identifier = player_id(value)
    url = f'{BASE_URL}/fo4db/pid{identifier}'
    request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'text/html'})
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=15) as response:
            raw = response.read(2_000_001)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise ValueError('无法访问球员详情，请检查网络或稍后重试。') from exc
    if len(raw) > 2_000_000:
        raise ValueError('球员页面过大，无法安全解析。')
    text = raw.decode('utf-8', errors='replace')
    parser = MetaParser()
    parser.feed(text)
    description = html.unescape(parser.description).strip()
    match = re.match(r'(.+?)（(.+?)），', description)
    ovr = first(r'总评\(OVR\)为(\d+)', description)
    if not match or not ovr or 'foPlayerSSRdb' not in text:
        raise ValueError('球员页面结构发生变化或数据不完整，请核对链接。')
    primary_position = first(r'司职([^，。]+)', description, '未知')
    team = first(r'效力于\s*(.+?)\s*俱乐部', description, '')
    height = first(r'身高(\d+)厘米', description)
    weight = first(r'体重(\d+)公斤', description)
    weak_foot = first(r'逆足\s*(\d)', description)
    salary = first(r'<span\b[^>]*class="[^"]*\binfo\s+fp\b[^"]*"[^>]*>\s*<i[^>]*></i>\s*<b\b[^>]*>(\d+)</b>', text)
    preferred_foot = None
    left_foot = None
    right_foot = None
    for row in re.findall(r'<tr\b[^>]*>.*?</tr>', text, re.DOTALL):
        if f'href="/fo4db/pid{identifier}"' in row:
            preferred_foot = first(r'\bfootpref_(left|right)\b', row)
            left_foot = first(r'<b\b[^>]*class="[^"]*\bfoot_left\b[^"]*"[^>]*>\s*([1-5])\s*</b>', row)
            right_foot = first(r'<b\b[^>]*class="[^"]*\bfoot_right\b[^"]*"[^>]*>\s*([1-5])\s*</b>', row)
            break
    attributes, trait_details, profile, career = parse_full_detail(fetch_full_detail(identifier))
    return {
        'id': identifier,
        'name': match.group(1),
        'season': match.group(2),
        'ovr': int(ovr),
        'position': primary_position,
        'club': team,
        'height_cm': int(height) if height else None,
        'weight_kg': int(weight) if weight else None,
        'weak_foot': int(weak_foot) if weak_foot else None,
        'salary': int(salary) if salary and int(salary) <= 1000 else None,
        'preferred_foot': preferred_foot,
        'left_foot': int(left_foot) if left_foot else None,
        'right_foot': int(right_foot) if right_foot else None,
        'attributes': attributes,
        'attributes_note': '能力为数据源提供的基础值，未计算强化、等级或队套加成。',
        'traits': [trait['name'] for trait in trait_details],
        'trait_details': trait_details,
        'profile': profile,
        'club_career': career,
        'description': description,
        'source_url': url,
        'fetched_at': datetime.now(timezone.utc).isoformat(),
        'data_note': '第三方中文站数据，非国服官方实时数据；未计算强化及队套加成。',
    }
